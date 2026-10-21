namespace Movers.Services.Auditing;

public interface IAuditService
{
    Task<IReadOnlyList<AuditLogModel>> ListAsync(int take, CancellationToken cancellationToken);
    /// <summary>Advanced search over the tenant's whole audit log (not only the latest events).</summary>
    Task<Movers.Services.Common.PagedResult<AuditLogModel>> SearchAsync(AuditListFilter filter, Movers.Services.Common.ListQuery query, CancellationToken cancellationToken);
}

/// <summary>Advanced search filters of the Audit page (exact action / entity type).</summary>
public sealed record AuditListFilter(string? Action = null, string? EntityType = null);
/// <summary>The distinct actions and entity types in the tenant's audit log, for the filter options.</summary>
public sealed record AuditListSummary(IReadOnlyList<string> Actions, IReadOnlyList<string> EntityTypes);
