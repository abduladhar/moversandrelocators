using Microsoft.EntityFrameworkCore;
using Movers.DAL.Common;
using Movers.DAL.Persistence;
using Movers.Domain.Auditing;
using Movers.Services.Auditing;
using Movers.Services.Common;

namespace Movers.DAL.Auditing;

public sealed class AuditRepository(MoversDbContext db) : IAuditRepository
{
    public async Task<IReadOnlyList<AuditLog>> ListAsync(Guid tenantId, int take, CancellationToken cancellationToken) =>
        await db.AuditLogs.AsNoTracking().Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.SerialNo).Take(take).ToListAsync(cancellationToken);

    private static readonly SortMap<AuditLog> AuditSorts = new SortMap<AuditLog>("serialNo", true, x => x.SerialNo)
        .Add("serialNo", x => x.SerialNo).Add("createdAtUtc", x => x.CreatedAtUtc).Add("actorEmail", x => x.ActorEmail).Add("action", x => x.Action).Add("entityType", x => x.EntityType);
    public async Task<(IReadOnlyList<AuditLog> Items, int Total)> SearchAsync(Guid tenantId, AuditListFilter filter, ListQuery list, CancellationToken t)
    {
        var q = db.AuditLogs.AsNoTracking().Where(x => x.TenantId == tenantId);
        if (!string.IsNullOrWhiteSpace(filter.Action)) q = q.Where(x => x.Action == filter.Action);
        if (!string.IsNullOrWhiteSpace(filter.EntityType)) q = q.Where(x => x.EntityType == filter.EntityType);
        q = q.Search(list, w => x => x.ActorEmail.ToLower().Contains(w) || x.EntityType.ToLower().Contains(w) || (x.EntityId ?? "").ToLower().Contains(w) || x.Action.ToLower().Contains(w));
        var (items, total) = await q.Sort(list, AuditSorts).PageAsync(list, t);
        return (items, total);
    }
    public async Task<AuditListSummary> SummaryAsync(Guid tenantId, CancellationToken t)
    {
        var q = db.AuditLogs.AsNoTracking().Where(x => x.TenantId == tenantId);
        return new(await q.Select(x => x.Action).Distinct().OrderBy(x => x).ToListAsync(t), await q.Select(x => x.EntityType).Distinct().OrderBy(x => x).ToListAsync(t));
    }
}
