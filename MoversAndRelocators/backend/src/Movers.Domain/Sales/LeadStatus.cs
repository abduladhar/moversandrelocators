using Movers.Domain.Common;

namespace Movers.Domain.Sales;

public sealed class LeadStatus : TenantOwnedEntity
{
    private LeadStatus() { }
    public LeadStatus(Guid tenantId, string code, string name, int displayOrder, string? color, bool isClosed) : base(tenantId) { CreatedAtUtc = DateTimeOffset.UtcNow; Update(code, name, displayOrder, color, isClosed); IsActive = true; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public int DisplayOrder { get; private set; }
    public string? Color { get; private set; }
    public bool IsClosed { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public void Update(string code, string name, int displayOrder, string? color, bool isClosed) { Code = code.Trim().ToUpperInvariant(); Name = name.Trim(); DisplayOrder = displayOrder; Color = string.IsNullOrWhiteSpace(color) ? null : color.Trim(); IsClosed = isClosed; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void SetActive(bool active) { IsActive = active; UpdatedAtUtc = DateTimeOffset.UtcNow; }
}
