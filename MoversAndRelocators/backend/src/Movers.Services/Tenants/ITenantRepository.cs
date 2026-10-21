using Movers.Domain.Tenants;

namespace Movers.Services.Tenants;

public interface ITenantRepository
{
    Task<IReadOnlyList<Tenant>> ListAsync(CancellationToken cancellationToken);
    Task<(IReadOnlyList<Tenant> Items, int Total)> SearchAsync(TenantListFilter filter, Movers.Services.Common.ListQuery query, CancellationToken cancellationToken);
    Task<TenantListSummary> SummaryAsync(CancellationToken cancellationToken);
    Task<Tenant?> GetAsync(Guid id, bool trackChanges, CancellationToken cancellationToken);
    Task<Tenant?> FindActiveAsync(Guid? id, string? slug, CancellationToken cancellationToken);
    Task<bool> SlugExistsAsync(string slug, Guid? excludingId, CancellationToken cancellationToken);
    void Add(Tenant tenant);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
