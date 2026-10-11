using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Movers.DAL.Persistence;
using Movers.Services.Operations;
using Npgsql;

namespace Movers.Api.Tests;

public sealed class OperationsIntegrationTests
{
    [Theory, MemberData(nameof(Providers))]
    public async Task Number_reservations_are_unique_concurrent_and_tenant_scoped(string provider)
    {
        await using var fixture = new Fixture(provider);
        var tenant = Guid.NewGuid();
        async Task<long> Next(Guid tenantId, string series)
        {
            using var scope = fixture.Factory.Services.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<Movers.Services.Numbering.INumberSequenceRepository>()
                .Next(tenantId, series, CancellationToken.None);
        }
        var values = await Task.WhenAll(Enumerable.Range(0, 16).Select(_ => Next(tenant, "LD-TEST")));
        Assert.Equal(Enumerable.Range(1, 16).Select(x => (long)x), values.Order());
        Assert.Equal(17L, await Next(tenant, "LD-TEST"));
        Assert.Equal(1L, await Next(Guid.NewGuid(), "LD-TEST"));
        Assert.Equal(1L, await Next(tenant, "QT-TEST"));
    }

    public static IEnumerable<object[]> Providers()
    {
        yield return ["Sqlite"];
        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MOVERS_TEST_SQLSERVER"))) yield return ["SqlServer"];
        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MOVERS_TEST_POSTGRESQL"))) yield return ["PostgreSql"];
    }

    [Theory, MemberData(nameof(Providers))]
    public async Task Complete_costing_flow_is_atomic_idempotent_and_tenant_scoped(string provider)
    {
        await using var fixture = new Fixture(provider);
        using var client = fixture.Client;
        var login = await Post(client, "/api/auth/login", new { email = "admin@movers.local", password = "ChangeMe123!" });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.GetProperty("accessToken").GetString());
        var tenant = await Post(client, "/api/platform/tenants", new { name = "Cost test", slug = "cost-test" });
        await Select(client, tenant.GetProperty("id").GetGuid());
        var statusResponse = await client.GetFromJsonAsync<JsonElement>("/api/pickups/statuses");
        var statusId = statusResponse[0].GetProperty("id").GetGuid();
        var p1 = await Pickup(client, "MOVE-1", statusId);
        var p2 = await Pickup(client, "MOVE-2", statusId);
        var designation = await Post(client, "/api/designations", new { code = "PACKER", name = "Packer", level = 1 });
        var employee = await Post(client, "/api/employees", new { employeeNumber = "EMP-1", firstName = "Asha", lastName = "Rao", joiningDate = "2026-01-01", designationId = designation.GetProperty("id").GetGuid() });

        var leadStatuses = await client.GetFromJsonAsync<JsonElement>("/api/sales/statuses/leads");
        var moveTypes = await client.GetFromJsonAsync<JsonElement>("/api/sales/statuses/move-types");
        var lead = await Post(client, "/api/sales/leads", new { leadNumber = "MEDIA-1", customerName = "Media Customer",
            phone = "9000000000", source = "Website", moveTypeId = moveTypes[0].GetProperty("id").GetGuid(),
            origin = "Bengaluru", destination = "Mysuru", expectedMoveDate = "2026-10-15",
            statusId = leadStatuses[0].GetProperty("id").GetGuid(), assignedEmployeeId = employee.GetProperty("id").GetGuid() });
        var leadId = lead.GetProperty("id").GetGuid();
        var uploadLink = await Post(client, $"/api/sales/leads/{leadId}/upload-links", new { validDays = 7 });
        var uploadToken = new Uri(uploadLink.GetProperty("url").GetString()!).Segments.Last();
        using var uploadingCustomer = fixture.Factory.CreateClient();
        var bytes = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGQAAAABJRU5ErkJggg==");
        var upload = await Post(uploadingCustomer, $"/api/public/lead-uploads/{uploadToken}/upload-requests",
            new { fileName = "room.png", contentType = "image/png", sizeBytes = bytes.Length });
        var uploadPath = upload.GetProperty("uploadUrl").GetString()!;
        using var imageContent = new ByteArrayContent(bytes);
        imageContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/png");
        var stored = await uploadingCustomer.PutAsync(uploadPath, imageContent);
        Assert.True(stored.IsSuccessStatusCode, await stored.Content.ReadAsStringAsync());
        var attachmentId = upload.GetProperty("attachmentId").GetGuid();
        var finishedUpload = await Post(uploadingCustomer, $"/api/public/lead-uploads/{uploadToken}/attachments/{attachmentId}/complete", new { });
        Assert.True(finishedUpload.GetProperty("isUploaded").GetBoolean());
        var download = await client.GetFromJsonAsync<JsonElement>($"/api/sales/leads/{leadId}/attachments/{attachmentId}/download");
        Assert.Equal(bytes, await uploadingCustomer.GetByteArrayAsync(download.GetProperty("url").GetString()));
        var tampered = await uploadingCustomer.GetAsync("/api/public/local-files?grant=invalid");
        Assert.Equal(HttpStatusCode.Unauthorized, tampered.StatusCode);
        var executableUpload = await uploadingCustomer.PostAsJsonAsync($"/api/public/lead-uploads/{uploadToken}/upload-requests",
            new { fileName = "run.exe", contentType = "application/octet-stream", sizeBytes = 100 });
        Assert.Equal(HttpStatusCode.BadRequest, executableUpload.StatusCode);

