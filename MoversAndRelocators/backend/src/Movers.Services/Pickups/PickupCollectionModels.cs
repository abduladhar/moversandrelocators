namespace Movers.Services.Pickups;

/// <summary>A packing job that can be added to a pickup, with how many of its boxes are still uncollected.</summary>
public sealed record SelectablePackingJobModel(Guid Id, string JobNumber, string Status, string CustomerName, string Address, DateTimeOffset ScheduledAtUtc, int BoxCount, int CollectedElsewhere, int Remaining);

/// <summary>A packing job attached to this pickup, with its progress on this visit.</summary>
public sealed record LinkedPackingJobModel(Guid Id, string JobNumber, string Status, string CustomerName, string Address, DateTimeOffset ScheduledAtUtc, DateTimeOffset LinkedAtUtc, string LinkedBy, int Expected, int Picked, int Missing, int Excluded, int Pending);

/// <summary>A photo, video or document held against one box - normally damage found before loading.</summary>
public sealed record CollectionMediaModel(Guid Id, string FileName, string ContentType, long SizeBytes, bool IsUploaded, string UploadedBy, DateTimeOffset CreatedAtUtc);

/// <summary>One expected box on this pickup. Source says which module it came from.</summary>
public sealed record CollectionBoxModel(Guid BoxId, string Source, string TrackingNumber, string BoxTypeName, string? RoomName, bool IsFragile, string? Notes, int ItemCount,
    Guid? PackingJobId, string? PackingJobNumber, string AddedBy, DateTimeOffset AddedAtUtc, string Status, DateTimeOffset? StatusAtUtc, string? StatusBy, string? Method, string? StatusReason,
    string Condition, string? ConditionNotes, DateTimeOffset? ConditionAtUtc, string? ConditionBy, IReadOnlyList<CollectionMediaModel> Media, Guid Version);

public sealed record CollectionEventModel(Guid Id, string Source, Guid BoxId, string TrackingNumber, string FromStatus, string ToStatus, string Method, DateTimeOffset OccurredAtUtc, string Actor, string? Notes);

public sealed record CollectionApprovalModel(Guid Id, Guid? WarehouseId, string? WarehouseName, int PickedCount, int MissingCount, int ExcludedCount, DateTimeOffset ApprovedAtUtc, string ApprovedBy, string? Notes, DateTimeOffset? ReopenedAtUtc, string? ReopenedBy, string? ReopenReason);

/// <summary>Everything the collection tab shows. Counts come from the box rows, so the pickup-level warning and
/// the per-job progress can never disagree with the list.</summary>
public sealed record PickupCollectionModel(Guid PickupId, string PickupNumber, IReadOnlyList<LinkedPackingJobModel> Jobs, IReadOnlyList<CollectionBoxModel> Boxes,
    int Expected, int Picked, int Missing, int Excluded, int Pending, int Damaged, bool HasUnresolved, bool IsApproved, bool CanReopen, CollectionApprovalModel? Approval);

public sealed record AddPackingJobsCommand(IReadOnlyList<Guid> PackingJobIds);
public sealed record SetBoxStatusCommand(string Source, Guid BoxId, string Status, string Method, string? Reason);
public sealed record SetBoxConditionCommand(string Source, Guid BoxId, string Condition, string? Notes);
public sealed record AddManualBoxCommand(Guid BoxTypeId, string? RoomName, bool IsFragile, string? Notes, int Copies);
public sealed record ScanBoxCommand(string TrackingNumber, string Status, string? Reason);
public sealed record BulkBoxStatusCommand(string Status, Guid? PackingJobId, string? Reason);
public sealed record ApproveCollectionCommand(Guid? WarehouseId, string? Notes, bool AcceptMissing);
public sealed record ReopenCollectionCommand(string Reason);
