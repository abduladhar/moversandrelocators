using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Operations;
using Movers.Services.Operations;
namespace Movers.DAL.Operations;
public sealed class WarehouseRepository(MoversDbContext db) : IWarehouseRepository {
    public Task<WarehouseReceipt?> Receipt(Guid id, CancellationToken ct) => db.Set<WarehouseReceipt>().SingleOrDefaultAsync(x => x.Id == id, ct);
    public async Task<IReadOnlyList<WarehouseReceipt>> Receipts(CancellationToken ct) => await db.Set<WarehouseReceipt>().AsNoTracking().OrderByDescending(x => x.SerialNo).ToListAsync(ct);
    public Task<WarehouseReceipt?> Request(Guid requestId, CancellationToken ct) => db.Set<WarehouseReceipt>().AsNoTracking().SingleOrDefaultAsync(x => x.RequestId == requestId, ct);
    public async Task<IReadOnlyList<WarehouseStock>> PickupStock(CancellationToken ct) {
        var latest = db.Set<PackageHandover>().Where(h => !db.Set<PackageHandover>().Any(n => n.PackageId == h.PackageId && n.SerialNo > h.SerialNo));
        var rows = await (from h in latest.Where(x => x.Status == "WAREHOUSE" && x.WarehouseId != null)
            join p in db.PickupPackages on h.PackageId equals p.Id
            join pickup in db.Pickups on p.PickupId equals pickup.Id
            join w in db.Set<Movers.Domain.Pickups.Warehouse>() on h.WarehouseId equals w.Id
            select new { p.Id, p.TrackingNumber, pickup.CustomerName, w.Name, WarehouseId = w.Id, h.Location, pickup.PickupNumber, h.RecordedAtUtc, h.ReceivedBy, p.Notes }).AsNoTracking().ToListAsync(ct);
        var ids = rows.Select(x => x.Id).ToList();
        var items = await db.PickupPackageItems.AsNoTracking().Where(x => ids.Contains(x.PickupPackageId)).ToListAsync(ct);
        return rows.Select(x => new WarehouseStock(x.Id, x.TrackingNumber, x.CustomerName, "PICKUP", x.WarehouseId, x.Name, x.Location, x.PickupNumber, x.RecordedAtUtc, x.ReceivedBy,
            x.Notes ?? "Pickup box", string.Join("\n", items.Where(i => i.PickupPackageId == x.Id).Select(i => $"{i.Quantity} × {i.ItemName}")))).ToList();
    }
}

public sealed class WarehouseAttachmentRepository(MoversDbContext db) : IWarehouseAttachmentRepository {
    public async Task<IReadOnlyList<WarehouseAttachment>> List(Guid receiptId, CancellationToken ct) => await db.Set<WarehouseAttachment>().AsNoTracking().Where(x => x.ReceiptId == receiptId && x.IsUploaded && !x.IsDeleted).OrderByDescending(x => x.SerialNo).ToListAsync(ct);
    public Task<WarehouseAttachment?> Get(Guid id, CancellationToken ct) => db.Set<WarehouseAttachment>().SingleOrDefaultAsync(x => x.Id == id, ct);
}
