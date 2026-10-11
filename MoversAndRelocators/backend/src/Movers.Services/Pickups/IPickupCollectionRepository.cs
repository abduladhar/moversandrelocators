using Movers.Domain.Packing;
using Movers.Domain.Surveys;
using Movers.Domain.Pickups;

namespace Movers.Services.Pickups;

/// <summary>Data access for pickup collection: linked packing jobs, the status of each expected box, its audit
/// trail and the warehouse approval.</summary>
public interface IPickupCollectionRepository
{
    Task<Pickup?> PickupAsync(Guid id, CancellationToken t);

    Task<IReadOnlyList<PickupPackingJob>> LinksAsync(Guid pickupId, CancellationToken t);
    Task<PickupPackingJob?> LinkAsync(Guid pickupId, Guid packingJobId, bool track, CancellationToken t);

    Task<PackingJob?> PackingJobAsync(Guid id, CancellationToken t);
    /// <summary>Jobs that can still be added: not already on this pickup, and not fully collected elsewhere.</summary>
    Task<IReadOnlyList<PackingJob>> SelectableJobsAsync(Guid pickupId, string? search, CancellationToken t);
    Task<IReadOnlyList<PackingJobBox>> JobBoxesAsync(Guid packingJobId, CancellationToken t);
    Task<IReadOnlyList<PackingJobBox>> JobBoxesAsync(IReadOnlyCollection<Guid> packingJobIds, CancellationToken t);
    Task<IReadOnlyList<PickupPackage>> PickupPackagesAsync(Guid pickupId, CancellationToken t);

    Task<IReadOnlyList<PickupBoxPick>> PicksAsync(Guid pickupId, bool track, CancellationToken t);
    Task<PickupBoxPick?> PickAsync(Guid pickupId, string source, Guid boxId, bool track, CancellationToken t);
    /// <summary>Resolves a scanned label. Restricted to the pickup so a scan cannot touch another visit's box.</summary>
    Task<PickupBoxPick?> PickByTrackingAsync(Guid pickupId, string trackingNumber, bool track, CancellationToken t);
    /// <summary>Picks for the same box on other pickups, so a box already collected elsewhere is not offered twice.</summary>
    Task<IReadOnlyList<PickupBoxPick>> PicksForBoxesElsewhereAsync(Guid pickupId, IReadOnlyCollection<Guid> boxIds, CancellationToken t);

    Task<IReadOnlyList<PickupBoxPickEvent>> EventsAsync(Guid pickupId, CancellationToken t);
    Task<IReadOnlyList<PickupBoxPickEvent>> EventsAsync(Guid pickupId, string source, Guid boxId, CancellationToken t);

    /// <summary>Photos, videos and documents held against a box on this pickup.</summary>
    Task<IReadOnlyList<PickupAttachment>> BoxAttachmentsAsync(Guid pickupId, CancellationToken t);
    Task<IReadOnlyList<PickupAttachment>> BoxAttachmentsAsync(Guid pickupId, bool track, CancellationToken t);

    Task<PickupCollectionApproval?> LatestApprovalAsync(Guid pickupId, bool track, CancellationToken t);
    Task<Warehouse?> WarehouseAsync(Guid id, CancellationToken t);
    Task<IReadOnlyList<Warehouse>> WarehousesAsync(CancellationToken t);
    Task<IReadOnlyList<BoxType>> BoxTypesAsync(CancellationToken t);
    Task<BoxType?> BoxTypeAsync(Guid id, CancellationToken t);

    Task Save(CancellationToken t);

    void Add(object entity);
    void Remove(object entity);
    void RemoveRange(IEnumerable<object> entities);
}
