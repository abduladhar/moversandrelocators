using Movers.Domain.Common;

namespace Movers.Domain.Sales;

public sealed class SalesLead : TenantOwnedEntity
{
    private SalesLead() { }
    public SalesLead(Guid tenantId, string leadNumber, string customerName, string phone, string? email, string? source, Guid moveTypeId, string origin, string destination, DateOnly? expectedMoveDate, Guid statusId, Guid? assignedEmployeeId, string? notes) : base(tenantId) { CreatedAtUtc = DateTimeOffset.UtcNow; Update(leadNumber, customerName, phone, email, source, moveTypeId, origin, destination, expectedMoveDate, statusId, assignedEmployeeId, notes); IsActive = true; }
    public string LeadNumber { get; private set; } = string.Empty;
    public string CustomerName { get; private set; } = string.Empty;
    public string Phone { get; private set; } = string.Empty;
    public string? Email { get; private set; }
    public string? Source { get; private set; }
    public Guid MoveTypeId { get; private set; }
    public string Origin { get; private set; } = string.Empty;
    public string Destination { get; private set; } = string.Empty;
    public DateOnly? ExpectedMoveDate { get; private set; }
    public Guid StatusId { get; private set; }
    public Guid? AssignedEmployeeId { get; private set; }
    public string? Notes { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public void Update(string leadNumber, string customerName, string phone, string? email, string? source, Guid moveTypeId, string origin, string destination, DateOnly? expectedMoveDate, Guid statusId, Guid? assignedEmployeeId, string? notes) { LeadNumber = leadNumber.Trim().ToUpperInvariant(); CustomerName = customerName.Trim(); Phone = phone.Trim(); Email = NullIfBlank(email); Source = NullIfBlank(source); MoveTypeId = moveTypeId; Origin = origin.Trim(); Destination = destination.Trim(); ExpectedMoveDate = expectedMoveDate; StatusId = statusId; AssignedEmployeeId = assignedEmployeeId; Notes = NullIfBlank(notes); UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void SetActive(bool active) { IsActive = active; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    private static string? NullIfBlank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
