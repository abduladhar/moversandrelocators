using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Movers.Api.Contracts.Tenants;

namespace Movers.Api.Tests;

public sealed class QuotationApiTests : IAsyncLifetime
{
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"movers-quotes-{Guid.NewGuid():N}.db");
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public Task InitializeAsync()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder => { builder.UseEnvironment("Testing"); builder.UseSetting("Database:Provider", "Sqlite"); builder.UseSetting("ConnectionStrings:Sqlite", $"Data Source={_databasePath}"); });
        _client = _factory.CreateClient(); return Task.CompletedTask;
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Quotation_inherits_the_survey_lead_calculates_charges_and_can_be_accepted(bool rejectAndRevise)
    {
        await LoginAndSelectTenant();
        var designation = await Post<IdResponse>("/api/designations", new { code = "SALES", name = "Sales Executive", level = 2, description = "Sales team", isSalesman = true });
        var employee = await Post<IdResponse>("/api/employees", new { employeeNumber = "SALE-001", firstName = "Asha", lastName = "Rao", workEmail = "asha@example.test", phone = "100", joiningDate = "2026-01-01", designationId = designation.Id, reportsToEmployeeId = (Guid?)null });
        var leadStatuses = await _client.GetFromJsonAsync<List<CodeResponse>>("/api/sales/statuses/leads");
        var moveTypes = await _client.GetFromJsonAsync<List<CodeResponse>>("/api/sales/statuses/move-types");
        var lead = await Post<IdResponse>("/api/sales/leads", new { leadNumber = "LEAD-Q-001", customerName = "Quotation Customer", phone = "+919900000000", email = "quote@example.test", source = "Website", moveTypeId = moveTypes!.Single(x => x.Code == "HOUSEHOLD").Id, origin = "Chennai", destination = "Bengaluru", expectedMoveDate = "2026-10-15", statusId = leadStatuses!.Single(x => x.Code == "NEW").Id, assignedEmployeeId = employee.Id, notes = "Quotation test" });
        var survey = await Post<IdResponse>("/api/surveys", new { surveyNumber = "SVY-Q-001", salesLeadId = lead.Id, customerName = "Quotation Customer", phone = "+919900000000", email = "quote@example.test", assignedEmployeeId = employee.Id, scheduledAtUtc = DateTimeOffset.UtcNow.AddDays(2), address = "Customer address", notes = "Linked survey" });
        var chair = await Post<IdResponse>("/api/surveys/masters/items", new { code = "QUOTE_CHAIR", name = "Quotation chair", volumeCbm = 1, description = "Chair shown with quotation" });
        await Put<object>($"/api/surveys/{survey.Id}/details", new { rooms = new[] { new { name = "Living room", displayOrder = 1, items = new[] { new { householdItemId = chair.Id, quantity = 2, volumePerUnitCbm = 1, notes = "Surveyed chairs" } } } }, extraMaterials = Array.Empty<object>() });

        var quote = await Post<QuotationResponse>("/api/quotations", new { quotationNumber = "QT-001", surveyId = survey.Id, salesLeadId = (Guid?)null, customerName = "Quotation Customer", phone = "+919900000000", email = "quote@example.test", assignedEmployeeId = employee.Id, currency = "INR", validUntil = "2026-12-31", terms = "Payment before delivery", notes = "Test quotation", includeSurveyItems = true });
        Assert.Equal(lead.Id, quote.SalesLeadId);
        Assert.Equal("Chennai", quote.Origin);
        Assert.Equal("Bengaluru", quote.Destination);
        var withItems = await Put<QuotationDetailResponse>($"/api/quotations/{quote.Id}/items", new { items = new[] { new { householdItemId = chair.Id, roomName = "Dining room", quantity = 4, volumePerUnitCbm = 1m, notes = "Quotation inventory", displayOrder = 1 } } });
        Assert.Equal(4m, withItems.SurveyVolumeCbm);
        await Put<QuotationDetailResponse>($"/api/quotations/{quote.Id}/items", new { items = Array.Empty<object>() });
        var charges = await _client.GetFromJsonAsync<List<ChargeResponse>>("/api/quotations/charges");
        var packing = charges!.Single(x => x.Code == "PACKING");
        var taxes = await _client.GetFromJsonAsync<List<CodeResponse>>("/api/quotations/taxes");
        var taxIds = new[] { taxes!.Single(x => x.Code == "CGST_9").Id, taxes!.Single(x => x.Code == "SGST_9").Id, taxes!.Single(x => x.Code == "CESS_ON_TAX_1").Id };
        var detail = await Put<QuotationDetailResponse>($"/api/quotations/{quote.Id}/lines", new { lines = new[] { new { chargeMasterId = packing.Id, description = "Packing by surveyed volume", quantity = 2, rate = 1000m, discountPercent = 0m, taxIds, displayOrder = 1 } } });
        Assert.Equal(2363.60m, detail.Quotation.GrandTotal);
        var cleared = await Put<QuotationDetailResponse>($"/api/quotations/{quote.Id}/lines", new { lines = Array.Empty<object>() });
        Assert.Empty(cleared.Lines);
        Assert.Equal(0m, cleared.Quotation.GrandTotal);
        var reloaded = await _client.GetFromJsonAsync<QuotationDetailResponse>($"/api/quotations/{quote.Id}");
        Assert.Empty(reloaded!.Lines);
        Assert.Equal(0m, reloaded.Quotation.GrandTotal);
        await Put<QuotationDetailResponse>($"/api/quotations/{quote.Id}/lines", new { lines = Array.Empty<object>() });
        detail = await Put<QuotationDetailResponse>($"/api/quotations/{quote.Id}/lines", new { lines = new[] { new { chargeMasterId = packing.Id, description = "Packing by surveyed volume", quantity = 2, rate = 1000m, discountPercent = 0m, taxIds, displayOrder = 1 } } });
        Assert.Equal(2363.60m, detail.Quotation.GrandTotal);

        var secondEmployee = await Post<IdResponse>("/api/employees", new { employeeNumber = "SALE-002", firstName = "Ben", lastName = "Joseph", workEmail = "ben@example.test", phone = "101", joiningDate = "2026-01-01", designationId = designation.Id, reportsToEmployeeId = (Guid?)null });
        await Post<QuotationResponse>("/api/quotations", new { quotationNumber = "QT-002", surveyId = (Guid?)null, salesLeadId = (Guid?)null, customerName = "Other Customer", phone = "+919800000000", email = "other@example.test", origin = "Mumbai", destination = "Delhi", assignedEmployeeId = secondEmployee.Id, currency = "INR", validUntil = "2026-12-31", terms = "Direct quotation", notes = "Other salesperson" });
        var roles = await _client.GetFromJsonAsync<List<RoleResponse>>("/api/security/roles");
        var tenantAdmin = roles!.Single(x => x.Code == "TENANT_ADMIN");
        await Post<IdResponse>("/api/security/users", new { fullName = "Asha Rao", email = "asha.user@example.test", password = "SecurePass123!", roleId = tenantAdmin.Id, employeeId = employee.Id });

        var link = await Post<LinkResponse>($"/api/quotations/{quote.Id}/share-link", new { validDays = 7 });
        var token = new Uri(link.Url).Segments.Last().Trim('/');
        _client.DefaultRequestHeaders.Authorization = null;
        var publicQuote = await _client.GetFromJsonAsync<PublicQuotationResponse>($"/api/public/quotations/{token}");
        Assert.Equal(2363.60m, publicQuote!.Quotation.GrandTotal);
        var publicItem = Assert.Single(Assert.Single(publicQuote.SurveyRooms).Items);
        Assert.Equal(2, publicItem.Quantity);
        var requested = await Post<PublicQuotationResponse>($"/api/public/quotations/{token}/request-requote", new { customerNotes = "One more chair", items = new[] { new { surveyItemId = publicItem.SurveyItemId, requestedQuantity = 3, notes = "Please add this chair" } } });
        Assert.Equal("REQUOTE_REQUESTED", requested.Quotation.Status);
        SetToken(await Post<LoginResponse>("/api/auth/login", new { email = "asha.user@example.test", password = "SecurePass123!" }));
        var visible = await _client.GetFromJsonAsync<List<QuotationResponse>>("/api/quotations");
        var salesmanQuote = Assert.Single(visible!);
        Assert.Equal(quote.Id, salesmanQuote.Id);
        Assert.Matches(@"^QT-\d{8}-\d{6}$", salesmanQuote.QuotationNumber);
        var requestedDetail = await _client.GetFromJsonAsync<QuotationDetailResponse>($"/api/quotations/{quote.Id}");
        var requoteRequest = Assert.Single(requestedDetail!.RequoteRequests);
        Assert.Equal(3, Assert.Single(requoteRequest.Items).RequestedQuantity);
        var prematureShare = await _client.PostAsJsonAsync($"/api/quotations/{quote.Id}/share-link", new { validDays = 7 });
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, prematureShare.StatusCode);
        var repriced = await Post<QuotationDetailResponse>($"/api/quotations/{quote.Id}/requote-requests/{requoteRequest.Id}/apply", new { });
        Assert.Equal(3m, repriced.SurveyVolumeCbm);
        Assert.Equal(3m, Assert.Single(repriced.Lines).Quantity);
        Assert.Equal(3545.40m, repriced.Quotation.GrandTotal);
        if (rejectAndRevise)
            await Put<QuotationDetailResponse>($"/api/quotations/{quote.Id}/items", new { items = new[] { new { householdItemId = chair.Id, roomName = "Dining room", quantity = 4, volumePerUnitCbm = 1m, notes = "Carry into revision", displayOrder = 1 } } });
        var newLink = await Post<LinkResponse>($"/api/quotations/{quote.Id}/share-link", new { validDays = 7 });
        _client.DefaultRequestHeaders.Authorization = null;
        if (rejectAndRevise)
        {
            var publicToken = new Uri(newLink.Url).Segments.Last().Trim('/');
            var rejected = await Post<PublicQuotationResponse>($"/api/public/quotations/{publicToken}/reject", new { reason = "Packing price is too high." });
            Assert.Equal("REJECTED", rejected.Quotation.Status);
            Assert.Equal(System.Net.HttpStatusCode.Unauthorized, (await _client.PostAsJsonAsync($"/api/quotations/{quote.Id}/revisions", new { })).StatusCode);
            SetToken(await Post<LoginResponse>("/api/auth/login", new { email = "asha.user@example.test", password = "SecurePass123!" }));
            var revision = await Post<System.Text.Json.JsonElement>($"/api/quotations/{quote.Id}/revisions", new { });
            var revisionId = revision.GetProperty("id").GetGuid();
            Assert.NotEqual(quote.Id, revisionId);
            Assert.NotEqual(quote.QuotationNumber, revision.GetProperty("quotationNumber").GetString());
            Assert.Equal("DRAFT", revision.GetProperty("status").GetString());
            Assert.Equal(quote.QuotationNumber, revision.GetProperty("revisedFromNumber").GetString());
            Assert.Equal("Packing price is too high.", revision.GetProperty("revisionReason").GetString());
            Assert.Equal(3545.40m, revision.GetProperty("grandTotal").GetDecimal());
            var copied = await _client.GetFromJsonAsync<QuotationDetailResponse>($"/api/quotations/{revisionId}");
            Assert.Single(copied!.QuotationItems); Assert.Single(copied.Lines);
            Assert.Equal(System.Net.HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/quotations/{revisionId}/revisions", new { })).StatusCode);
            await Put<QuotationDetailResponse>($"/api/quotations/{revisionId}/lines", new { lines = new[] { new { chargeMasterId = packing.Id, description = "Revised packing price", quantity = 3, rate = 900m, discountPercent = 0m, taxIds, displayOrder = 1 } } });
            var revisionLink = await Post<LinkResponse>($"/api/quotations/{revisionId}/share-link", new { validDays = 7 });
            Assert.NotEqual(newLink.Url, revisionLink.Url);
            var original = await _client.GetFromJsonAsync<System.Text.Json.JsonElement>($"/api/quotations/{quote.Id}");
            Assert.Equal("REJECTED", original.GetProperty("quotation").GetProperty("status").GetString());
            Assert.Equal("Packing price is too high.", original.GetProperty("quotation").GetProperty("rejectionReason").GetString());
            Assert.Equal(3545.40m, original.GetProperty("quotation").GetProperty("grandTotal").GetDecimal());
            _client.DefaultRequestHeaders.Authorization = null;
            var oldPublic = await _client.GetFromJsonAsync<PublicQuotationResponse>($"/api/public/quotations/{publicToken}");
            Assert.Equal("REJECTED", oldPublic!.Quotation.Status);
            return;
        }
        var accepted = await Post<PublicQuotationResponse>($"/api/public/quotations/{new Uri(newLink.Url).Segments.Last().Trim('/')}/accept", new { });
        Assert.Equal("ACCEPTED", accepted.Quotation.Status);
    }

    private async Task LoginAndSelectTenant()
    {
        var login = await Post<LoginResponse>("/api/auth/login", new { email = "admin@movers.local", password = "ChangeMe123!" }); SetToken(login);
        var tenant = await Post<TenantResponse>("/api/platform/tenants", new SaveTenantRequest("Quotation Test", "quotation-test", null, null, null));
        SetToken(await Post<LoginResponse>("/api/auth/select-tenant", new { tenantId = tenant.Id }));
    }
    private async Task<T> Post<T>(string url, object body) { var response = await _client.PostAsJsonAsync(url, body); response.EnsureSuccessStatusCode(); return (await response.Content.ReadFromJsonAsync<T>())!; }
    private async Task<T> Put<T>(string url, object body) { var response = await _client.PutAsJsonAsync(url, body); response.EnsureSuccessStatusCode(); return (await response.Content.ReadFromJsonAsync<T>())!; }
    private void SetToken(LoginResponse x) => _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", x.AccessToken);
    public async Task DisposeAsync() { _client.Dispose(); await _factory.DisposeAsync(); SqliteConnection.ClearAllPools(); if (File.Exists(_databasePath)) File.Delete(_databasePath); }
    private sealed record LoginResponse(string AccessToken);
    private sealed record IdResponse(Guid Id);
    private sealed record CodeResponse(Guid Id, string Code);
    private sealed record ChargeResponse(Guid Id, string Code);
    private sealed record QuotationResponse(Guid Id, string QuotationNumber, Guid? SalesLeadId, string Origin, string Destination, decimal GrandTotal, string Status);
    private sealed record QuotationDetailResponse(QuotationResponse Quotation, decimal? SurveyVolumeCbm, List<LineResponse> Lines, List<object> QuotationItems, List<RequoteResponse> RequoteRequests);
    private sealed record LinkResponse(string Url);
    private sealed record PublicQuotationResponse(QuotationResponse Quotation, List<RoomResponse> SurveyRooms);
    private sealed record RoomResponse(List<SurveyItemResponse> Items);
    private sealed record SurveyItemResponse(Guid SurveyItemId, int Quantity);
    private sealed record RequoteResponse(Guid Id, DateTimeOffset? AppliedAtUtc, List<RequoteItemResponse> Items);
    private sealed record RequoteItemResponse(int RequestedQuantity);
    private sealed record LineResponse(decimal Quantity);
    private sealed record RoleResponse(Guid Id, string Code);
}
