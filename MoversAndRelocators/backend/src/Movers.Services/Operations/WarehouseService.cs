using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Movers.Domain.Operations;
using Movers.Services.Masters;
using Movers.Services.Numbering;
using Movers.Services.Pickups;
using Movers.Services.Security;
using Movers.Services.Tenancy;
namespace Movers.Services.Operations;

public sealed record WarehouseParty(string? Name, string? Phone, string? Address);
public sealed record WarehouseShipping(WarehouseParty? Shipper, WarehouseParty? Consignee, string? ToLocation, string? DropLocation, string? DropAddress);
public sealed record UpdateWarehouseShipping(string ExpectedVersion, WarehouseShipping Shipping);
public sealed record OfficeBoxInput(string Description, string? CustomerReference, string Condition, string? SealNumber, string? Contents, bool ContentsChecked);
public sealed record ReceiveOfficeBoxes(Guid RequestId, string CustomerCode, Guid WarehouseId, string? Bay, string DeliveredBy, string ReceivedBy, string? Notes, IReadOnlyList<OfficeBoxInput> Boxes, WarehouseShipping? Shipping = null);
public sealed record ReceivePickupBoxes(Guid RequestId, Guid PickupId, Guid WarehouseId, string? Bay, string ReceivedBy, string? Notes, IReadOnlyList<Guid> PackageIds, WarehouseShipping? Shipping = null);
public sealed record ReceiptBox(Guid Id, string TrackingNumber, string Description, string? CustomerReference, string Condition, string? SealNumber, string Contents, bool ContentsChecked);
public sealed record ReceiptSnapshot(string CustomerName, string? CustomerCode, string? Phone, string? Address, string WarehouseName, string? Bay, string DeliveredBy, string ReceivedBy, string? Notes, string? PickupNumber, IReadOnlyList<ReceiptBox> Boxes, WarehouseShipping? Shipping = null);
public sealed record WarehouseReceiptModel(Guid Id, string ReceiptNumber, string Source, Guid WarehouseId, Guid? PickupId, DateTimeOffset ReceivedAtUtc, ReceiptSnapshot Details, string Version);
public sealed record WarehouseStock(Guid Id, string TrackingNumber, string CustomerName, string Source, Guid WarehouseId, string WarehouseName, string Location, string Reference, DateTimeOffset ReceivedAtUtc, string ReceivedBy, string Description, string Contents);
public interface IWarehouseRepository {
    Task<WarehouseReceipt?> Receipt(Guid id, CancellationToken ct);
    Task<IReadOnlyList<WarehouseReceipt>> Receipts(CancellationToken ct);
    Task<WarehouseReceipt?> Request(Guid requestId, CancellationToken ct);
    Task<IReadOnlyList<WarehouseStock>> PickupStock(CancellationToken ct);
}
public sealed class WarehouseService(IWarehouseRepository repository, IOperationsRepository unit, IJobRepository jobs, IPickupWorkRepository work,
    IPickupService pickups, IShipmentService shipments, BusinessMasterService masters, IRecordNumbers numbers, ITenantContext tenant, IUserContext user, TimeProvider clock)
{
    public async Task<IReadOnlyList<WarehouseReceiptModel>> Receipts(CancellationToken ct) => (await repository.Receipts(ct)).Select(Map).ToList();
    public async Task<IReadOnlyList<WarehouseStock>> Stock(CancellationToken ct) {
        var rows = (await repository.PickupStock(ct)).ToList();
        foreach (var receipt in (await repository.Receipts(ct)).Where(x => x.Source == "OFFICE")) {
            var d = Map(receipt).Details;
            rows.AddRange(d.Boxes.Select(b => new WarehouseStock(b.Id, b.TrackingNumber, d.CustomerName, "OFFICE", receipt.WarehouseId, d.WarehouseName,
                Location(d.WarehouseName, d.Bay), receipt.ReceiptNumber, receipt.ReceivedAtUtc, d.ReceivedBy, b.Description, b.Contents)));
        }
        var allocated = (await jobs.ActiveBoxIds(ct)).ToHashSet(); return rows.Where(x => !allocated.Contains(x.Id)).OrderByDescending(x => x.ReceivedAtUtc).ToList();
    }
    public async Task<WarehouseReceiptModel> ReceiveOffice(ReceiveOfficeBoxes c, CancellationToken ct) {
        ValidateShipping(c.Shipping);
        var hash = Hash(c); var prior = await Existing(c.RequestId, hash, ct); if (prior is not null) return prior;
        if (c.Boxes is null || c.Boxes.Count is < 1 or > 200) throw new InvalidOperationException("Enter between 1 and 200 boxes, one row per physical box.");
        Required(c.DeliveredBy, 160, "Delivered by"); Required(c.ReceivedBy, 160, "Received by"); Optional(c.Bay, 80); Optional(c.Notes, 2000);
        foreach (var b in c.Boxes) {
            Required(b.Description, 160, "Box description"); Required(b.Condition, 500, "Box condition"); Optional(b.CustomerReference, 80); Optional(b.SealNumber, 80); Optional(b.Contents, 2000);
            if (b.ContentsChecked && string.IsNullOrWhiteSpace(b.Contents)) throw new InvalidOperationException("List the contents checked by staff.");
        }
        // Reserve numbers before the business transaction; number reservations use a separate connection.
        var receiptNumber = await numbers.Next("WR", ct);
        var boxes = new List<ReceiptBox>();
        foreach (var b in c.Boxes) boxes.Add(new(Guid.NewGuid(), await numbers.Next("WBX", ct), b.Description.Trim(), b.CustomerReference?.Trim(), b.Condition.Trim(), b.SealNumber?.Trim(), b.Contents?.Trim() ?? "Not declared", b.ContentsChecked));
        return await unit.Transaction(async () => {
            var existing = await Existing(c.RequestId, hash, ct); if (existing is not null) return existing;
            var warehouse = await ActiveWarehouse(c.WarehouseId, ct);
            var customer = (await masters.List("customer", ct)).SingleOrDefault(x => x.Code == c.CustomerCode && x.IsActive)
                ?? throw new InvalidOperationException("Select an active customer from the customer master.");
            var snapshot = new ReceiptSnapshot(customer.Name, customer.Code, customer.Phone, customer.Address, warehouse.Name, c.Bay?.Trim(), c.DeliveredBy.Trim(), c.ReceivedBy.Trim(), c.Notes?.Trim(), null, boxes, ShippingWithShipper(c.Shipping, customer.Name, customer.Phone, customer.Address));
            return await Save(c.RequestId, hash, receiptNumber, "OFFICE", c.WarehouseId, null, snapshot, ct);
        }, ct);
    }
    public async Task<WarehouseReceiptModel> ReceivePickup(ReceivePickupBoxes c, CancellationToken ct) {
        ValidateShipping(c.Shipping);
        var hash = Hash(c); var prior = await Existing(c.RequestId, hash, ct); if (prior is not null) return prior;
        if (c.PackageIds is null || c.PackageIds.Count is < 1 or > 200 || c.PackageIds.Distinct().Count() != c.PackageIds.Count) throw new InvalidOperationException("Select 1 to 200 different boxes from the pickup.");
        Required(c.ReceivedBy, 160, "Received by"); Optional(c.Bay, 80); Optional(c.Notes, 2000);
        var receiptNumber = await numbers.Next("WR", ct);
        return await unit.Transaction(async () => {
            var existing = await Existing(c.RequestId, hash, ct); if (existing is not null) return existing;
            var warehouse = await ActiveWarehouse(c.WarehouseId, ct);
            var detail = await pickups.Get(c.PickupId, ct) ?? throw new KeyNotFoundException();
            if ((await jobs.ActiveBoxIds(ct)).Intersect(c.PackageIds).Any()) throw new OperationConflictException("A box is on a job or a delivery. Return it there before receiving it again.");
            var shipment = await shipments.Get(c.PickupId, ct);
            // A pickup no longer waits on the customer to confirm its packing list - the crew and the warehouse
            // sign for the boxes instead - so storage is not gated on PackingConfirmed.
            var boxes = new List<ReceiptBox>();
            // Validate every package before writing anything. Receipt and custody events commit together.
            foreach (var id in c.PackageIds) {
                var p = detail.Packages.SingleOrDefault(x => x.Id == id) ?? throw new InvalidOperationException("Select boxes belonging to this pickup.");
                var state = shipment.Packages.Single(x => x.Id == id);
                // ARRIVED counts: a box off a job at the destination port still has to be received into a warehouse.
                if (state.Status is not ("PACKED" or "IN_TRANSIT" or "ARRIVED")) throw new InvalidOperationException($"Box {p.TrackingNumber} is already stored or delivered. Refresh the list.");
                boxes.Add(new(p.Id, p.TrackingNumber, p.BoxTypeName, null, "See receiving notes", null, string.Join("\n", p.Items.Select(i => $"{i.Quantity} × {i.ItemName}" + (string.IsNullOrWhiteSpace(i.Notes) ? "" : $" — {i.Notes}"))), false));
            }
            foreach (var box in boxes) unit.Add(new PackageHandover(tenant.TenantId) { PickupId = c.PickupId, PackageId = box.Id, Status = "WAREHOUSE", WarehouseId = warehouse.Id,
                Location = Location(warehouse.Name, c.Bay), ReceivedBy = c.ReceivedBy.Trim(), Notes = c.Notes?.Trim() ?? "", RequestId = Guid.NewGuid(), RecordedAtUtc = clock.GetUtcNow(), ActorId = Actor() });
            var snapshot = new ReceiptSnapshot(detail.Pickup.CustomerName, null, detail.Pickup.Phone, detail.Pickup.Address, warehouse.Name, c.Bay?.Trim(), "Pickup crew", c.ReceivedBy.Trim(), c.Notes?.Trim(), detail.Pickup.PickupNumber, boxes, ShippingWithShipper(c.Shipping, detail.Pickup.CustomerName, detail.Pickup.Phone, detail.Pickup.Address));
            return await Save(c.RequestId, hash, receiptNumber, "PICKUP", c.WarehouseId, c.PickupId, snapshot, ct);
        }, ct);
    }
    public Task<WarehouseReceiptModel> UpdateShipping(Guid id, UpdateWarehouseShipping c, CancellationToken ct) => unit.Transaction(async () => {
        var receipt = await repository.Receipt(id, ct) ?? throw new KeyNotFoundException();
        if (c.ExpectedVersion != Hash(receipt.SnapshotJson)) throw new OperationConflictException("Receipt details changed. Reopen the receipt before saving.");
        ValidateShipping(c.Shipping);
        var details = JsonSerializer.Deserialize<ReceiptSnapshot>(receipt.SnapshotJson)!;
        receipt.SnapshotJson = JsonSerializer.Serialize(details with { Shipping = c.Shipping });
        await unit.Save(ct); return Map(receipt);
    }, ct);
    private static WarehouseShipping ShippingWithShipper(WarehouseShipping? value, string name, string? phone, string? address) =>
        new(value?.Shipper ?? new(name, phone, address), value?.Consignee, value?.ToLocation, value?.DropLocation, value?.DropAddress);
    private static void ValidateShipping(WarehouseShipping? value) {
        if (value is null) return;
        foreach (var party in new[] { value.Shipper, value.Consignee }) {
            Optional(party?.Name, 160); Optional(party?.Phone, 40); Optional(party?.Address, 1000);
        }
        Optional(value.ToLocation, 200); Optional(value.DropLocation, 200); Optional(value.DropAddress, 1000);
    }
    private async Task<Movers.Domain.Pickups.Warehouse> ActiveWarehouse(Guid id, CancellationToken ct) {
        var warehouse = await work.WarehouseAsync(id, false, ct);
        return warehouse is { IsActive: true } ? warehouse : throw new InvalidOperationException("Select an active warehouse.");
    }
    private async Task<WarehouseReceiptModel> Save(Guid requestId, string hash, string number, string source, Guid warehouseId, Guid? pickupId, ReceiptSnapshot snapshot, CancellationToken ct) {
        var row = new WarehouseReceipt(tenant.TenantId) { RequestId = requestId, RequestHash = hash, ReceiptNumber = number, Source = source, WarehouseId = warehouseId,
            PickupId = pickupId, ReceivedAtUtc = clock.GetUtcNow(), ActorId = Actor(), SnapshotJson = JsonSerializer.Serialize(snapshot) };
        unit.Add(row); await unit.Save(ct); return Map(row);
    }
    private async Task<WarehouseReceiptModel?> Existing(Guid id, string hash, CancellationToken ct) {
        if (id == Guid.Empty) throw new InvalidOperationException("A request ID is required.");
        var row = await repository.Request(id, ct);
        if (row is null) return null;
        if (row.RequestHash != hash) throw new OperationConflictException("This receipt request was already saved with different details. Refresh before creating another receipt.");
        return Map(row);
    }
    private Guid Actor() => user.UserId ?? throw new InvalidOperationException("Sign in to receive boxes.");
    private static WarehouseReceiptModel Map(WarehouseReceipt x) => new(x.Id, x.ReceiptNumber, x.Source, x.WarehouseId, x.PickupId, x.ReceivedAtUtc, JsonSerializer.Deserialize<ReceiptSnapshot>(x.SnapshotJson)!, Hash(x.SnapshotJson));
    private static string Hash<T>(T c) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(c))));
    private static string Location(string warehouse, string? bay) => string.IsNullOrWhiteSpace(bay) ? warehouse : $"{warehouse} · {bay.Trim()}";
    private static void Required(string? value, int max, string field) { if (string.IsNullOrWhiteSpace(value) || value.Trim().Length > max) throw new InvalidOperationException($"{field} is required and must be at most {max} characters."); }
    private static void Optional(string? value, int max) { if (value?.Length > max) throw new InvalidOperationException($"Keep the field within {max} characters."); }
}


