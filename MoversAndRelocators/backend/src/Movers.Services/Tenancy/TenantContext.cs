using Movers.Domain.Tenants;

namespace Movers.Services.Tenancy;

public sealed class TenantContext : ITenantContext
{
    private int allCompanies;

    public Tenant? Tenant { get; private set; }
    public Guid TenantId => Tenant?.Id ?? throw new InvalidOperationException("No tenant has been resolved for this request.");
    public bool IsResolved => Tenant is not null;

    public Company? Company { get; private set; }
    public Guid? CompanyId => allCompanies > 0 ? null : Company?.Id;
    public bool IsCompanyResolved => Company is not null;

    public void SetTenant(Tenant tenant)
    {
        if (Tenant is not null)
            throw new InvalidOperationException("The request tenant cannot be changed after it is resolved.");
        Tenant = tenant;
    }

    public void SetCompany(Company company)
    {
        if (Tenant is null || company.TenantId != Tenant.Id)
            throw new InvalidOperationException("The company does not belong to the request tenant.");
        if (Company is not null && Company.Id != company.Id)
            throw new InvalidOperationException("The request company cannot be changed after it is resolved.");
        Company = company;
    }

    public IDisposable AllCompanies()
    {
        allCompanies++;
        return new Scope(() => allCompanies--);
    }

    private sealed class Scope(Action release) : IDisposable
    {
        private Action? release = release;
        public void Dispose() { release?.Invoke(); release = null; }
    }
}
