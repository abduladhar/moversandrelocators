using Movers.Domain.Tenants;

namespace Movers.Services.Tenancy;

public sealed class TenantContext : ITenantContext
{
    public Tenant? Tenant { get; private set; }
    public Guid TenantId => Tenant?.Id ?? throw new InvalidOperationException("No tenant has been resolved for this request.");
    public bool IsResolved => Tenant is not null;

    public void SetTenant(Tenant tenant)
    {
        if (Tenant is not null)
            throw new InvalidOperationException("The request tenant cannot be changed after it is resolved.");
        Tenant = tenant;
    }
}
