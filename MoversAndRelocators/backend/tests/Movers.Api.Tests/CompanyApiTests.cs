using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Movers.Api.Contracts.Tenants;
using Movers.DAL.Persistence;
using Movers.Domain.Common;

namespace Movers.Api.Tests;

/// <summary>Companies inside a tenant: company records are separate, masters are shared, and only tenant users switch.</summary>
public sealed class CompanyApiTests : IAsyncLifetime
{
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"movers-company-{Guid.NewGuid():N}.db");
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public Task InitializeAsync()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Database:Provider", "Sqlite");
            builder.UseSetting("ConnectionStrings:Sqlite", $"Data Source={_databasePath}");
        });
        _client = _factory.CreateClient();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task Company_records_are_separate_masters_are_shared_and_only_tenant_users_switch()
    {
        // A new tenant starts with one default company, and the session opens in it.
        var main = await LoginAndSelectTenantAsync();
        Assert.NotNull(main.CompanyId);
        Assert.True(main.CanSwitchCompany);
        var mainCompany = Assert.Single(main.Companies!);
        Assert.Equal("MAIN", mainCompany.Code);

        var statuses = await _client.GetFromJsonAsync<List<CodeResponse>>("/api/sales/statuses/leads");
        var moveTypes = await _client.GetFromJsonAsync<List<CodeResponse>>("/api/sales/statuses/move-types");
        var statusId = statuses!.Single(x => x.Code == "NEW").Id; var moveTypeId = moveTypes!.Single(x => x.Code == "HOUSEHOLD").Id;
        var designation = await Read<IdResponse>(await _client.PostAsJsonAsync("/api/designations", new { code = "SALES", name = "Sales", level = 2, description = "Sales" }));
        var seller = await CreateEmployeeAsync(designation.Id, "admin@movers.local");
        var mainLead = await CreateLeadAsync("Main customer", statusId, moveTypeId, seller);
        Assert.Matches(@"^LD-\d{8}-\d{6}$", mainLead.LeadNumber);

        // A second company needs its own number code because MAIN already uses the plain numbers.
        var noCode = await _client.PostAsJsonAsync("/api/companies", new { code = "DXB", name = "Dubai Branch" });
        Assert.Equal(HttpStatusCode.BadRequest, noCode.StatusCode);
        var dubai = await Read<CompanyResponse>(await _client.PostAsJsonAsync("/api/companies", new { code = "DXB", name = "Dubai Branch", numberCode = "dxb", taxNumber = "TRN-100" }));
        Assert.Equal("DXB", dubai.NumberCode);
        Assert.False(dubai.IsDefault);
        Assert.Equal(2, (await _client.GetFromJsonAsync<List<CompanyResponse>>("/api/companies"))!.Count);

        // Switching: the other company's records are invisible and cannot be changed; masters are shared.
        var switched = await Read<SessionResponse>(await _client.PostAsJsonAsync("/api/auth/select-company", new { companyId = dubai.Id }));
        Assert.Equal(dubai.Id, switched.CompanyId);
        SetToken(switched);
        Assert.Empty((await _client.GetFromJsonAsync<List<LeadResponse>>("/api/sales/leads"))!);
        Assert.Contains((await _client.GetFromJsonAsync<List<IdResponse>>("/api/employees"))!, x => x.Id == seller);
        var update = await _client.PutAsJsonAsync($"/api/sales/leads/{mainLead.Id}", LeadRequest("Hijacked", statusId, moveTypeId, seller));
        Assert.Equal(HttpStatusCode.NotFound, update.StatusCode);
        var dubaiLead = await CreateLeadAsync("Dubai customer", statusId, moveTypeId, seller);
        Assert.Matches(@"^LD-DXB-\d{8}-\d{6}$", dubaiLead.LeadNumber);
        Assert.Equal(dubaiLead.Id, Assert.Single((await _client.GetFromJsonAsync<List<LeadResponse>>("/api/sales/leads"))!).Id);
        var current = await _client.GetFromJsonAsync<CompanyResponse>("/api/companies/current");
        Assert.Equal("DXB", current!.Code);

        // Masters: shared by default; a record marked for one company disappears from the others.
        var scopes = await _client.GetFromJsonAsync<ScopeResponse>("/api/master-scopes/customer");
        Assert.True(scopes!.Enabled);
        Assert.Empty(scopes.CompanyOnly);
        var dubaiCustomer = await Read<MasterResponse>(await _client.PostAsJsonAsync("/api/business-masters/customer", new { name = "Dubai only customer", isActive = true }));
        var sharedCustomer = await Read<MasterResponse>(await _client.PostAsJsonAsync("/api/business-masters/customer", new { name = "Group customer", isActive = true }));
        Assert.Equal(HttpStatusCode.NoContent, (await _client.PutAsJsonAsync($"/api/master-scopes/customer/{dubaiCustomer.Code}", new { companyOnly = true })).StatusCode);
        Assert.Equal([dubaiCustomer.Code], (await _client.GetFromJsonAsync<ScopeResponse>("/api/master-scopes/customer"))!.CompanyOnly);
        Assert.Equal(HttpStatusCode.NoContent, (await _client.PutAsJsonAsync($"/api/master-scopes/employee/{seller}", new { companyOnly = true })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await _client.PutAsJsonAsync($"/api/master-scopes/employee/{seller}", new { companyOnly = false })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.PutAsJsonAsync("/api/master-scopes/customer/NOPE", new { companyOnly = true })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/master-scopes/unknown")).StatusCode);

        SetToken(await Read<SessionResponse>(await _client.PostAsJsonAsync("/api/auth/select-company", new { companyId = main.CompanyId })));
        Assert.Equal(mainLead.Id, Assert.Single((await _client.GetFromJsonAsync<List<LeadResponse>>("/api/sales/leads"))!).Id);
        var mainCustomers = (await _client.GetFromJsonAsync<List<MasterResponse>>("/api/business-masters/customer"))!.Select(x => x.Code).ToList();
        Assert.Contains(sharedCustomer.Code, mainCustomers);
        Assert.DoesNotContain(dubaiCustomer.Code, mainCustomers);
        Assert.False((await _client.PutAsJsonAsync($"/api/business-masters/customer/{dubaiCustomer.Code}", new { name = "Taken over", isActive = true })).IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.PutAsJsonAsync($"/api/master-scopes/customer/{dubaiCustomer.Code}", new { companyOnly = false })).StatusCode);
        Assert.Contains((await _client.GetFromJsonAsync<List<IdResponse>>("/api/employees"))!, x => x.Id == seller);

        // A company user works only in their own company: no switching and no company management.
        var roles = await _client.GetFromJsonAsync<List<RoleResponse>>("/api/security/roles");
        var adminRole = roles!.Single(x => x.Code == "TENANT_ADMIN");
        var clerk = await CreateEmployeeAsync(designation.Id, "clerk@example.test");
        var created = await Read<UserResponse>(await _client.PostAsJsonAsync("/api/security/users",
            new { fullName = "Dubai Clerk", email = "clerk@example.test", password = "ClerkPass123!", roleId = adminRole.Id, employeeId = clerk, companyId = dubai.Id }));
        Assert.Equal(dubai.Id, created.CompanyId);
        Assert.Equal("Dubai Branch", created.CompanyName);

        var admin = _client.DefaultRequestHeaders.Authorization;
        var clerkSession = await Read<SessionResponse>(await _client.PostAsJsonAsync("/api/auth/login", new { email = "clerk@example.test", password = "ClerkPass123!", companyId = main.CompanyId }));
        Assert.Equal(dubai.Id, clerkSession.CompanyId);
        Assert.False(clerkSession.CanSwitchCompany);
        Assert.Single(clerkSession.Companies!);
        SetToken(clerkSession);
        Assert.Equal(dubaiLead.Id, Assert.Single((await _client.GetFromJsonAsync<List<LeadResponse>>("/api/sales/leads"))!).Id);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.PostAsJsonAsync("/api/auth/select-company", new { companyId = main.CompanyId })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.PostAsJsonAsync("/api/companies", new { code = "AUH", name = "Abu Dhabi", numberCode = "AUH" })).StatusCode);
        var visibleUsers = await _client.GetFromJsonAsync<List<UserResponse>>("/api/security/users");
        Assert.All(visibleUsers!, x => Assert.Equal(dubai.Id, x.CompanyId));

        // Deactivating the company locks its users out; the default company cannot be deactivated.
        _client.DefaultRequestHeaders.Authorization = admin;
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PatchAsJsonAsync($"/api/companies/{main.CompanyId}/status", new { isActive = false })).StatusCode);
        (await _client.PatchAsJsonAsync($"/api/companies/{dubai.Id}/status", new { isActive = false })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.PostAsJsonAsync("/api/auth/login", new { email = "clerk@example.test", password = "ClerkPass123!" })).StatusCode);
        SetToken(clerkSession);
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.GetAsync("/api/sales/leads")).StatusCode);

        // Moving the clerk to MAIN applies at once, even with the old token.
        _client.DefaultRequestHeaders.Authorization = admin;
        (await _client.PatchAsJsonAsync($"/api/security/users/{created.Id}/company", new { companyId = main.CompanyId })).EnsureSuccessStatusCode();
        SetToken(clerkSession);
        Assert.Equal(mainLead.Id, Assert.Single((await _client.GetFromJsonAsync<List<LeadResponse>>("/api/sales/leads"))!).Id);
    }

    [Fact]
    public void Upgrade_script_covers_every_company_table_in_the_model()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MoversDbContext>();
        var owned = db.Model.GetEntityTypes().Where(x => typeof(TenantOwnedEntity).IsAssignableFrom(x.ClrType) && !MoversDbContext.SharedTypes.Contains(x.ClrType)).ToList();
        Assert.Equal(owned.Where(x => !MoversDbContext.OptionalCompanyTypes.Contains(x.ClrType)).Select(x => x.GetTableName()!).Order(StringComparer.Ordinal).ToList(),
            CompanySchema.CompanyTables.Order(StringComparer.Ordinal).ToList());
        Assert.Equal(owned.Where(x => MoversDbContext.OptionalCompanyTypes.Contains(x.ClrType)).Select(x => x.GetTableName()!).Order(StringComparer.Ordinal).ToList(),
            CompanySchema.OptionalCompanyTables.Order(StringComparer.Ordinal).ToList());
        var output = Environment.GetEnvironmentVariable("MOVERS_SCHEMA_OUTPUT");
        if (!string.IsNullOrWhiteSpace(output))
        {
            Directory.CreateDirectory(output);
            File.WriteAllText(Path.Combine(output, "sqlserver-034-companies.sql"), CompanySchema.SqlServer);
        }
    }

    private async Task<SessionResponse> LoginAndSelectTenantAsync()
    {
        SetToken(await Read<SessionResponse>(await _client.PostAsJsonAsync("/api/auth/login", new { email = "admin@movers.local", password = "ChangeMe123!" })));
        var tenant = await Read<TenantResponse>(await _client.PostAsJsonAsync("/api/platform/tenants", new SaveTenantRequest("Company Test", "company-test", null, null, null)));
        var selected = await Read<SessionResponse>(await _client.PostAsJsonAsync("/api/auth/select-tenant", new { tenantId = tenant.Id }));
        SetToken(selected);
        return selected;
    }

    private async Task<Guid> CreateEmployeeAsync(Guid designationId, string email) =>
        (await Read<IdResponse>(await _client.PostAsJsonAsync("/api/employees", new
        {
            firstName = "Test", lastName = email.Split('@')[0], workEmail = email, phone = "100", joiningDate = "2026-01-01",
            designationId, reportsToEmployeeId = (Guid?)null
        }))).Id;

    private async Task<LeadResponse> CreateLeadAsync(string customer, Guid statusId, Guid moveTypeId, Guid employeeId) =>
        await Read<LeadResponse>(await _client.PostAsJsonAsync("/api/sales/leads", LeadRequest(customer, statusId, moveTypeId, employeeId)));

    private static object LeadRequest(string customer, Guid statusId, Guid moveTypeId, Guid employeeId) => new
    {
        leadNumber = "AUTO", customerName = customer, phone = "+971 50 000 0000", email = "customer@example.test", source = "Website",
        moveTypeId, origin = "Dubai", destination = "Abu Dhabi", expectedMoveDate = "2026-10-15", statusId, assignedEmployeeId = employeeId, notes = "Company test"
    };

    private static async Task<T> Read<T>(HttpResponseMessage response)
    {
        if (!response.IsSuccessStatusCode) Assert.Fail($"{(int)response.StatusCode} {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }

    private void SetToken(SessionResponse session) => _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
        SqliteConnection.ClearAllPools();
        if (File.Exists(_databasePath)) File.Delete(_databasePath);
    }

    private sealed record SessionResponse(string AccessToken, Guid? CompanyId, string? CompanyName, List<CompanyOptionResponse>? Companies, bool CanSwitchCompany);
    private sealed record CompanyOptionResponse(Guid Id, string Code, string Name, bool IsDefault);
    private sealed record CompanyResponse(Guid Id, string Code, string Name, string? NumberCode, bool IsDefault, bool IsActive);
    private sealed record CodeResponse(Guid Id, string Code);
    private sealed record ScopeResponse(bool Enabled, string? CompanyName, List<string> CompanyOnly);
    private sealed record MasterResponse(string Code, string Name);
    private sealed record IdResponse(Guid Id);
    private sealed record LeadResponse(Guid Id, string LeadNumber);
    private sealed record RoleResponse(Guid Id, string Code);
    private sealed record UserResponse(Guid Id, Guid? CompanyId, string? CompanyName);
}
