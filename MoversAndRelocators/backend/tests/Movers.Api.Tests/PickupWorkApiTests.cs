using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Movers.Api.Contracts.Tenants;

namespace Movers.Api.Tests;

public sealed class PickupWorkApiTests : IAsyncLifetime
{
    private const string Signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"movers-pickups-{Guid.NewGuid():N}.db");
    private readonly string _storageRoot = Path.Combine(Path.GetTempPath(), $"movers-pickup-files-{Guid.NewGuid():N}");
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public Task InitializeAsync()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing"); builder.UseSetting("Database:Provider", "Sqlite"); builder.UseSetting("ConnectionStrings:Sqlite", $"Data Source={_databasePath}");
            builder.UseSetting("Storage:Provider", "Local"); builder.UseSetting("Storage:LocalRoot", _storageRoot);
        });
        _client = _factory.CreateClient(); return Task.CompletedTask;
    }

    [Fact]
    public async Task Pickup_from_a_sales_lead_tracks_trip_packing_photos_signoffs_expenses_and_warehouse_storage()
    {
        await LoginAndSelectTenant();
        var designation = await Post("/api/designations", new { code = "CREW", name = "Crew", level = 4, description = "Packing crew" });
        var lead = await Post("/api/employees", new { employeeNumber = "CR-001", firstName = "Lee", lastName = "Lead", workEmail = "lee@example.test", phone = "100", joiningDate = "2026-01-01", designationId = Id(designation), reportsToEmployeeId = (Guid?)null });
        var statuses = await Get("/api/pickups/statuses");
        var moveType = (await Get("/api/sales/statuses/move-types"))[0];
        var leadStatus = (await Get("/api/sales/statuses/leads"))[0];
        var salesLead = await Post("/api/sales/leads", new { leadNumber = "", customerName = "Asha Customer", phone = "9000000001", email = (string?)null, source = "Web", origin = "Kochi", destination = "Dubai", moveTypeId = Id(moveType), statusId = Id(leadStatus), assignedEmployeeId = Id(lead), expectedMoveDate = (string?)null, notes = (string?)null });

        // A household item, and a box type whose recipe uses tape and cartons.
        var tape = await Post("/api/surveys/masters/materials", new { code = "PW_TAPE", name = "Tape", unit = "roll", currentUnitCost = 20, description = (string?)null });
        var carton = await Post("/api/surveys/masters/materials", new { code = "PW_CARTON", name = "Carton sheet", unit = "sheet", currentUnitCost = 15, description = (string?)null });
        var box = await Post("/api/surveys/masters/box-types", new { code = "PW_MED", name = "Medium carton", capacityCbm = 1m, description = (string?)null, materials = new[] { new { materialId = Id(tape), quantity = 1 }, new { materialId = Id(carton), quantity = 2 } } });

        var pickup = await Post("/api/pickups", new { pickupNumber = "", salesLeadId = Id(salesLead), quotationId = (Guid?)null, customerName = "Asha Customer", phone = "9000000001", address = "Kochi", scheduledAtUtc = DateTimeOffset.UtcNow.AddHours(2), statusId = Id(statuses[0]) });
        var pickupId = Id(pickup);
        Assert.Equal(Id(salesLead), pickup.GetProperty("salesLeadId").GetGuid());
        Assert.False(string.IsNullOrEmpty(pickup.GetProperty("leadNumber").GetString()));

        // Trip clock with a pause.
        var now = DateTimeOffset.UtcNow;
        await Post($"/api/pickups/{pickupId}/trip/start", new { at = now.AddHours(-4) });
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/pickups/{pickupId}/trip/pause", new { at = now.AddHours(-3) })).StatusCode);
        await Post($"/api/pickups/{pickupId}/trip/pause", new { at = now.AddHours(-3), reason = "Lift not available" });
        await Post($"/api/pickups/{pickupId}/trip/resume", new { at = now.AddHours(-2) });

        // Packing: two boxes in the living room; recipe materials are derived, extras are kept.
        var packed = await Put($"/api/pickups/{pickupId}/details", new
        {
            assignments = new[] { new { employeeId = Id(lead), role = "Crew lead" } },
            materials = new[] { new { materialId = Id(tape), quantity = 3, unitCost = (decimal?)null } },
            packages = new[] {
                new { boxTypeId = Id(box), trackingNumber = (string?)null, notes = (string?)null, roomName = "Living room", isFragile = true, items = new[] { new { itemName = "Glassware", quantity = 6, notes = (string?)null, roomName = (string?)null, householdItemId = (Guid?)null } } },
                new { boxTypeId = Id(box), trackingNumber = (string?)null, notes = (string?)null, roomName = "Living room", isFragile = false, items = new[] { new { itemName = "Books", quantity = 20, notes = (string?)null, roomName = (string?)null, householdItemId = (Guid?)null } } }
            }
        });
        var packages = packed.GetProperty("packages").EnumerateArray().ToList();
        Assert.Equal(2, packages.Count); Assert.True(packages[0].GetProperty("isFragile").GetBoolean());
        Assert.Equal("Living room", packages[0].GetProperty("items")[0].GetProperty("roomName").GetString());
        var materials = packed.GetProperty("materials").EnumerateArray().ToList();
        Assert.Equal(3m, materials.Single(m => !m.GetProperty("isBoxRecipe").GetBoolean()).GetProperty("quantity").GetDecimal());
        Assert.Equal(2m, materials.Single(m => m.GetProperty("isBoxRecipe").GetBoolean() && m.GetProperty("materialId").GetGuid() == Id(tape)).GetProperty("quantity").GetDecimal());
        Assert.Equal(4m, materials.Single(m => m.GetProperty("isBoxRecipe").GetBoolean() && m.GetProperty("materialId").GetGuid() == Id(carton)).GetProperty("quantity").GetDecimal());

        // Before and after photos for a room.
        var upload = await Post($"/api/pickups/{pickupId}/attachments/upload-requests", new { stage = "BEFORE_PACKING", roomName = "Living room", fileName = "before.jpg", contentType = "image/jpeg", sizeBytes = 3 });
        (await _client.PutAsync(upload.GetProperty("uploadUrl").GetString(), new ByteArrayContent([1, 2, 3]))).EnsureSuccessStatusCode();
        await Post($"/api/pickups/{pickupId}/attachments/{upload.GetProperty("attachmentId").GetGuid()}/complete", new { });
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/pickups/{pickupId}/attachments/upload-requests", new { stage = "DURING", fileName = "x.jpg", contentType = "image/jpeg", sizeBytes = 3 })).StatusCode);

        // Crew expenses flow into the move's costs.
        await Post($"/api/pickups/{pickupId}/expenses", new { category = "FUEL", amount = 400, currency = "INR", incurredAtUtc = now.AddHours(-3), paidByEmployeeId = Id(lead), notes = "Diesel" });
        await Post($"/api/pickups/{pickupId}/expenses", new { category = "TOLL", amount = 60, currency = "INR", incurredAtUtc = now.AddHours(-3), paidByEmployeeId = (Guid?)null, notes = (string?)null });
        var cost = (await Get("/api/operations-costs/summary")).Single(x => x.GetProperty("pickupId").GetGuid() == pickupId);
        Assert.Equal(400m, cost.GetProperty("fuelCost").GetDecimal()); Assert.Equal(60m, cost.GetProperty("transportOtherCost").GetDecimal());

        var customCategory = await Post("/api/business-masters/expense-category", new { name = "Building access fee", isActive = true });
        var categoryCode = customCategory.GetProperty("code").GetString();
        var expenseInput = new { category = categoryCode, amount = 25, currency = "INR", incurredAtUtc = now.AddHours(-1), notes = "Access fee" };
        var customWork = await Post($"/api/pickups/{pickupId}/expenses", expenseInput);
        Assert.Contains(customWork.GetProperty("expenses").EnumerateArray(), x => x.GetProperty("category").GetString() == categoryCode);
        await Put($"/api/business-masters/expense-category/{categoryCode}", new { name = "Building access fee", isActive = false });
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/pickups/{pickupId}/expenses", expenseInput)).StatusCode);
        // Sign-offs: the employee must be selected and a signature captured.
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/pickups/{pickupId}/signoffs", new { party = "EMPLOYEE", signerName = "Lee Lead", statement = "Packed as listed", signaturePng = Signature })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/pickups/{pickupId}/signoffs", new { party = "CUSTOMER", signerName = "Asha", statement = "Received", signaturePng = "not-an-image" })).StatusCode);
        await Post($"/api/pickups/{pickupId}/signoffs", new { party = "EMPLOYEE", signerName = "Lee Lead", employeeId = Id(lead), statement = "All items packed and loaded as listed.", signaturePng = Signature });
        await Post($"/api/pickups/{pickupId}/signoffs", new { party = "CUSTOMER", signerName = "Asha Customer", statement = "I confirm my items were packed as listed.", remarks = "Handle glassware carefully", signaturePng = Signature });

        // Warehouse storage needs the customer's packing-list confirmation first.
        var warehouse = await Post("/api/pickups/warehouses", new { code = "WH-KOCHI", name = "Kochi warehouse", address = "Edappally" });
        var packageIds = packages.Select(p => Id(p)).ToArray();
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/pickups/{pickupId}/warehouse", new { warehouseId = Id(warehouse), bay = "A-01", packageIds, receivedBy = "Store keeper" })).StatusCode);
        var share = await Post($"/api/shipments/{pickupId}/share", new { validDays = 7, leftBehindNotes = "Nothing left behind." });
        var token = share.GetProperty("url").GetString()!.Split('/').Last();
        var auth = _client.DefaultRequestHeaders.Authorization; _client.DefaultRequestHeaders.Authorization = null;
        var list = await Get1($"/api/public/packing/{token}");
        await Post($"/api/public/packing/{token}/respond", new { name = "Asha Customer", confirmed = true, notes = (string?)null, snapshotHash = list.GetProperty("snapshotHash").GetString() });
        _client.DefaultRequestHeaders.Authorization = auth;
        // Invalid mixed batch must not store the first valid box or leave a receipt.
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync("/api/warehouse/receive-pickup", new { requestId = Guid.NewGuid(), pickupId, warehouseId = Id(warehouse), bay = "A-01", packageIds = new[] { packageIds[0], Guid.NewGuid() }, receivedBy = "Store keeper" })).StatusCode);
        Assert.Empty(await Get("/api/warehouse/stock"));
        Assert.Empty(await Get("/api/warehouse/receipts"));
        var stored = await Post($"/api/pickups/{pickupId}/warehouse", new { warehouseId = Id(warehouse), bay = "A-01", packageIds, receivedBy = "Store keeper", notes = (string?)null });
        Assert.All(stored.GetProperty("storage").EnumerateArray(), s => { Assert.Equal("WAREHOUSE", s.GetProperty("status").GetString()); Assert.Equal("Kochi warehouse", s.GetProperty("warehouseName").GetString()); Assert.Equal("Kochi warehouse · A-01", s.GetProperty("location").GetString()); });

        var warehouseStock = await Get("/api/warehouse/stock");
        Assert.Equal(2, warehouseStock.Count);
        Assert.All(warehouseStock, row => Assert.Equal("Kochi warehouse · A-01", row.GetProperty("location").GetString()));
        var receipt = Assert.Single(await Get("/api/warehouse/receipts"));
        Assert.Equal(2, receipt.GetProperty("details").GetProperty("boxes").GetArrayLength());
        Assert.Equal("PICKUP", receipt.GetProperty("source").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync("/api/warehouse/receive-pickup", new { requestId = Guid.NewGuid(), pickupId, warehouseId = Id(warehouse), packageIds, receivedBy = "Store keeper" })).StatusCode);
        await Post($"/api/shipments/{pickupId}/handovers", new { requestId = Guid.NewGuid(), packageId = packageIds[0], expectedStatus = "WAREHOUSE", status = "IN_TRANSIT", location = "Vehicle", receivedBy = "Driver" });
        Assert.Single(await Get("/api/warehouse/stock"));
        var returnBatch = new { requestId = Guid.NewGuid(), pickupId, warehouseId = Id(warehouse), packageIds = new[] { packageIds[0] }, bay = "A-02", receivedBy = "Store keeper" };
        var returnReceipt = await Post("/api/warehouse/receive-pickup", returnBatch);
        Assert.Equal(Id(returnReceipt), Id(await Post("/api/warehouse/receive-pickup", returnBatch)));
        Assert.Equal(2, (await Get("/api/warehouse/stock")).Count);
        Assert.Equal(2, (await Get("/api/warehouse/receipts")).Count);
        var job = await Post("/api/jobs", new { requestId = Guid.NewGuid(), details = new { mode = "ROAD", originPort = "Kochi", destinationPort = "Dubai" } });
        var jobId = Id(job);
        job = await Post($"/api/jobs/{jobId}/load", new { expectedVersion = job.GetProperty("version").GetGuid(), boxIds = new[] { packageIds[0] }, loadedBy = "Loader" });
        Assert.Single(await Get("/api/warehouse/stock"));
        Assert.Equal(HttpStatusCode.Conflict, (await _client.PostAsJsonAsync("/api/warehouse/receive-pickup", new { requestId = Guid.NewGuid(), pickupId, warehouseId = Id(warehouse), packageIds = new[] { packageIds[0] }, receivedBy = "Keeper" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await _client.PostAsJsonAsync($"/api/shipments/{pickupId}/handovers", new { requestId = Guid.NewGuid(), packageId = packageIds[0], expectedStatus = "IN_TRANSIT", status = "DELIVERED", location = "Door", receivedBy = "Customer" })).StatusCode);
        job = await Post($"/api/jobs/{jobId}/cargo/{Id(job.GetProperty("cargo")[0])}/return", new { expectedVersion = job.GetProperty("version").GetGuid() });
        Assert.Equal(2, (await Get("/api/warehouse/stock")).Count);
        // Back at the office.
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/pickups/{pickupId}/trip/complete", new { at = now.AddHours(-1) })).StatusCode);
        var work = await Post($"/api/pickups/{pickupId}/trip/complete", new { at = now.AddHours(-1), distanceKm = 35 });
        Assert.Equal(2 * 3600, work.GetProperty("trip").GetProperty("activeSeconds").GetInt64()); // 3h trip minus 1h pause
        Assert.Equal(3600, work.GetProperty("trip").GetProperty("pausedSeconds").GetInt64());
        Assert.Equal(2, work.GetProperty("signoffs").GetArrayLength());
        Assert.Single(work.GetProperty("attachments").EnumerateArray());
        Assert.Equal(485m, work.GetProperty("expenseTotals")[0].GetProperty("amount").GetDecimal());
    }

    [Fact]
    public async Task Office_receipts_are_numbered_retry_safe_validated_and_tenant_isolated()
    {
        await LoginAndSelectTenant();
        var customer = await Post("/api/business-masters/customer", new { name = "Office Customer", phone = "123", address = "Customer address" });
        var warehouse = await Post("/api/pickups/warehouses", new { code = "OFFICE-WH", name = "Office warehouse", address = "Office" });
        var input = new { requestId = Guid.NewGuid(), customerCode = customer.GetProperty("code").GetString(), warehouseId = Id(warehouse), bay = "R-02", deliveredBy = "Customer representative", receivedBy = "Receiving clerk", notes = "Sealed on arrival", shipping = new { shipper = new { name = "Origin Sender", phone = "111", address = "Origin address" }, consignee = new { name = "Destination Receiver", phone = "222", address = "Consignee address" }, toLocation = "Dubai", dropLocation = "Office tower", dropAddress = "Building 12, Dubai" }, boxes = new[] {
            new { description = "Large carton", customerReference = "Customer box 1", condition = "Dented corner", sealNumber = "SEAL-123", contents = "Books × 20", contentsChecked = false },
            new { description = "Suitcase", customerReference = "Customer box 2", condition = "Good", sealNumber = "", contents = "Clothes × 10", contentsChecked = true }
        } };
        var receipt = await Post("/api/warehouse/receive-office", input);
        Assert.Matches(@"^WR-\d{8}-\d{6}$", receipt.GetProperty("receiptNumber").GetString()!);
        var boxes = receipt.GetProperty("details").GetProperty("boxes");
        Assert.Equal(2, boxes.GetArrayLength());
        Assert.All(boxes.EnumerateArray(), b => Assert.Matches(@"^WBX-\d{8}-\d{6}$", b.GetProperty("trackingNumber").GetString()!));
        Assert.False(boxes[0].GetProperty("contentsChecked").GetBoolean());
        Assert.True(boxes[1].GetProperty("contentsChecked").GetBoolean());
        Assert.Equal(Id(receipt), Id(await Post("/api/warehouse/receive-office", input)));
        Assert.Single(await Get("/api/warehouse/receipts"));
        Assert.Equal(2, (await Get("/api/warehouse/stock")).Count);
        Assert.Empty(await Get("/api/pickups")); // An office receipt must not manufacture a pickup.
        var receiptId = Id(receipt);
        Assert.Equal("Destination Receiver", receipt.GetProperty("details").GetProperty("shipping").GetProperty("consignee").GetProperty("name").GetString());
        Assert.Equal("Building 12, Dubai", receipt.GetProperty("details").GetProperty("shipping").GetProperty("dropAddress").GetString());
        var shippingUpdate = new { expectedVersion = receipt.GetProperty("version").GetString(), shipping = input.shipping with { dropAddress = "Building 14, Dubai" } };
        var editedReceipt = await Put($"/api/warehouse/receipts/{receiptId}/shipping", shippingUpdate);
        Assert.Equal("Building 14, Dubai", editedReceipt.GetProperty("details").GetProperty("shipping").GetProperty("dropAddress").GetString());
        Assert.Equal(boxes.GetRawText(), editedReceipt.GetProperty("details").GetProperty("boxes").GetRawText());
        Assert.Equal(HttpStatusCode.Conflict, (await _client.PutAsJsonAsync($"/api/warehouse/receipts/{receiptId}/shipping", shippingUpdate)).StatusCode);
        var fileUrl = $"/api/warehouse/receipts/{receiptId}/attachments";
        var upload = await Post(fileUrl + "/upload-requests", new { fileName = "warehouse-proof.pdf", contentType = "application/pdf", sizeBytes = 3 });
        var fileId = upload.GetProperty("attachmentId").GetGuid();
        Assert.Empty(await Get(fileUrl));
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync(fileUrl + $"/{fileId}/download")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync(fileUrl + $"/{fileId}/complete", new { })).StatusCode);
        (await _client.PutAsync(upload.GetProperty("uploadUrl").GetString(), new ByteArrayContent([1, 2, 3]))).EnsureSuccessStatusCode();
        await Post(fileUrl + $"/{fileId}/complete", new { });
        await Post(fileUrl + $"/{fileId}/complete", new { });
        Assert.Single(await Get(fileUrl));
        var download = await Get1(fileUrl + $"/{fileId}/download");
        Assert.Equal(new byte[] { 1, 2, 3 }, await _client.GetByteArrayAsync(download.GetProperty("url").GetString()));
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/api/warehouse/receipts/{Guid.NewGuid()}/attachments/{fileId}/download")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync(fileUrl + "/upload-requests", new { fileName = "bad.exe", contentType = "application/octet-stream", sizeBytes = 3 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync(fileUrl + "/upload-requests", new { fileName = "large.pdf", contentType = "application/pdf", sizeBytes = 524288001L })).StatusCode);
        (await _client.DeleteAsync(fileUrl + $"/{fileId}")).EnsureSuccessStatusCode();
        Assert.Empty(await Get(fileUrl));
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync(fileUrl + $"/{fileId}/download")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await _client.PostAsJsonAsync("/api/warehouse/receive-office", input with { bay = "Different rack" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync("/api/warehouse/receive-office", input with { requestId = Guid.NewGuid(), warehouseId = Guid.NewGuid() })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync("/api/warehouse/receive-office", input with { requestId = Guid.NewGuid(), boxes = input.boxes.Select(b => b with { contents = "", contentsChecked = true }).ToArray() })).StatusCode);
        Assert.Single(await Get("/api/warehouse/receipts"));
        var second = await Post("/api/platform/tenants", new SaveTenantRequest("Other warehouse tenant", "other-warehouse", null, null, null));
        SetToken(await Post("/api/auth/select-tenant", new { tenantId = Id(second) }));
        Assert.Empty(await Get("/api/warehouse/receipts")); Assert.Empty(await Get("/api/warehouse/stock"));
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync(fileUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.PostAsJsonAsync(fileUrl + "/upload-requests", new { fileName = "other.pdf", contentType = "application/pdf", sizeBytes = 3 })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.PutAsJsonAsync($"/api/warehouse/receipts/{receiptId}/shipping", shippingUpdate)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync("/api/warehouse/receive-office", input)).StatusCode);
        _client.DefaultRequestHeaders.Authorization = null;
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/warehouse/stock")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.PostAsJsonAsync("/api/warehouse/receive-office", input)).StatusCode);
    }

    [Theory]
    [InlineData("AIR")]
    [InlineData("OCEAN")]
    [InlineData("ROAD")]
    public async Task Jobs_load_warehouse_boxes_validate_transport_and_preserve_custody(string mode)
    {
        await LoginAndSelectTenant();
        var agent = await Post("/api/business-masters/vendor", new { name = "Port agent", vendorType = "Freight forwarder", isAgent = true });
        Assert.True(agent.GetProperty("isAgent").GetBoolean());
        Assert.Equal("Freight forwarder", agent.GetProperty("vendorType").GetString());
        var vendor = await Post("/api/business-masters/vendor", new { name = "Supplier" });
        Assert.False(vendor.GetProperty("isAgent").GetBoolean());
        var details = new Movers.Services.Operations.JobDetails(mode, "Origin port", "Destination port");
        var create = new { requestId = Guid.NewGuid(), details };
        var job = await Post("/api/jobs", create); var id = Id(job);
        Assert.StartsWith("JOB-", job.GetProperty("jobNumber").GetString());
        Assert.Equal(id, Id(await Post("/api/jobs", create)));
        Assert.Equal(HttpStatusCode.Conflict, (await _client.PostAsJsonAsync("/api/jobs", new { requestId = create.requestId, details = details with { OriginPort = "Other port" } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync("/api/jobs", new { requestId = Guid.NewGuid(), details = details with { OriginAgentCode = vendor.GetProperty("code").GetString() } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/jobs/{id}/actions/depart", new { expectedVersion = job.GetProperty("version").GetGuid() })).StatusCode);
        var customer = await Post("/api/business-masters/customer", new { name = "Cargo owner" });
        var warehouse = await Post("/api/pickups/warehouses", new { code = "JOB-WH", name = "Job warehouse", address = "Office" });
        var receipt = await Post("/api/warehouse/receive-office", new { requestId = Guid.NewGuid(), customerCode = customer.GetProperty("code").GetString(), warehouseId = Id(warehouse), deliveredBy = "Customer", receivedBy = "Clerk", boxes = new[] {
            new { description = "Box one", condition = "Good", contents = "Books", contentsChecked = true },
            new { description = "Box two", condition = "Good", contents = "Clothes", contentsChecked = true }
        }});
        var boxId = receipt.GetProperty("details").GetProperty("boxes")[0].GetProperty("id").GetGuid();
        var oldVersion = job.GetProperty("version").GetGuid();
        Assert.Equal(HttpStatusCode.Conflict, (await _client.PostAsJsonAsync($"/api/jobs/{id}/load", new { expectedVersion = oldVersion, boxIds = new[] { boxId, Guid.NewGuid() }, loadedBy = "Loader" })).StatusCode);
        Assert.Equal(2, (await Get("/api/warehouse/stock")).Count);
        job = await Post($"/api/jobs/{id}/load", new { expectedVersion = oldVersion, boxIds = new[] { boxId }, loadedBy = "Loader" });
        Assert.Single(await Get("/api/warehouse/stock"));
        Assert.Single(job.GetProperty("cargo").EnumerateArray());
        Assert.Equal(HttpStatusCode.Conflict, (await _client.PutAsJsonAsync($"/api/jobs/{id}", new { expectedVersion = oldVersion, details })).StatusCode);
        var second = await Post("/api/jobs", new { requestId = Guid.NewGuid(), details });
        Assert.Equal(HttpStatusCode.Conflict, (await _client.PostAsJsonAsync($"/api/jobs/{Id(second)}/load", new { expectedVersion = second.GetProperty("version").GetGuid(), boxIds = new[] { boxId }, loadedBy = "Loader" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/jobs/{id}/actions/depart", new { expectedVersion = job.GetProperty("version").GetGuid() })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/jobs/{id}/actions/cancel", new { expectedVersion = job.GetProperty("version").GetGuid() })).StatusCode);
        job = await Post($"/api/jobs/{id}/cargo/{Id(job.GetProperty("cargo")[0])}/return", new { expectedVersion = job.GetProperty("version").GetGuid() });
        Assert.Equal("DRAFT", job.GetProperty("status").GetString());
        Assert.Equal(2, (await Get("/api/warehouse/stock")).Count);
        job = await Post($"/api/jobs/{id}/load", new { expectedVersion = job.GetProperty("version").GetGuid(), boxIds = new[] { boxId }, loadedBy = "Loader" });
        details = details with { OriginAgentCode = agent.GetProperty("code").GetString(), Carrier = "Carrier", FlightNumber = "AB123", VesselName = "Ocean vessel", VoyageNumber = "V123", TruckNumber = "TR123", DriverName = "Driver" };
        job = await Put($"/api/jobs/{id}", new { expectedVersion = job.GetProperty("version").GetGuid(), details });
        Assert.Equal("Port agent", job.GetProperty("details").GetProperty("originAgentName").GetString());
        if (mode != "AIR") Assert.Equal(JsonValueKind.Null, job.GetProperty("details").GetProperty("flightNumber").ValueKind);
        if (mode != "ROAD") Assert.Equal(JsonValueKind.Null, job.GetProperty("details").GetProperty("truckNumber").ValueKind);
        job = await Post($"/api/jobs/{id}/actions/depart", new { expectedVersion = job.GetProperty("version").GetGuid() });
        Assert.Equal("IN_TRANSIT", job.GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PutAsJsonAsync($"/api/jobs/{id}", new { expectedVersion = job.GetProperty("version").GetGuid(), details })).StatusCode);
        var active = job.GetProperty("cargo").EnumerateArray().Single(x => x.GetProperty("isActive").GetBoolean());
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"/api/jobs/{id}/cargo/{Id(active)}/return", new { expectedVersion = job.GetProperty("version").GetGuid() })).StatusCode);
        job = await Post($"/api/jobs/{id}/actions/arrive", new { expectedVersion = job.GetProperty("version").GetGuid() });
        Assert.Equal("ARRIVED", job.GetProperty("status").GetString());
        Assert.Single(await Get("/api/warehouse/stock"));
        second = await Post($"/api/jobs/{Id(second)}/actions/cancel", new { expectedVersion = second.GetProperty("version").GetGuid() });
        Assert.Equal("CANCELLED", second.GetProperty("status").GetString());
        var tenant = await Post("/api/platform/tenants", new SaveTenantRequest("Other jobs", "other-jobs", null, null, null));
        SetToken(await Post("/api/auth/select-tenant", new { tenantId = Id(tenant) }));
        await Post("/api/currencies/rates",new{currency="INR",date="2020-01-01",usdPerUnit=0.012m});
        Assert.Empty(await Get("/api/jobs"));
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/api/jobs/{id}")).StatusCode);
        _client.DefaultRequestHeaders.Authorization = null;
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/jobs")).StatusCode);
    }
    private async Task LoginAndSelectTenant()
    {
        var login = await Post("/api/auth/login", new { email = "admin@movers.local", password = "ChangeMe123!" }); SetToken(login);
        var tenant = await Post("/api/platform/tenants", new SaveTenantRequest("Pickup Test", "pickup-test", null, null, null));
        SetToken(await Post("/api/auth/select-tenant", new { tenantId = Id(tenant) }));
        await Post("/api/currencies/rates",new{currency="INR",date="2020-01-01",usdPerUnit=0.012m});
    }
    private void SetToken(JsonElement x) => _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", x.GetProperty("accessToken").GetString());
    private static Guid Id(JsonElement x) => x.GetProperty("id").GetGuid();
    private async Task<JsonElement> Post(string url, object body) { var r = await _client.PostAsJsonAsync(url, body); Assert.True(r.IsSuccessStatusCode, $"{url}: {await r.Content.ReadAsStringAsync()}"); return await r.Content.ReadFromJsonAsync<JsonElement>(); }
    private async Task<JsonElement> Put(string url, object body) { var r = await _client.PutAsJsonAsync(url, body); Assert.True(r.IsSuccessStatusCode, $"{url}: {await r.Content.ReadAsStringAsync()}"); return await r.Content.ReadFromJsonAsync<JsonElement>(); }
    private async Task<List<JsonElement>> Get(string url) => (await _client.GetFromJsonAsync<JsonElement>(url)).EnumerateArray().ToList();
    private async Task<JsonElement> Get1(string url) => await _client.GetFromJsonAsync<JsonElement>(url);
    public async Task DisposeAsync()
    {
        _client.Dispose(); await _factory.DisposeAsync(); SqliteConnection.ClearAllPools();
        if (File.Exists(_databasePath)) File.Delete(_databasePath);
        if (Directory.Exists(_storageRoot)) Directory.Delete(_storageRoot, true);
    }
}








