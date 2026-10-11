using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Movers.Api.Contracts.Tenants;

namespace Movers.Api.Tests;

public sealed class SecurityApiTests : IAsyncLifetime
{
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"movers-security-{Guid.NewGuid():N}.db");
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
    public async Task System_admin_can_enter_tenant_while_tenant_admin_is_isolated_and_changes_are_audited()
    {
        await LoginAsync("admin@movers.local", "ChangeMe123!", HttpStatusCode.OK);
        var first = await CreateTenantAsync("First Company", "first-company");
        var second = await CreateTenantAsync("Second Company", "second-company");

        var selected = await _client.PostAsJsonAsync("/api/auth/select-tenant", new { tenantId = first.Id });
        Assert.Equal(HttpStatusCode.OK, selected.StatusCode);
        SetToken(await selected.Content.ReadFromJsonAsync<LoginResponse>());

        var roles = await _client.GetFromJsonAsync<List<RoleResponse>>("/api/security/roles");
        var tenantAdmin = Assert.Single(roles!, x => x.Code == "TENANT_ADMIN");
        var designationResponse = await _client.PostAsJsonAsync("/api/designations", new { code = "ADMIN", name = "Administrator", level = 1, description = "Tenant administrator", isSalesman = false });
        designationResponse.EnsureSuccessStatusCode();
        var designation = (await designationResponse.Content.ReadFromJsonAsync<IdResponse>())!;
        var employeeResponse = await _client.PostAsJsonAsync("/api/employees", new { employeeNumber = "EMP-ADMIN", firstName = "First", lastName = "Administrator", workEmail = "tenant.admin@example.test", phone = "100", joiningDate = "2026-01-01", designationId = designation.Id, reportsToEmployeeId = (Guid?)null });
        employeeResponse.EnsureSuccessStatusCode();
        var employee = (await employeeResponse.Content.ReadFromJsonAsync<IdResponse>())!;
        var createUser = await _client.PostAsJsonAsync("/api/security/users", new
        {
            fullName = "First Tenant Admin",
            email = "tenant.admin@example.test",
            password = "SecurePass123!",
            roleId = tenantAdmin.Id,
            employeeId = employee.Id
        });
        Assert.Equal(HttpStatusCode.Created, createUser.StatusCode);
        var createdUser = (await createUser.Content.ReadFromJsonAsync<UserLinkResponse>())!;
        var replacementResponse = await _client.PostAsJsonAsync("/api/employees", new { employeeNumber = "EMP-ADMIN-2", firstName = "Replacement", lastName = "Administrator", workEmail = "replacement@example.test", phone = "101", joiningDate = "2026-01-01", designationId = designation.Id, reportsToEmployeeId = (Guid?)null });
        replacementResponse.EnsureSuccessStatusCode();
        var replacement = (await replacementResponse.Content.ReadFromJsonAsync<IdResponse>())!;
        var linkedResponse = await _client.PatchAsJsonAsync($"/api/security/users/{createdUser.Id}/employee", new { employeeId = replacement.Id });
        linkedResponse.EnsureSuccessStatusCode();
        var linkedUser = (await linkedResponse.Content.ReadFromJsonAsync<UserLinkResponse>())!;
        Assert.Equal(replacement.Id, linkedUser.EmployeeId);
        Assert.Equal("Replacement Administrator", linkedUser.EmployeeName);

        var audit = await _client.GetFromJsonAsync<List<AuditResponse>>("/api/security/audit");
        Assert.Contains(audit!, x => x.EntityType == "User" && x.ActorEmail == "admin@movers.local");

        var selectSecond = await _client.PostAsJsonAsync("/api/auth/select-tenant", new { tenantId = second.Id });
        selectSecond.EnsureSuccessStatusCode();
        SetToken(await selectSecond.Content.ReadFromJsonAsync<LoginResponse>());
        var secondRoles = await _client.GetFromJsonAsync<List<RoleResponse>>("/api/security/roles");
        var secondTenantAdmin = Assert.Single(secondRoles!, x => x.Code == "TENANT_ADMIN");
        var duplicateEmail = await _client.PostAsJsonAsync("/api/security/users", new
        {
            fullName = "Duplicate Email",
            email = "tenant.admin@example.test",
            password = "SecurePass123!",
            roleId = secondTenantAdmin.Id,
            employeeId = Guid.NewGuid()
        });
        Assert.Equal(HttpStatusCode.BadRequest, duplicateEmail.StatusCode);

        await LoginAsync("tenant.admin@example.test", "SecurePass123!", HttpStatusCode.OK);
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync("/api/security/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.GetAsync("/api/platform/tenants")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await _client.PostAsJsonAsync("/api/auth/select-tenant", new { tenantId = second.Id })).StatusCode);
    }

    [Fact]
    public async Task Invalid_password_is_rejected()
    {
        await LoginAsync("admin@movers.local", "wrong-password", HttpStatusCode.Unauthorized);
    }

    private async Task<TenantResponse> CreateTenantAsync(string name, string slug)
    {
        var response = await _client.PostAsJsonAsync("/api/platform/tenants",
            new SaveTenantRequest(name, slug, null, null, null));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<TenantResponse>())!;
    }

    private async Task LoginAsync(string email, string password, HttpStatusCode expected)
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new { email, password });
        Assert.Equal(expected, response.StatusCode);
        if (response.IsSuccessStatusCode) SetToken(await response.Content.ReadFromJsonAsync<LoginResponse>());
    }

    private void SetToken(LoginResponse? response)
    {
        Assert.NotNull(response);
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", response.AccessToken);
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
        SqliteConnection.ClearAllPools();
        if (File.Exists(_databasePath)) File.Delete(_databasePath);
    }

    private sealed record LoginResponse(string AccessToken);
    private sealed record RoleResponse(Guid Id, string Code);
    private sealed record AuditResponse(string ActorEmail, string EntityType);
    private sealed record IdResponse(Guid Id);
    private sealed record UserLinkResponse(Guid Id, Guid? EmployeeId, string? EmployeeName);
}
