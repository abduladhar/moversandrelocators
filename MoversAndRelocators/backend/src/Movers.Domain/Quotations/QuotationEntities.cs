using Movers.Domain.Common;

namespace Movers.Domain.Quotations;

public static class QuotationStatuses
{
    public const string Draft = "DRAFT";
    public const string Sent = "SENT";
    public const string Accepted = "ACCEPTED";
    public const string Rejected = "REJECTED";
    public const string RequoteRequested = "REQUOTE_REQUESTED";
}

public static class TaxKinds { public const string Tax = "TAX"; public const string Cess = "CESS"; }
public static class TaxCalculationBases { public const string TaxableAmount = "TAXABLE_AMOUNT"; public const string TaxAmount = "TAX_AMOUNT"; public const string Quantity = "QUANTITY"; }

public sealed class TaxMaster : TenantOwnedEntity
{
    private TaxMaster() { }
    public TaxMaster(Guid tenantId, string code, string name, string kind, string calculationBasis, decimal rate, bool isDefault, string? description) : base(tenantId) { CreatedAtUtc = DateTimeOffset.UtcNow; Update(code, name, kind, calculationBasis, rate, isDefault, description); IsActive = true; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Kind { get; private set; } = TaxKinds.Tax;
    public string CalculationBasis { get; private set; } = TaxCalculationBases.TaxableAmount;
    public decimal Rate { get; private set; }
    public bool IsDefault { get; private set; }
    public string? Description { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public void Update(string code, string name, string kind, string calculationBasis, decimal rate, bool isDefault, string? description) { Code = code.Trim().ToUpperInvariant(); Name = name.Trim(); Kind = kind.Trim().ToUpperInvariant(); CalculationBasis = calculationBasis.Trim().ToUpperInvariant(); Rate = rate; IsDefault = isDefault; Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(); UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void SetActive(bool active) { IsActive = active; UpdatedAtUtc = DateTimeOffset.UtcNow; }
}

public sealed class ChargeMaster : TenantOwnedEntity
{
    private ChargeMaster() { }
    public ChargeMaster(Guid tenantId, string code, string name, string unit, decimal defaultRate, decimal taxPercent, string? description) : base(tenantId) { CreatedAtUtc = DateTimeOffset.UtcNow; Update(code, name, unit, defaultRate, taxPercent, description); IsActive = true; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Unit { get; private set; } = string.Empty;
    public decimal DefaultRate { get; private set; }
    public decimal TaxPercent { get; private set; }
    public string? Description { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public void Update(string code, string name, string unit, decimal defaultRate, decimal taxPercent, string? description) { Code = code.Trim().ToUpperInvariant(); Name = name.Trim(); Unit = unit.Trim(); DefaultRate = defaultRate; TaxPercent = taxPercent; Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(); UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void SetActive(bool active) { IsActive = active; UpdatedAtUtc = DateTimeOffset.UtcNow; }
}

public sealed class Quotation : TenantOwnedEntity
{
    private Quotation() { }
    public Quotation(Guid tenantId, string quotationNumber, Guid? surveyId, Guid? salesLeadId, string customerName, string phone, string? email, string origin, string destination, Guid assignedEmployeeId, string currency, DateOnly validUntil, string? terms, string? notes, bool includeSurveyItems = false) : base(tenantId) { QuotationNumber = quotationNumber.Trim().ToUpperInvariant(); CreatedAtUtc = DateTimeOffset.UtcNow; Status = QuotationStatuses.Draft; Update(surveyId, salesLeadId, customerName, phone, email, origin, destination, assignedEmployeeId, currency, validUntil, terms, notes, includeSurveyItems); }
    public string QuotationNumber { get; private set; } = string.Empty;
    public string? RevisedFromNumber { get; private set; }
    public string? RevisionReason { get; private set; }
    public void SetRevisionSource(Quotation source) { RevisedFromNumber = source.QuotationNumber; RevisionReason = source.RejectionReason; }
    public Guid? SurveyId { get; private set; }
    public Guid? SalesLeadId { get; private set; }
    public string CustomerName { get; private set; } = string.Empty;
    public string Phone { get; private set; } = string.Empty;
    public string? Email { get; private set; }
    public string Origin { get; private set; } = string.Empty;
    public string Destination { get; private set; } = string.Empty;
    public Guid AssignedEmployeeId { get; private set; }
    public string Currency { get; private set; } = "INR";
    public DateOnly ValidUntil { get; private set; }
    public string? Terms { get; private set; }
    public string? Notes { get; private set; }
    public bool IncludeSurveyItems { get; private set; }
    public string Status { get; private set; } = QuotationStatuses.Draft;
    public decimal Subtotal { get; private set; }
    public decimal DiscountTotal { get; private set; }
    public decimal TaxTotal { get; private set; }
    public decimal GrandTotal { get; private set; }
    public string? ShareTokenHash { get; private set; }
    public DateTimeOffset? ShareExpiresAtUtc { get; private set; }
    public DateTimeOffset? SentAtUtc { get; private set; }
    public DateTimeOffset? RespondedAtUtc { get; private set; }
    public string? RejectionReason { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public void Update(Guid? surveyId, Guid? salesLeadId, string customerName, string phone, string? email, string origin, string destination, Guid assignedEmployeeId, string currency, DateOnly validUntil, string? terms, string? notes, bool includeSurveyItems) { if (Status is QuotationStatuses.Accepted or QuotationStatuses.Rejected) throw new InvalidOperationException("A customer-responded quotation cannot be edited."); SurveyId = surveyId; SalesLeadId = salesLeadId; CustomerName = customerName.Trim(); Phone = phone.Trim(); Email = Clean(email); Origin = origin.Trim(); Destination = destination.Trim(); AssignedEmployeeId = assignedEmployeeId; Currency = currency.Trim().ToUpperInvariant(); ValidUntil = validUntil; Terms = Clean(terms); Notes = Clean(notes); IncludeSurveyItems = surveyId.HasValue && includeSurveyItems; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void SetTotals(decimal subtotal, decimal discount, decimal tax, decimal total) { Subtotal = subtotal; DiscountTotal = discount; TaxTotal = tax; GrandTotal = total; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void Share(string tokenHash, DateTimeOffset expiresAtUtc) { if (Status is QuotationStatuses.Accepted or QuotationStatuses.Rejected) throw new InvalidOperationException("A customer-responded quotation cannot be shared again."); ShareTokenHash = tokenHash; ShareExpiresAtUtc = expiresAtUtc; SentAtUtc = DateTimeOffset.UtcNow; RespondedAtUtc = null; RejectionReason = null; Status = QuotationStatuses.Sent; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void Accept() { if (Status != QuotationStatuses.Sent) throw new InvalidOperationException("Only a sent quotation can be accepted."); Status = QuotationStatuses.Accepted; RespondedAtUtc = DateTimeOffset.UtcNow; RejectionReason = null; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void Reject(string reason) { if (Status != QuotationStatuses.Sent) throw new InvalidOperationException("Only a sent quotation can be rejected."); if (string.IsNullOrWhiteSpace(reason)) throw new InvalidOperationException("A rejection reason is required."); Status = QuotationStatuses.Rejected; RespondedAtUtc = DateTimeOffset.UtcNow; RejectionReason = reason.Trim(); UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void RequestRequote() { if (Status != QuotationStatuses.Sent) throw new InvalidOperationException("Only a sent quotation can be submitted for requoting."); if (!IncludeSurveyItems || !SurveyId.HasValue) throw new InvalidOperationException("Survey items are not enabled for this quotation."); Status = QuotationStatuses.RequoteRequested; RespondedAtUtc = DateTimeOffset.UtcNow; RejectionReason = null; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed class QuotationRequoteRequest : TenantOwnedEntity
{
    private QuotationRequoteRequest() { }
    public QuotationRequoteRequest(Guid tenantId, Guid quotationId, string itemsJson, string? customerNotes) : base(tenantId) { QuotationId = quotationId; ItemsJson = itemsJson; CustomerNotes = string.IsNullOrWhiteSpace(customerNotes) ? null : customerNotes.Trim(); CreatedAtUtc = DateTimeOffset.UtcNow; }
    public Guid QuotationId { get; private set; }
    public string ItemsJson { get; private set; } = "[]";
    public string? CustomerNotes { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset? AppliedAtUtc { get; private set; }
    public void MarkApplied() { if (AppliedAtUtc.HasValue) throw new InvalidOperationException("This requote request has already been applied."); AppliedAtUtc = DateTimeOffset.UtcNow; }
}

public sealed class QuotationLine : TenantOwnedEntity
{
    private QuotationLine() { }
    public QuotationLine(Guid tenantId, Guid quotationId, Guid chargeMasterId, string description, decimal quantity, string unit, decimal rate, decimal discountPercent, decimal taxPercent, decimal taxAmount, int displayOrder, int decimalPlaces = 2) : base(tenantId) { QuotationId = quotationId; ChargeMasterId = chargeMasterId; Description = description.Trim(); Quantity = quantity; Unit = unit.Trim(); Rate = rate; DiscountPercent = discountPercent; TaxPercent = taxPercent; DisplayOrder = displayOrder; var gross = quantity * rate; DiscountAmount = decimal.Round(gross * discountPercent / 100m, decimalPlaces, MidpointRounding.AwayFromZero); TaxAmount = decimal.Round(taxAmount, decimalPlaces, MidpointRounding.AwayFromZero); LineTotal = decimal.Round(gross - DiscountAmount + TaxAmount, decimalPlaces, MidpointRounding.AwayFromZero); }
    public Guid QuotationId { get; private set; }
    public Guid ChargeMasterId { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public decimal Quantity { get; private set; }
    public string Unit { get; private set; } = string.Empty;
    public decimal Rate { get; private set; }
    public decimal DiscountPercent { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal TaxPercent { get; private set; }
    public decimal TaxAmount { get; private set; }
    public decimal LineTotal { get; private set; }
    public int DisplayOrder { get; private set; }
}

public sealed class QuotationItem : TenantOwnedEntity
{
    private QuotationItem() { }
    public QuotationItem(Guid tenantId, Guid quotationId, Guid householdItemId, string roomName, string itemName, int quantity, decimal volumePerUnitCbm, string? notes, int displayOrder) : base(tenantId)
    {
        QuotationId = quotationId; HouseholdItemId = householdItemId; RoomName = roomName.Trim(); ItemName = itemName.Trim(); Quantity = quantity; VolumePerUnitCbm = volumePerUnitCbm; Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(); DisplayOrder = displayOrder;
    }
    public Guid QuotationId { get; private set; }
    public Guid HouseholdItemId { get; private set; }
    public string RoomName { get; private set; } = string.Empty;
    public string ItemName { get; private set; } = string.Empty;
    public int Quantity { get; private set; }
    public decimal VolumePerUnitCbm { get; private set; }
    public decimal TotalVolumeCbm => Quantity * VolumePerUnitCbm;
    public string? Notes { get; private set; }
    public int DisplayOrder { get; private set; }
}

public sealed class QuotationLineTax : TenantOwnedEntity
{
    private QuotationLineTax() { }
    public QuotationLineTax(Guid tenantId, Guid quotationLineId, Guid taxMasterId, string code, string name, string kind, string calculationBasis, decimal rate, decimal taxableBase, decimal amount) : base(tenantId) { QuotationLineId = quotationLineId; TaxMasterId = taxMasterId; Code = code; Name = name; Kind = kind; CalculationBasis = calculationBasis; Rate = rate; TaxableBase = taxableBase; Amount = amount; }
    public Guid QuotationLineId { get; private set; }
    public Guid TaxMasterId { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Kind { get; private set; } = string.Empty;
    public string CalculationBasis { get; private set; } = string.Empty;
    public decimal Rate { get; private set; }
    public decimal TaxableBase { get; private set; }
    public decimal Amount { get; private set; }
}

