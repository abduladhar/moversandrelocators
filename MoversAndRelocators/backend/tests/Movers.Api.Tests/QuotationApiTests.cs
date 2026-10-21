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
        // Sharing the link puts the quotation on "customer action pending".
        var pending = Assert.Single((await Replies())!);
        Assert.Equal((quote.Id, "PENDING"), (pending.RecordId, pending.State));
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
        // The customer's requote shows as a reply the office must act on.
        var replied = Assert.Single((await Replies())!);
        Assert.Equal(("REPLIED", "QUOTATION_REQUOTE", "One more chair"), (replied.State, replied.ReplyKind, replied.ReplyNote));
        Assert.Equal(3, Assert.Single(requoteRequest.Items).RequestedQuantity);
        var prematureShare = await _client.PostAsJsonAsync($"/api/quotations/{quote.Id}/share-link", new { validDays = 7 });
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, prematureShare.StatusCode);
        var repriced = await Post<QuotationDetailResponse>($"/api/quotations/{quote.Id}/requote-requests/{requoteRequest.Id}/apply", new { });
        Assert.Equal(3m, repriced.SurveyVolumeCbm);
        Assert.Equal(3m, Assert.Single(repriced.Lines).Quantity);
        Assert.Equal(3545.40m, repriced.Quotation.GrandTotal);
        // Applying the request is the office's action on the reply.
        var applied = Assert.Single((await Replies())!);
        Assert.Equal(("ACTION_TAKEN", "REQUOTE_APPLIED", "Asha Rao"), (applied.State, applied.HandledAction, applied.HandledBy));
        if (rejectAndRevise)
            await Put<QuotationDetailResponse>($"/api/quotations/{quote.Id}/items", new { items = new[] { new { householdItemId = chair.Id, roomName = "Dining room", quantity = 4, volumePerUnitCbm = 1m, notes = "Carry into revision", displayOrder = 1 } } });
        var newLink = await Post<LinkResponse>($"/api/quotations/{quote.Id}/share-link", new { validDays = 7 });
        Assert.Equal("PENDING", Assert.Single((await Replies())!).State);
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
        SetToken(await Post<LoginResponse>("/api/auth/login", new { email = "asha.user@example.test", password = "SecurePass123!" }));
        Assert.Equal(("REPLIED", "QUOTATION_ACCEPTED"), Assert.Single((await Replies())!) is var r ? (r.State, r.ReplyKind) : default);
        var tasks = await _client.GetFromJsonAsync<List<System.Text.Json.JsonElement>>("/api/tasks/mine");
        Assert.Contains(tasks!, x => x.GetProperty("type").GetString() == "customer-reply" && x.GetProperty("entityId").GetString() == quote.Id.ToString());
        (await _client.PostAsJsonAsync($"/api/customer-replies/QUOTATION/{quote.Id}/handled", new { note = "Booked the move" })).EnsureSuccessStatusCode();
        var taken = Assert.Single((await Replies())!);
        Assert.Equal(("ACTION_TAKEN", "MARKED", "Booked the move"), (taken.State, taken.HandledAction, taken.HandledNote));
        // Nothing is waiting any more, so a second "action taken" is refused.
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/customer-replies/QUOTATION/{quote.Id}/handled", new { note = "again" })).StatusCode);
        var history = (await _client.GetFromJsonAsync<List<CustomerReplyEventResponse>>($"/api/customer-replies/QUOTATION/{quote.Id}/history"))!;
        Assert.Equal(["ACTION_TAKEN", "REPLIED", "SHARED", "ACTION_TAKEN", "REPLIED", "SHARED"], history.Select(x => x.Event));
        Assert.Equal(("MARKED", "Booked the move", "Asha Rao"), (history[0].Detail, history[0].Note, history[0].Actor));
        Assert.Equal(("QUOTATION_ACCEPTED", "CUSTOMER"), (history[1].Detail, history[1].Actor));
        Assert.Equal(("QUOTATION_REQUOTE", "One more chair"), (history[4].Detail, history[4].Note));
    }

    private Task<List<CustomerReplyResponse>?> Replies() => _client.GetFromJsonAsync<List<CustomerReplyResponse>>("/api/customer-replies?type=QUOTATION");
    private sealed record CustomerReplyResponse(Guid RecordId, string State, string? ReplyKind, string? ReplyNote, string? HandledAction, string? HandledBy, string? HandledNote);
    private sealed record CustomerReplyEventResponse(string Event, string? Detail, string? Note, string Actor);

    [Fact]
    public async Task Lead_inventory_loads_every_line_and_creates_missing_household_items()
    {
        await LoginAndSelectTenant();
        var designation = await Post<IdResponse>("/api/designations", new { code = "SALES", name = "Sales Executive", level = 2, description = "Sales team", isSalesman = true });
        var employee = await Post<IdResponse>("/api/employees", new { employeeNumber = "SALE-002", firstName = "Ravi", lastName = "K", workEmail = "ravi@example.test", phone = "101", joiningDate = "2026-01-01", designationId = designation.Id, reportsToEmployeeId = (Guid?)null });
        var leadStatuses = await _client.GetFromJsonAsync<List<CodeResponse>>("/api/sales/statuses/leads");
        var moveTypes = await _client.GetFromJsonAsync<List<CodeResponse>>("/api/sales/statuses/move-types");
        var lead = await Post<IdResponse>("/api/sales/leads", new { leadNumber = "LEAD-INV-001", customerName = "Inventory Customer", phone = "+919900000001", email = "inv@example.test", source = "Website", moveTypeId = moveTypes!.Single(x => x.Code == "HOUSEHOLD").Id, origin = "Kochi", destination = "Pune", expectedMoveDate = "2026-11-15", statusId = leadStatuses!.Single(x => x.Code == "NEW").Id, assignedEmployeeId = employee.Id, notes = "Import test" });
        await Post<IdResponse>("/api/surveys/masters/items", new { code = "T_LAMP", name = "Lamp stand", volumeCbm = 0.2m, description = (string?)null });
        var piano = await Post<IdResponse>("/api/surveys/masters/items", new { code = "T_PIANO", name = "Old upright piano", volumeCbm = 1.5m, description = (string?)null });
        (await _client.PatchAsJsonAsync($"/api/surveys/masters/items/{piano.Id}/status", new { isActive = false })).EnsureSuccessStatusCode();

        object Line(string kind, string room, string name, int quantity, decimal cbm) => new { kind, room, name, quantity, unitCbm = cbm, fragile = false, handling = (string?)null, notes = (string?)null, sourceAttachmentId = (Guid?)null };
        await Put<object>($"/api/sales/leads/{lead.Id}/inventory", new { lines = new[] {
            Line("ITEM", "Study", "Lamp stand", 1, 0.2m),
            Line("ITEM", "Study", "Tall lamp stand", 2, 0.25m),              // matches the same master: must still be its own line
            Line("ITEM", "Study", "Robot vacuum cleaner", 1, 0.05m),          // not in the master data: created
            Line("ITEM", "Garage", "Robot vacuum cleaner", 1, 0.05m),         // same new name again: reuses the new master
            Line("ITEM", "Hall", "Mystery crate", 1, 0m),                     // no volume: cannot be created
            Line("ITEM", "Hall", "Old upright piano", 1, 1.5m),               // its master was deactivated on purpose
            Line("BOX", "Study", "Book carton", 3, 0.06m) } });

        var survey = await Post<IdResponse>("/api/surveys", new { surveyNumber = "SVY-INV-001", salesLeadId = lead.Id, customerName = "Inventory Customer", phone = "+919900000001", email = "inv@example.test", assignedEmployeeId = employee.Id, scheduledAtUtc = DateTimeOffset.UtcNow.AddDays(2), address = "Kochi", notes = "Import" });
        var loaded = await Post<System.Text.Json.JsonElement>($"/api/surveys/{survey.Id}/details/from-lead-inventory", new { });
        Assert.Equal(4, loaded.GetProperty("added").GetInt32());
        Assert.Equal(1, loaded.GetProperty("boxes").GetInt32());
        Assert.Equal(["Robot vacuum cleaner"], loaded.GetProperty("createdItems").EnumerateArray().Select(x => x.GetString()).ToArray());
        Assert.Equal(["Mystery crate", "Old upright piano"], loaded.GetProperty("unmatched").EnumerateArray().Select(x => x.GetString()).ToArray());
        var study = loaded.GetProperty("detail").GetProperty("rooms").EnumerateArray().Single(r => r.GetProperty("name").GetString() == "Study").GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(3, study.Count);
        var tall = study.Single(i => i.GetProperty("quantity").GetInt32() == 2);
        Assert.Equal("Lamp stand", tall.GetProperty("itemName").GetString());
        Assert.Equal("Tall lamp stand", tall.GetProperty("notes").GetString());
        Assert.Equal(0.25m, tall.GetProperty("volumePerUnitCbm").GetDecimal());

        var masters = await _client.GetFromJsonAsync<List<System.Text.Json.JsonElement>>("/api/surveys/masters/items");
        var robot = masters!.Single(m => m.GetProperty("name").GetString() == "Robot vacuum cleaner");
        Assert.StartsWith("LI-ROBOTVACUUMCLEANER-", robot.GetProperty("code").GetString());
        Assert.Equal(0.05m, robot.GetProperty("volumeCbm").GetDecimal());
        Assert.DoesNotContain(masters!, m => m.GetProperty("name").GetString() is "Mystery crate" or "Book carton");

        // Loading again adds nothing new (and creates no second master).
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/surveys/{survey.Id}/details/from-lead-inventory", new { })).StatusCode);

        // The quotation gets every item line too (boxes are not household items), reusing the master created above.
        var quote = await Post<QuotationResponse>("/api/quotations", new { quotationNumber = "QT-INV-001", surveyId = (Guid?)null, salesLeadId = lead.Id, customerName = "Inventory Customer", phone = "+919900000001", email = "inv@example.test", origin = "Kochi", destination = "Pune", assignedEmployeeId = employee.Id, currency = "INR", validUntil = "2026-12-31", terms = (string?)null, notes = (string?)null });
        var imported = await Post<System.Text.Json.JsonElement>($"/api/quotations/{quote.Id}/items/from-lead-inventory", new { });
        Assert.Equal(4, imported.GetProperty("imported").GetInt32());
        Assert.Empty(imported.GetProperty("createdItems").EnumerateArray());
        Assert.Equal(1, (await _client.GetFromJsonAsync<List<System.Text.Json.JsonElement>>("/api/surveys/masters/items"))!.Count(m => m.GetProperty("name").GetString() == "Robot vacuum cleaner"));
    }

    [Fact]
    public async Task Register_search_runs_on_the_server_with_keyword_filters_sort_and_pages()
    {
        await LoginAndSelectTenant();
        var designation = await Post<IdResponse>("/api/designations", new { code = "OPS", name = "Coordinator", level = 2, description = (string?)null, isSalesman = false });
        var meera = await Post<IdResponse>("/api/employees", new { employeeNumber = "OPS-001", firstName = "Meera", lastName = "Nair", workEmail = "meera@example.test", phone = "102", joiningDate = "2026-01-01", designationId = designation.Id, reportsToEmployeeId = (Guid?)null });
        var arun = await Post<IdResponse>("/api/employees", new { employeeNumber = "OPS-002", firstName = "Arun", lastName = "Das", workEmail = "arun@example.test", phone = "103", joiningDate = "2026-01-01", designationId = designation.Id, reportsToEmployeeId = (Guid?)null });
        async Task<QuotationResponse> Quote(string customer, string origin, Guid employee) => await Post<QuotationResponse>("/api/quotations", new { quotationNumber = "X", surveyId = (Guid?)null, salesLeadId = (Guid?)null, customerName = customer, phone = "+910000000000", email = (string?)null, origin, destination = "Pune", assignedEmployeeId = employee, currency = "INR", validUntil = "2026-12-31", terms = (string?)null, notes = (string?)null });
        var zara = await Quote("Zara Khan", "Kochi", meera.Id);
        await Quote("Anil Menon", "Chennai", arun.Id);
        await Quote("Bina Kochar", "Mumbai", meera.Id);

        Task<PageResponse> Search(string query) => _client.GetFromJsonAsync<PageResponse>("/api/quotations/search?" + query)!;
        // Every word must match some field: "koch" finds Kochi (origin) and Kochar (name); adding "zara" narrows to one.
        Assert.Equal(2, (await Search("search=KOCH")).Total);
        Assert.Equal(["Zara Khan"], (await Search("search=koch%20zara")).Items.Select(x => x.CustomerName));
        // Joined names are searched too (assigned employee), and filters combine with the keyword.
        Assert.Equal(2, (await Search("search=meera")).Total);
        Assert.Equal(["Anil Menon"], (await Search($"employeeId={arun.Id}")).Items.Select(x => x.CustomerName));
        // Sorted and paged on the server: the total counts every match, the page holds only `take` rows.
        var first = await Search("sort=customerName&desc=false&take=2");
        Assert.Equal(3, first.Total);
        Assert.Equal(["Anil Menon", "Bina Kochar"], first.Items.Select(x => x.CustomerName));
        Assert.Equal(["Zara Khan"], (await Search("sort=customerName&desc=false&skip=2&take=2")).Items.Select(x => x.CustomerName));
        Assert.Equal(3, (await Search("sort=grandTotal")).Items.Count);
        Assert.Equal(3, (await Search("sort=validUntil&desc=true")).Items.Count);
        // Customer state is filtered on the server as well.
        await Put<QuotationDetailResponse>($"/api/quotations/{zara.Id}/lines", new { lines = new[] { new { chargeMasterId = (await Post<ChargeResponse>("/api/quotations/charges", new { code = "MOVE", name = "Move", unit = "TRIP", defaultRate = 100m, taxPercent = 0m, description = (string?)null })).Id, description = "Move", quantity = 1, rate = 100m, discountPercent = 0m, taxIds = Array.Empty<Guid>(), displayOrder = 1 } } });
        await Post<LinkResponse>($"/api/quotations/{zara.Id}/share-link", new { validDays = 7 });
        Assert.Equal(["Zara Khan"], (await Search("customerState=PENDING")).Items.Select(x => x.CustomerName));
        Assert.Empty((await Search("customerState=REPLIED")).Items);
    }

    private sealed record PageResponse(List<PageRow> Items, int Total);
    private sealed record PageRow(Guid Id, string CustomerName);

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
