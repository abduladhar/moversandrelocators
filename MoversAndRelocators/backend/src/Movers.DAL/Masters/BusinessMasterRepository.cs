using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Masters;
using Movers.Services.Masters;
namespace Movers.DAL.Masters;
public sealed class BusinessMasterRepository(MoversDbContext db) : IBusinessMasterRepository {
 public async Task<IReadOnlyList<BusinessMaster>> List(string kind, CancellationToken ct) => await db.Set<BusinessMaster>().AsNoTracking().Where(x => x.Kind == kind).ToListAsync(ct);
 public Task<BusinessMaster?> Get(string kind, string code, CancellationToken ct) => db.Set<BusinessMaster>().SingleOrDefaultAsync(x => x.Kind == kind && x.Code == code, ct);
 public void Add(BusinessMaster entity) => db.Add(entity);
 public async Task Save(CancellationToken ct) => await db.SaveChangesAsync(ct);
}
