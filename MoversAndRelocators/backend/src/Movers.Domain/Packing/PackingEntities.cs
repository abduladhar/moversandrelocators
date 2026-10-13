using Movers.Domain.Common;

namespace Movers.Domain.Packing;

/// <summary>Lifecycle of a packing job. Completed and cancelled jobs are locked for crew, box and material edits.</summary>
public static class PackingJobStatuses
{
    public const string Planned = "PLANNED", InProgress = "IN_PROGRESS", Completed = "COMPLETED", Cancelled = "CANCELLED";
    public static readonly string[] All = [Planned, InProgress, Completed, Cancelled];
}

/// <summary>
/// A packing job: crew packs the customer's goods into labelled boxes, consuming packing materials, and
/// records income and expenses. Independent of the pickup module; it may be started from a pickup,
/// a quotation or a sales lead, or directly.
/// </summary>
public sealed class PackingJob : TenantOwnedEntity
{
    private PackingJob() { }
    public PackingJob(Guid tenantId, string jobNumber, Guid? pickupId, Guid? quotationId, Guid? salesLeadId, string customerName, string phone, string? email, string address, DateTimeOffset scheduledAtUtc, string? notes) : base(tenantId)
    {
        JobNumber = jobNumber; PickupId = pickupId; QuotationId = quotationId; SalesLeadId = salesLeadId;
        Status = PackingJobStatuses.Planned; CreatedAtUtc = DateTimeOffset.UtcNow;
        Update(customerName, phone, email, address, scheduledAtUtc, notes);
    }
    public string JobNumber { get; private set; } = "";
    public Guid? PickupId { get; private set; }
    public Guid? QuotationId { get; private set; }
    public Guid? SalesLeadId { get; private set; }
    public string CustomerName { get; private set; } = "";
    public string Phone { get; private set; } = "";
    public string? Email { get; private set; }
    public string Address { get; private set; } = "";
    public DateTimeOffset ScheduledAtUtc { get; private set; }
    public string Status { get; private set; } = PackingJobStatuses.Planned;
    public string? Notes { get; private set; }
    public DateTimeOffset? StartedAtUtc { get; private set; }
    public DateTimeOffset? CompletedAtUtc { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public Guid Version { get; private set; } = Guid.NewGuid();
    public bool IsLocked => Status is PackingJobStatuses.Completed or PackingJobStatuses.Cancelled;
    /// <summary>The packing clock is paused (job stays IN_PROGRESS); see PackingJobTimeEvent for the reason.</summary>
    public bool IsPaused { get; private set; }

    /* Customer confirmations, each through its own link (PackingJobLink). */
    public DateTimeOffset? ScheduleConfirmedAtUtc { get; private set; }
    public decimal? Latitude { get; private set; }
    public decimal? Longitude { get; private set; }
    /// <summary>Landmark or directions the customer added when sharing the location.</summary>
    public string? LocationNotes { get; private set; }
    public DateTimeOffset? LocationSharedAtUtc { get; private set; }
    /// <summary>CONFIRMED or CORRECTIONS for the packing list identified by ItemsSnapshotHash; null until the customer responds.</summary>
    public string? ItemsResponse { get; private set; }
    public string? ItemsResponderName { get; private set; }
    public string? ItemsResponseNotes { get; private set; }
    public DateTimeOffset? ItemsRespondedAtUtc { get; private set; }
    public string? ItemsSnapshotHash { get; private set; }
    /// <summary>The exact box list the customer responded to, kept as evidence.</summary>
    public string? ItemsSnapshotJson { get; private set; }

    public void Update(string customerName, string phone, string? email, string address, DateTimeOffset scheduledAtUtc, string? notes)
    {
        // A new date from the office needs the customer to confirm again.
        if (ScheduleConfirmedAtUtc.HasValue && scheduledAtUtc != ScheduledAtUtc) ScheduleConfirmedAtUtc = null;
        CustomerName = customerName.Trim(); Phone = phone.Trim(); Email = Clean(email); Address = address.Trim();
        ScheduledAtUtc = scheduledAtUtc; Notes = Clean(notes); Touch();
    }
    /// <summary>How long the job is expected to occupy its crew, so a double booking can be detected.</summary>
    public int DurationMinutes { get; private set; } = 240;
    public void SetDuration(int minutes) { DurationMinutes = minutes is < 15 or > 1440 ? throw new InvalidOperationException("A packing job must last between 15 minutes and 24 hours.") : minutes; Touch(); }

    public void SetStatus(string status, DateTimeOffset at)
    {
        Status = status; IsPaused = false;
        if (status == PackingJobStatuses.InProgress && StartedAtUtc is null) StartedAtUtc = at;
        CompletedAtUtc = status == PackingJobStatuses.Completed ? at : null;
        Touch();
    }
    public void ConfirmSchedule(DateTimeOffset scheduledAtUtc, DateTimeOffset at) { ScheduledAtUtc = scheduledAtUtc; ScheduleConfirmedAtUtc = at; Touch(); }
    public void ShareLocation(decimal latitude, decimal longitude, string? address, string? notes, DateTimeOffset at)
    {
        Latitude = latitude; Longitude = longitude; LocationNotes = Clean(notes);
        if (!string.IsNullOrWhiteSpace(address)) Address = address.Trim();
        LocationSharedAtUtc = at; Touch();
    }
    public void RespondItems(bool confirmed, string name, string? notes, string snapshotHash, string snapshotJson, DateTimeOffset at)
    {
        ItemsResponse = confirmed ? "CONFIRMED" : "CORRECTIONS"; ItemsResponderName = name.Trim(); ItemsResponseNotes = Clean(notes);
        ItemsSnapshotHash = snapshotHash; ItemsSnapshotJson = snapshotJson; ItemsRespondedAtUtc = at; Touch();
    }
    public void Pause()
    {
        if (Status != PackingJobStatuses.InProgress) throw new InvalidOperationException("Only packing in progress can be paused.");
        if (IsPaused) throw new InvalidOperationException("Packing is already paused.");
        IsPaused = true; Touch();
    }
    public void Resume() { if (!IsPaused) throw new InvalidOperationException("Packing is not paused."); IsPaused = false; Touch(); }
    public void Touch() { Version = Guid.NewGuid(); UpdatedAtUtc = DateTimeOffset.UtcNow; }
    internal static string? Clean(string? x) => string.IsNullOrWhiteSpace(x) ? null : x.Trim();
}

/// <summary>Steps of the packing clock. Working time runs from STARTED/RESUMED/REOPENED until PAUSED/COMPLETED/CANCELLED.</summary>
public static class PackingTimeEventTypes
{
    public const string Started = "STARTED", Paused = "PAUSED", Resumed = "RESUMED", Completed = "COMPLETED", Reopened = "REOPENED", Cancelled = "CANCELLED";
}

/// <summary>One step of the packing clock, with who recorded it and (for a pause) why.</summary>
public sealed class PackingJobTimeEvent : TenantOwnedEntity
{
    private PackingJobTimeEvent() { }
    public PackingJobTimeEvent(Guid tenantId, Guid jobId, string type, DateTimeOffset occurredAtUtc, string? reason, string recordedBy) : base(tenantId)
    { PackingJobId = jobId; Type = type; OccurredAtUtc = occurredAtUtc; Reason = PackingJob.Clean(reason); RecordedBy = recordedBy; }
    public Guid PackingJobId { get; private set; }
    public string Type { get; private set; } = "";
    public DateTimeOffset OccurredAtUtc { get; private set; }
    public string? Reason { get; private set; }
    public string RecordedBy { get; private set; } = "";
}

/// <summary>What a customer link is for. Each purpose has its own link and page.</summary>
public static class PackingLinkPurposes
{
    public const string Schedule = "SCHEDULE", Location = "LOCATION", Items = "ITEMS";
    public static readonly string[] All = [Schedule, Location, Items];
}

/// <summary>A customer link for one purpose. Only the SHA-256 of the token is stored; a new link replaces the previous one.</summary>
public sealed class PackingJobLink : TenantOwnedEntity
{
    private PackingJobLink() { }
    public PackingJobLink(Guid tenantId, Guid jobId, string purpose, string tokenHash, DateTimeOffset expiresAtUtc) : base(tenantId)
    { PackingJobId = jobId; Purpose = purpose; TokenHash = tokenHash; ExpiresAtUtc = expiresAtUtc; CreatedAtUtc = DateTimeOffset.UtcNow; }
    public Guid PackingJobId { get; private set; }
    public string Purpose { get; private set; } = "";
    public string TokenHash { get; private set; } = "";
    public DateTimeOffset ExpiresAtUtc { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
}

/// <summary>Who worked this packing job. TeamId and TeamName are a snapshot taken when the crew was assigned:
/// moving someone to another team later, or renaming a team, must not change who was responsible for this job.</summary>
public sealed class PackingJobCrew : TenantOwnedEntity
{
    private PackingJobCrew() { }
    public PackingJobCrew(Guid tenantId, Guid jobId, Guid employeeId, string role, Guid? teamId = null, string? teamName = null, DateTimeOffset? assignedAt = null) : base(tenantId)
    { PackingJobId = jobId; EmployeeId = employeeId; Role = role.Trim(); TeamId = teamId; TeamName = teamName; AssignedAtUtc = assignedAt ?? DateTimeOffset.UtcNow; }
    public Guid PackingJobId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public string Role { get; private set; } = "";
    public Guid? TeamId { get; private set; }
    public string? TeamName { get; private set; }
    public DateTimeOffset AssignedAtUtc { get; private set; }
}

/// <summary>A packed box. Its id and tracking number stay stable across edits, so a printed label remains valid.</summary>
public sealed class PackingJobBox : TenantOwnedEntity
{
    private PackingJobBox() { }
    public PackingJobBox(Guid tenantId, Guid jobId, Guid boxTypeId, string trackingNumber) : base(tenantId) { PackingJobId = jobId; TrackingNumber = trackingNumber; BoxTypeId = boxTypeId; CreatedAtUtc = DateTimeOffset.UtcNow; }
    public Guid PackingJobId { get; private set; }
    public Guid BoxTypeId { get; private set; }
    public string TrackingNumber { get; private set; } = "";
    public string? RoomName { get; private set; }
    public bool IsFragile { get; private set; }
    public string? Notes { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    /// <summary>When the label was last printed; null means the box still needs a label.</summary>
    public DateTimeOffset? LabelPrintedAtUtc { get; private set; }
    public int LabelPrintCount { get; private set; }
    /// <summary>True when the crew recorded the materials actually used (PackingJobBoxMaterial rows); false means the box type recipe applies.</summary>
    public bool CustomMaterials { get; private set; }
    public void SetCustomMaterials(bool custom) => CustomMaterials = custom;
    public void Update(Guid boxTypeId, string? roomName, bool isFragile, string? notes) { BoxTypeId = boxTypeId; RoomName = PackingJob.Clean(roomName); IsFragile = isFragile; Notes = PackingJob.Clean(notes); }
    public void LabelPrinted(DateTimeOffset at) { LabelPrintedAtUtc = at; LabelPrintCount++; }
}

/// <summary>Material actually used for one box, recorded when it differs from the box type recipe.</summary>
public sealed class PackingJobBoxMaterial : TenantOwnedEntity
{
    private PackingJobBoxMaterial() { }
    public PackingJobBoxMaterial(Guid tenantId, Guid boxId, Guid materialId, decimal quantity) : base(tenantId) { PackingJobBoxId = boxId; MaterialId = materialId; Quantity = quantity; }
    public Guid PackingJobBoxId { get; private set; }
    public Guid MaterialId { get; private set; }
    public decimal Quantity { get; private set; }
}

public sealed class PackingJobBoxItem : TenantOwnedEntity
{
    private PackingJobBoxItem() { }
    public PackingJobBoxItem(Guid tenantId, Guid boxId, string itemName, int quantity, string? notes, Guid? householdItemId) : base(tenantId)
    { PackingJobBoxId = boxId; ItemName = itemName.Trim(); Quantity = quantity; Notes = PackingJob.Clean(notes); HouseholdItemId = householdItemId; }
    public Guid PackingJobBoxId { get; private set; }
    public string ItemName { get; private set; } = "";
    public int Quantity { get; private set; }
    public string? Notes { get; private set; }
    public Guid? HouseholdItemId { get; private set; }
}

/// <summary>Material consumed: derived from the packed boxes' recipes (IsBoxRecipe) or added by the crew.</summary>
public sealed class PackingJobMaterial : TenantOwnedEntity
{
    private PackingJobMaterial() { }
    public PackingJobMaterial(Guid tenantId, Guid jobId, Guid materialId, decimal quantity, decimal unitCost, bool isBoxRecipe) : base(tenantId)
    { PackingJobId = jobId; MaterialId = materialId; Quantity = quantity; UnitCost = unitCost; IsBoxRecipe = isBoxRecipe; }
    public Guid PackingJobId { get; private set; }
    public Guid MaterialId { get; private set; }
    public decimal Quantity { get; private set; }
    public decimal UnitCost { get; private set; }
    public bool IsBoxRecipe { get; private set; }
    public decimal TotalCost => Quantity * UnitCost;
}

/// <summary>Income received or expense paid on the job. Flows to the accountant's cash-posting queue as source PACKING.</summary>
public sealed class PackingJobTransaction : TenantOwnedEntity
{
    private PackingJobTransaction() { }
    public PackingJobTransaction(Guid tenantId, Guid jobId, string number, string type, string category, decimal amount, string method, string? notes) : base(tenantId)
    {
        PackingJobId = jobId; TransactionNumber = number; Type = type.Trim().ToUpperInvariant(); Category = category.Trim();
        Amount = amount; PaymentMethod = method.Trim(); Notes = PackingJob.Clean(notes); CreatedAtUtc = DateTimeOffset.UtcNow;
    }
    public Guid PackingJobId { get; private set; }
    /// <summary>The employee who paid an expense out of pocket or from a float (employee expense report).</summary>
    public Guid? PaidByEmployeeId { get; private set; }
    public void SetPaidBy(Guid? employeeId) => PaidByEmployeeId = employeeId;
    public string TransactionNumber { get; private set; } = "";
    public string Type { get; private set; } = "";
    public string Category { get; private set; } = "";
    public decimal Amount { get; private set; }
    public string PaymentMethod { get; private set; } = "";
    public string? Notes { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
}
