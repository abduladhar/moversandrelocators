using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Auditing;
using Movers.Services.Auditing;

namespace Movers.DAL.Auditing;

public sealed class AuditRepository(MoversDbContext db) : IAuditRepository
{
    public async Task<IReadOnlyList<AuditLog>> ListAsync(Guid tenantId, int take, CancellationToken cancellationToken) =>
        await db.AuditLogs.AsNoTracking().Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.SerialNo).Take(take).ToListAsync(cancellationToken);
}
