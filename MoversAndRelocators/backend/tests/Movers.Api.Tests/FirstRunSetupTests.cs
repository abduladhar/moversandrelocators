using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Movers.Api.Contracts.Tenants;

namespace Movers.Api.Tests;

/// <summary>No bootstrap administrator configured: the first system administrator is created through setup.</summary>
public sealed class FirstRunSetupTests : IAsyncLifetime
{
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"movers-setup-{Guid.NewGuid():N}.db");
    private readonly List<WebApplicationFactory<Program>> _factories = [];

    private HttpClient Client(string? setupKey = null)
    {
        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Database:Provider", "Sqlite");
            builder.UseSetting("ConnectionStrings:Sqlite", $"Data Source={_databasePath}");
            builder.UseSetting("Bootstrap:SystemAdminEmail", "");
            builder.UseSetting("Bootstrap:SystemAdminPassword", "");
            if (setupKey is not null) builder.UseSetting("Setup:Key", setupKey);
        });
        _factories.Add(factory);
        return factory.CreateClient();
    }

    public Task InitializeAsync() => Task.CompletedTask;

    [Fact]
    public async Task First_system_admin_is_created_once_then_registers_a_tenant_and_its_users()
    {
        var client = Client();
        var status = await client.GetFromJsonAsync<JsonElement>("/api/setup/status");
        Assert.True(status.GetProperty("needsSetup").GetBoolean());
        Assert.True(status.GetProperty("enabled").GetBoolean());
        Assert.False(status.GetProperty("requiresKey").GetBoolean());
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new { email = "admin@movers.local", password = "ChangeMe123!" })).StatusCode);

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/setup/system-admin", new { fullName = "Owner", email = "owner@example.test", password = "short" })).StatusCode);
        var created = await client.PostAsJsonAsync("/api/setup/system-admin", new { fullName = "Platform Owner", email = "owner@example.test", password = "OwnerPass123!" });
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var session = await created.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(session.GetProperty("accessToken").GetString()));
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/setup/system-admin", new { fullName = "Intruder", email = "intruder@example.test", password = "IntruderPass123!" })).StatusCode);
        Assert.False((await client.GetFromJsonAsync<JsonElement>("/api/setup/status")).GetProperty("needsSetup").GetBoolean());

        // The new administrator registers a tenant and its first users without entering the tenant.
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.GetProperty("accessToken").GetString());
        var tenant = await (await client.PostAsJsonAsync("/api/platform/tenants", new SaveTenantRequest("Setup Movers", "setup-movers", null, null, null))).Content.ReadFromJsonAsync<JsonElement>();
        var tenantId = tenant.GetProperty("id").GetGuid();
        var roles = await client.GetFromJsonAsync<JsonElement>($"/api/platform/tenants/{tenantId}/roles");
        var adminRole = roles.EnumerateArray().Single(r => r.GetProperty("code").GetString() == "TENANT_ADMIN").GetProperty("id").GetGuid();
        var user = await client.PostAsJsonAsync($"/api/platform/tenants/{tenantId}/users", new { fullName = "Tenant Admin", email = "tenant.admin@setup.test", password = "TenantPass123!", roleId = adminRole });
        Assert.Equal(HttpStatusCode.OK, user.StatusCode);
        var userId = (await user.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync($"/api/platform/tenants/{tenantId}/users", new { fullName = "Again", email = "tenant.admin@setup.test", password = "TenantPass123!", roleId = adminRole })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/platform/tenants/{Guid.NewGuid()}/users")).StatusCode);
        Assert.Single((await client.GetFromJsonAsync<JsonElement>($"/api/platform/tenants/{tenantId}/users")).EnumerateArray());

        using var tenantClient = _factories[0].CreateClient();
        var tenantLogin = await tenantClient.PostAsJsonAsync("/api/auth/login", new { email = "tenant.admin@setup.test", password = "TenantPass123!" });
        Assert.Equal(HttpStatusCode.OK, tenantLogin.StatusCode);
        var tenantSession = await tenantLogin.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(tenantId, tenantSession.GetProperty("tenantId").GetGuid());
        tenantClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tenantSession.GetProperty("accessToken").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, (await tenantClient.GetAsync($"/api/platform/tenants/{tenantId}/users")).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await client.PatchAsJsonAsync($"/api/platform/tenants/{tenantId}/users/{userId}/status", new { isActive = false })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new { email = "tenant.admin@setup.test", password = "TenantPass123!" })).StatusCode);
    }

    [Fact]
    public async Task With_setup_key_admins_can_be_created_or_reset_from_sign_in_at_any_time()
    {
        const string key = "setup-key-1234567890";
        var client = Client(key);
        Assert.True((await client.GetFromJsonAsync<JsonElement>("/api/setup/status")).GetProperty("requiresKey").GetBoolean());
        async Task<HttpResponseMessage> Create(string email, string password, string? setupKey) =>
            await client.PostAsJsonAsync("/api/setup/system-admin", new { fullName = "Owner", email, password, setupKey });

        Assert.Equal(HttpStatusCode.Forbidden, (await Create("owner@example.test", "OwnerPass123!", "wrong")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Create("owner@example.test", "OwnerPass123!", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Create("owner@example.test", "OwnerPass123!", key)).StatusCode);

        // An administrator exists, yet the key still allows another one, and stays offered on the sign-in page.
        var status = await client.GetFromJsonAsync<JsonElement>("/api/setup/status");
        Assert.False(status.GetProperty("needsSetup").GetBoolean());
        Assert.True(status.GetProperty("enabled").GetBoolean());
        Assert.Equal(HttpStatusCode.OK, (await Create("second@example.test", "SecondPass123!", key)).StatusCode);

        // The same email resets that administrator's password (recovery).
        var reset = await (await Create("owner@example.test", "NewOwnerPass123!", key)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(reset.GetProperty("passwordReset").GetBoolean());
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new { email = "owner@example.test", password = "OwnerPass123!" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth/login", new { email = "owner@example.test", password = "NewOwnerPass123!" })).StatusCode);

        // A tenant user's email cannot be turned into a system administrator.
        var session = await (await client.PostAsJsonAsync("/api/auth/login", new { email = "owner@example.test", password = "NewOwnerPass123!" })).Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.GetProperty("accessToken").GetString());
        var tenantId = (await (await client.PostAsJsonAsync("/api/platform/tenants", new SaveTenantRequest("Key Movers", "key-movers", null, null, null))).Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var adminRole = (await client.GetFromJsonAsync<JsonElement>($"/api/platform/tenants/{tenantId}/roles")).EnumerateArray().Single(r => r.GetProperty("code").GetString() == "TENANT_ADMIN").GetProperty("id").GetGuid();
        await client.PostAsJsonAsync($"/api/platform/tenants/{tenantId}/users", new { fullName = "Tenant User", email = "user@key.test", password = "TenantPass123!", roleId = adminRole });
        client.DefaultRequestHeaders.Authorization = null;
        Assert.Equal(HttpStatusCode.BadRequest, (await Create("user@key.test", "Takeover123!", key)).StatusCode);
    }

    [Fact]
    public async Task Bootstrap_password_is_only_replaced_when_reset_is_switched_on()
    {
        HttpClient Start(string password, bool reset) => Configured(b =>
        {
            b.UseSetting("Bootstrap:SystemAdminEmail", "owner@boot.test");
            b.UseSetting("Bootstrap:SystemAdminPassword", password);
            if (reset) b.UseSetting("Bootstrap:ResetPassword", "true");
        });
        async Task<HttpStatusCode> Login(HttpClient c, string password) => (await c.PostAsJsonAsync("/api/auth/login", new { email = "owner@boot.test", password })).StatusCode;

        Assert.Equal(HttpStatusCode.OK, await Login(Start("FirstPass123!", false), "FirstPass123!"));
        // Changing the configured password later does not touch the existing account...
        var changed = Start("SecondPass123!", false);
        Assert.Equal(HttpStatusCode.Unauthorized, await Login(changed, "SecondPass123!"));
        Assert.Equal(HttpStatusCode.OK, await Login(changed, "FirstPass123!"));
        // ...unless the reset switch is on.
        var reset = Start("SecondPass123!", true);
        Assert.Equal(HttpStatusCode.OK, await Login(reset, "SecondPass123!"));
        Assert.Equal(HttpStatusCode.Unauthorized, await Login(reset, "FirstPass123!"));
    }

    private HttpClient Configured(Action<IWebHostBuilder> configure)
    {
        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Database:Provider", "Sqlite");
            builder.UseSetting("ConnectionStrings:Sqlite", $"Data Source={_databasePath}");
            configure(builder);
        });
        _factories.Add(factory);
        return factory.CreateClient();
    }

    public async Task DisposeAsync()
    {
        foreach (var factory in _factories) await factory.DisposeAsync();
        SqliteConnection.ClearAllPools();
        if (File.Exists(_databasePath)) File.Delete(_databasePath);
    }
}
