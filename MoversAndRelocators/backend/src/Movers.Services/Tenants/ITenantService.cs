namespace Movers.Services.Tenants;

public interface ITenantService
{
    Task<IReadOnlyList<TenantModel>> ListAsync(CancellationToken cancellationToken);
    Task<TenantModel?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<TenantModel> CreateAsync(SaveTenantCommand command, CancellationToken cancellationToken);
    Task<TenantModel?> UpdateAsync(Guid id, SaveTenantCommand command, CancellationToken cancellationToken);
    Task<TenantModel?> SetStatusAsync(Guid id, bool isActive, CancellationToken cancellationToken);
    Task<bool> ResolveCurrentAsync(string? tenantId, string? tenantSlug, CancellationToken cancellationToken);
    TenantModel GetCurrent();
}
