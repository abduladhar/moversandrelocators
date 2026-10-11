using Movers.Domain.Common;

namespace Movers.Domain.Sales;

public sealed class SalesLeadUploadLink : TenantOwnedEntity
{
    private SalesLeadUploadLink() { }
    public SalesLeadUploadLink(Guid tenantId, Guid salesLeadId, string tokenHash, DateTimeOffset expiresAtUtc) : base(tenantId)
    { SalesLeadId = salesLeadId; TokenHash = tokenHash; ExpiresAtUtc = expiresAtUtc; IsActive = true; CreatedAtUtc = DateTimeOffset.UtcNow; }
    public Guid SalesLeadId { get; private set; }
    public string TokenHash { get; private set; } = string.Empty;
    public DateTimeOffset ExpiresAtUtc { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public string? RequestedItems { get; private set; }
    public string? Description { get; private set; }
    public string? CustomerItems { get; private set; }
    public string? CustomerDescription { get; private set; }
    public void SetInstructions(string? items, string? description) { RequestedItems = items; Description = description; }
    public void SetCustomerDetails(string? items, string? description) { CustomerItems = items; CustomerDescription = description; }
    public void Revoke() => IsActive = false;
}
