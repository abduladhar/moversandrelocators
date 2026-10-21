using Movers.Domain.Auditing;
using Movers.Services.Tenancy;

namespace Movers.Services.Auditing;

public sealed class AuditService(IAuditRepository repository, ITenantContext tenantContext) : IAuditService
{
    public async Task<IReadOnlyList<AuditLogModel>> ListAsync(int take, CancellationToken cancellationToken) =>
        (await repository.ListAsync(tenantContext.TenantId, Math.Clamp(take, 1, 500), cancellationToken)).Select(Map).ToList();

    public async Task<Movers.Services.Common.PagedResult<AuditLogModel>> SearchAsync(AuditListFilter filter, Movers.Services.Common.ListQuery query, CancellationToken cancellationToken)
    {
        query = query.Normalized(); var (items, total) = await repository.SearchAsync(tenantContext.TenantId, filter, query, cancellationToken);
        return new(items.Select(Map).ToList(), total, await repository.SummaryAsync(tenantContext.TenantId, cancellationToken));
    }

    private static AuditLogModel Map(AuditLog x) => new(x.SerialNo, x.Id, x.TenantId, x.ActorUserId, x.ActorEmail,
        x.Action, x.EntityType, x.EntityId, x.Changes, x.IpAddress, x.CreatedAtUtc);
}
