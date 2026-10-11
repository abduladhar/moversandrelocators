using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Operations;
using Movers.Services.Operations;
namespace Movers.DAL.Operations;
public sealed class JobRepository(MoversDbContext db) : IJobRepository {
 public async Task<IReadOnlyList<TransportJob>> List(CancellationToken ct) => await db.Set<TransportJob>().OrderByDescending(x => x.SerialNo).ToListAsync(ct);
 public Task<TransportJob?> Get(Guid id, CancellationToken ct) => db.Set<TransportJob>().SingleOrDefaultAsync(x => x.Id == id, ct);
 public Task<TransportJob?> Request(Guid id, CancellationToken ct) => db.Set<TransportJob>().SingleOrDefaultAsync(x => x.RequestId == id, ct);
 public async Task<IReadOnlyList<JobCargo>> Cargo(Guid id, CancellationToken ct) => await db.Set<JobCargo>().Where(x => x.JobId == id).OrderBy(x => x.SerialNo).ToListAsync(ct);
 /// <summary>Boxes that are not free to move: on an active job, or held by a delivery.</summary>
 public async Task<IReadOnlyList<Guid>> ActiveBoxIds(CancellationToken ct) => await db.Set<JobCargo>().Where(x => x.IsActive).Select(x => x.BoxId).Union(Movers.DAL.Delivery.DeliveryRepository.HeldBoxIds(db)).ToListAsync(ct);
 public Task<Guid?> PickupId(Guid id, CancellationToken ct) => db.PickupPackages.Where(x => x.Id == id).Select(x => (Guid?)x.PickupId).SingleOrDefaultAsync(ct);
}
