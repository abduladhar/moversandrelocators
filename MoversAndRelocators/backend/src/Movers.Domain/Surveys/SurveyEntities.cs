using Movers.Domain.Common;

namespace Movers.Domain.Surveys;

public static class SurveyStatuses
{
    public const string Draft = "DRAFT";
    public const string Scheduled = "SCHEDULED";
    public const string Confirmed = "CONFIRMED";
    public const string InProgress = "IN_PROGRESS";
    public const string Completed = "COMPLETED";
}

public sealed class HouseholdItem : TenantOwnedEntity
{
    private HouseholdItem() { }
    public HouseholdItem(Guid tenantId, string code, string name, decimal volumeCbm, string? description) : base(tenantId) { Update(code, name, volumeCbm, description); IsActive = true; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public decimal VolumeCbm { get; private set; }
    public string? Description { get; private set; }
    public bool IsActive { get; private set; }
    public void Update(string code, string name, decimal volumeCbm, string? description) { Code = code.Trim().ToUpperInvariant(); Name = name.Trim(); VolumeCbm = volumeCbm; Description = Clean(description); }
    public void SetActive(bool value) => IsActive = value;
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed class PackingMaterial : TenantOwnedEntity
{
    private PackingMaterial() { }
    public PackingMaterial(Guid tenantId, string code, string name, string unit, decimal currentUnitCost, string? description) : base(tenantId) { Update(code, name, unit, currentUnitCost, description); IsActive = true; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Unit { get; private set; } = string.Empty;
    public decimal CurrentUnitCost { get; private set; }
    public string? Description { get; private set; }
    public bool IsActive { get; private set; }
    public void Update(string code, string name, string unit, decimal currentUnitCost, string? description) { Code = code.Trim().ToUpperInvariant(); Name = name.Trim(); Unit = unit.Trim(); CurrentUnitCost = currentUnitCost; Description = Clean(description); }
    public void SetActive(bool value) => IsActive = value;
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed class BoxType : TenantOwnedEntity
{
    private BoxType() { }
    public BoxType(Guid tenantId, string code, string name, decimal capacityCbm, string? description) : base(tenantId) { Update(code, name, capacityCbm, description); IsActive = true; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public decimal CapacityCbm { get; private set; }
    public string? Description { get; private set; }
    public bool IsActive { get; private set; }
    public void Update(string code, string name, decimal capacityCbm, string? description) { Code = code.Trim().ToUpperInvariant(); Name = name.Trim(); CapacityCbm = capacityCbm; Description = Clean(description); }
    public void SetActive(bool value) => IsActive = value;
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed class BoxTypeMaterial : TenantOwnedEntity
{
    private BoxTypeMaterial() { }
    public BoxTypeMaterial(Guid tenantId, Guid boxTypeId, Guid materialId, decimal quantity) : base(tenantId) { BoxTypeId = boxTypeId; MaterialId = materialId; Quantity = quantity; }
    public Guid BoxTypeId { get; private set; }
    public Guid MaterialId { get; private set; }
    public decimal Quantity { get; private set; }
    public void SetQuantity(decimal quantity) => Quantity = quantity;
}

public sealed class Survey : TenantOwnedEntity
{
    private Survey() { }
    public Survey(Guid tenantId, string surveyNumber, Guid? salesLeadId, string customerName, string phone, string? email, Guid assignedEmployeeId, DateTimeOffset scheduledAtUtc, string address, string? notes) : base(tenantId)
    {
        SurveyNumber = surveyNumber.Trim().ToUpperInvariant(); CreatedAtUtc = DateTimeOffset.UtcNow; Status = SurveyStatuses.Scheduled;
        Update(salesLeadId, customerName, phone, email, assignedEmployeeId, scheduledAtUtc, address, notes);
    }
    public string SurveyNumber { get; private set; } = string.Empty;
    public Guid? SalesLeadId { get; private set; }
    public string CustomerName { get; private set; } = string.Empty;
    public string Phone { get; private set; } = string.Empty;
    public string? Email { get; private set; }
    public Guid AssignedEmployeeId { get; private set; }
    public DateTimeOffset ScheduledAtUtc { get; private set; }
    public string Address { get; private set; } = string.Empty;
    public decimal? Latitude { get; private set; }
    public decimal? Longitude { get; private set; }
    public string Status { get; private set; } = SurveyStatuses.Draft;
    public string? Notes { get; private set; }
    public DateTimeOffset? StartedAtUtc { get; private set; }
    public DateTimeOffset? EndedAtUtc { get; private set; }
    public DateTimeOffset? ScheduleConfirmedAtUtc { get; private set; }
    public DateTimeOffset? ItemsConfirmedAtUtc { get; private set; }
    public string? CustomerNotes { get; private set; }
    public string? ConfirmationTokenHash { get; private set; }
    public DateTimeOffset? ConfirmationExpiresAtUtc { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public void Update(Guid? salesLeadId, string customerName, string phone, string? email, Guid assignedEmployeeId, DateTimeOffset scheduledAtUtc, string address, string? notes) { SalesLeadId = salesLeadId; CustomerName = customerName.Trim(); Phone = phone.Trim(); Email = Clean(email); AssignedEmployeeId = assignedEmployeeId; ScheduledAtUtc = scheduledAtUtc; Address = address.Trim(); Notes = Clean(notes); UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void SetConfirmationLink(string tokenHash, DateTimeOffset expiresAtUtc) { ConfirmationTokenHash = tokenHash; ConfirmationExpiresAtUtc = expiresAtUtc; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void ConfirmSchedule(DateTimeOffset scheduledAtUtc, string address, decimal? latitude, decimal? longitude, string? notes) { ScheduledAtUtc = scheduledAtUtc; Address = address.Trim(); Latitude = latitude; Longitude = longitude; CustomerNotes = Clean(notes); ScheduleConfirmedAtUtc = DateTimeOffset.UtcNow; Status = SurveyStatuses.Confirmed; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void ConfirmItems(string? notes) { ItemsConfirmedAtUtc = DateTimeOffset.UtcNow; CustomerNotes = Clean(notes) ?? CustomerNotes; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    /// <summary>The trip clock: starts when the surveyor leaves the office and ends when they are back.</summary>
    public void Start(DateTimeOffset at) { if (Status == SurveyStatuses.Completed) throw new InvalidOperationException("A completed survey cannot be restarted."); if (StartedAtUtc is not null) throw new InvalidOperationException("The survey has already started."); StartedAtUtc = at; Status = SurveyStatuses.InProgress; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void Pause() { if (Status != SurveyStatuses.InProgress) throw new InvalidOperationException("Only a survey in progress can be paused."); if (IsPaused) throw new InvalidOperationException("The survey is already paused."); IsPaused = true; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void Resume() { if (!IsPaused) throw new InvalidOperationException("The survey is not paused."); IsPaused = false; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void Complete(DateTimeOffset at, decimal distanceKm, Guid conductedByEmployeeId) { if (StartedAtUtc is null || Status != SurveyStatuses.InProgress) throw new InvalidOperationException("Start the survey before completing it."); IsPaused = false; EndedAtUtc = at; Status = SurveyStatuses.Completed; RecordTrip(distanceKm, conductedByEmployeeId); }
    public void RecordTrip(decimal? distanceKm, Guid? conductedByEmployeeId) { DistanceKm = distanceKm; ConductedByEmployeeId = conductedByEmployeeId; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public Guid? ConductedByEmployeeId { get; private set; }
    public decimal? DistanceKm { get; private set; }
    public bool IsPaused { get; private set; }
    public void RecordRequoteInventoryChange() { ItemsConfirmedAtUtc = null; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    /// <summary>Customer-requested inventory changes awaiting staff review; the inventory itself is unchanged until applied.</summary>
    public string? CustomerChangeRequestJson { get; private set; }
    public DateTimeOffset? CustomerChangeRequestedAtUtc { get; private set; }
    public void SubmitCustomerChanges(string requestJson) { CustomerChangeRequestJson = requestJson; CustomerChangeRequestedAtUtc = DateTimeOffset.UtcNow; ItemsConfirmedAtUtc = null; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void ClearCustomerChanges() { CustomerChangeRequestJson = null; CustomerChangeRequestedAtUtc = null; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed class SurveyRoom : TenantOwnedEntity
{
    private SurveyRoom() { }
    public SurveyRoom(Guid tenantId, Guid surveyId, string name, int displayOrder) : base(tenantId) { SurveyId = surveyId; Name = name.Trim(); DisplayOrder = displayOrder; }
    public Guid SurveyId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public int DisplayOrder { get; private set; }
}

public sealed class SurveyItem : TenantOwnedEntity
{
    private SurveyItem() { }
    public SurveyItem(Guid tenantId, Guid surveyId, Guid roomId, Guid householdItemId, int quantity, decimal volumePerUnitCbm, string? notes) : base(tenantId) { SurveyId = surveyId; RoomId = roomId; HouseholdItemId = householdItemId; Quantity = quantity; VolumePerUnitCbm = volumePerUnitCbm; Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(); }
    public Guid SurveyId { get; private set; }
    public Guid RoomId { get; private set; }
    public Guid HouseholdItemId { get; private set; }
    public int Quantity { get; private set; }
    public decimal VolumePerUnitCbm { get; private set; }
    public string? Notes { get; private set; }
    public void ApplyRequoteChange(int quantity, string? notes) { Quantity = quantity; if (!string.IsNullOrWhiteSpace(notes)) Notes = notes.Trim(); }
}

public sealed class SurveyExtraMaterial : TenantOwnedEntity
{
    private SurveyExtraMaterial() { }
    public SurveyExtraMaterial(Guid tenantId, Guid surveyId, Guid materialId, decimal quantity) : base(tenantId) { SurveyId = surveyId; MaterialId = materialId; Quantity = quantity; }
    public Guid SurveyId { get; private set; }
    public Guid MaterialId { get; private set; }
    public decimal Quantity { get; private set; }
}

public static class SurveyAttachmentSources
{
    public const string Customer = "CUSTOMER";
    public const string Staff = "STAFF";
}

public sealed class SurveyAttachment : TenantOwnedEntity
{
    private SurveyAttachment() { }
    public SurveyAttachment(Guid tenantId, Guid surveyId, string source, string uploadedBy, string originalFileName, string contentType, long declaredSizeBytes) : base(tenantId)
    { SurveyId = surveyId; Source = source; UploadedBy = uploadedBy; OriginalFileName = originalFileName; ContentType = contentType; DeclaredSizeBytes = declaredSizeBytes; S3ObjectKey = $"tenants/{tenantId:N}/surveys/{surveyId:N}/attachments/{Id:N}/{originalFileName}"; CreatedAtUtc = DateTimeOffset.UtcNow; }
    public Guid SurveyId { get; private set; }
    public string Source { get; private set; } = SurveyAttachmentSources.Staff;
    public string UploadedBy { get; private set; } = string.Empty;
    public string OriginalFileName { get; private set; } = string.Empty;
    public string ContentType { get; private set; } = string.Empty;
    public long DeclaredSizeBytes { get; private set; }
    public long? StoredSizeBytes { get; private set; }
    public string S3ObjectKey { get; private set; } = string.Empty;
    public bool IsUploaded { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset? UploadedAtUtc { get; private set; }
    public void MarkUploaded(long sizeBytes) { StoredSizeBytes = sizeBytes; IsUploaded = true; UploadedAtUtc = DateTimeOffset.UtcNow; }
}

public static class SurveyTimeEventTypes
{
    public const string Started = "STARTED";
    public const string Paused = "PAUSED";
    public const string Resumed = "RESUMED";
    public const string Completed = "COMPLETED";
}

/// <summary>One step of the survey trip clock (leave office, pause, resume, back at office).</summary>
public sealed class SurveyTimeEvent : TenantOwnedEntity
{
    private SurveyTimeEvent() { }
    public SurveyTimeEvent(Guid tenantId, Guid surveyId, string type, DateTimeOffset occurredAtUtc, string? reason, string recordedBy) : base(tenantId)
    { SurveyId = surveyId; Type = type; OccurredAtUtc = occurredAtUtc; Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim(); RecordedBy = recordedBy; }
    public Guid SurveyId { get; private set; }
    public string Type { get; private set; } = string.Empty;
    public DateTimeOffset OccurredAtUtc { get; private set; }
    public string? Reason { get; private set; }
    public string RecordedBy { get; private set; } = string.Empty;
}

public static class SurveyExpenseCategories
{
    public static readonly string[] All = ["FUEL", "TAXI", "METRO", "BUS", "TOLL", "PARKING", "FOOD", "OTHER"];
}

/// <summary>Out-of-pocket cost incurred while travelling for or conducting a survey.</summary>
public sealed class SurveyExpense : TenantOwnedEntity
{
    private SurveyExpense() { }
    public SurveyExpense(Guid tenantId, Guid surveyId, string category, decimal amount, string currency, DateTimeOffset incurredAtUtc, Guid? paidByEmployeeId, string? notes) : base(tenantId)
    { SurveyId = surveyId; CreatedAtUtc = DateTimeOffset.UtcNow; Update(category, amount, currency, incurredAtUtc, paidByEmployeeId, notes); }
    public Guid SurveyId { get; private set; }
    public string Category { get; private set; } = string.Empty;
    public decimal Amount { get; private set; }
    public string Currency { get; private set; } = string.Empty;
    public DateTimeOffset IncurredAtUtc { get; private set; }
    public Guid? PaidByEmployeeId { get; private set; }
    public string? Notes { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public void Update(string category, decimal amount, string currency, DateTimeOffset incurredAtUtc, Guid? paidByEmployeeId, string? notes)
    { Category = category.Trim().ToUpperInvariant(); Amount = amount; Currency = currency.Trim().ToUpperInvariant(); IncurredAtUtc = incurredAtUtc; PaidByEmployeeId = paidByEmployeeId; Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(); }
}
