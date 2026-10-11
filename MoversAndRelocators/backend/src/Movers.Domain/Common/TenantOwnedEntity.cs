namespace Movers.Domain.Common;

public interface ITenantOwned
{
    Guid TenantId { get; }
}

public abstract class TenantOwnedEntity : Entity, ITenantOwned
{
    protected TenantOwnedEntity() { }

    protected TenantOwnedEntity(Guid tenantId)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("A tenant ID is required.", nameof(tenantId));
        TenantId = tenantId;
    }

    public Guid TenantId { get; protected set; }

    /// <summary>
    /// The company inside the tenant that owns this record. Company records (jobs, documents, ledger) get it from the
    /// data layer when added. Masters may have it: null means shared by every company, a value means that company only.
    /// </summary>
    public Guid? CompanyId { get; private set; }

    /// <summary>Masters: null shares the record with every company of the tenant; a company ID limits it to that company.</summary>
    public void SetCompanyScope(Guid? companyId) => CompanyId = companyId;
}
