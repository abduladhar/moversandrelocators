using Movers.Services.Tenancy;

namespace Movers.Services.Auditing;

public sealed class AuditService(IAuditRepository repository, ITenantContext tenantContext) : IAuditService
{
    public async Task<IReadOnlyList<AuditLogModel>> ListAsync(int take, CancellationToken cancellationToken) =>
        (await repository.ListAsync(tenantContext.TenantId, Math.Clamp(take, 1, 500), cancellationToken))
        .Select(x => new AuditLogModel(x.SerialNo, x.Id, x.TenantId, x.ActorUserId, x.ActorEmail,
            x.Action, x.EntityType, x.EntityId, x.Changes, x.IpAddress, x.CreatedAtUtc)).ToList();
}
