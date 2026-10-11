using Movers.Domain.Tenants;

namespace Movers.Services.Tenancy;

public interface ITenantContext
{
    Tenant? Tenant { get; }
    Guid TenantId { get; }
    bool IsResolved { get; }
    void SetTenant(Tenant tenant);
}
