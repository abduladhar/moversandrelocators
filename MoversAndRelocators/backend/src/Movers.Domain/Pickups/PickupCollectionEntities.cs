using Movers.Domain.Common;

namespace Movers.Domain.Pickups;

/// <summary>Which packing jobs a pickup collects. A link rather than a column on PackingJob, because a job's
/// boxes can be collected over several visits, so the same job may appear under more than one pickup.</summary>
public sealed class PickupPackingJob : TenantOwnedEntity
{
    private PickupPackingJob() { }
    public PickupPackingJob(Guid tenantId, Guid pickupId, Guid packingJobId, DateTimeOffset at, string linkedBy) : base(tenantId)
    { PickupId = pickupId; PackingJobId = packingJobId; LinkedAtUtc = at; LinkedBy = linkedBy; }
    public Guid PickupId { get; private set; }
    public Guid PackingJobId { get; private set; }
    public DateTimeOffset LinkedAtUtc { get; private set; }
    public string LinkedBy { get; private set; } = "";
}

/// <summary>What happened to one box on one pickup. Boxes come from two places - a packing job packed earlier,
/// or the pickup's own packing - so the box is identified by source plus id rather than a foreign key. The
/// tracking number is copied in so a scan finds the row without reading both box tables.
/// A row is created for every expected box when its job is attached, so the crew sees the full count up front.</summary>
public sealed class PickupBoxPick : TenantOwnedEntity
{
    private PickupBoxPick() { }
    public PickupBoxPick(Guid tenantId, Guid pickupId, string source, Guid boxId, string trackingNumber, Guid? packingJobId, DateTimeOffset addedAt, string addedBy) : base(tenantId)
    { PickupId = pickupId; Source = source; BoxId = boxId; TrackingNumber = trackingNumber.Trim(); PackingJobId = packingJobId; Status = PickupBoxStatuses.Pending; AddedAtUtc = addedAt; AddedBy = addedBy; }
    public Guid PickupId { get; private set; }
    public string Source { get; private set; } = "";
    public Guid BoxId { get; private set; }
    public string TrackingNumber { get; private set; } = "";
    /// <summary>Set for boxes that came from a packing job, so progress can be reported per job.</summary>
    public Guid? PackingJobId { get; private set; }
    /// <summary>Who listed the box as expected. Not the same person as the one who loads it: the office or the
    /// packer adds it, the crew picks it up, and both names have to survive on the record.</summary>
    public string AddedBy { get; private set; } = "";
    public DateTimeOffset AddedAtUtc { get; private set; }
    public string Status { get; private set; } = PickupBoxStatuses.Pending;
    public DateTimeOffset? StatusAtUtc { get; private set; }
    /// <summary>Who last moved it. Kept here for the common question; every change is also in PickupBoxPickEvents.</summary>
    public string? StatusBy { get; private set; }
    public string? Method { get; private set; }
    public string? StatusReason { get; private set; }
    /// <summary>Checked before the box is loaded, so damage is recorded as found rather than argued about later.</summary>
    public string Condition { get; private set; } = PickupBoxConditions.NotChecked;
    public string? ConditionNotes { get; private set; }
    public DateTimeOffset? ConditionAtUtc { get; private set; }
    public string? ConditionBy { get; private set; }
    public Guid Version { get; private set; } = Guid.NewGuid();

    /// <summary>Saving a pickup's packing deletes and recreates its package rows, keeping only the tracking
    /// number. For PICKUP boxes the label is therefore the stable identity, and the row id is re-pointed here
    /// so a tick, a condition and its photos survive an edit to the packing list.</summary>
    public void Relink(Guid boxId) { BoxId = boxId; }

    public void SetCondition(string condition, string? notes, DateTimeOffset at, string by)
    { Condition = condition; ConditionNotes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(); ConditionAtUtc = at; ConditionBy = by; Version = Guid.NewGuid(); }

    public void MoveTo(string status, DateTimeOffset at, string by, string method, string? reason)
    { Status = status; StatusAtUtc = at; StatusBy = by; Method = method; StatusReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim(); Version = Guid.NewGuid(); }

    /// <summary>Back to expected-but-unhandled. The audit trail keeps who had picked it and who took it back.</summary>
    public void Reset(DateTimeOffset at, string by, string method)
    { Status = PickupBoxStatuses.Pending; StatusAtUtc = at; StatusBy = by; Method = method; StatusReason = null; Version = Guid.NewGuid(); }
}