        var work = new RecordLabour(Guid.NewGuid(), p1, employee.GetProperty("id").GetGuid(), "PACKING",
            DateTimeOffset.Parse("2026-09-01T08:00:00Z"), DateTimeOffset.Parse("2026-09-01T12:00:00Z"), 30, 0, 200, 300, "INR", "Packing crew");
        var first = await Post(client, "/api/operations-costs/labour", work);
        var replay = await Post(client, "/api/operations-costs/labour", work);
        Assert.Equal(first.GetProperty("id").GetGuid(), replay.GetProperty("id").GetGuid());
        Assert.Equal(3.5m, first.GetProperty("regularHours").GetDecimal());
        Assert.Equal(700m, first.GetProperty("cost").GetDecimal());
        var overlap = await client.PostAsJsonAsync("/api/operations-costs/labour", work with { RequestId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.BadRequest, overlap.StatusCode);
        var keyConflict = await client.PostAsJsonAsync("/api/operations-costs/labour", work with { HourlyRate = 210 });
        Assert.Equal(HttpStatusCode.Conflict, keyConflict.StatusCode);
        var expense = new RecordExpense(Guid.NewGuid(), p1, "VENDOR_SERVICE", "Local vendor", "BILL-1", 100, "INR", null);
        await Post(client, "/api/operations-costs/expenses", expense);
        var duplicate = await client.PostAsJsonAsync("/api/operations-costs/expenses", expense with { RequestId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);

        var box = await Post(client, "/api/surveys/masters/box-types", new { code = "BOX", name = "Test carton", capacityCbm = 1m, materials = Array.Empty<object>() });
        var contents = new
        {
            assignments = Array.Empty<object>(), materials = Array.Empty<object>(),
            packages = new[] {
                new { boxTypeId = box.GetProperty("id").GetGuid(), trackingNumber = "MOVE-1-001", items = new[] { new { itemName = "Books", quantity = 5 } } },
                new { boxTypeId = box.GetProperty("id").GetGuid(), trackingNumber = "MOVE-1-002", items = new[] { new { itemName = "Clothes", quantity = 10 } } }
            }
        };
        var packed = await client.PutAsJsonAsync($"/api/pickups/{p1}/details", contents);
        Assert.True(packed.IsSuccessStatusCode, await packed.Content.ReadAsStringAsync());
        var shipment = await client.GetFromJsonAsync<ShipmentView>($"/api/shipments/{p1}");
        Assert.Equal(2, shipment!.Packages.Count);
        var initialShare = await Post(client, $"/api/shipments/{p1}/share", new SharePacking(7, "Customer retains the old desk."));
        var obsoleteToken = initialShare.GetProperty("url").GetString()!.Split('/').Last();
        await Post(client, $"/api/shipments/{p1}/revoke", new { });
        using var customer = fixture.Factory.CreateClient();
        Assert.Equal(HttpStatusCode.NotFound, (await customer.GetAsync("/api/public/packing/" + obsoleteToken)).StatusCode);
        var share = await Post(client, $"/api/shipments/{p1}/share", new SharePacking(7, "Customer retains the old desk."));
        var token = share.GetProperty("url").GetString()!.Split('/').Last();
        var publicPath = "/api/public/packing/" + token;
        var publicList = await customer.GetFromJsonAsync<PublicPacking>(publicPath);
        Assert.Equal("PENDING", publicList!.Response);
        var locked = await client.PutAsJsonAsync($"/api/pickups/{p1}/details", contents);
        Assert.Equal(HttpStatusCode.BadRequest, locked.StatusCode);
        var handover = new HandoverInput(Guid.NewGuid(), shipment.Packages[0].Id, "PACKED", "IN_TRANSIT", "Vehicle TEST-1", "Driver", "Seal intact");
        var premature = await client.PostAsJsonAsync($"/api/shipments/{p1}/handovers", handover);
        Assert.Equal(HttpStatusCode.BadRequest, premature.StatusCode);
        await Post(customer, publicPath + "/respond", new PackingResponse("Customer", true, "Checked all rooms", publicList.SnapshotHash));
        var afterHandover = await Post(client, $"/api/shipments/{p1}/handovers", handover);
        var replayHandover = await Post(client, $"/api/shipments/{p1}/handovers", handover);
        Assert.Equal(afterHandover.GetProperty("history").GetArrayLength(), replayHandover.GetProperty("history").GetArrayLength());
        await Post(client, $"/api/shipments/{p1}/handovers", handover with { RequestId = Guid.NewGuid(), ExpectedStatus = "IN_TRANSIT", Status = "DELIVERED", Location = "Customer address", ReceivedBy = "Customer" });
        var partial = await client.GetFromJsonAsync<ShipmentView>($"/api/shipments/{p1}");
        Assert.False(partial!.AllPackagesDelivered);
        var incident = await Post(client, "/api/shipments/claims", new ClaimInput(p1, shipment.Packages[1].Id, "LATE", "Second carton delayed", "Coordinator"));
        await Post(client, "/api/shipments/claims/" + incident.GetProperty("id").GetGuid() + "/resolve",
            new ResolveClaim(incident.GetProperty("version").GetGuid(), "Customer agreed to revised delivery time."));

        var vehicle = await Post(client, "/api/pickups/vehicles", new { registrationNumber = "TEST-1", name = "Test van", type = "Van", capacityCbm = 30 });
        var trip = await Post(client, "/api/transport-trips", new CreateTrip("TRIP-1", vehicle.GetProperty("id").GetGuid(),
            "Bengaluru", "Mysuru", DateTimeOffset.Parse("2026-09-02T08:00:00Z"), 12300, 9, 100, "INR", [new(p1, 6), new(p2, 4)]));
        var tripId = trip.GetProperty("trip").GetProperty("id").GetGuid();
        var version = trip.GetProperty("trip").GetProperty("version").GetGuid();
        var completed = await Post(client, $"/api/transport-trips/{tripId}/complete", new CompleteTrip(version, 12480, 300, DateTimeOffset.Parse("2026-09-02T16:00:00Z")));
        Assert.Equal(2000m, completed.GetProperty("trip").GetProperty("fuelCost").GetDecimal());
        Assert.Equal(2000m, completed.GetProperty("allocations").EnumerateArray().Sum(x => x.GetProperty("fuelCost").GetDecimal()));
        var summary = await client.GetFromJsonAsync<CostRow[]>("/api/operations-costs/summary");
        var cost = Assert.Single(summary!, x => x.PickupId == p1);
        Assert.Equal(1200m, cost.FuelCost); Assert.Equal(180m, cost.TransportOtherCost);
        Assert.Equal(2180m, cost.TotalCost);
        var report = await Post(client, "/api/operations-costs/reports", new SaveReport("My costs", ["pickupNumber", "labourCost", "fuelCost", "totalCost"], "totalCost", null));
        var csv = await client.GetStringAsync("/api/operations-costs/reports/" + report.GetProperty("id").GetGuid() + "/csv");
        Assert.Contains("PU-", csv); Assert.Contains("2180", csv);
        var journal = new JournalInput(Guid.NewGuid(), "INV-1", "Customer invoice", "INR", new DateOnly(2026, 9, 2), p1,
            [new("1100", 1000, 0), new("4000", 0, 1000)]);
        var posted = await Post(client, "/api/operations-costs/journals", journal);
        var invalid = await client.PostAsJsonAsync("/api/operations-costs/journals", journal with { RequestId = Guid.NewGuid(), Reference = "INV-INVALID", Lines = [new("1100", 100, 0), new("4000", 0, 90)] });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        await Post(client, "/api/operations-costs/journals/" + posted.GetProperty("entry").GetProperty("id").GetGuid() + "/reverse", new { requestId = Guid.NewGuid(), date = "2026-09-03" });
        var balance = await client.GetFromJsonAsync<AccountBalance[]>("/api/operations-costs/trial-balance?currency=INR");
        Assert.All(balance!, row => Assert.Equal(0, row.Balance));
        var other = await Post(client, "/api/platform/tenants", new { name = "Other company", slug = "other-company" });
        await Select(client, other.GetProperty("id").GetGuid());
        Assert.Empty((await client.GetFromJsonAsync<CostRow[]>("/api/operations-costs/summary"))!);
        var forbidden = await client.PostAsJsonAsync("/api/operations-costs/expenses", expense with { RequestId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.BadRequest, forbidden.StatusCode);
        using var anonymous = fixture.Factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/operations-costs/summary")).StatusCode);
    }

    private static async Task Select(HttpClient client, Guid id)
    {
        var selected = await Post(client, "/api/auth/select-tenant", new { tenantId = id });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", selected.GetProperty("accessToken").GetString());
        await Post(client,"/api/currencies/rates",new{currency="INR",date="2020-01-01",usdPerUnit=0.012m});
    }
    private static async Task<Guid> Pickup(HttpClient client, string number, Guid statusId)
    {
        var result = await Post(client, "/api/pickups", new { pickupNumber = number, customerName = "Customer", phone = "9000000000", address = "Bengaluru", scheduledAtUtc = "2026-09-01T08:00:00Z", statusId });
        return result.GetProperty("id").GetGuid();
    }
    private static async Task<JsonElement> Post(HttpClient client, string path, object input)
    {
        var response = await client.PostAsJsonAsync(path, input);
        Assert.True(response.IsSuccessStatusCode, path + ": " + await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).Clone();
    }

    private sealed class Fixture : IAsyncDisposable
    {
        public WebApplicationFactory<Program> Factory { get; }
        public HttpClient Client { get; }
        private readonly string _mediaRoot = Path.Combine(Path.GetTempPath(), "movers_media_test_" + Guid.NewGuid().ToString("N"));
        private readonly string _provider;
        private readonly string _connection;
        private readonly string _databaseName = "movers_test_" + Guid.NewGuid().ToString("N");
        public Fixture(string provider)
        {
            _provider = provider;
            _connection = provider switch
            {
                "SqlServer" => new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("MOVERS_TEST_SQLSERVER")) { InitialCatalog = _databaseName }.ConnectionString,
                "PostgreSql" => new NpgsqlConnectionStringBuilder(Environment.GetEnvironmentVariable("MOVERS_TEST_POSTGRESQL")) { Database = _databaseName }.ConnectionString,
                _ => "Data Source=" + Path.Combine(Path.GetTempPath(), _databaseName + ".db")
            };
            Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
            {
                b.UseEnvironment("Testing"); b.UseSetting("Database:Provider", provider);
                b.UseSetting("ConnectionStrings:" + provider, _connection);
                b.UseSetting("Storage:Provider", "Local"); b.UseSetting("Storage:LocalRoot", _mediaRoot);
            });
            Client = Factory.CreateClient();
        }
        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            using (var scope = Factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<MoversDbContext>();
                // This fixture only creates randomly named databases; never use the supplied database name for cleanup.
                if (_provider != "Sqlite" && db.Database.GetDbConnection().Database != _databaseName)
                    throw new InvalidOperationException("Refusing to clean an unexpected database.");
                await db.Database.EnsureDeletedAsync();
            }
            await Factory.DisposeAsync();
            if (Directory.Exists(_mediaRoot) && Path.GetFileName(_mediaRoot).StartsWith("movers_media_test_", StringComparison.Ordinal)) Directory.Delete(_mediaRoot, true);
            if (_provider == "Sqlite") SqliteConnection.ClearAllPools();
        }
    }
}

