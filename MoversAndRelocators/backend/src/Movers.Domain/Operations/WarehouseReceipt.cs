using Movers.Domain.Common;
namespace Movers.Domain.Operations;
public sealed class WarehouseReceipt(Guid tenantId) : TenantOwnedEntity(tenantId)
{
    public Guid RequestId { get; set; }
    public string RequestHash { get; set; } = "";
    public string ReceiptNumber { get; set; } = "";
    public string Source { get; set; } = "";
    public Guid WarehouseId { get; set; }
    public Guid? PickupId { get; set; }
    public DateTimeOffset ReceivedAtUtc { get; set; }
    public Guid ActorId { get; set; }
    public string SnapshotJson { get; set; } = "";
}
