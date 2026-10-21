using Movers.Domain.Auditing;

namespace Movers.Services.Auditing;

public interface IAuditRepository
{
    Task<IReadOnlyList<AuditLog>> ListAsync(Guid tenantId, int take, CancellationToken cancellationToken);
    Task<(IReadOnlyList<AuditLog> Items, int Total)> SearchAsync(Guid tenantId, AuditListFilter filter, Movers.Services.Common.ListQuery query, CancellationToken cancellationToken);
    Task<AuditListSummary> SummaryAsync(Guid tenantId, CancellationToken cancellationToken);
}
