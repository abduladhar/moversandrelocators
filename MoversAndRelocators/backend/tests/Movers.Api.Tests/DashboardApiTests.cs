using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Movers.Api.Contracts.Tenants;

namespace Movers.Api.Tests;

/// <summary>The Sales & planning, Operations and Finance dashboards: counts follow the records, sections follow permissions.</summary>
public sealed class DashboardApiTests : IAsyncLifetime
{
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"movers-dash-{Guid.NewGuid():N}.db");
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public Task InitializeAsync()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b => { b.UseEnvironment("Testing"); b.UseSetting("Database:Provider", "Sqlite"); b.UseSetting("ConnectionStrings:Sqlite", $"Data Source={_databasePath}"); });
        _client = _factory.CreateClient(); return Task.CompletedTask;
    }

    [Fact]
    public async Task Dashboards_count_the_companys_work()
    {
        await SignInAsync();
        var designation = await Post<JsonElement>("/api/designations", new { code = "OPS", name = "Coordinator", level = 2, description = "Office" });
        var employee = await Post<JsonElement>("/api/employees", new { employeeNumber = "E-1", firstName = "Sara", lastName = "Khan", workEmail = "sara@movers.local", phone = "1",
            joiningDate = "2026-01-01", designationId = designation.GetProperty("id").GetGuid(), reportsToEmployeeId = (Guid?)null });
        var statuses = await _client.GetFromJsonAsync<List<JsonElement>>("/api/sales/statuses/leads");
        var moveType = (await _client.GetFromJsonAsync<List<JsonElement>>("/api/sales/statuses/move-types"))![0].GetProperty("id").GetGuid();
        var planned = (await _client.GetFromJsonAsync<List<JsonElement>>("/api/sales/statuses/follow-ups"))!.Single(x => x.GetProperty("code").GetString() == "PLANNED").GetProperty("id").GetGuid();
        var newStatus = statuses!.Single(x => x.GetProperty("code").GetString() == "NEW").GetProperty("id").GetGuid();
        foreach (var (name, source) in new[] { ("Ali", "Website"), ("Beth", "Website"), ("Chen", "Referral") })
        {
            var lead = await Post<JsonElement>("/api/sales/leads", new { leadNumber = "", customerName = name, phone = "+971 50 000 0000", email = (string?)null, source, moveTypeId = moveType,
                origin = "Dubai", destination = "Abu Dhabi", expectedMoveDate = (string?)null, statusId = newStatus, assignedEmployeeId = employee.GetProperty("id").GetGuid(), notes = (string?)null });
            await Post<JsonElement>($"/api/sales/leads/{lead.GetProperty("id").GetGuid()}/follow-ups", new { scheduledAtUtc = DateTimeOffset.UtcNow.AddDays(-2), statusId = planned, notes = "Call", nextFollowUpAtUtc = (DateTimeOffset?)null });
        }
        await Post<JsonElement>("/api/surveys", new { surveyNumber = "S-1", salesLeadId = (Guid?)null, customerName = "Ali", phone = "1", email = (string?)null,
            assignedEmployeeId = employee.GetProperty("id").GetGuid(), scheduledAtUtc = DateTimeOffset.UtcNow.AddDays(2), address = "Marina", notes = (string?)null });

        var sales = await _client.GetFromJsonAsync<JsonElement>("/api/dashboards/sales");
        var leads = sales.GetProperty("leads");
        Assert.Equal(3, leads.GetProperty("newLeadsThisMonth").GetInt32());
        Assert.Equal(3, leads.GetProperty("openLeads").GetInt32());
        Assert.Equal(3, leads.GetProperty("followUpsOverdue").GetInt32());
        Assert.Equal(3, sales.GetProperty("leadsPerWeek").GetProperty("points").EnumerateArray().Last().GetProperty("values")[0].GetDecimal());
        Assert.Equal(12, sales.GetProperty("leadsPerWeek").GetProperty("points").GetArrayLength());
        var bySource = sales.GetProperty("leadsBySource").EnumerateArray().ToList();
        Assert.Equal(("Website", 2), (bySource[0].GetProperty("label").GetString(), bySource[0].GetProperty("count").GetInt32()));
        Assert.Equal(1, sales.GetProperty("surveys").GetProperty("scheduledNext7Days").GetInt32());
        Assert.Equal("Ali", Assert.Single(sales.GetProperty("upcomingSurveys").EnumerateArray()).GetProperty("customer").GetString());
        Assert.Equal(3, sales.GetProperty("recentLeads").GetArrayLength());

        var operations = await _client.GetFromJsonAsync<JsonElement>("/api/dashboards/operations");
        Assert.Equal(14, operations.GetProperty("next14Days").GetProperty("points").GetArrayLength());
        Assert.Contains("PACKING", operations.GetProperty("modules").EnumerateArray().Select(x => x.GetString()));

        var finance = await _client.GetAsync("/api/dashboards/finance");
        Assert.Equal(HttpStatusCode.OK, finance.StatusCode); // with no posted documents: zero amounts, or a set-up problem message
    }

    private async Task<T> Post<T>(string url, object body) { var r = await _client.PostAsJsonAsync(url, body); r.EnsureSuccessStatusCode(); return (await r.Content.ReadFromJsonAsync<T>())!; }
    private async Task SignInAsync()
    {
        var login = await _client.PostAsJsonAsync("/api/auth/login", new { email = "admin@movers.local", password = "ChangeMe123!" }); login.EnsureSuccessStatusCode();
        Token((await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("accessToken").GetString()!);
        var tenant = await Post<TenantResponse>("/api/platform/tenants", new SaveTenantRequest("Dash Test", "dash-test", null, null, null));
        var selected = await _client.PostAsJsonAsync("/api/auth/select-tenant", new { tenantId = tenant.Id }); selected.EnsureSuccessStatusCode();
        Token((await selected.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("accessToken").GetString()!);
    }
    private void Token(string token) => _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    public async Task DisposeAsync() { _client.Dispose(); await _factory.DisposeAsync(); SqliteConnection.ClearAllPools(); if (File.Exists(_databasePath)) File.Delete(_databasePath); }
}
