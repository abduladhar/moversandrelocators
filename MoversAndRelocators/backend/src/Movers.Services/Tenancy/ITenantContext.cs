using Movers.Domain.Tenants;

namespace Movers.Services.Tenancy;

public interface ITenantContext
{
    Tenant? Tenant { get; }
    Guid TenantId { get; }
    bool IsResolved { get; }
    void SetTenant(Tenant tenant);

    /// <summary>The company of the request inside the tenant. Company records (jobs, documents, ledger) are filtered to it.</summary>
    Company? Company { get; }
    /// <summary>The company used by the data filter: null while no company is resolved, or inside <see cref="AllCompanies"/>.</summary>
    Guid? CompanyId { get; }
    bool IsCompanyResolved { get; }
    void SetCompany(Company company);
    /// <summary>Temporarily reads across every company of the tenant (for checks on shared masters). Dispose to restore.</summary>
    IDisposable AllCompanies();
}
