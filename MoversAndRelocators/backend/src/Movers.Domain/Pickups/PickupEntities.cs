using Movers.Domain.Common;

namespace Movers.Domain.Pickups;

public sealed class PickupStatus : TenantOwnedEntity
{
    private PickupStatus() { }
    public PickupStatus(Guid tenantId, string code, string name, int order, string? color, bool completed) : base(tenantId) { Code = code.Trim().ToUpperInvariant(); Name = name.Trim(); DisplayOrder = order; Color = Clean(color); IsCompleted = completed; IsActive = true; }
    public string Code { get; private set; } = ""; public string Name { get; private set; } = ""; public int DisplayOrder { get; private set; } public string? Color { get; private set; } public bool IsCompleted { get; private set; } public bool IsActive { get; private set; }
    public void Update(string code, string name, int order, string? color, bool completed) { Code = code.Trim().ToUpperInvariant(); Name = name.Trim(); DisplayOrder = order; Color = Clean(color); IsCompleted = completed; }
    public void SetActive(bool value) => IsActive = value;
    private static string? Clean(string? x) => string.IsNullOrWhiteSpace(x) ? null : x.Trim();
}

public sealed class Vehicle : TenantOwnedEntity
{
    private Vehicle() { }
    public Vehicle(Guid tenantId, string number, string name, string type, decimal capacityCbm, string? driverName, string? driverPhone) : base(tenantId) { Update(number, name, type, capacityCbm, driverName, driverPhone); IsActive = true; }
    public string RegistrationNumber { get; private set; } = ""; public string Name { get; private set; } = ""; public string Type { get; private set; } = ""; public decimal CapacityCbm { get; private set; } public string? DriverName { get; private set; } public string? DriverPhone { get; private set; } public bool IsActive { get; private set; }
    public void Update(string number, string name, string type, decimal capacityCbm, string? driverName, string? driverPhone) { RegistrationNumber = number.Trim().ToUpperInvariant(); Name = name.Trim(); Type = type.Trim(); CapacityCbm = capacityCbm; DriverName = Clean(driverName); DriverPhone = Clean(driverPhone); }
    public void SetActive(bool value) => IsActive = value; private static string? Clean(string? x) => string.IsNullOrWhiteSpace(x) ? null : x.Trim();
}

public sealed class Pickup : TenantOwnedEntity
{
    private Pickup() { }
    public bool PackagesLocked { get; private set; }
    public Guid Version { get; private set; } = Guid.NewGuid();
    /// <summary>How long the pickup is expected to occupy its crew, so a double booking can be detected.</summary>
    public int DurationMinutes { get; private set; } = 240;
    public void SetDuration(int minutes) { DurationMinutes = minutes is < 15 or > 1440 ? throw new InvalidOperationException("A pickup must last between 15 minutes and 24 hours.") : minutes; Touch(); }

