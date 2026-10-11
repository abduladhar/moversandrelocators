using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Packing;
using Movers.Domain.Pickups;
using Movers.Domain.Surveys;
using Movers.Services.Pickups;

namespace Movers.DAL.Pickups;

public sealed class PickupCollectionRepository(MoversDbContext db) : IPickupCollectionRepository
{
    public Task<Pickup?> PickupAsync(Guid id, CancellationToken t) => db.Pickups.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, t);

    public async Task<IReadOnlyList<PickupPackingJob>> LinksAsync(Guid pickupId, CancellationToken t) =>
        await db.PickupPackingJobs.AsNoTracking().Where(x => x.PickupId == pickupId).OrderBy(x => x.SerialNo).ToListAsync(t);

    public Task<PickupPackingJob?> LinkAsync(Guid pickupId, Guid packingJobId, bool track, CancellationToken t) =>
        (track ? db.PickupPackingJobs : db.PickupPackingJobs.AsNoTracking()).SingleOrDefaultAsync(x => x.PickupId == pickupId && x.PackingJobId == packingJobId, t);

    public Task<PackingJob?> PackingJobAsync(Guid id, CancellationToken t) => db.Set<PackingJob>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, t);

    public async Task<IReadOnlyList<PackingJob>> SelectableJobsAsync(Guid pickupId, string? search, CancellationToken t)
    {
        var linked = db.PickupPackingJobs.AsNoTracking().Where(x => x.PickupId == pickupId).Select(x => x.PackingJobId);
        var q = db.Set<PackingJob>().AsNoTracking().Where(x => x.Status != PackingJobStatuses.Cancelled && !linked.Contains(x.Id));
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(x => EF.Functions.Like(x.JobNumber, "%" + s + "%") || EF.Functions.Like(x.CustomerName, "%" + s + "%") || EF.Functions.Like(x.Address, "%" + s + "%"));
        }
        return await q.OrderByDescending(x => x.ScheduledAtUtc).Take(50).ToListAsync(t);
    }

    public async Task<IReadOnlyList<PackingJobBox>> JobBoxesAsync(Guid packingJobId, CancellationToken t) =>
        await db.Set<PackingJobBox>().AsNoTracking().Where(x => x.PackingJobId == packingJobId).OrderBy(x => x.SerialNo).ToListAsync(t);

    public async Task<IReadOnlyList<PackingJobBox>> JobBoxesAsync(IReadOnlyCollection<Guid> packingJobIds, CancellationToken t) =>
        packingJobIds.Count == 0 ? []
        : await db.Set<PackingJobBox>().AsNoTracking().Where(x => packingJobIds.Contains(x.PackingJobId)).OrderBy(x => x.SerialNo).ToListAsync(t);

    public async Task<IReadOnlyList<PickupPackage>> PickupPackagesAsync(Guid pickupId, CancellationToken t) =>
        await db.PickupPackages.AsNoTracking().Where(x => x.PickupId == pickupId).OrderBy(x => x.SerialNo).ToListAsync(t);

    public async Task<IReadOnlyList<PickupBoxPick>> PicksAsync(Guid pickupId, bool track, CancellationToken t) =>
        await (track ? db.PickupBoxPicks : db.PickupBoxPicks.AsNoTracking()).Where(x => x.PickupId == pickupId).OrderBy(x => x.SerialNo).ToListAsync(t);

    public Task<PickupBoxPick?> PickAsync(Guid pickupId, string source, Guid boxId, bool track, CancellationToken t) =>
        (track ? db.PickupBoxPicks : db.PickupBoxPicks.AsNoTracking()).SingleOrDefaultAsync(x => x.PickupId == pickupId && x.Source == source && x.BoxId == boxId, t);

    public Task<PickupBoxPick?> PickByTrackingAsync(Guid pickupId, string trackingNumber, bool track, CancellationToken t) =>
        (track ? db.PickupBoxPicks : db.PickupBoxPicks.AsNoTracking()).FirstOrDefaultAsync(x => x.PickupId == pickupId && x.TrackingNumber == trackingNumber, t);

    public async Task<IReadOnlyList<PickupBoxPick>> PicksForBoxesElsewhereAsync(Guid pickupId, IReadOnlyCollection<Guid> boxIds, CancellationToken t) =>
        boxIds.Count == 0 ? []
        : await db.PickupBoxPicks.AsNoTracking().Where(x => x.PickupId != pickupId && boxIds.Contains(x.BoxId)).ToListAsync(t);

    public async Task<IReadOnlyList<PickupBoxPickEvent>> EventsAsync(Guid pickupId, CancellationToken t) =>
        await db.PickupBoxPickEvents.AsNoTracking().Where(x => x.PickupId == pickupId).OrderByDescending(x => x.OccurredAtUtc).ThenByDescending(x => x.SerialNo).Take(500).ToListAsync(t);

    public async Task<IReadOnlyList<PickupBoxPickEvent>> EventsAsync(Guid pickupId, string source, Guid boxId, CancellationToken t) =>
        await db.PickupBoxPickEvents.AsNoTracking().Where(x => x.PickupId == pickupId && x.Source == source && x.BoxId == boxId)
            .OrderByDescending(x => x.OccurredAtUtc).ThenByDescending(x => x.SerialNo).ToListAsync(t);

    public async Task<IReadOnlyList<PickupAttachment>> BoxAttachmentsAsync(Guid pickupId, CancellationToken t) =>
        await db.Set<PickupAttachment>().AsNoTracking().Where(x => x.PickupId == pickupId && x.BoxId != null).OrderBy(x => x.SerialNo).ToListAsync(t);

    public async Task<IReadOnlyList<PickupAttachment>> BoxAttachmentsAsync(Guid pickupId, bool track, CancellationToken t) =>
        await (track ? db.Set<PickupAttachment>() : db.Set<PickupAttachment>().AsNoTracking()).Where(x => x.PickupId == pickupId && x.BoxId != null).ToListAsync(t);

    public Task<PickupCollectionApproval?> LatestApprovalAsync(Guid pickupId, bool track, CancellationToken t) =>
        (track ? db.PickupCollectionApprovals : db.PickupCollectionApprovals.AsNoTracking())
            .Where(x => x.PickupId == pickupId).OrderByDescending(x => x.SerialNo).FirstOrDefaultAsync(t);

    public Task<Warehouse?> WarehouseAsync(Guid id, CancellationToken t) => db.Set<Warehouse>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, t);
    public async Task<IReadOnlyList<Warehouse>> WarehousesAsync(CancellationToken t) => await db.Set<Warehouse>().AsNoTracking().OrderBy(x => x.Name).ToListAsync(t);
    public async Task<IReadOnlyList<BoxType>> BoxTypesAsync(CancellationToken t) => await db.Set<BoxType>().AsNoTracking().ToListAsync(t);

    public Task<BoxType?> BoxTypeAsync(Guid id, CancellationToken t) => db.Set<BoxType>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, t);

    public Task Save(CancellationToken t) => db.SaveChangesAsync(t);
    public void Add(object entity) => db.Add(entity);
    public void Remove(object entity) => db.Remove(entity);
    public void RemoveRange(IEnumerable<object> entities) => db.RemoveRange(entities);
}
