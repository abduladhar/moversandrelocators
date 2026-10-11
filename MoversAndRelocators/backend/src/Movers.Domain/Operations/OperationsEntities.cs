using Movers.Domain.Common;

namespace Movers.Domain.Operations;

public sealed class LabourEntry(Guid tenantId) : TenantOwnedEntity(tenantId)
{
    public Guid PickupId { get; set; }
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = "";
    public string Activity { get; set; } = "";
    public DateTimeOffset StartedAtUtc { get; set; }
    public DateTimeOffset EndedAtUtc { get; set; }
    public decimal UnpaidBreakMinutes { get; set; }
    public decimal RegularHours { get; set; }
    public decimal OvertimeHours { get; set; }
    public decimal HourlyRate { get; set; }
    public decimal OvertimeRate { get; set; }
    public decimal Cost { get; set; }
    public string Currency { get; set; } = "INR";
    public string Notes { get; set; } = "";
    public Guid RequestId { get; set; }
    public string RequestHash { get; set; } = "";
    public Guid RecordedBy { get; set; }
}

public sealed class TransportTrip(Guid tenantId) : TenantOwnedEntity(tenantId)
{
    public string Number { get; set; } = "";
    public Guid VehicleId { get; set; }
    public string VehicleNumber { get; set; } = "";
    public string Origin { get; set; } = "";
    public string Destination { get; set; } = "";
    public DateTimeOffset StartedAtUtc { get; set; }
    public DateTimeOffset? CompletedAtUtc { get; set; }
    public decimal StartOdometer { get; set; }
    public decimal? EndOdometer { get; set; }
    public decimal Kilometres { get; set; }
    public decimal KmPerLitre { get; set; }
    public decimal FuelPricePerLitre { get; set; }
    public decimal FuelCost { get; set; }
    public decimal OtherCost { get; set; }
    public string Currency { get; set; } = "INR";
    public string Status { get; set; } = "PLANNED";
    public Guid Version { get; set; } = Guid.NewGuid();
}

public sealed class TripAllocation(Guid tenantId) : TenantOwnedEntity(tenantId)
{
    public Guid TripId { get; set; }
    public Guid PickupId { get; set; }
    public decimal Weight { get; set; }
    public decimal FuelCost { get; set; }
    public decimal OtherCost { get; set; }
}

public sealed class JobExpense(Guid tenantId) : TenantOwnedEntity(tenantId)
{
    public Guid PickupId { get; set; }
    public string Category { get; set; } = "";
    public string Vendor { get; set; } = "";
    public string Reference { get; set; } = "";
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string Notes { get; set; } = "";
    public DateTimeOffset RecordedAtUtc { get; set; }
    public Guid RequestId { get; set; }
    public string RequestHash { get; set; } = "";
}

public sealed class SavedReport(Guid tenantId) : TenantOwnedEntity(tenantId)
{
    public string Name { get; set; } = "";
    public string ColumnsJson { get; set; } = "[]";
    public string SortBy { get; set; } = "pickupNumber";
    public Guid Version { get; set; } = Guid.NewGuid();
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class JournalEntry(Guid tenantId) : TenantOwnedEntity(tenantId)
{
    public string Reference { get; set; } = "";
    public string Description { get; set; } = "";
    public string Currency { get; set; } = "INR";
    public DateOnly PostingDate { get; set; }
    public Guid? PickupId { get; set; }
    public Guid? ReversesId { get; set; }
    public Guid RequestId { get; set; }
    public string RequestHash { get; set; } = "";
    public Guid PostedBy { get; set; }
    public DateTimeOffset PostedAtUtc { get; set; }
}

public sealed class JournalLine(Guid tenantId) : TenantOwnedEntity(tenantId)
{
    public Guid JournalId { get; set; }
    public string AccountCode { get; set; } = "";
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
}