    public void SetPackagesLocked(bool value) { PackagesLocked = value; Touch(); }
    public Guid? SalesLeadId { get; private set; }
    public void LinkSalesLead(Guid? salesLeadId) { SalesLeadId = salesLeadId; Touch(); }
    // Trip clock: leaves the office, optional pauses, back at the office (steps are logged as PickupTimeEvents).
    public DateTimeOffset? StartedAtUtc { get; private set; }
    public DateTimeOffset? EndedAtUtc { get; private set; }
    public bool IsPaused { get; private set; }
    public decimal? DistanceKm { get; private set; }
    public void StartTrip(DateTimeOffset at) { if (StartedAtUtc is not null) throw new InvalidOperationException("The pickup trip has already started."); StartedAtUtc = at; Touch(); }
    public void PauseTrip() { if (StartedAtUtc is null || EndedAtUtc is not null) throw new InvalidOperationException("Only a pickup in progress can be paused."); if (IsPaused) throw new InvalidOperationException("The pickup is already paused."); IsPaused = true; Touch(); }
    public void ResumeTrip() { if (!IsPaused) throw new InvalidOperationException("The pickup is not paused."); IsPaused = false; Touch(); }
    public void CompleteTrip(DateTimeOffset at, decimal distanceKm) { if (StartedAtUtc is null || EndedAtUtc is not null) throw new InvalidOperationException("Start the pickup trip before ending it."); IsPaused = false; EndedAtUtc = at; DistanceKm = distanceKm; Touch(); }
    public void RecordDistance(decimal? distanceKm) { DistanceKm = distanceKm; Touch(); }
    public void Touch() { Version = Guid.NewGuid(); UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public Pickup(Guid tenantId, string number, Guid? quotationId, string customerName, string phone, string? email, string address, DateTimeOffset scheduledAtUtc, Guid statusId, Guid? vehicleId, string? notes) : base(tenantId) { PickupNumber = number.Trim().ToUpperInvariant(); CustomerName = customerName.Trim(); Phone = phone.Trim(); Email = Clean(email); Address = address.Trim(); ScheduledAtUtc = scheduledAtUtc; StatusId = statusId; VehicleId = vehicleId; Notes = Clean(notes); QuotationId = quotationId; CreatedAtUtc = UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public string PickupNumber { get; private set; } = ""; public Guid? QuotationId { get; private set; } public string CustomerName { get; private set; } = ""; public string Phone { get; private set; } = ""; public string? Email { get; private set; } public string Address { get; private set; } = ""; public decimal? Latitude { get; private set; } public decimal? Longitude { get; private set; } public DateTimeOffset ScheduledAtUtc { get; private set; } public DateTimeOffset? ConfirmedAtUtc { get; private set; } public Guid StatusId { get; private set; } public Guid? VehicleId { get; private set; } public string? Notes { get; private set; } public string? ConfirmationTokenHash { get; private set; } public DateTimeOffset? ConfirmationExpiresAtUtc { get; private set; } public DateTimeOffset CreatedAtUtc { get; private set; } public DateTimeOffset UpdatedAtUtc { get; private set; }
    public void Update(string customerName, string phone, string? email, string address, DateTimeOffset scheduled, Guid statusId, Guid? vehicleId, string? notes) { CustomerName = customerName.Trim(); Phone = phone.Trim(); Email = Clean(email); Address = address.Trim(); ScheduledAtUtc = scheduled; StatusId = statusId; VehicleId = vehicleId; Notes = Clean(notes); UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void Share(string hash, DateTimeOffset expires) { ConfirmationTokenHash = hash; ConfirmationExpiresAtUtc = expires; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void Confirm(DateTimeOffset time, decimal? latitude, decimal? longitude, string? address) { ScheduledAtUtc = time; Latitude = latitude; Longitude = longitude; if (!string.IsNullOrWhiteSpace(address)) Address = address.Trim(); ConfirmedAtUtc = DateTimeOffset.UtcNow; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    private static string? Clean(string? x) => string.IsNullOrWhiteSpace(x) ? null : x.Trim();
}

/// <summary>Who worked this pickup. TeamId and TeamName are a snapshot taken when the crew was assigned: moving
/// someone to another team later, or renaming a team, must not change who was responsible for this job.</summary>
public sealed class PickupAssignment : TenantOwnedEntity
{
    private PickupAssignment() { }
    public PickupAssignment(Guid tenantId, Guid pickupId, Guid employeeId, string role, Guid? teamId = null, string? teamName = null, DateTimeOffset? assignedAt = null) : base(tenantId)
    { PickupId = pickupId; EmployeeId = employeeId; Role = role.Trim(); TeamId = teamId; TeamName = teamName; AssignedAtUtc = assignedAt ?? DateTimeOffset.UtcNow; }
    public Guid PickupId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public string Role { get; private set; } = "";
    public Guid? TeamId { get; private set; }
    public string? TeamName { get; private set; }
    public DateTimeOffset AssignedAtUtc { get; private set; }
}
public sealed class PickupPackage : TenantOwnedEntity { private PickupPackage() { } public PickupPackage(Guid tenantId, Guid pickupId, Guid boxTypeId, string trackingNumber, string? notes, string? roomName = null, bool isFragile = false) : base(tenantId) { PickupId = pickupId; BoxTypeId = boxTypeId; TrackingNumber = trackingNumber; Notes = Clean(notes); RoomName = Clean(roomName); IsFragile = isFragile; } public Guid PickupId { get; private set; } public Guid BoxTypeId { get; private set; } public string TrackingNumber { get; private set; } = ""; public string? Notes { get; private set; } public string? RoomName { get; private set; } public bool IsFragile { get; private set; } private static string? Clean(string? x) => string.IsNullOrWhiteSpace(x) ? null : x.Trim(); }
public sealed class PickupPackageItem : TenantOwnedEntity { private PickupPackageItem() { } public PickupPackageItem(Guid tenantId, Guid packageId, string itemName, int quantity, string? notes, string? roomName = null, Guid? householdItemId = null) : base(tenantId) { PickupPackageId = packageId; ItemName = itemName.Trim(); Quantity = quantity; Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(); RoomName = string.IsNullOrWhiteSpace(roomName) ? null : roomName.Trim(); HouseholdItemId = householdItemId; } public Guid PickupPackageId { get; private set; } public string ItemName { get; private set; } = ""; public int Quantity { get; private set; } public string? Notes { get; private set; } public string? RoomName { get; private set; } public Guid? HouseholdItemId { get; private set; } }
/// <summary>Material consumed on a pickup: either derived from a packed box type's recipe (IsBoxRecipe) or added by the crew.</summary>
public sealed class PickupMaterialUsage : TenantOwnedEntity { private PickupMaterialUsage() { } public PickupMaterialUsage(Guid tenantId, Guid pickupId, Guid materialId, decimal quantity, decimal unitCost, bool isBoxRecipe = false) : base(tenantId) { PickupId = pickupId; MaterialId = materialId; Quantity = quantity; UnitCost = unitCost; IsBoxRecipe = isBoxRecipe; } public Guid PickupId { get; private set; } public Guid MaterialId { get; private set; } public decimal Quantity { get; private set; } public decimal UnitCost { get; private set; } public bool IsBoxRecipe { get; private set; } public decimal TotalCost => Quantity * UnitCost; }
public sealed class PickupTransaction : TenantOwnedEntity { private PickupTransaction() { } public PickupTransaction(Guid tenantId, Guid pickupId, string number, string type, string category, decimal amount, string method, string? notes) : base(tenantId) { PickupId = pickupId; TransactionNumber = number; Type = type.Trim().ToUpperInvariant(); Category = category.Trim(); Amount = amount; PaymentMethod = method.Trim(); Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(); CreatedAtUtc = DateTimeOffset.UtcNow; } public Guid PickupId { get; private set; } public string TransactionNumber { get; private set; } = ""; public string Type { get; private set; } = ""; public string Category { get; private set; } = ""; public decimal Amount { get; private set; } public string PaymentMethod { get; private set; } = ""; public string? Notes { get; private set; } public DateTimeOffset CreatedAtUtc { get; private set; } }

/// <summary>One step of the pickup trip clock; types match SurveyTimeEventTypes (STARTED, PAUSED, RESUMED, COMPLETED).</summary>
public sealed class PickupTimeEvent : TenantOwnedEntity
{
    private PickupTimeEvent() { }
    public PickupTimeEvent(Guid tenantId, Guid pickupId, string type, DateTimeOffset occurredAtUtc, string? reason, string recordedBy) : base(tenantId)
    { PickupId = pickupId; Type = type; OccurredAtUtc = occurredAtUtc; Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim(); RecordedBy = recordedBy; }
    public Guid PickupId { get; private set; }
    public string Type { get; private set; } = "";
    public DateTimeOffset OccurredAtUtc { get; private set; }
    public string? Reason { get; private set; }
    public string RecordedBy { get; private set; } = "";
}

/// <summary>Crew out-of-pocket cost on a pickup (fuel, toll, metro…); categories match SurveyExpenseCategories.</summary>
public sealed class PickupExpense : TenantOwnedEntity
{
    private PickupExpense() { }
    public PickupExpense(Guid tenantId, Guid pickupId, string category, decimal amount, string currency, DateTimeOffset incurredAtUtc, Guid? paidByEmployeeId, string? notes) : base(tenantId)
    { PickupId = pickupId; CreatedAtUtc = DateTimeOffset.UtcNow; Update(category, amount, currency, incurredAtUtc, paidByEmployeeId, notes); }
    public Guid PickupId { get; private set; }
    public string Category { get; private set; } = "";
    public decimal Amount { get; private set; }
    public string Currency { get; private set; } = "";
    public DateTimeOffset IncurredAtUtc { get; private set; }
    public Guid? PaidByEmployeeId { get; private set; }
    public string? Notes { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public void Update(string category, decimal amount, string currency, DateTimeOffset incurredAtUtc, Guid? paidByEmployeeId, string? notes)
    { Category = category.Trim().ToUpperInvariant(); Amount = amount; Currency = currency.Trim().ToUpperInvariant(); IncurredAtUtc = incurredAtUtc; PaidByEmployeeId = paidByEmployeeId; Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(); }
}

public static class PickupPhotoStages
{
    public const string BeforePacking = "BEFORE_PACKING";
    public const string AfterPacking = "AFTER_PACKING";
    /// <summary>Condition evidence captured against one box before it is loaded.</summary>
    public const string BeforePickup = "BEFORE_PICKUP";
    public const string Other = "OTHER";
    public static readonly string[] All = [BeforePacking, AfterPacking, BeforePickup, Other];
}

/// <summary>Photo, video or document captured on a pickup, tagged with the packing stage and room. When BoxId is
/// set it is evidence for one box - typically damage found before loading.</summary>
public sealed class PickupAttachment : TenantOwnedEntity
{
    private PickupAttachment() { }
    public PickupAttachment(Guid tenantId, Guid pickupId, string stage, string? roomName, string uploadedBy, string originalFileName, string contentType, long declaredSizeBytes, string? boxSource = null, Guid? boxId = null) : base(tenantId)
    { PickupId = pickupId; Stage = stage; RoomName = string.IsNullOrWhiteSpace(roomName) ? null : roomName.Trim(); UploadedBy = uploadedBy; OriginalFileName = originalFileName; ContentType = contentType; DeclaredSizeBytes = declaredSizeBytes; BoxSource = boxSource; BoxId = boxId; S3ObjectKey = $"tenants/{tenantId:N}/pickups/{pickupId:N}/attachments/{Id:N}/{originalFileName}"; CreatedAtUtc = DateTimeOffset.UtcNow; }
    public Guid PickupId { get; private set; }
    /// <summary>PACKING or PICKUP when this file belongs to a box; null for a general pickup photo.</summary>
    public string? BoxSource { get; private set; }
    public Guid? BoxId { get; private set; }
    public string Stage { get; private set; } = PickupPhotoStages.Other;
    public string? RoomName { get; private set; }
    public string UploadedBy { get; private set; } = "";
    public string OriginalFileName { get; private set; } = "";
    public string ContentType { get; private set; } = "";
    public long DeclaredSizeBytes { get; private set; }
    public long? StoredSizeBytes { get; private set; }
    public string S3ObjectKey { get; private set; } = "";
    public bool IsUploaded { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset? UploadedAtUtc { get; private set; }
    public void MarkUploaded(long sizeBytes) { StoredSizeBytes = sizeBytes; IsUploaded = true; UploadedAtUtc = DateTimeOffset.UtcNow; }
    /// <summary>Follows its box when a packing save recreates the package row under a new id.</summary>
    public void RelinkBox(Guid boxId) { BoxId = boxId; }
}

public static class PickupSignoffParties
{
    public const string Employee = "EMPLOYEE";
    public const string Customer = "CUSTOMER";
}

/// <summary>On-site sign-off by the crew lead or the customer, with a drawn signature (PNG data URL).</summary>
public sealed class PickupSignoff : TenantOwnedEntity
{
    private PickupSignoff() { }
    public PickupSignoff(Guid tenantId, Guid pickupId, string party, string signerName, Guid? employeeId, string statement, string? remarks, string signaturePng, DateTimeOffset signedAtUtc, string recordedBy) : base(tenantId)
    { PickupId = pickupId; Party = party; SignerName = signerName.Trim(); EmployeeId = employeeId; Statement = statement; Remarks = string.IsNullOrWhiteSpace(remarks) ? null : remarks.Trim(); SignaturePng = signaturePng; SignedAtUtc = signedAtUtc; RecordedBy = recordedBy; }
    public Guid PickupId { get; private set; }
    public string Party { get; private set; } = "";
    public string SignerName { get; private set; } = "";
    public Guid? EmployeeId { get; private set; }
    public string Statement { get; private set; } = "";
    public string? Remarks { get; private set; }
    public string SignaturePng { get; private set; } = "";
    public DateTimeOffset SignedAtUtc { get; private set; }
    public string RecordedBy { get; private set; } = "";
}

/// <summary>Storage facility where packed boxes can be held between pickup and delivery.</summary>
public sealed class Warehouse : TenantOwnedEntity
{
    private Warehouse() { }
    public Warehouse(Guid tenantId, string code, string name, string? address) : base(tenantId) { Update(code, name, address); IsActive = true; }
    public string Code { get; private set; } = "";
    public string Name { get; private set; } = "";
    public string? Address { get; private set; }
    public bool IsActive { get; private set; }
    public void Update(string code, string name, string? address) { Code = code.Trim().ToUpperInvariant(); Name = name.Trim(); Address = string.IsNullOrWhiteSpace(address) ? null : address.Trim(); }
    public void SetActive(bool value) => IsActive = value;
}
