using Movers.Domain.Common;

namespace Movers.Domain.Delivery;

/// <summary>Lifecycle of a delivery. Out for delivery = the trip has started; completed and cancelled deliveries are locked.</summary>
public static class DeliveryStatuses
{
    public const string Planned = "PLANNED", OutForDelivery = "OUT_FOR_DELIVERY", Completed = "COMPLETED", Cancelled = "CANCELLED";
}

/// <summary>State of one package on a delivery. RETURNED = not delivered: it goes back to the warehouse (or stays with its job).</summary>
public static class DeliveryItemStatuses
{
    public const string Loaded = "LOADED", Delivered = "DELIVERED", Returned = "RETURNED";
    public static readonly string[] All = [Loaded, Delivered, Returned];
}

/// <summary>Where a delivered package was loaded from. A box loaded onto a transport job can only be delivered through that job.</summary>
public static class DeliverySources
{
    public const string Warehouse = "WAREHOUSE", Job = "JOB";
}

/// <summary>Steps of the delivery trip clock: leave → pause/resume → complete (with the distance covered).</summary>
public static class DeliveryTimeEventTypes
{
    public const string Started = "STARTED", Paused = "PAUSED", Resumed = "RESUMED", Completed = "COMPLETED";
}

/// <summary>
/// A delivery run: packages loaded from the warehouse or from transport jobs are taken to one or more customers.
/// Each customer gets a delivery note they sign on receipt. Crew, driver and vehicle are assigned; income collected
/// and expenses paid flow to the accountant's cash queue as source DELIVERY.
/// </summary>
public sealed class DeliveryJob : TenantOwnedEntity
{
    private DeliveryJob() { }
    public DeliveryJob(Guid tenantId, string deliveryNumber, DateTimeOffset scheduledAtUtc, int durationMinutes, string? notes) : base(tenantId)
    {
        DeliveryNumber = deliveryNumber; Status = DeliveryStatuses.Planned; CreatedAtUtc = DateTimeOffset.UtcNow;
        Update(scheduledAtUtc, durationMinutes, notes);
    }
    public string DeliveryNumber { get; private set; } = "";
    public DateTimeOffset ScheduledAtUtc { get; private set; }
    /// <summary>How long the run is expected to occupy its crew, so a double booking can be detected.</summary>
    public int DurationMinutes { get; private set; } = 240;
    public string Status { get; private set; } = DeliveryStatuses.Planned;
    public string? Notes { get; private set; }
    public Guid? VehicleId { get; private set; }
    public Guid? DriverEmployeeId { get; private set; }
    public DateTimeOffset? StartedAtUtc { get; private set; }
    public DateTimeOffset? CompletedAtUtc { get; private set; }
    public bool IsPaused { get; private set; }
    /// <summary>Distance covered on the run, entered when the trip completes (editable afterwards).</summary>
    public decimal? DistanceKm { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public Guid Version { get; private set; } = Guid.NewGuid();
    public bool IsLocked => Status is DeliveryStatuses.Completed or DeliveryStatuses.Cancelled;

    public void Update(DateTimeOffset scheduledAtUtc, int durationMinutes, string? notes)
    {
        if (durationMinutes is < 15 or > 1440) throw new InvalidOperationException("A delivery must last between 15 minutes and 24 hours.");
        ScheduledAtUtc = scheduledAtUtc; DurationMinutes = durationMinutes; Notes = Clean(notes); Touch();
    }
    public void Assign(Guid? vehicleId, Guid? driverEmployeeId) { VehicleId = vehicleId; DriverEmployeeId = driverEmployeeId; Touch(); }
    public void Start(DateTimeOffset at) { Status = DeliveryStatuses.OutForDelivery; StartedAtUtc = at; IsPaused = false; Touch(); }
    public void Pause()
    {
        if (Status != DeliveryStatuses.OutForDelivery) throw new InvalidOperationException("Only a delivery that is out can be paused.");
        if (IsPaused) throw new InvalidOperationException("The delivery is already paused.");
        IsPaused = true; Touch();
    }
    public void Resume() { if (!IsPaused) throw new InvalidOperationException("The delivery is not paused."); IsPaused = false; Touch(); }
    public void Complete(DateTimeOffset at, decimal? distanceKm) { Status = DeliveryStatuses.Completed; CompletedAtUtc = at; IsPaused = false; RecordDistance(distanceKm); }
    public void Cancel() { Status = DeliveryStatuses.Cancelled; IsPaused = false; Touch(); }
    public void RecordDistance(decimal? distanceKm)
    {
        if (distanceKm is < 0 or > 5000) throw new InvalidOperationException("Distance must be between 0 and 5,000 km.");
        DistanceKm = distanceKm; Touch();
    }
    public void Touch() { Version = Guid.NewGuid(); UpdatedAtUtc = DateTimeOffset.UtcNow; }
    internal static string? Clean(string? x) => string.IsNullOrWhiteSpace(x) ? null : x.Trim();
}

public sealed class DeliveryJobTimeEvent : TenantOwnedEntity
{
    private DeliveryJobTimeEvent() { }
    public DeliveryJobTimeEvent(Guid tenantId, Guid jobId, string type, DateTimeOffset occurredAtUtc, string? reason, string recordedBy) : base(tenantId)
    { DeliveryJobId = jobId; Type = type; OccurredAtUtc = occurredAtUtc; Reason = DeliveryJob.Clean(reason); RecordedBy = recordedBy; }
    public Guid DeliveryJobId { get; private set; }
    public string Type { get; private set; } = "";
    public DateTimeOffset OccurredAtUtc { get; private set; }
    public string? Reason { get; private set; }
    public string RecordedBy { get; private set; } = "";
}

/// <summary>Who worked the delivery. Team is a snapshot taken at assignment, like packing crew.</summary>
public sealed class DeliveryJobCrew : TenantOwnedEntity
{
    private DeliveryJobCrew() { }
    public DeliveryJobCrew(Guid tenantId, Guid jobId, Guid employeeId, string role, Guid? teamId, string? teamName, DateTimeOffset assignedAt) : base(tenantId)
    { DeliveryJobId = jobId; EmployeeId = employeeId; Role = role.Trim(); TeamId = teamId; TeamName = teamName; AssignedAtUtc = assignedAt; }
    public Guid DeliveryJobId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public string Role { get; private set; } = "";
    public Guid? TeamId { get; private set; }
    public string? TeamName { get; private set; }
    public DateTimeOffset AssignedAtUtc { get; private set; }
}

/// <summary>
/// The delivery note of one customer on the run. Created when that customer's first package is loaded. The customer
/// signs it on receipt; the signature is tied to the packages recorded as delivered at that moment (SignedItemsJson).
/// </summary>
public sealed class DeliveryNote : TenantOwnedEntity
{
    private DeliveryNote() { }
    public DeliveryNote(Guid tenantId, Guid jobId, string noteNumber, string customerName, string? contactName, string? phone, string? address) : base(tenantId)
    { DeliveryJobId = jobId; NoteNumber = noteNumber; CustomerName = customerName.Trim(); CreatedAtUtc = DateTimeOffset.UtcNow; UpdateContact(contactName, phone, address); }
    public Guid DeliveryJobId { get; private set; }
    public string NoteNumber { get; private set; } = "";
    public string CustomerName { get; private set; } = "";
    /// <summary>Who receives the goods (consignee), when different from the customer.</summary>
    public string? ContactName { get; private set; }
    public string? Phone { get; private set; }
    public string? Address { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public string? SignerName { get; private set; }
    public string? SignaturePng { get; private set; }
    public string? Remarks { get; private set; }
    public DateTimeOffset? SignedAtUtc { get; private set; }
    public string? SignedBy { get; private set; }
    public string? SignedItemsJson { get; private set; }
    public bool IsSigned => SignedAtUtc.HasValue;

    /* Customer responses through the note's links (DeliveryNoteLink). */
    /// <summary>CONFIRMED (the run's time suits them) or RESCHEDULE (they asked for PreferredAtUtc instead).</summary>
    public string? DateResponse { get; private set; }
    public DateTimeOffset? PreferredAtUtc { get; private set; }
    public DateTimeOffset? DateRespondedAtUtc { get; private set; }
    /// <summary>The delivery time the customer responded to; when the run is rescheduled the response no longer applies.</summary>
    public DateTimeOffset? DateRespondedForUtc { get; private set; }
    public decimal? Latitude { get; private set; }
    public decimal? Longitude { get; private set; }
    /// <summary>Landmark or directions the customer added when sharing the location.</summary>
    public string? LocationNotes { get; private set; }
    public DateTimeOffset? LocationSharedAtUtc { get; private set; }

    public void UpdateContact(string? contactName, string? phone, string? address) { ContactName = DeliveryJob.Clean(contactName); Phone = DeliveryJob.Clean(phone); Address = DeliveryJob.Clean(address); }
    public void RespondDate(bool confirmed, DateTimeOffset? preferredAtUtc, DateTimeOffset scheduledAtUtc, DateTimeOffset at)
    { DateResponse = confirmed ? "CONFIRMED" : "RESCHEDULE"; PreferredAtUtc = confirmed ? null : preferredAtUtc; DateRespondedForUtc = scheduledAtUtc; DateRespondedAtUtc = at; }
    /// <summary>The customer updates the delivery address and directions, with the GPS position when they are at the address (coordinates are kept otherwise).</summary>
    public void ShareLocation(decimal? latitude, decimal? longitude, string? address, string? notes, DateTimeOffset at)
    {
        if (latitude.HasValue && longitude.HasValue) { Latitude = latitude; Longitude = longitude; }
        LocationNotes = DeliveryJob.Clean(notes);
        if (!string.IsNullOrWhiteSpace(address)) Address = address.Trim();
        LocationSharedAtUtc = at;
    }
    public void Sign(string signerName, string signaturePng, string? remarks, string itemsJson, DateTimeOffset at, string recordedBy)
    { SignerName = signerName.Trim(); SignaturePng = signaturePng; Remarks = DeliveryJob.Clean(remarks); SignedItemsJson = itemsJson; SignedAtUtc = at; SignedBy = recordedBy; }
}

/// <summary>What a customer link on a delivery note is for. Each purpose has its own link and page.</summary>
public static class DeliveryLinkPurposes
{
    public const string Schedule = "SCHEDULE", Location = "LOCATION";
    public static readonly string[] All = [Schedule, Location];
}

/// <summary>A customer link for one delivery note and purpose. Only the SHA-256 of the token is stored; a new link replaces the previous one.</summary>
public sealed class DeliveryNoteLink : TenantOwnedEntity
{
    private DeliveryNoteLink() { }
    public DeliveryNoteLink(Guid tenantId, Guid jobId, Guid noteId, string purpose, string tokenHash, DateTimeOffset expiresAtUtc) : base(tenantId)
    { DeliveryJobId = jobId; DeliveryNoteId = noteId; Purpose = purpose; TokenHash = tokenHash; ExpiresAtUtc = expiresAtUtc; CreatedAtUtc = DateTimeOffset.UtcNow; }
    public Guid DeliveryJobId { get; private set; }
    public Guid DeliveryNoteId { get; private set; }
    public string Purpose { get; private set; } = "";
    public string TokenHash { get; private set; } = "";
    public DateTimeOffset ExpiresAtUtc { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
}

/// <summary>A package on the delivery, with a snapshot of what it was when loaded.</summary>
public sealed class DeliveryItem : TenantOwnedEntity
{
    private DeliveryItem() { }
    public DeliveryItem(Guid tenantId, Guid jobId, Guid noteId, Guid boxId, string source, Guid? transportJobId, Guid? pickupId, string trackingNumber, string description, string contents,
        Guid? warehouseId, string location, string reference, DateTimeOffset loadedAtUtc, string loadedBy) : base(tenantId)
    {
        DeliveryJobId = jobId; DeliveryNoteId = noteId; BoxId = boxId; Source = source; TransportJobId = transportJobId; PickupId = pickupId;
        TrackingNumber = trackingNumber; Description = description; Contents = contents; WarehouseId = warehouseId; Location = location; Reference = reference;
        Status = DeliveryItemStatuses.Loaded; LoadedAtUtc = loadedAtUtc; LoadedBy = loadedBy;
    }
    public Guid DeliveryJobId { get; private set; }
    public Guid DeliveryNoteId { get; private set; }
    public Guid BoxId { get; private set; }
    public string Source { get; private set; } = "";
    public Guid? TransportJobId { get; private set; }
    public Guid? PickupId { get; private set; }
    public string TrackingNumber { get; private set; } = "";
    public string Description { get; private set; } = "";
    public string Contents { get; private set; } = "";
    public Guid? WarehouseId { get; private set; }
    /// <summary>Where the package was taken from (warehouse location or job number); a returned warehouse box goes back here.</summary>
    public string Location { get; private set; } = "";
    /// <summary>Warehouse receipt or job number the package came from.</summary>
    public string Reference { get; private set; } = "";
    public string Status { get; private set; } = DeliveryItemStatuses.Loaded;
    public DateTimeOffset LoadedAtUtc { get; private set; }
    public string LoadedBy { get; private set; } = "";
    public DateTimeOffset? StatusAtUtc { get; private set; }
    public string? ReceivedBy { get; private set; }
    public string? Notes { get; private set; }
    public string? UpdatedBy { get; private set; }

