using Movers.Domain.Common;

namespace Movers.Domain.Sales;

public sealed class FollowUpStatus : TenantOwnedEntity
{
    private FollowUpStatus() { }
    public FollowUpStatus(Guid tenantId, string code, string name, int displayOrder, string? color, bool isCompleted) : base(tenantId) { CreatedAtUtc = DateTimeOffset.UtcNow; Update(code, name, displayOrder, color, isCompleted); IsActive = true; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public int DisplayOrder { get; private set; }
    public string? Color { get; private set; }
    public bool IsCompleted { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public void Update(string code, string name, int displayOrder, string? color, bool isCompleted) { Code = code.Trim().ToUpperInvariant(); Name = name.Trim(); DisplayOrder = displayOrder; Color = string.IsNullOrWhiteSpace(color) ? null : color.Trim(); IsCompleted = isCompleted; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void SetActive(bool active) { IsActive = active; UpdatedAtUtc = DateTimeOffset.UtcNow; }
}
