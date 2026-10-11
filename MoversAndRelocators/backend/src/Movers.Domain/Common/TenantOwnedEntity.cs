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
}
