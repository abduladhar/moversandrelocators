using Movers.Domain.Common;
namespace Movers.Domain.Operations;
public sealed class TransportJob(Guid tenantId) : TenantOwnedEntity(tenantId) {
    public string JobNumber { get; set; } = "";
    public Guid RequestId { get; set; }
    public string RequestHash { get; set; } = "";
    public string DetailsJson { get; set; } = "";
    public string Status { get; set; } = "DRAFT";
    public Guid Version { get; set; } = Guid.NewGuid();
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? DepartedAtUtc { get; set; }
    public DateTimeOffset? ArrivedAtUtc { get; set; }
}
public sealed class JobCargo(Guid tenantId) : TenantOwnedEntity(tenantId) {
    public Guid JobId { get; set; }
    public Guid BoxId { get; set; }
    public Guid? PickupId { get; set; }
    public bool IsActive { get; set; } = true;
    public string SnapshotJson { get; set; } = "";
    public string LoadedBy { get; set; } = "";
    public DateTimeOffset LoadedAtUtc { get; set; }
    public DateTimeOffset? UnloadedAtUtc { get; set; }
    public string? UnloadedBy { get; set; }
}
