using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Movers.Api.Contracts.Tenants;
using Movers.Services.Sales;

namespace Movers.Api.Tests;

public sealed class SalesLeadApiTests : IAsyncLifetime
{
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"movers-sales-{Guid.NewGuid():N}.db");
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;
    private readonly FakeGateway _gateway = new();
    private readonly FakeClaudeGateway _claude = new();
    private readonly FakeUploader _uploader = new();

    public Task InitializeAsync()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Database:Provider", "Sqlite");
            builder.UseSetting("ConnectionStrings:Sqlite", $"Data Source={_databasePath}");
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IAwsObjectStorage>(); services.AddSingleton<IAwsObjectStorage, FakeStorage>();
                services.RemoveAll<IInventoryVisionGateway>(); services.AddSingleton<IInventoryVisionGateway>(_gateway);
                services.RemoveAll<IClaudeVisionGateway>(); services.AddSingleton<IClaudeVisionGateway>(_claude);
                services.RemoveAll<IObjectUploader>(); services.AddSingleton<IObjectUploader>(_uploader);
            });
        });
        _client = _factory.CreateClient();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task Tenant_can_manage_sales_leads_and_follow_ups()
    {
        await LoginAndSelectTenantAsync();
        var leadStatuses = await _client.GetFromJsonAsync<List<StatusResponse>>("/api/sales/statuses/leads");
        var followStatuses = await _client.GetFromJsonAsync<List<StatusResponse>>("/api/sales/statuses/follow-ups");
        var moveTypes = await _client.GetFromJsonAsync<List<MoveTypeResponse>>("/api/sales/statuses/move-types");
        Assert.Equal(6, leadStatuses!.Count);
        Assert.Equal(5, followStatuses!.Count);
        Assert.Equal(5, moveTypes!.Count);
        var newStatus = leadStatuses.Single(x => x.Code == "NEW");
        var planned = followStatuses.Single(x => x.Code == "PLANNED");
        var household = moveTypes.Single(x => x.Code == "HOUSEHOLD");
        var employeeId = await CreateAssignedEmployeeAsync();
        var aws = await _client.PutAsJsonAsync("/api/settings/aws", new { region = "ap-south-1", bucketName = "movers-test-uploads", accessKey = "AKIAEXAMPLE123456789", secretKey = "example-secret-key-for-tests" });
        aws.EnsureSuccessStatusCode();

        var first = await CreateLeadAsync("LEAD-001", "Northwind Traders", newStatus.Id, household.Id, employeeId);
        var second = await CreateLeadAsync("LEAD-002", "Contoso Ltd", newStatus.Id, household.Id, employeeId);

        var leads = await _client.GetFromJsonAsync<List<LeadResponse>>("/api/sales/leads");
        Assert.NotNull(leads);
        Assert.Equal([second.Id, first.Id], leads.Select(x => x.Id));
        Assert.Matches(@"^LD-\d{8}-\d{6}$", leads[1].LeadNumber);
        Assert.NotEqual(first.LeadNumber, second.LeadNumber);

        var followUpResponse = await _client.PostAsJsonAsync($"/api/sales/leads/{first.Id}/follow-ups", new
        {
            scheduledAtUtc = new DateTimeOffset(DateTime.UtcNow.Date.AddHours(12), TimeSpan.Zero),
            statusId = planned.Id,
            notes = "Customer confirmed the initial requirements.",
            nextFollowUpAtUtc = (DateTimeOffset?)null
        });
        followUpResponse.EnsureSuccessStatusCode();
        var followUp = (await followUpResponse.Content.ReadFromJsonAsync<FollowUpResponse>())!;
        Assert.Equal("Planned", followUp.StatusName);

        var followUps = await _client.GetFromJsonAsync<List<FollowUpResponse>>($"/api/sales/leads/{first.Id}/follow-ups");
        Assert.Equal(followUp.Id, Assert.Single(followUps!).Id);

        var surveyResponse = await _client.PostAsJsonAsync("/api/surveys", new { surveyNumber = "SVY-TASK-001", salesLeadId = first.Id, customerName = "Northwind Traders", phone = "+91 90000 00000", email = "customer@example.test", assignedEmployeeId = employeeId, scheduledAtUtc = DateTimeOffset.UtcNow, address = "Chennai", notes = "Task aggregation regression" });
        surveyResponse.EnsureSuccessStatusCode();
        var tasks = await _client.GetFromJsonAsync<List<TaskResponse>>("/api/tasks/mine");
        Assert.Equal(2, tasks!.Count);
        var task = Assert.Single(tasks, x => x.Type == "sales_follow_up");
        Assert.Equal("sales_follow_up", task.Type);
        Assert.Contains("Northwind Traders", task.Title);
        Assert.Contains(tasks, x => x.Type == "survey");

        var tooShort = await _client.PostAsJsonAsync($"/api/sales/leads/{first.Id}/upload-links", new { validDays = 4 });
        Assert.Equal(HttpStatusCode.BadRequest, tooShort.StatusCode);
        var linkResponse = await _client.PostAsJsonAsync($"/api/sales/leads/{first.Id}/upload-links", new { validDays = 5 });
        linkResponse.EnsureSuccessStatusCode();
        var generated = (await linkResponse.Content.ReadFromJsonAsync<GeneratedLinkResponse>())!;
        Assert.True(generated.Link.ExpiresAtUtc >= DateTimeOffset.UtcNow.AddDays(4.9));
        var shareToken = new Uri(generated.Url).Segments.Last().Trim('/');
        var publicInfo = await _client.GetFromJsonAsync<PublicInfoResponse>($"/api/public/lead-uploads/{shareToken}");
        Assert.Equal("Northwind Traders", publicInfo!.CustomerName);
        var requestResponse = await _client.PostAsJsonAsync($"/api/public/lead-uploads/{shareToken}/upload-requests", new { fileName = "room-video.mp4", contentType = "video/mp4", sizeBytes = 1024 });
        requestResponse.EnsureSuccessStatusCode();
        var upload = (await requestResponse.Content.ReadFromJsonAsync<UploadResponse>())!;
        var complete = await _client.PostAsync($"/api/public/lead-uploads/{shareToken}/attachments/{upload.AttachmentId}/complete", null);
        complete.EnsureSuccessStatusCode();
        var files = await _client.GetFromJsonAsync<List<AttachmentResponse>>($"/api/sales/leads/{first.Id}/attachments");
        Assert.Equal("room-video.mp4", Assert.Single(files!).OriginalFileName);

        var withoutNumber = System.Text.Json.JsonSerializer.SerializeToNode(
            LeadRequest("", "Automatic", newStatus.Id, household.Id, employeeId))!.AsObject();
        withoutNumber.Remove("leadNumber");
        var automaticResponse = await _client.PostAsJsonAsync("/api/sales/leads", withoutNumber);
        automaticResponse.EnsureSuccessStatusCode();
        var automatic = (await automaticResponse.Content.ReadFromJsonAsync<LeadResponse>())!;
        Assert.Matches(@"^LD-\d{8}-\d{6}$", automatic.LeadNumber);
        var editedResponse = await _client.PutAsJsonAsync($"/api/sales/leads/{automatic.Id}",
            LeadRequest("MANUAL-OVERRIDE", "Automatic edited", newStatus.Id, household.Id, employeeId));
        editedResponse.EnsureSuccessStatusCode();
        Assert.Equal(automatic.LeadNumber, (await editedResponse.Content.ReadFromJsonAsync<LeadResponse>())!.LeadNumber);

        var duplicate = await _client.PostAsJsonAsync("/api/sales/leads", LeadRequest("lead-001", "Duplicate", newStatus.Id, household.Id, employeeId));
        Assert.Equal(HttpStatusCode.OK, duplicate.StatusCode);

        var audit = await _client.GetFromJsonAsync<List<AuditResponse>>("/api/security/audit");
        Assert.Contains(audit!, x => x.EntityType == "SalesLead" && x.ActorEmail == "admin@movers.local");
        Assert.Contains(audit!, x => x.EntityType == "LeadFollowUp");
        Assert.Contains(audit!, x => x.EntityType == "LeadStatus");
        Assert.Contains(audit!, x => x.EntityType == "FollowUpStatus");
        Assert.Contains(audit!, x => x.EntityType == "MoveType");
    }

    [Fact]
    public async Task Staff_video_is_analysed_from_s3_frames_and_narration_into_rooms_boxes_and_fragile_items()
    {
        await LoginAndSelectTenantAsync();
        var newStatus = (await _client.GetFromJsonAsync<List<StatusResponse>>("/api/sales/statuses/leads"))!.Single(x => x.Code == "NEW");
        var household = (await _client.GetFromJsonAsync<List<MoveTypeResponse>>("/api/sales/statuses/move-types"))!.Single(x => x.Code == "HOUSEHOLD");
        (await _client.PutAsJsonAsync("/api/settings/aws", new { region = "ap-south-1", bucketName = "movers-test-uploads", accessKey = "AKIAEXAMPLE123456789", secretKey = "example-secret-key-for-tests" })).EnsureSuccessStatusCode();
        (await _client.PutAsJsonAsync("/api/settings/openai", new { apiKey = "sk-test-0123456789abcdefghijklmnop", extractionModel = "gpt-test-vision", transcriptionModel = "gpt-test-transcribe", inputPricePerMillion = 0.4m, cachedInputPricePerMillion = 0.1m, outputPricePerMillion = 1.6m, transcriptionPricePerMinute = 0.003m })).EnsureSuccessStatusCode();
        (await _client.PostAsJsonAsync("/api/surveys/masters/box-types", new { code = "BOOKS", name = "Book carton", capacityCbm = 0.06m, description = (string?)null, materials = Array.Empty<object>() })).EnsureSuccessStatusCode();
        (await _client.PostAsJsonAsync("/api/surveys/masters/items", new { code = "TV_TEST", name = "Television", volumeCbm = 0.4m, description = (string?)null })).EnsureSuccessStatusCode();
        var lead = await CreateLeadAsync("LEAD-VID", "Video customer", newStatus.Id, household.Id, await CreateAssignedEmployeeAsync());

        // Staff records a walk-through video on the lead (no customer link involved).
        var upload = await (await _client.PostAsJsonAsync($"/api/sales/leads/{lead.Id}/attachments/upload-requests", new { fileName = "walkthrough.mp4", contentType = "video/mp4", sizeBytes = 1024 })).Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var attachmentId = upload.GetProperty("attachmentId").GetGuid();
        Assert.Equal(HttpStatusCode.OK, (await _client.PostAsync($"/api/sales/leads/{lead.Id}/attachments/{attachmentId}/complete", null)).StatusCode);
        Assert.Contains((await _client.GetFromJsonAsync<List<System.Text.Json.JsonElement>>($"/api/sales/leads/{lead.Id}/attachments"))!, a => a.GetProperty("id").GetGuid() == attachmentId);
        Assert.Empty((await _client.GetFromJsonAsync<List<System.Text.Json.JsonElement>>($"/api/sales/leads/{lead.Id}/upload-links"))!);

        var jpeg = "data:image/jpeg;base64," + Convert.ToBase64String([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
        // Two seconds of 16 kHz mono 16-bit sound (byte rate 32000 at header offset 28).
        var wav = new byte[44 + 64000]; "RIFF"u8.CopyTo(wav); "WAVE"u8.CopyTo(wav.AsSpan(8)); BitConverter.GetBytes(32000).CopyTo(wav, 28);
        var audio = "data:audio/wav;base64," + Convert.ToBase64String(wav);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/sales/leads/{lead.Id}/attachments/{attachmentId}/extract", new { frames = Enumerable.Repeat(jpeg, 21).ToArray() })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/sales/leads/{lead.Id}/attachments/{attachmentId}/extract", new { frames = new[] { jpeg }, audio = "data:audio/wav;base64,AAAA" })).StatusCode);

        var result = await (await _client.PostAsJsonAsync($"/api/sales/leads/{lead.Id}/attachments/{attachmentId}/extract", new { frames = Enumerable.Repeat(jpeg, 12).ToArray(), audio })).Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(12, result.GetProperty("framesAnalysed").GetInt32());
        Assert.Equal("Three boxes of books in the study", result.GetProperty("transcript").GetString());
        var tv = result.GetProperty("items").EnumerateArray().Single(i => i.GetProperty("name").GetString() == "Television");
        Assert.True(tv.GetProperty("fragile").GetBoolean()); Assert.Equal("Living room", tv.GetProperty("room").GetString());
        Assert.Equal(JsonValueKindNull, result.GetProperty("items").EnumerateArray().Single(i => i.GetProperty("name").GetString() == "Sofa").GetProperty("room").ValueKind);
        Assert.Equal(3, result.GetProperty("boxes")[0].GetProperty("quantity").GetInt32());

        // Approximate cost: (10,000 uncached x 0.4 + 2,000 cached x 0.1 + 800 output x 1.6) / 1M = 0.00548, plus 2 s of sound at 0.003/min = 0.0001.
        var usage = result.GetProperty("usage");
        Assert.Equal(12000, usage.GetProperty("inputTokens").GetInt32());
        Assert.Equal(2m, usage.GetProperty("audioSeconds").GetDecimal());
        Assert.Equal(0.00558m, usage.GetProperty("cost").GetDecimal());
        Assert.Equal(1, result.GetProperty("inventory").GetProperty("aiRuns").GetInt32());

        // OpenAI got S3 presigned links (frames stored next to the video), the narration and the tenant's box types.
        Assert.Equal(12, _uploader.Puts);
        Assert.All(_gateway.Last!.Images, url => Assert.StartsWith("https://s3.example.test/", url));
        Assert.Equal("Three boxes of books in the study", _gateway.Last.Transcript);
        Assert.Contains(_gateway.Last.BoxTypes, b => b.StartsWith("Book carton"));
        Assert.Equal("gpt-test-transcribe", _gateway.TranscriptionModel);

        // The result is kept on the attachment for later review.
        var saved = (await _client.GetFromJsonAsync<List<System.Text.Json.JsonElement>>($"/api/sales/leads/{lead.Id}/attachments"))!.Single(a => a.GetProperty("id").GetGuid() == attachmentId);
        Assert.Contains("Book carton", saved.GetProperty("extractionJson").GetString());

        // Stored on the lead: Television uses the master volume (0.4), the sofa the AI estimate (2.0), 3 book cartons x 0.06.
        var inv = result.GetProperty("inventory");
        Assert.Equal(0.4m + 2.0m + 0.18m, inv.GetProperty("expectedCbm").GetDecimal());
        Assert.Equal(1, inv.GetProperty("fragileItems").GetInt32());
        Assert.Equal(3, inv.GetProperty("boxCount").GetInt32());
        var leadRow = (await _client.GetFromJsonAsync<List<System.Text.Json.JsonElement>>("/api/sales/leads"))!.Single(l => l.GetProperty("id").GetGuid() == lead.Id);
        Assert.Equal(2.58m, leadRow.GetProperty("expectedCbm").GetDecimal());
        Assert.Equal(1, leadRow.GetProperty("fragileItems").GetInt32());

        // Staff adds a manual line; extracting the same video again replaces only that video's lines.
        var lines = inv.GetProperty("lines").EnumerateArray().Select(l => new { kind = l.GetProperty("kind").GetString(), room = l.GetProperty("room").GetString(), name = l.GetProperty("name").GetString(), quantity = l.GetProperty("quantity").GetInt32(), unitCbm = l.GetProperty("unitCbm").GetDecimal(), fragile = l.GetProperty("fragile").GetBoolean(), handling = (string?)null, notes = (string?)null, sourceAttachmentId = (Guid?)l.GetProperty("sourceAttachmentId").GetGuid() }).ToList();
        lines.Add(new { kind = "ITEM", room = (string?)"Garage", name = "Bicycle", quantity = 2, unitCbm = 0.5m, fragile = false, handling = (string?)null, notes = (string?)null, sourceAttachmentId = (Guid?)null });
        var edited = await (await _client.PutAsJsonAsync($"/api/sales/leads/{lead.Id}/inventory", new { lines })).Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(3.58m, edited.GetProperty("expectedCbm").GetDecimal());
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PutAsJsonAsync($"/api/sales/leads/{lead.Id}/inventory", new { lines = new[] { new { kind = "ITEM", name = "Bad", quantity = 0, unitCbm = 1m, fragile = false } } })).StatusCode);
        await _client.PostAsJsonAsync($"/api/sales/leads/{lead.Id}/attachments/{attachmentId}/extract", new { frames = new[] { jpeg } });
        var after = await _client.GetFromJsonAsync<System.Text.Json.JsonElement>($"/api/sales/leads/{lead.Id}/inventory");
        Assert.Equal(3.58m, after.GetProperty("expectedCbm").GetDecimal());
        Assert.Single(after.GetProperty("lines").EnumerateArray(), l => l.GetProperty("name").GetString() == "Bicycle");
        Assert.Single(after.GetProperty("lines").EnumerateArray(), l => l.GetProperty("name").GetString() == "Television");
        // Both runs are kept on the lead; the second (pictures only) cost 0.00548.
        Assert.Equal(2, after.GetProperty("aiRuns").GetInt32());
        Assert.Equal(0.01106m, after.GetProperty("aiCost").GetDecimal());
        var summary = await _client.GetFromJsonAsync<System.Text.Json.JsonElement>("/api/settings/openai/usage");
        Assert.True(summary.GetProperty("pricesConfigured").GetBoolean());
        Assert.Equal(2, summary.GetProperty("thisMonth").GetProperty("runs").GetInt32());
        Assert.Equal(0.0111m, summary.GetProperty("allTime").GetProperty("cost").GetDecimal());
        Assert.Equal(lead.LeadNumber, summary.GetProperty("recent")[0].GetProperty("leadNumber").GetString());
    }

    [Fact]
    public async Task Claude_selected_in_the_dialog_reads_the_s3_frames_and_openai_transcribes_the_narration()
    {
        await LoginAndSelectTenantAsync();
        var newStatus = (await _client.GetFromJsonAsync<List<StatusResponse>>("/api/sales/statuses/leads"))!.Single(x => x.Code == "NEW");
        var household = (await _client.GetFromJsonAsync<List<MoveTypeResponse>>("/api/sales/statuses/move-types"))!.Single(x => x.Code == "HOUSEHOLD");
        (await _client.PutAsJsonAsync("/api/settings/aws", new { region = "ap-south-1", bucketName = "movers-test-uploads", accessKey = "AKIAEXAMPLE123456789", secretKey = "example-secret-key-for-tests" })).EnsureSuccessStatusCode();
        var lead = await CreateLeadAsync("LEAD-CLAUDE", "Claude customer", newStatus.Id, household.Id, await CreateAssignedEmployeeAsync());
        var upload = await (await _client.PostAsJsonAsync($"/api/sales/leads/{lead.Id}/attachments/upload-requests", new { fileName = "walkthrough.mp4", contentType = "video/mp4", sizeBytes = 1024 })).Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var attachmentId = upload.GetProperty("attachmentId").GetGuid();
        (await _client.PostAsync($"/api/sales/leads/{lead.Id}/attachments/{attachmentId}/complete", null)).EnsureSuccessStatusCode();
        var jpeg = "data:image/jpeg;base64," + Convert.ToBase64String([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
        var wav = new byte[44 + 64000]; "RIFF"u8.CopyTo(wav); "WAVE"u8.CopyTo(wav.AsSpan(8)); BitConverter.GetBytes(32000).CopyTo(wav, 28);
        var audio = "data:audio/wav;base64," + Convert.ToBase64String(wav);
        var extractUrl = $"/api/sales/leads/{lead.Id}/attachments/{attachmentId}/extract";

        // Nothing configured yet: no providers, and choosing Claude explains what to set up.
        var none = await _client.GetFromJsonAsync<System.Text.Json.JsonElement>("/api/sales/extraction-providers");
        Assert.Empty(none.GetProperty("providers").EnumerateArray());
        var missing = await _client.PostAsJsonAsync(extractUrl, new { frames = new[] { jpeg }, provider = "claude" });
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        Assert.Contains("Claude configuration", await missing.Content.ReadAsStringAsync());

        // Claude settings: key required first time, model must be a Claude model, the key is never returned.
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PutAsJsonAsync("/api/settings/claude", new { apiKey = (string?)null, extractionModel = "claude-opus-5-5", effort = "medium" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PutAsJsonAsync("/api/settings/claude", new { apiKey = "sk-ant-test-0123456789abcdefghij", extractionModel = "gpt-test-vision", effort = "medium" })).StatusCode);
        var saved = await (await _client.PutAsJsonAsync("/api/settings/claude", new { apiKey = "sk-ant-test-0123456789abcdefghij", extractionModel = "claude-opus-5-5", effort = "high", inputPricePerMillion = 4m, cachedInputPricePerMillion = 0.4m, outputPricePerMillion = 20m })).Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal("••••ghij", saved.GetProperty("maskedApiKey").GetString());
        Assert.DoesNotContain("sk-ant-test", (await _client.GetStringAsync("/api/settings/claude")));

        // Claude only: the narration cannot be heard, so the run says so and uses the pictures.
        var picturesOnly = await (await _client.PostAsJsonAsync(extractUrl, new { frames = new[] { jpeg }, audio })).Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal("claude", picturesOnly.GetProperty("provider").GetString());
        Assert.Contains("speech-to-text", picturesOnly.GetProperty("warning").GetString());
        Assert.Equal("sk-ant-test-0123456789abcdefghij", _claude.ApiKey);

        // With OpenAI configured too, both are offered (OpenAI first) and OpenAI transcribes for Claude.
        (await _client.PutAsJsonAsync("/api/settings/openai", new { apiKey = "sk-test-0123456789abcdefghijklmnop", extractionModel = "gpt-test-vision", transcriptionModel = "gpt-test-transcribe", transcriptionPricePerMinute = 0.003m })).EnsureSuccessStatusCode();
        var providers = await _client.GetFromJsonAsync<System.Text.Json.JsonElement>("/api/sales/extraction-providers");
        Assert.Equal(["openai", "claude"], providers.GetProperty("providers").EnumerateArray().Select(p => p.GetProperty("key").GetString()).ToArray());
        Assert.True(providers.GetProperty("transcription").GetBoolean());
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync(extractUrl, new { frames = new[] { jpeg }, provider = "gemini" })).StatusCode);

        var result = await (await _client.PostAsJsonAsync(extractUrl, new { frames = Enumerable.Repeat(jpeg, 8).ToArray(), audio, provider = "claude" })).Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal("claude-opus-5-5", result.GetProperty("model").GetString());
        Assert.Equal("Three boxes of books in the study", result.GetProperty("transcript").GetString());
        Assert.Equal(("claude-opus-5-5", "high"), (_claude.Model, _claude.Effort));
        Assert.Equal(8, _claude.Last!.Images.Count);
        Assert.All(_claude.Last.Images, url => Assert.StartsWith("https://s3.example.test/", url));
        Assert.Equal("Three boxes of books in the study", _claude.Last.Transcript);
        Assert.Equal("gpt-test-transcribe", _gateway.TranscriptionModel);
        Assert.Null(_gateway.Last); // OpenAI never saw the pictures
        // Claude prices: (10,000 x 4 + 2,000 cached x 0.4 + 800 output x 20) / 1M = 0.0568, plus 2 s of sound at OpenAI's 0.003/min = 0.0001.
        Assert.Equal(0.0569m, result.GetProperty("usage").GetProperty("cost").GetDecimal());
        Assert.Equal(2, result.GetProperty("inventory").GetProperty("itemCount").GetInt32());

        // Usage is split per provider on the two settings pages.
        var claudeUsage = await _client.GetFromJsonAsync<System.Text.Json.JsonElement>("/api/settings/claude/usage");
        Assert.Equal(2, claudeUsage.GetProperty("allTime").GetProperty("runs").GetInt32());
        Assert.Equal(0, (await _client.GetFromJsonAsync<System.Text.Json.JsonElement>("/api/settings/openai/usage")).GetProperty("allTime").GetProperty("runs").GetInt32());
        // Without the option no item has a picture.
        Assert.All(result.GetProperty("inventory").GetProperty("lines").EnumerateArray(), l => Assert.Equal(System.Text.Json.JsonValueKind.Null, l.GetProperty("imageUrl").ValueKind));

        // Optional item pictures: the AI is told the pictures are numbered, and the TV keeps frame 3 (stored next to the video).
        var withPictures = await (await _client.PostAsJsonAsync(extractUrl, new { frames = Enumerable.Repeat(jpeg, 8).ToArray(), provider = "claude", pictures = true })).Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.True(_claude.Last!.Pictures);
        Assert.Equal(3, withPictures.GetProperty("items").EnumerateArray().Single(i => i.GetProperty("name").GetString() == "Television").GetProperty("picture").GetInt32());
        Assert.Equal(0, withPictures.GetProperty("items").EnumerateArray().Single(i => i.GetProperty("name").GetString() == "Sofa").GetProperty("picture").GetInt32());
        var pictured = withPictures.GetProperty("inventory").GetProperty("lines").EnumerateArray().ToList();
        var tvLine = pictured.Single(l => l.GetProperty("name").GetString() == "Television");
        Assert.Matches("^https://s3.example.test/download/.*/frames/frame-03.jpg$", tvLine.GetProperty("imageUrl").GetString());
        // The mark is kept inside the picture (600 + 500 is cut to the right edge); the sofa named no real picture, so no mark either.
        var tvMark = tvLine.GetProperty("imageMark");
        Assert.Equal((600, 250, 400, 300), (tvMark.GetProperty("x").GetInt32(), tvMark.GetProperty("y").GetInt32(), tvMark.GetProperty("width").GetInt32(), tvMark.GetProperty("height").GetInt32()));
        Assert.Equal(System.Text.Json.JsonValueKind.Null, pictured.Single(l => l.GetProperty("name").GetString() == "Sofa").GetProperty("imageMark").ValueKind);
        Assert.Equal(System.Text.Json.JsonValueKind.Null, pictured.Single(l => l.GetProperty("name").GetString() == "Sofa").GetProperty("imageUrl").ValueKind);

        // Staff edits keep the picture (by the line's id) or drop it; the client cannot point a line at another picture.
        object Line(System.Text.Json.JsonElement l, Guid? imageFrom) => new { kind = l.GetProperty("kind").GetString(), room = l.GetProperty("room").GetString(), name = l.GetProperty("name").GetString(), quantity = 2, unitCbm = l.GetProperty("unitCbm").GetDecimal(), fragile = l.GetProperty("fragile").GetBoolean(), sourceAttachmentId = (Guid?)attachmentId, imageFromLineId = imageFrom };
        var sofaLine = pictured.Single(l => l.GetProperty("name").GetString() == "Sofa");
        var kept = await (await _client.PutAsJsonAsync($"/api/sales/leads/{lead.Id}/inventory", new { lines = new[] { Line(tvLine, tvLine.GetProperty("id").GetGuid()), Line(sofaLine, Guid.NewGuid()) } })).Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.EndsWith("frame-03.jpg", kept.GetProperty("lines").EnumerateArray().Single(l => l.GetProperty("name").GetString() == "Television").GetProperty("imageUrl").GetString());
        Assert.Equal(400, kept.GetProperty("lines").EnumerateArray().Single(l => l.GetProperty("name").GetString() == "Television").GetProperty("imageMark").GetProperty("width").GetInt32());
        Assert.Equal(System.Text.Json.JsonValueKind.Null, kept.GetProperty("lines").EnumerateArray().Single(l => l.GetProperty("name").GetString() == "Sofa").GetProperty("imageUrl").ValueKind);
        var removed = await (await _client.PutAsJsonAsync($"/api/sales/leads/{lead.Id}/inventory", new { lines = new[] { Line(kept.GetProperty("lines").EnumerateArray().First(), null) } })).Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal(System.Text.Json.JsonValueKind.Null, removed.GetProperty("lines")[0].GetProperty("imageUrl").ValueKind);
    }

    private const System.Text.Json.JsonValueKind JsonValueKindNull = System.Text.Json.JsonValueKind.Null;

    private sealed class FakeClaudeGateway : IClaudeVisionGateway
    {
        public ExtractionInput? Last; public string? ApiKey, Model, Effort;
        public Task<VisionResult> Extract(string apiKey, string model, string effort, ExtractionInput input, CancellationToken ct)
        {
            (Last, ApiKey, Model, Effort) = (input, apiKey, model, effort);
            // With pictures requested the TV names picture 3; the sofa a picture that was never sent (ignored).
            // The TV mark runs past the right edge (clamped to the picture).
            var (tv, sofa) = input.Pictures ? (",\"picture\":3,\"mark\":{\"x\":600,\"y\":250,\"width\":500,\"height\":300}", ",\"picture\":99,\"mark\":{\"x\":10,\"y\":10,\"width\":100,\"height\":100}") : ("", "");
            return Task.FromResult(new VisionResult("{\"items\":[{\"name\":\"Television\",\"quantity\":1,\"room\":\"Living room\",\"fragile\":true,\"volumeCbm\":0.9,\"handling\":\"\",\"notes\":\"\"" + tv + "},{\"name\":\"Sofa\",\"quantity\":1,\"room\":\"\",\"fragile\":false,\"volumeCbm\":2.0,\"handling\":\"\",\"notes\":\"\"" + sofa + "}],\"boxes\":[]}", 12000, 2000, 800));
        }
    }

    private sealed class FakeGateway : IInventoryVisionGateway
    {
        public ExtractionInput? Last; public string? TranscriptionModel;
        public Task<VisionResult> Extract(string apiKey, string model, ExtractionInput input, CancellationToken ct)
        {
            Last = input;
            return Task.FromResult(new VisionResult("""{"items":[{"name":"Television","quantity":1,"room":"Living room","fragile":true,"volumeCbm":0.9,"handling":"Crate the screen","notes":"55 inch"},{"name":"Sofa","quantity":1,"room":"","fragile":false,"volumeCbm":2.0,"handling":"","notes":""}],"boxes":[{"boxType":"Book carton","quantity":3,"contents":"Books","room":"Study"}]}""", 12000, 2000, 800));
        }
        public Task<string> Transcribe(string apiKey, string model, byte[] audio, string fileName, string contentType, CancellationToken ct) { TranscriptionModel = model; return Task.FromResult(" Three boxes of books in the study "); }
    }

    private sealed class FakeUploader : IObjectUploader
    {
        public int Puts;
        public Task PutAsync(string url, byte[] content, string contentType, CancellationToken ct) { Interlocked.Increment(ref Puts); return Task.CompletedTask; }
    }

    private async Task LoginAndSelectTenantAsync()
    {
        var login = await _client.PostAsJsonAsync("/api/auth/login", new
            { email = "admin@movers.local", password = "ChangeMe123!" });
        login.EnsureSuccessStatusCode();
        SetToken(await login.Content.ReadFromJsonAsync<LoginResponse>());

        var tenantResponse = await _client.PostAsJsonAsync("/api/platform/tenants",
            new SaveTenantRequest("Sales Test", "sales-test", null, null, null));
        tenantResponse.EnsureSuccessStatusCode();
        var tenant = (await tenantResponse.Content.ReadFromJsonAsync<TenantResponse>())!;
        var selected = await _client.PostAsJsonAsync("/api/auth/select-tenant", new { tenantId = tenant.Id });
        selected.EnsureSuccessStatusCode();
        SetToken(await selected.Content.ReadFromJsonAsync<LoginResponse>());
    }

    private async Task<Guid> CreateAssignedEmployeeAsync()
    {
        var designationResponse = await _client.PostAsJsonAsync("/api/designations", new
            { code = "SALES", name = "Sales Executive", level = 2, description = "Sales team" });
        designationResponse.EnsureSuccessStatusCode();
        var designation = (await designationResponse.Content.ReadFromJsonAsync<IdResponse>())!;
        var employeeResponse = await _client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = "SALES-001", firstName = "System", lastName = "Admin",
            workEmail = "admin@movers.local", phone = "100", joiningDate = "2026-01-01",
            designationId = designation.Id, reportsToEmployeeId = (Guid?)null
        });
        employeeResponse.EnsureSuccessStatusCode();
        return (await employeeResponse.Content.ReadFromJsonAsync<IdResponse>())!.Id;
    }

    private async Task<LeadResponse> CreateLeadAsync(string number, string customer, Guid statusId, Guid moveTypeId, Guid employeeId)
    {
        var response = await _client.PostAsJsonAsync("/api/sales/leads", LeadRequest(number, customer, statusId, moveTypeId, employeeId));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<LeadResponse>())!;
    }

    private static object LeadRequest(string number, string customer, Guid statusId, Guid moveTypeId, Guid employeeId) => new
    {
        leadNumber = number,
        customerName = customer,
        phone = "+91 90000 00000",
        email = "customer@example.test",
        source = "Website",
        moveTypeId,
        origin = "Chennai",
        destination = "Bengaluru",
        expectedMoveDate = "2026-10-15",
        statusId,
        assignedEmployeeId = employeeId,
        notes = "Initial sales enquiry"
    };

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
    private sealed record IdResponse(Guid Id);
    private sealed record StatusResponse(Guid Id, string Code);
    private sealed record MoveTypeResponse(Guid Id, string Code);
    private sealed record LeadResponse(Guid Id, string LeadNumber);
    private sealed record FollowUpResponse(Guid Id, string StatusName);
    private sealed record TaskResponse(string Type, string Title);
    private sealed record GeneratedLinkResponse(LinkResponse Link, string Url);
    private sealed record LinkResponse(DateTimeOffset ExpiresAtUtc);
    private sealed record PublicInfoResponse(string CustomerName);
    private sealed record UploadResponse(Guid AttachmentId);
    private sealed record AttachmentResponse(string OriginalFileName);
    private sealed record AuditResponse(string ActorEmail, string EntityType);
    private sealed class FakeStorage : IAwsObjectStorage
    {
        public Task<string> CreateUploadUrlAsync(AwsStorageCredentials credentials, string key, string contentType, DateTimeOffset expiresAtUtc, CancellationToken token) => Task.FromResult("https://s3.example.test/upload");
        public Task<string> CreateDownloadUrlAsync(AwsStorageCredentials credentials, string key, string fileName, DateTimeOffset expiresAtUtc, CancellationToken token) => Task.FromResult("https://s3.example.test/download/" + key);
        public Task<StoredObjectInfo?> GetObjectInfoAsync(AwsStorageCredentials credentials, string key, CancellationToken token) => Task.FromResult<StoredObjectInfo?>(new(1024));
    }
}
