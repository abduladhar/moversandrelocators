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

    public Task InitializeAsync()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Database:Provider", "Sqlite");
            builder.UseSetting("ConnectionStrings:Sqlite", $"Data Source={_databasePath}");
            builder.ConfigureServices(services => { services.RemoveAll<IAwsObjectStorage>(); services.AddSingleton<IAwsObjectStorage, FakeStorage>(); });
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
        public Task<string> CreateDownloadUrlAsync(AwsStorageCredentials credentials, string key, string fileName, DateTimeOffset expiresAtUtc, CancellationToken token) => Task.FromResult("https://s3.example.test/download");
        public Task<StoredObjectInfo?> GetObjectInfoAsync(AwsStorageCredentials credentials, string key, CancellationToken token) => Task.FromResult<StoredObjectInfo?>(new(1024));
    }
}
