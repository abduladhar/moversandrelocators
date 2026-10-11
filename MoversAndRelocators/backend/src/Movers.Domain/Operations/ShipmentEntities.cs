using Movers.Domain.Common;
namespace Movers.Domain.Operations;

public sealed class PackingConfirmation(Guid tenantId) : TenantOwnedEntity(tenantId)
{
    public Guid PickupId { get; set; }
    public string SnapshotJson { get; set; } = "";
    public string SnapshotHash { get; set; } = "";
    public string TokenHash { get; set; } = "";
    public DateTimeOffset ExpiresAtUtc { get; set; }
    public DateTimeOffset? RevokedAtUtc { get; set; }
    public string Response { get; set; } = "PENDING";
    public string? ResponderName { get; set; }
    public string? ResponseNotes { get; set; }
    public DateTimeOffset? RespondedAtUtc { get; set; }
    public Guid Version { get; set; } = Guid.NewGuid();
}
public sealed class PackageHandover(Guid tenantId) : TenantOwnedEntity(tenantId)
{
    public Guid PickupId { get; set; }
    public Guid PackageId { get; set; }
    public string Status { get; set; } = "";
    public string Location { get; set; } = "";
    public string ReceivedBy { get; set; } = "";
    public string Notes { get; set; } = "";
    public Guid RequestId { get; set; }
    public DateTimeOffset RecordedAtUtc { get; set; }
    public Guid ActorId { get; set; }
    public Guid? WarehouseId { get; set; }
}
public sealed class ShipmentClaim(Guid tenantId) : TenantOwnedEntity(tenantId)
{
    public Guid PickupId { get; set; }
    public Guid? PackageId { get; set; }
    public string Category { get; set; } = "";
    public string Description { get; set; } = "";
    public string Owner { get; set; } = "";
    public string Status { get; set; } = "OPEN";
    public string? Resolution { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? ResolvedAtUtc { get; set; }
    public Guid Version { get; set; } = Guid.NewGuid();
}
