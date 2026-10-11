using System.ComponentModel.DataAnnotations;
using Movers.Services.Quotations;

namespace Movers.Api.Contracts.Quotations;

public sealed record SaveChargeRequest([Required, StringLength(40)] string Code, [Required, StringLength(160)] string Name, [Required, StringLength(40)] string Unit, [Range(0, 999999999)] decimal DefaultRate, [Range(0, 100)] decimal TaxPercent, [StringLength(500)] string? Description) { public SaveChargeCommand ToCommand() => new(Code, Name, Unit, DefaultRate, TaxPercent, Description); }
public sealed record SetChargeStatusRequest(bool IsActive);
public sealed record SaveTaxRequest([Required, StringLength(40)] string Code, [Required, StringLength(160)] string Name, [Required] string Kind, [Required] string CalculationBasis, [Range(0, 999999)] decimal Rate, bool IsDefault, [StringLength(500)] string? Description) { public SaveTaxCommand ToCommand() => new(Code, Name, Kind, CalculationBasis, Rate, IsDefault, Description); }
public sealed record SetTaxStatusRequest(bool IsActive);
public sealed record SaveQuotationRequest(string? QuotationNumber, Guid? SurveyId, Guid? SalesLeadId, [Required, StringLength(160)] string CustomerName, [Required, StringLength(40)] string Phone, [EmailAddress, StringLength(254)] string? Email, [StringLength(300)] string? Origin, [StringLength(300)] string? Destination, Guid AssignedEmployeeId, [Required, StringLength(3, MinimumLength = 3)] string Currency, DateOnly ValidUntil, [StringLength(4000)] string? Terms, [StringLength(2000)] string? Notes, bool IncludeSurveyItems) { public SaveQuotationCommand ToCommand() => new(QuotationNumber ?? "", SurveyId, SalesLeadId, CustomerName, Phone, Email, Origin, Destination, AssignedEmployeeId, Currency, ValidUntil, Terms, Notes, IncludeSurveyItems); }
public sealed record SaveQuotationLineRequest(Guid ChargeMasterId, [StringLength(500)] string? Description, [Range(0.001, 1000000)] decimal Quantity, [Range(0, 999999999)] decimal? Rate, [Range(0, 100)] decimal DiscountPercent, IReadOnlyList<Guid>? TaxIds, int DisplayOrder) { public SaveQuotationLineCommand ToCommand() => new(ChargeMasterId, Description, Quantity, Rate, DiscountPercent, TaxIds ?? [], DisplayOrder); }
public sealed record SaveQuotationLinesRequest(IReadOnlyList<SaveQuotationLineRequest> Lines);
public sealed record SaveQuotationItemRequest(Guid HouseholdItemId, [Required, StringLength(120)] string RoomName, [Range(1, 10000)] int Quantity, [Range(0.001, 100000)] decimal? VolumePerUnitCbm, [StringLength(500)] string? Notes, int DisplayOrder) { public SaveQuotationItemCommand ToCommand() => new(HouseholdItemId, RoomName, Quantity, VolumePerUnitCbm, Notes, DisplayOrder); }
public sealed record SaveQuotationItemsRequest(IReadOnlyList<SaveQuotationItemRequest> Items);
public sealed record GenerateQuotationLinkRequest([Range(1, 30)] int ValidDays = 7);
public sealed record RejectQuotationRequest([Required, StringLength(1000, MinimumLength = 2)] string Reason);
public sealed record RequoteItemRequest(Guid SurveyItemId, [Range(0, 10000)] int RequestedQuantity, [StringLength(500)] string? Notes);
public sealed record SubmitRequoteRequest([StringLength(2000)] string? CustomerNotes, IReadOnlyList<RequoteItemRequest> Items) { public SubmitRequoteCommand ToCommand() => new(CustomerNotes, Items.Select(x => new RequoteItemInput(x.SurveyItemId, x.RequestedQuantity, x.Notes)).ToList()); }
