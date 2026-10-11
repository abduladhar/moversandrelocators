using Movers.Domain.Auditing;

namespace Movers.Services.Auditing;

public interface IAuditRepository
{
    Task<IReadOnlyList<AuditLog>> ListAsync(Guid tenantId, int take, CancellationToken cancellationToken);
}
