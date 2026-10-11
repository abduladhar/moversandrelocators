using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Movers.Api.Contracts.Tenants;

namespace Movers.Api.Tests;

public sealed class TenantApiTests : IAsyncLifetime
{
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"movers-tests-{Guid.NewGuid():N}.db");
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
    public async Task Tenant_lifecycle_is_resolved_and_inactive_tenant_is_rejected()
    {
        await LoginAsync();
        var input = new SaveTenantRequest("Northstar Relocations", "northstar", "ops@northstar.test", "+91 90000", "Bengaluru");
        var create = await _client.PostAsJsonAsync("/api/platform/tenants", input);
        Assert.True(create.StatusCode == HttpStatusCode.Created, await create.Content.ReadAsStringAsync());
        var tenant = await create.Content.ReadFromJsonAsync<TenantResponse>();
        Assert.NotNull(tenant);
        Assert.True(tenant.SerialNo > 0);

        var secondCreate = await _client.PostAsJsonAsync("/api/platform/tenants",
            new SaveTenantRequest("Newest Relocations", "newest", null, null, null));
        var newest = await secondCreate.Content.ReadFromJsonAsync<TenantResponse>();
        Assert.Equal(HttpStatusCode.Created, secondCreate.StatusCode);
        Assert.NotNull(newest);
        Assert.True(newest.SerialNo > tenant.SerialNo);

        var listed = await _client.GetFromJsonAsync<List<TenantResponse>>("/api/platform/tenants");
        Assert.NotNull(listed);
        Assert.Equal(newest.Id, listed[0].Id);

        await SelectTenantAsync(tenant.Id);
        var current = await _client.GetAsync("/api/tenant/current");
        Assert.Equal(HttpStatusCode.OK, current.StatusCode);

        var duplicate = await _client.PostAsJsonAsync("/api/platform/tenants", input);
        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);

        var disabled = await _client.PatchAsJsonAsync($"/api/platform/tenants/{tenant.Id}/status", new SetTenantStatusRequest(false));
        Assert.Equal(HttpStatusCode.OK, disabled.StatusCode);

        var inactive = await _client.GetAsync("/api/tenant/current");
        Assert.Equal(HttpStatusCode.BadRequest, inactive.StatusCode);
    }

    [Fact]
    public async Task Tenant_scoped_endpoint_requires_selected_tenant()
    {
        await LoginAsync();
        var response = await _client.GetAsync("/api/tenant/current");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private async Task LoginAsync()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email = "admin@movers.local",
            password = "ChangeMe123!"
        });
        response.EnsureSuccessStatusCode();
        var login = await response.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(login);
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.AccessToken);
    }

    private async Task SelectTenantAsync(Guid tenantId)
    {
        var response = await _client.PostAsJsonAsync("/api/auth/select-tenant", new { tenantId });
        response.EnsureSuccessStatusCode();
        var login = await response.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(login);
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.AccessToken);
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
        SqliteConnection.ClearAllPools();
        if (File.Exists(_databasePath)) File.Delete(_databasePath);
    }

    private sealed record LoginResponse(string AccessToken);
}
