namespace Movers.Services.Tenants;

public interface ITenantService
{
    Task<IReadOnlyList<TenantModel>> ListAsync(CancellationToken cancellationToken);
    Task<Movers.Services.Common.PagedResult<TenantModel>> SearchAsync(TenantListFilter filter, Movers.Services.Common.ListQuery query, CancellationToken cancellationToken);
    Task<TenantModel?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<TenantModel> CreateAsync(SaveTenantCommand command, CancellationToken cancellationToken);
    Task<TenantModel?> UpdateAsync(Guid id, SaveTenantCommand command, CancellationToken cancellationToken);
    Task<TenantModel?> SetStatusAsync(Guid id, bool isActive, CancellationToken cancellationToken);
    Task<bool> ResolveCurrentAsync(string? tenantId, string? tenantSlug, CancellationToken cancellationToken);
    TenantModel GetCurrent();
}

/// <summary>Advanced search filters of the platform Tenants page.</summary>
public sealed record TenantListFilter(bool? IsActive = null);
/// <summary>Whole-list figures for the Tenants page stats cards.</summary>
public sealed record TenantListSummary(int Total, int Active, int Inactive);