    public void SetStatus(string status, string? receivedBy, string? notes, DateTimeOffset at, string updatedBy)
    {
        Status = status; StatusAtUtc = status == DeliveryItemStatuses.Loaded ? null : at;
        ReceivedBy = status == DeliveryItemStatuses.Delivered ? DeliveryJob.Clean(receivedBy) : null; Notes = DeliveryJob.Clean(notes); UpdatedBy = updatedBy;
    }
}

/// <summary>Money collected from a customer or expense paid on the run. Flows to the cash-posting queue as source DELIVERY.</summary>
public sealed class DeliveryJobTransaction : TenantOwnedEntity
{
    private DeliveryJobTransaction() { }
    public DeliveryJobTransaction(Guid tenantId, Guid jobId, Guid? noteId, string number, string type, string category, decimal amount, string method, string? notes) : base(tenantId)
    {
        DeliveryJobId = jobId; DeliveryNoteId = noteId; TransactionNumber = number; Type = type; Category = category.Trim();
        Amount = amount; PaymentMethod = method.Trim(); Notes = DeliveryJob.Clean(notes); CreatedAtUtc = DateTimeOffset.UtcNow;
    }
    public Guid DeliveryJobId { get; private set; }
    /// <summary>The employee who paid an expense out of pocket or from a float (employee expense report).</summary>
    public Guid? PaidByEmployeeId { get; private set; }
    public void SetPaidBy(Guid? employeeId) => PaidByEmployeeId = employeeId;
    /// <summary>The customer (delivery note) the money was collected from; null for expenses or general income.</summary>
    public Guid? DeliveryNoteId { get; private set; }
    public string TransactionNumber { get; private set; } = "";
    public string Type { get; private set; } = "";
    public string Category { get; private set; } = "";
    public decimal Amount { get; private set; }
    public string PaymentMethod { get; private set; } = "";
    public string? Notes { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
}