/// <summary>Append-only record of every status change: from, to, who, when and how. Rows are never updated or
/// deleted, so unticking a box cannot erase who picked it first.</summary>
public sealed class PickupBoxPickEvent : TenantOwnedEntity
{
    private PickupBoxPickEvent() { }
    public PickupBoxPickEvent(Guid tenantId, Guid pickupId, string source, Guid boxId, string trackingNumber, string fromStatus, string toStatus, string method, DateTimeOffset at, string actor, string? notes) : base(tenantId)
    { PickupId = pickupId; Source = source; BoxId = boxId; TrackingNumber = trackingNumber.Trim(); FromStatus = fromStatus; ToStatus = toStatus; Method = method; OccurredAtUtc = at; Actor = actor; Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(); }
    public Guid PickupId { get; private set; }
    public string Source { get; private set; } = "";
    public Guid BoxId { get; private set; }
    public string TrackingNumber { get; private set; } = "";
    public string FromStatus { get; private set; } = "";
    public string ToStatus { get; private set; } = "";
    public string Method { get; private set; } = "";
    public DateTimeOffset OccurredAtUtc { get; private set; }
    public string Actor { get; private set; } = "";
    public string? Notes { get; private set; }
}

/// <summary>The warehouse sign-off that closes a pickup's collection. Counts are frozen at approval so a later
/// edit cannot quietly change what was approved. Reopening is a separate, permissioned action.</summary>
public sealed class PickupCollectionApproval : TenantOwnedEntity
{
    private PickupCollectionApproval() { }
    public PickupCollectionApproval(Guid tenantId, Guid pickupId, Guid? warehouseId, int picked, int missing, int excluded, DateTimeOffset at, string approvedBy, string? notes) : base(tenantId)
    { PickupId = pickupId; WarehouseId = warehouseId; PickedCount = picked; MissingCount = missing; ExcludedCount = excluded; ApprovedAtUtc = at; ApprovedBy = approvedBy; Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(); }
    public Guid PickupId { get; private set; }
    /// <summary>Where the boxes were received, when the tenant tracks more than one warehouse.</summary>
    public Guid? WarehouseId { get; private set; }
    public int PickedCount { get; private set; }
    public int MissingCount { get; private set; }
    public int ExcludedCount { get; private set; }
    public DateTimeOffset ApprovedAtUtc { get; private set; }
    public string ApprovedBy { get; private set; } = "";
    public string? Notes { get; private set; }
    public DateTimeOffset? ReopenedAtUtc { get; private set; }
    public string? ReopenedBy { get; private set; }
    public string? ReopenReason { get; private set; }
    public bool IsOpen => ReopenedAtUtc is not null;

    public void Reopen(DateTimeOffset at, string by, string reason)
    { ReopenedAtUtc = at; ReopenedBy = by; ReopenReason = reason.Trim(); }
}

public static class PickupBoxSources
{
    /// <summary>A PackingJobBox, packed by a packing job before the pickup.</summary>
    public const string Packing = "PACKING";
    /// <summary>A PickupPackage, packed by the pickup crew on the day.</summary>
    public const string Pickup = "PICKUP";
    public static bool IsValid(string? x) => x is Packing or Pickup;
}

public static class PickupBoxStatuses
{
    /// <summary>Expected on this pickup, not yet handled.</summary>
    public const string Pending = "PENDING";
    /// <summary>Loaded.</summary>
    public const string Picked = "PICKED";
    /// <summary>Deliberately not on this visit. Stays free for another pickup to collect.</summary>
    public const string Excluded = "EXCLUDED";
    /// <summary>Expected but not found. Blocks warehouse approval until it is acknowledged.</summary>
    public const string Missing = "MISSING";
    public static bool IsValid(string? x) => x is Pending or Picked or Excluded or Missing;
}

public static class PickupBoxConditions
{
    public const string NotChecked = "NOT_CHECKED";
    public const string Ok = "OK";
    /// <summary>Damage found before loading. Photos and video are attached against the box as evidence.</summary>
    public const string Damaged = "DAMAGED";
    public static bool IsValid(string? x) => x is NotChecked or Ok or Damaged;
}

public static class PickupPickMethods
{
    public const string List = "LIST";
    public const string Scan = "SCAN";
    /// <summary>"Mark all" - still writes one row per box, so speed never costs traceability.</summary>
    public const string Bulk = "BULK";
    public static bool IsValid(string? x) => x is List or Scan or Bulk;
}
