using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Movers.Api.Contracts.Tenants;

namespace Movers.Api.Tests;

public sealed class EmployeeApiTests : IAsyncLifetime
{
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"movers-employees-{Guid.NewGuid():N}.db");
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
    public async Task Tenant_can_manage_designations_and_valid_employee_hierarchy()
    {
        await LoginAndSelectTenantAsync();
        var director = await CreateDesignationAsync("DIRECTOR", "Director", 1);
        var manager = await CreateDesignationAsync("MANAGER", "Manager", 2);
        var executive = await CreateDesignationAsync("EXEC", "Executive", 3);

        var lead = await CreateEmployeeAsync("EMP-001", "Asha", "Rao", director.Id, null);
        var supervisor = await CreateEmployeeAsync("EMP-002", "Bilal", "Khan", manager.Id, lead.Id);
        var teamMember = await CreateEmployeeAsync("EMP-003", "Chen", "Das", executive.Id, supervisor.Id);

        var employees = await _client.GetFromJsonAsync<List<EmployeeResponse>>("/api/employees");
        Assert.NotNull(employees);
        Assert.Equal([teamMember.Id, supervisor.Id, lead.Id], employees.Select(x => x.Id));
        Assert.Equal("Bilal Khan", employees[0].ReportsToName);

        var hierarchy = await _client.GetFromJsonAsync<List<HierarchyResponse>>("/api/employees/hierarchy");
        var root = Assert.Single(hierarchy!);
        Assert.Equal(lead.Id, root.Id);
        Assert.Equal(supervisor.Id, Assert.Single(root.DirectReports).Id);
        Assert.Equal(teamMember.Id, Assert.Single(root.DirectReports[0].DirectReports).Id);

        var invalidManager = await _client.PutAsJsonAsync($"/api/employees/{lead.Id}", new
        {
            employeeNumber = "EMP-001", firstName = "Asha", lastName = "Rao",
            workEmail = "asha@example.test", phone = "100", joiningDate = "2026-01-01",
            designationId = director.Id, reportsToEmployeeId = teamMember.Id
        });
        Assert.Equal(HttpStatusCode.BadRequest, invalidManager.StatusCode);

        var duplicateNumber = await _client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = "emp-003", firstName = "Duplicate", lastName = "Number",
            workEmail = (string?)null, phone = (string?)null, joiningDate = "2026-01-01",
            designationId = executive.Id, reportsToEmployeeId = supervisor.Id
        });
        Assert.Equal(HttpStatusCode.OK, duplicateNumber.StatusCode); // Supplied numbers are ignored.

        var audit = await _client.GetFromJsonAsync<List<AuditResponse>>("/api/security/audit");
        Assert.Contains(audit!, x => x.EntityType == "Employee" && x.ActorEmail == "admin@movers.local");
        Assert.Contains(audit!, x => x.EntityType == "Designation");
    }

    private async Task LoginAndSelectTenantAsync()
    {
        var login = await _client.PostAsJsonAsync("/api/auth/login", new
            { email = "admin@movers.local", password = "ChangeMe123!" });
        login.EnsureSuccessStatusCode();
        SetToken(await login.Content.ReadFromJsonAsync<LoginResponse>());

        var tenantResponse = await _client.PostAsJsonAsync("/api/platform/tenants",
            new SaveTenantRequest("People Test", "people-test", null, null, null));
        tenantResponse.EnsureSuccessStatusCode();
        var tenant = (await tenantResponse.Content.ReadFromJsonAsync<TenantResponse>())!;
        var selected = await _client.PostAsJsonAsync("/api/auth/select-tenant", new { tenantId = tenant.Id });
        selected.EnsureSuccessStatusCode();
        SetToken(await selected.Content.ReadFromJsonAsync<LoginResponse>());
    }

    private async Task<DesignationResponse> CreateDesignationAsync(string code, string name, int level)
    {
        var response = await _client.PostAsJsonAsync("/api/designations", new
            { code, name, level, description = $"{name} designation" });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<DesignationResponse>())!;
    }

    private async Task<EmployeeResponse> CreateEmployeeAsync(
        string number, string firstName, string lastName, Guid designationId, Guid? reportsToEmployeeId)
    {
        var response = await _client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = number, firstName, lastName,
            workEmail = $"{firstName.ToLowerInvariant()}@example.test", phone = "100",
            joiningDate = "2026-01-01", designationId, reportsToEmployeeId
        });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<EmployeeResponse>())!;
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
    private sealed record DesignationResponse(Guid Id);
    private sealed record EmployeeResponse(Guid Id, string? ReportsToName);
    private sealed record HierarchyResponse(Guid Id, List<HierarchyResponse> DirectReports);
    private sealed record AuditResponse(string ActorEmail, string EntityType);
}
