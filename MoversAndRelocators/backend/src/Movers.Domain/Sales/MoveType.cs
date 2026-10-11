using Movers.Domain.Common;

namespace Movers.Domain.Sales;

public sealed class MoveType : TenantOwnedEntity
{
    private MoveType() { }

    public MoveType(Guid tenantId, string code, string name, int displayOrder, string? description) : base(tenantId)
    {
        CreatedAtUtc = DateTimeOffset.UtcNow;
        Update(code, name, displayOrder, description);
        IsActive = true;
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public int DisplayOrder { get; private set; }
    public string? Description { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public void Update(string code, string name, int displayOrder, string? description)
    {
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        DisplayOrder = displayOrder;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void SetActive(bool active)
    {
        IsActive = active;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }
}
