using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Movers.Api.Contracts.Tenants;

namespace Movers.Api.Tests;

public sealed class SurveyApiTests : IAsyncLifetime
{
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"movers-surveys-{Guid.NewGuid():N}.db");
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public Task InitializeAsync()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder => { builder.UseEnvironment("Testing"); builder.UseSetting("Database:Provider", "Sqlite"); builder.UseSetting("ConnectionStrings:Sqlite", $"Data Source={_databasePath}"); });
        _client = _factory.CreateClient(); return Task.CompletedTask;
    }

    [Fact]
    public async Task Survey_can_collect_items_plan_whole_item_boxes_and_receive_customer_confirmation()
    {
        await LoginAndSelectTenant();
        var designation = await Post<IdResponse>("/api/designations", new { code = "SURVEYOR", name = "Surveyor", level = 3, description = "Survey staff" });
        var employee = await Post<IdResponse>("/api/employees", new { employeeNumber = "SV-001", firstName = "Sam", lastName = "Surveyor", workEmail = "sam@example.test", phone = "100", joiningDate = "2026-01-01", designationId = designation.Id, reportsToEmployeeId = (Guid?)null });
        var cardboard = await Post<IdResponse>("/api/surveys/masters/materials", new { code = "TEST_CARD", name = "Test cardboard", unit = "sheet", currentUnitCost = 10, description = "Board" });
        var bed = await Post<IdResponse>("/api/surveys/masters/items", new { code = "TEST_BED", name = "Test king bed", volumeCbm = 5, description = "Large bed" });
        await Post<IdResponse>("/api/surveys/masters/box-types", new { code = "TEST_MED", name = "Test medium", capacityCbm = 3, description = "Medium box", materials = new[] { new { materialId = cardboard.Id, quantity = 2 } } });
        await Post<IdResponse>("/api/surveys/masters/box-types", new { code = "TEST_LARGE", name = "Test large", capacityCbm = 5, description = "Large box", materials = new[] { new { materialId = cardboard.Id, quantity = 4 } } });
        var survey = await Post<IdResponse>("/api/surveys", new { surveyNumber = "SVY-001", salesLeadId = (Guid?)null, customerName = "Customer One", phone = "123", email = "customer@example.test", assignedEmployeeId = employee.Id, scheduledAtUtc = DateTimeOffset.UtcNow.AddDays(2), address = "Customer address", notes = "Initial survey" });
        var detail = await Put<SurveyDetailResponse>($"/api/surveys/{survey.Id}/details", new { rooms = new[] { new { name = "Bedroom", displayOrder = 1, items = new[] { new { householdItemId = bed.Id, quantity = 1, volumePerUnitCbm = 5, notes = "Do not split" } } } }, extraMaterials = Array.Empty<object>() });
        var box = Assert.Single(detail.PackingPlan.Boxes); Assert.Equal("Test large", box.BoxTypeName); Assert.Equal(5m, box.UsedCbm); Assert.Empty(detail.PackingPlan.UnboxedItems); Assert.Equal(40m, detail.PackingPlan.EstimatedMaterialCost);
        var link = await Post<LinkResponse>($"/api/surveys/{survey.Id}/confirmation-link", new { validDays = 7 }); var token = new Uri(link.Url).Segments.Last();
        _client.DefaultRequestHeaders.Authorization = null;
        var publicSurvey = await _client.GetFromJsonAsync<PublicSurveyResponse>($"/api/public/surveys/{token}"); Assert.NotNull(publicSurvey); Assert.Equal(5m, publicSurvey.TotalVolumeCbm);
        var confirmed = await Post<PublicSurveyResponse>($"/api/public/surveys/{token}/confirm-schedule", new { scheduledAtUtc = DateTimeOffset.UtcNow.AddDays(3), address = "Confirmed location", latitude = 12.34, longitude = 56.78, notes = "Gate 2" }); Assert.True(confirmed.ScheduleConfirmed);
        confirmed = await Post<PublicSurveyResponse>($"/api/public/surveys/{token}/confirm-items", new { notes = "Items are correct" }); Assert.True(confirmed.ItemsConfirmed);
    }

    [Fact]
    public async Task Customer_link_requests_inventory_changes_for_staff_review_and_both_sides_can_attach_files()
    {
        var storageRoot = Path.Combine(Path.GetTempPath(), $"movers-survey-files-{Guid.NewGuid():N}");
        await using var factory = _factory.WithWebHostBuilder(builder => { builder.UseSetting("Storage:Provider", "Local"); builder.UseSetting("Storage:LocalRoot", storageRoot); });
        _client = factory.CreateClient();
        try
        {
            await LoginAndSelectTenant();
            var designation = await Post<IdResponse>("/api/designations", new { code = "SURVEYOR", name = "Surveyor", level = 3, description = "Survey staff" });
            var employee = await Post<IdResponse>("/api/employees", new { employeeNumber = "SV-002", firstName = "Sue", lastName = "Surveyor", workEmail = "sue@example.test", phone = "100", joiningDate = "2026-01-01", designationId = designation.Id, reportsToEmployeeId = (Guid?)null });
            var sofa = await Post<IdResponse>("/api/surveys/masters/items", new { code = "TEST_SOFA", name = "Test sofa", volumeCbm = 2, description = (string?)null });
            var table = await Post<IdResponse>("/api/surveys/masters/items", new { code = "TEST_TABLE", name = "Test table", volumeCbm = 1, description = (string?)null });
            var survey = await Post<IdResponse>("/api/surveys", new { surveyNumber = "", salesLeadId = (Guid?)null, customerName = "Customer Two", phone = "123", email = (string?)null, assignedEmployeeId = employee.Id, scheduledAtUtc = DateTimeOffset.UtcNow.AddDays(2), address = "Address", notes = (string?)null });
            var detail = await Put<ChangeDetailResponse>($"/api/surveys/{survey.Id}/details", new { rooms = new[] { new { name = "Lounge", displayOrder = 1, items = new[] { new { householdItemId = sofa.Id, quantity = 1, volumePerUnitCbm = (decimal?)null, notes = (string?)null } } } }, extraMaterials = Array.Empty<object>() });
            var sofaLine = Assert.Single(Assert.Single(detail.Rooms).Items);
            var link = await Post<LinkResponse>($"/api/surveys/{survey.Id}/confirmation-link", new { validDays = 7 }); var token = new Uri(link.Url).Segments.Last();
            var staffAuth = _client.DefaultRequestHeaders.Authorization; _client.DefaultRequestHeaders.Authorization = null;

            var catalog = await _client.GetFromJsonAsync<List<IdResponse>>($"/api/public/surveys/{token}/catalog");
            Assert.Contains(catalog!, x => x.Id == table.Id);
            var empty = await _client.PostAsJsonAsync($"/api/public/surveys/{token}/changes", new { removedItems = Array.Empty<object>(), addedItems = Array.Empty<object>() });
            Assert.Equal(System.Net.HttpStatusCode.BadRequest, empty.StatusCode);
            var requested = await Post<PublicChangeResponse>($"/api/public/surveys/{token}/changes", new { removedItems = new[] { new { surveyItemId = sofaLine.Id, reason = "Selling it" } }, addedItems = new[] { new { roomName = "Study", householdItemId = table.Id, quantity = 2, notes = "Glass top" } }, notes = "Updated list" });
            Assert.NotNull(requested.CustomerChanges); Assert.False(requested.ItemsConfirmed);
            Assert.Equal(2m, requested.TotalVolumeCbm); // inventory unchanged until staff applies the request

            var upload = await Post<UploadResponse>($"/api/public/surveys/{token}/upload-requests", new { fileName = "lounge.jpg", contentType = "image/jpeg", sizeBytes = 3 });
            (await _client.PutAsync(upload.UploadUrl, new ByteArrayContent([1, 2, 3]))).EnsureSuccessStatusCode();
            await Post<IdResponse>($"/api/public/surveys/{token}/attachments/{upload.AttachmentId}/complete", new { });

            _client.DefaultRequestHeaders.Authorization = staffAuth;
            var staffUpload = await Post<UploadResponse>($"/api/surveys/{survey.Id}/attachments/upload-requests", new { fileName = "plan.pdf", contentType = "application/pdf", sizeBytes = 4 });
            (await _client.PutAsync(staffUpload.UploadUrl, new ByteArrayContent([1, 2, 3, 4]))).EnsureSuccessStatusCode();
            await Post<IdResponse>($"/api/surveys/{survey.Id}/attachments/{staffUpload.AttachmentId}/complete", new { });
            var files = await _client.GetFromJsonAsync<List<AttachmentResponse>>($"/api/surveys/{survey.Id}/attachments");
            Assert.Equal(["STAFF", "CUSTOMER"], files!.Select(x => x.Source));
            Assert.Single((await _client.GetFromJsonAsync<List<AttachmentResponse>>($"/api/public/surveys/{token}/attachments"))!);

            var applied = await Post<ChangeDetailResponse>($"/api/surveys/{survey.Id}/customer-changes/apply", new { });
            Assert.Null(applied.CustomerChanges);
            var study = Assert.Single(applied.Rooms, r => r.Name == "Study"); Assert.Equal(2, Assert.Single(study.Items).Quantity);
            Assert.Empty(Assert.Single(applied.Rooms, r => r.Name == "Lounge").Items);
            Assert.Equal(System.Net.HttpStatusCode.NoContent, (await _client.DeleteAsync($"/api/surveys/{survey.Id}/attachments/{staffUpload.AttachmentId}")).StatusCode);
            Assert.Single((await _client.GetFromJsonAsync<List<AttachmentResponse>>($"/api/surveys/{survey.Id}/attachments"))!);
        }
        finally { if (Directory.Exists(storageRoot)) Directory.Delete(storageRoot, true); }
    }

    [Fact]
    public async Task Survey_trip_tracks_active_time_excluding_pauses_distance_surveyor_and_expenses()
    {
        await LoginAndSelectTenant();
        var designation = await Post<IdResponse>("/api/designations", new { code = "SURVEYOR", name = "Surveyor", level = 3, description = "Survey staff" });
        var assigned = await Post<IdResponse>("/api/employees", new { employeeNumber = "SV-003", firstName = "Ann", lastName = "Assigned", workEmail = "ann@example.test", phone = "100", joiningDate = "2026-01-01", designationId = designation.Id, reportsToEmployeeId = (Guid?)null });
        var substitute = await Post<IdResponse>("/api/employees", new { employeeNumber = "SV-004", firstName = "Ben", lastName = "Backup", workEmail = "ben@example.test", phone = "101", joiningDate = "2026-01-01", designationId = designation.Id, reportsToEmployeeId = (Guid?)null });
        var survey = await Post<IdResponse>("/api/surveys", new { surveyNumber = "", salesLeadId = (Guid?)null, customerName = "Customer Three", phone = "123", email = (string?)null, assignedEmployeeId = assigned.Id, scheduledAtUtc = DateTimeOffset.UtcNow.AddHours(1), address = "Address", notes = (string?)null });
        var now = DateTimeOffset.UtcNow;

        await Post<TripDetailResponse>($"/api/surveys/{survey.Id}/start", new { at = now.AddHours(-3) });
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/surveys/{survey.Id}/pause", new { at = now.AddHours(-2) })).StatusCode); // reason required
        var paused = await Post<TripDetailResponse>($"/api/surveys/{survey.Id}/pause", new { at = now.AddHours(-2), reason = "Vehicle breakdown" });
        Assert.True(paused.Trip.IsPaused);
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/surveys/{survey.Id}/resume", new { at = now.AddHours(-4) })).StatusCode); // before previous step
        await Post<TripDetailResponse>($"/api/surveys/{survey.Id}/resume", new { at = now.AddMinutes(-90) });
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/surveys/{survey.Id}/complete", new { at = now.AddMinutes(-30) })).StatusCode); // distance required
        var completed = await Post<TripDetailResponse>($"/api/surveys/{survey.Id}/complete", new { at = now.AddMinutes(-30), distanceKm = 42.5, conductedByEmployeeId = substitute.Id });
        Assert.Equal("COMPLETED", completed.Survey.Status);
        Assert.Equal(2 * 3600, completed.Trip.ActiveSeconds); // 2.5h trip minus a 30 minute pause
        Assert.Equal(30 * 60, completed.Trip.PausedSeconds);
        Assert.Equal(42.5m, completed.Trip.DistanceKm); Assert.Equal("Ben Backup", completed.Trip.ConductedByName);
        Assert.Equal(["STARTED", "PAUSED", "RESUMED", "COMPLETED"], completed.Trip.Events.Select(e => e.Type));

        await Post<TripDetailResponse>($"/api/surveys/{survey.Id}/expenses", new { category = "fuel", amount = 500, currency = "inr", incurredAtUtc = now.AddHours(-3), paidByEmployeeId = substitute.Id, notes = "Petrol" });
        var withToll = await Post<TripDetailResponse>($"/api/surveys/{survey.Id}/expenses", new { category = "TOLL", amount = 120.50, currency = "INR", incurredAtUtc = now.AddHours(-2), paidByEmployeeId = (Guid?)null, notes = (string?)null });
        Assert.Equal(620.50m, Assert.Single(withToll.Trip.ExpenseTotals).Amount);
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/surveys/{survey.Id}/expenses", new { category = "LUNCH_PARTY", amount = 10, currency = "INR", incurredAtUtc = now })).StatusCode);
        var toll = withToll.Trip.Expenses.Single(x => x.Category == "TOLL");
        var edited = await Put<TripDetailResponse>($"/api/surveys/{survey.Id}/expenses/{toll.Id}", new { category = "TOLL", amount = 150, currency = "INR", incurredAtUtc = now.AddHours(-2), paidByEmployeeId = (Guid?)null, notes = "Highway toll" });
        Assert.Equal(650m, Assert.Single(edited.Trip.ExpenseTotals).Amount);
        var afterDelete = await _client.DeleteAsync($"/api/surveys/{survey.Id}/expenses/{toll.Id}"); afterDelete.EnsureSuccessStatusCode();
        Assert.Equal(500m, Assert.Single((await afterDelete.Content.ReadFromJsonAsync<TripDetailResponse>())!.Trip.ExpenseTotals).Amount);
        var corrected = await Put<TripDetailResponse>($"/api/surveys/{survey.Id}/trip", new { distanceKm = 40, conductedByEmployeeId = substitute.Id });
        Assert.Equal(40m, corrected.Trip.DistanceKm);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("  customer@example.test  ")]
    public async Task Survey_accepts_optional_email_and_rejects_invalid_nonblank_email(string? email)
    {
        await LoginAndSelectTenant();
        var designation = await Post<IdResponse>("/api/designations", new { code = "SURVEYOR", name = "Surveyor", level = 3 });
        var employee = await Post<IdResponse>("/api/employees", new { firstName = "Sam", lastName = "Surveyor", workEmail = "sam@example.test", phone = "100", joiningDate = "2026-01-01", designationId = designation.Id });
        var input = new { customerName = "Optional Email", phone = "123", email, assignedEmployeeId = employee.Id, scheduledAtUtc = DateTimeOffset.UtcNow.AddDays(1), address = "Survey address" };
        var created = await _client.PostAsJsonAsync("/api/surveys", input);
        created.EnsureSuccessStatusCode();
        var data = await created.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var id = data.GetProperty("id").GetGuid();
        Assert.Equal(string.IsNullOrWhiteSpace(email) ? null : email.Trim(), data.GetProperty("email").GetString());
        (await _client.PutAsJsonAsync($"/api/surveys/{id}", input)).EnsureSuccessStatusCode();
        var invalid = input with { email = "invalid-email" };
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync("/api/surveys", invalid)).StatusCode);
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, (await _client.PutAsJsonAsync($"/api/surveys/{id}", invalid)).StatusCode);
    }
    [Fact]
    public async Task Business_masters_are_editable_numbered_and_tenant_isolated()
    {
        await LoginAndSelectTenant();
        var created = new List<(string Kind, string Code)>();
        foreach (var kind in new[] { "crew-role", "payment-method", "payment-purpose", "expense-category", "customer", "vendor" })
        {
            var row = await Post<System.Text.Json.JsonElement>($"/api/business-masters/{kind}", new { name = "Custom " + kind, email = "", isActive = true, phone = "123", address = "Office address" });
            var code = row.GetProperty("code").GetString()!;
            Assert.Matches(@"^[A-Z]+-\d{8}-\d{6}$", code);
            created.Add((kind, code));
            if (kind is "customer" or "vendor") {
                var choices = await _client.GetFromJsonAsync<List<System.Text.Json.JsonElement>>($"/api/business-masters/{kind}/choices");
                Assert.Contains(choices!, x => x.GetProperty("code").GetString() == code && x.GetProperty("phone").GetString() == "123");
            }
            var updated = await Put<System.Text.Json.JsonElement>($"/api/business-masters/{kind}/{code}", new { name = "Updated " + kind, isActive = false });
            Assert.False(updated.GetProperty("isActive").GetBoolean());
            if (kind is "customer" or "vendor") {
                var choices = await _client.GetFromJsonAsync<List<System.Text.Json.JsonElement>>($"/api/business-masters/{kind}/choices");
                Assert.DoesNotContain(choices!, x => x.GetProperty("code").GetString() == code);
            }
            var listed = await _client.GetFromJsonAsync<List<System.Text.Json.JsonElement>>($"/api/business-masters/{kind}");
            Assert.Contains(listed!, x => x.GetProperty("code").GetString() == code && x.GetProperty("name").GetString() == "Updated " + kind);
        }
        await Put<object>("/api/business-masters/payment-method/CASH", new { name = "Cash payment", isActive = false });
        var methods = await _client.GetFromJsonAsync<List<System.Text.Json.JsonElement>>("/api/business-masters/payment-method");
        Assert.False(methods!.Single(x => x.GetProperty("code").GetString() == "CASH").GetProperty("isActive").GetBoolean());
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync("/api/business-masters/customer", new { name = "Invalid email", email = "bad" })).StatusCode);
        var second = await Post<TenantResponse>("/api/platform/tenants", new SaveTenantRequest("Second Master Tenant", "master-second", null, null, null));
        SetToken(await Post<LoginResponse>("/api/auth/select-tenant", new { tenantId = second.Id }));
        foreach (var (kind, code) in created)
        {
            var listed = await _client.GetFromJsonAsync<List<System.Text.Json.JsonElement>>($"/api/business-masters/{kind}");
            Assert.DoesNotContain(listed!, x => x.GetProperty("code").GetString() == code);
            Assert.Equal(System.Net.HttpStatusCode.NotFound, (await _client.PutAsJsonAsync($"/api/business-masters/{kind}/{code}", new { name = "Forbidden change", isActive = true })).StatusCode);
        }
        _client.DefaultRequestHeaders.Authorization = null;
        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/business-masters/customer")).StatusCode);
        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/business-masters/customer/choices")).StatusCode);
    }
    [Fact]
    public async Task Quick_customer_creation_preserves_details_and_is_tenant_scoped()
    {
        await LoginAndSelectTenant();
        var customer = await Post<System.Text.Json.JsonElement>("/api/business-masters/customer/quick-create", new {
            name = "Lead customer", phone = "123456", email = " lead@example.test ", address = "Collected origin address", notes = "Collected lead notes", isActive = false
        });
        var code = customer.GetProperty("code").GetString();
        Assert.Matches(@"^CUS-\d{8}-\d{6}$", code!);
        Assert.True(customer.GetProperty("isActive").GetBoolean());
        Assert.Equal("lead@example.test", customer.GetProperty("email").GetString());
        var choices = await _client.GetFromJsonAsync<List<System.Text.Json.JsonElement>>("/api/business-masters/customer/choices");
        var saved = Assert.Single(choices!, x => x.GetProperty("code").GetString() == code);
        Assert.Equal("123456", saved.GetProperty("phone").GetString());
        Assert.Equal("Collected origin address", saved.GetProperty("address").GetString());
        Assert.Equal("Collected lead notes", saved.GetProperty("notes").GetString());
        Assert.Equal(System.Net.HttpStatusCode.NotFound, (await _client.PostAsJsonAsync("/api/business-masters/vendor/quick-create", new { name = "Not a customer" })).StatusCode);
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync("/api/business-masters/customer/quick-create", new { name = "Invalid", email = "invalid" })).StatusCode);
        var second = await Post<TenantResponse>("/api/platform/tenants", new SaveTenantRequest("Other quick customer tenant", "quick-customer-other", null, null, null));
        SetToken(await Post<LoginResponse>("/api/auth/select-tenant", new { tenantId = second.Id }));
        var otherChoices = await _client.GetFromJsonAsync<List<System.Text.Json.JsonElement>>("/api/business-masters/customer/choices");
        Assert.DoesNotContain(otherChoices!, x => x.GetProperty("code").GetString() == code);
        _client.DefaultRequestHeaders.Authorization = null;
        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, (await _client.PostAsJsonAsync("/api/business-masters/customer/quick-create", new { name = "Anonymous" })).StatusCode);
    }
    private async Task LoginAndSelectTenant()
    {
        var login = await Post<LoginResponse>("/api/auth/login", new { email = "admin@movers.local", password = "ChangeMe123!" }); SetToken(login);
        var tenant = await Post<TenantResponse>("/api/platform/tenants", new SaveTenantRequest("Survey Test", "survey-test", null, null, null));
        SetToken(await Post<LoginResponse>("/api/auth/select-tenant", new { tenantId = tenant.Id }));
        (await _client.PostAsJsonAsync("/api/currencies/rates",new{currency="INR",date="2020-01-01",usdPerUnit=0.012m})).EnsureSuccessStatusCode();
    }
    private async Task<T> Post<T>(string url, object body) { var response = await _client.PostAsJsonAsync(url, body); response.EnsureSuccessStatusCode(); return (await response.Content.ReadFromJsonAsync<T>())!; }
    private async Task<T> Put<T>(string url, object body) { var response = await _client.PutAsJsonAsync(url, body); response.EnsureSuccessStatusCode(); return (await response.Content.ReadFromJsonAsync<T>())!; }
    private void SetToken(LoginResponse x) => _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", x.AccessToken);
    public async Task DisposeAsync() { _client.Dispose(); await _factory.DisposeAsync(); SqliteConnection.ClearAllPools(); if (File.Exists(_databasePath)) File.Delete(_databasePath); }
    private sealed record LoginResponse(string AccessToken);
    private sealed record IdResponse(Guid Id);
    private sealed record LinkResponse(string Url);
    private sealed record SurveyDetailResponse(PackingPlanResponse PackingPlan);
    private sealed record PackingPlanResponse(List<BoxResponse> Boxes, List<object> UnboxedItems, decimal EstimatedMaterialCost);
    private sealed record BoxResponse(string BoxTypeName, decimal UsedCbm);
    private sealed record PublicSurveyResponse(decimal TotalVolumeCbm, bool ScheduleConfirmed, bool ItemsConfirmed);
    private sealed record ItemLineResponse(Guid Id, int Quantity);
    private sealed record RoomResponse(string Name, List<ItemLineResponse> Items);
    private sealed record ChangeDetailResponse(List<RoomResponse> Rooms, object? CustomerChanges);
    private sealed record PublicChangeResponse(decimal TotalVolumeCbm, bool ItemsConfirmed, object? CustomerChanges);
    private sealed record UploadResponse(Guid AttachmentId, string UploadUrl);
    private sealed record AttachmentResponse(Guid Id, string Source);
    private sealed record StatusResponse(string Status);
    private sealed record TripEventResponse(string Type);
    private sealed record ExpenseResponse(Guid Id, string Category, decimal Amount);
    private sealed record TotalResponse(string Currency, decimal Amount);
    private sealed record TripResponse(bool IsPaused, long ActiveSeconds, long PausedSeconds, decimal? DistanceKm, string? ConductedByName, List<TripEventResponse> Events, List<ExpenseResponse> Expenses, List<TotalResponse> ExpenseTotals);
    private sealed record TripDetailResponse(StatusResponse Survey, TripResponse Trip);
}




