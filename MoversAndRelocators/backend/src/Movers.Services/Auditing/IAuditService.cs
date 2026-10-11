namespace Movers.Services.Auditing;

public interface IAuditService
{
    Task<IReadOnlyList<AuditLogModel>> ListAsync(int take, CancellationToken cancellationToken);
}
