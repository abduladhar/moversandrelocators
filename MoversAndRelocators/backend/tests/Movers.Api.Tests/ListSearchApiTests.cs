using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Movers.Api.Contracts.Tenants;

namespace Movers.Api.Tests;

/// <summary>
/// Every list screen's advanced search runs on the server. This calls each search endpoint with every sort it offers (both
/// directions), a keyword and its filters, so a query the database cannot translate (subquery sorts, nullable or decimal
/// keys, joined-name search) fails here rather than in the browser.
/// </summary>
public sealed class ListSearchApiTests : IAsyncLifetime
{
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"movers-search-{Guid.NewGuid():N}.db");
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public Task InitializeAsync()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder => { builder.UseEnvironment("Testing"); builder.UseSetting("Database:Provider", "Sqlite"); builder.UseSetting("ConnectionStrings:Sqlite", $"Data Source={_databasePath}"); });
        _client = _factory.CreateClient(); return Task.CompletedTask;
    }

    /// <summary>route, the sort names it offers, extra filter query (may be empty).</summary>
    public static readonly (string Route, string[] Sorts, string Filters)[] Lists =
    [
        ("/api/quotations/search", ["serialNo", "customerName", "quotationNumber", "validUntil", "grandTotal", "status"], "status=DRAFT&customerState=PENDING"),
        ("/api/quotations/charges/search", ["serialNo", "name", "defaultRate"], "active=true"),
        ("/api/quotations/taxes/search", ["serialNo", "name", "code", "rate"], "kind=TAX"),
        ("/api/business-masters/customer/search", ["name", "code"], "active=true"),
        ("/api/business-masters/payment-method/search", ["name", "code"], ""),
        ("/api/sales/leads/search", ["serialNo", "customerName", "leadNumber", "moveTypeName", "expectedMoveDate", "statusName"], "active=true&customerState=REPLIED"),
        ("/api/sales/statuses/leads/search", ["displayOrder", "serialNo", "name", "code"], "active=true"),
        ("/api/sales/statuses/follow-ups/search", ["displayOrder", "serialNo", "name", "code"], ""),
        ("/api/sales/statuses/move-types/search", ["displayOrder", "serialNo", "name", "code"], "active=false"),
        ("/api/surveys/search", ["serialNo", "scheduledAtUtc", "assignedEmployeeName"], "status=SCHEDULED&customerState=EXPIRED"),
        ("/api/surveys/masters/items/search", ["serialNo", "name", "code", "volumeCbm"], "active=true"),
        ("/api/surveys/masters/materials/search", ["serialNo", "name", "code", "currentUnitCost"], ""),
        ("/api/surveys/masters/box-types/search", ["serialNo", "name", "code", "capacityCbm"], ""),
        ("/api/pickups/search", ["serialNo", "scheduledAtUtc", "customerName", "pickupNumber", "statusName"], "customerState=ACTION_TAKEN"),
        ("/api/pickups/statuses/search", ["displayOrder", "serialNo"], ""),
        ("/api/pickups/vehicles/search", ["serialNo", "registrationNumber"], ""),
        ("/api/pickups/warehouses/search", ["name"], ""),
        ("/api/packing/search", ["serialNo", "scheduledAtUtc", "customerName", "jobNumber", "status"], "status=PLANNED&customerState=PENDING"),
        ("/api/delivery/search", ["serialNo", "scheduledAtUtc", "deliveryNumber", "status"], "status=PLANNED&customerState=PENDING"),
        ("/api/employees/search", ["serialNo", "fullName", "employeeNumber", "designationName", "reportsToName", "joiningDate", "isActive"], "isActive=true"),
        ("/api/designations/search", ["serialNo", "name", "code", "level", "isActive"], "isActive=true&level=2"),
        ("/api/security/users/search", ["serialNo", "fullName", "email", "lastLoginAtUtc", "isActive"], "isActive=true"),
        ("/api/security/roles/search", ["serialNo", "name", "code", "isSystemRole"], "isSystemRole=true"),
        ("/api/security/audit/search", ["serialNo", "createdAtUtc", "actorEmail", "action", "entityType"], "action=ADDED"),
        ("/api/platform/tenants/search", ["serialNo", "name", "contactEmail", "isActive"], "isActive=true"),
    ];

    [Fact]
    public async Task Every_list_search_translates_with_every_sort_keyword_and_filter()
    {
        await LoginAndSelectTenant();
        await Seed();
        var failures = new List<string>();
        foreach (var (route, sorts, filters) in Lists)
        {
            foreach (var sort in sorts)
                foreach (var desc in new[] { true, false })
                    await Check(failures, $"{route}?sort={sort}&desc={desc.ToString().ToLowerInvariant()}&take=5");
            await Check(failures, $"{route}?search=a%20e&skip=1&take=2");
            if (filters.Length > 0) await Check(failures, $"{route}?search=x&{filters}");
        }
        Assert.True(failures.Count == 0, string.Join("\n", failures));
    }

    [Fact]
    public async Task Search_pages_count_every_match_and_return_whole_list_figures()
    {
        await LoginAndSelectTenant();
        await Seed();
        // Rows exist and map (the mapping now runs per page only).
        foreach (var route in new[] { "/api/sales/leads/search", "/api/surveys/search", "/api/quotations/search", "/api/employees/search", "/api/designations/search", "/api/security/audit/search" })
        {
            var page = await Get(route + "?take=1");
            Assert.True(page.GetProperty("total").GetInt32() >= 1, route);
            Assert.Equal(1, page.GetProperty("items").GetArrayLength());
        }
        // Keyword on a joined name (the survey's assigned employee) and the whole-list stats in the summary.
        var surveys = await Get("/api/surveys/search?search=meera");
        Assert.Equal(1, surveys.GetProperty("total").GetInt32());
        Assert.Equal(1, surveys.GetProperty("summary").GetProperty("all").GetInt32());
        Assert.Equal(0, (await Get("/api/surveys/search?search=nobody")).GetProperty("total").GetInt32());
        // Audit filter options come from the whole log, and ?action= binds.
        var audit = await Get("/api/security/audit/search?action=ADDED&take=1");
        Assert.Contains("ADDED", audit.GetProperty("summary").GetProperty("actions").EnumerateArray().Select(x => x.GetString()));
        Assert.All(audit.GetProperty("items").EnumerateArray(), x => Assert.Equal("ADDED", x.GetProperty("action").GetString()));
    }

    private async Task Check(List<string> failures, string url)
    {
        var response = await _client.GetAsync(url);
        if (response.StatusCode != HttpStatusCode.OK) { failures.Add($"{url} → {(int)response.StatusCode} {Trim(await response.Content.ReadAsStringAsync())}"); return; }
        var page = await response.Content.ReadFromJsonAsync<JsonElement>();
        if (page.ValueKind != JsonValueKind.Object || !page.TryGetProperty("items", out _) || !page.TryGetProperty("total", out _)) failures.Add($"{url} → not a page: {Trim(page.ToString())}");
    }
    private static string Trim(string s) => s.Length > 300 ? s[..300] : s;

    private async Task Seed()
    {
        var manager = await Post("/api/designations", new { code = "LEAD", name = "Team lead", level = 1, description = "Leads the field team", isSalesman = false });
        var designation = await Post("/api/designations", new { code = "SURV", name = "Surveyor", level = 2, description = "Field team", isSalesman = false });
        var lead = await Post("/api/employees", new { employeeNumber = "SV-001", firstName = "Meera", lastName = "Nair", workEmail = "meera@example.test", phone = "100", joiningDate = "2026-01-01", designationId = manager, reportsToEmployeeId = (Guid?)null });
        var employee = await Post("/api/employees", new { employeeNumber = "SV-002", firstName = "Arun", lastName = "Das", workEmail = "arun@example.test", phone = "101", joiningDate = "2026-02-01", designationId = designation, reportsToEmployeeId = lead });
        var statuses = await _client.GetFromJsonAsync<List<JsonElement>>("/api/sales/statuses/leads");
        var moveTypes = await _client.GetFromJsonAsync<List<JsonElement>>("/api/sales/statuses/move-types");
        var salesLead = await Post("/api/sales/leads", new { leadNumber = "L-1", customerName = "Asha Varma", phone = "+911111111111", email = "asha@example.test", source = "Web", moveTypeId = moveTypes![0].GetProperty("id").GetGuid(), origin = "Kochi", destination = "Pune", expectedMoveDate = "2026-11-15", statusId = statuses![0].GetProperty("id").GetGuid(), assignedEmployeeId = employee, notes = (string?)null });
        await Post("/api/surveys", new { surveyNumber = "S-1", salesLeadId = salesLead, customerName = "Asha Varma", phone = "+911111111111", email = "asha@example.test", assignedEmployeeId = lead, scheduledAtUtc = DateTimeOffset.UtcNow.AddDays(2), address = "Kochi", notes = (string?)null });
        await Post("/api/quotations", new { quotationNumber = "X", surveyId = (Guid?)null, salesLeadId = salesLead, customerName = "Asha Varma", phone = "+911111111111", email = (string?)null, origin = "Kochi", destination = "Pune", assignedEmployeeId = employee, currency = "INR", validUntil = "2026-12-31", terms = (string?)null, notes = (string?)null });
        await Post("/api/surveys/masters/items", new { code = "SOFA", name = "Sofa", volumeCbm = 1.2m, description = "Three seater" });
    }

    private async Task LoginAndSelectTenant()
    {
        var login = await Post<LoginResponse>("/api/auth/login", new { email = "admin@movers.local", password = "ChangeMe123!" }); SetToken(login);
        var tenant = await Post<TenantResponse>("/api/platform/tenants", new SaveTenantRequest("Search Test", "search-test", null, null, null));
        SetToken(await Post<LoginResponse>("/api/auth/select-tenant", new { tenantId = tenant.Id }));
    }
    private async Task<JsonElement> Get(string url) => (await _client.GetFromJsonAsync<JsonElement>(url))!;
    private async Task<Guid> Post(string url, object body) => (await Post<JsonElement>(url, body)).GetProperty("id").GetGuid();
    private async Task<T> Post<T>(string url, object body) { var response = await _client.PostAsJsonAsync(url, body); Assert.True(response.IsSuccessStatusCode, $"{url}: {await response.Content.ReadAsStringAsync()}"); return (await response.Content.ReadFromJsonAsync<T>())!; }
    private void SetToken(LoginResponse x) => _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", x.AccessToken);
    public async Task DisposeAsync() { _client.Dispose(); await _factory.DisposeAsync(); SqliteConnection.ClearAllPools(); if (File.Exists(_databasePath)) File.Delete(_databasePath); }
    private sealed record LoginResponse(string AccessToken);
}
