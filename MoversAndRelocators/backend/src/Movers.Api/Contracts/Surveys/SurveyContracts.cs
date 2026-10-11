using System.ComponentModel.DataAnnotations;
using Movers.Services.Surveys;

namespace Movers.Api.Contracts.Surveys;

public sealed record SaveHouseholdItemRequest([Required, StringLength(40)] string Code, [Required, StringLength(160)] string Name, [Range(0.001, 10000)] decimal VolumeCbm, [StringLength(500)] string? Description) { public SaveHouseholdItemCommand ToCommand() => new(Code, Name, VolumeCbm, Description); }
public sealed record SaveMaterialRequest([Required, StringLength(40)] string Code, [Required, StringLength(160)] string Name, [Required, StringLength(40)] string Unit, [Range(0, 999999999)] decimal CurrentUnitCost, [StringLength(500)] string? Description) { public SaveMaterialCommand ToCommand() => new(Code, Name, Unit, CurrentUnitCost, Description); }
public sealed record BoxMaterialRequest(Guid MaterialId, [Range(0.001, 100000)] decimal Quantity);
public sealed record SaveBoxTypeRequest([Required, StringLength(40)] string Code, [Required, StringLength(160)] string Name, [Range(0.001, 10000)] decimal CapacityCbm, [StringLength(500)] string? Description, IReadOnlyList<BoxMaterialRequest> Materials) { public SaveBoxTypeCommand ToCommand() => new(Code, Name, CapacityCbm, Description, Materials.Select(x => new BoxMaterialInput(x.MaterialId, x.Quantity)).ToList()); }
public sealed record SetSurveyMasterStatusRequest(bool IsActive);
public sealed record SaveSurveyRequest(string? SurveyNumber, Guid? SalesLeadId, [Required, StringLength(160)] string CustomerName, [Required, StringLength(40)] string Phone, [OptionalSurveyEmail, StringLength(254)] string? Email, Guid AssignedEmployeeId, DateTimeOffset ScheduledAtUtc, [Required, StringLength(600)] string Address, [StringLength(2000)] string? Notes) { public SaveSurveyCommand ToCommand() => new(SurveyNumber ?? "", SalesLeadId, CustomerName, Phone, string.IsNullOrWhiteSpace(Email) ? null : Email.Trim(), AssignedEmployeeId, ScheduledAtUtc, Address, Notes); }
public sealed record SurveyItemRequest(Guid HouseholdItemId, [Range(1, 10000)] int Quantity, [Range(0.001, 10000)] decimal? VolumePerUnitCbm, [StringLength(500)] string? Notes);
public sealed record SurveyRoomRequest([Required, StringLength(120)] string Name, int DisplayOrder, IReadOnlyList<SurveyItemRequest> Items);
public sealed record SurveyExtraMaterialRequest(Guid MaterialId, [Range(0.001, 100000)] decimal Quantity);
public sealed record SaveSurveyDetailsRequest(IReadOnlyList<SurveyRoomRequest> Rooms, IReadOnlyList<SurveyExtraMaterialRequest> ExtraMaterials) { public SaveSurveyDetailsCommand ToCommand() => new(Rooms.Select(r => new SurveyRoomInput(r.Name, r.DisplayOrder, r.Items.Select(i => new SurveyItemInput(i.HouseholdItemId, i.Quantity, i.VolumePerUnitCbm, i.Notes)).ToList())).ToList(), ExtraMaterials.Select(x => new SurveyExtraMaterialInput(x.MaterialId, x.Quantity)).ToList()); }
public sealed record GenerateSurveyLinkRequest([Range(1, 30)] int ValidDays = 7);
public sealed record ConfirmSurveyScheduleRequest(DateTimeOffset ScheduledAtUtc, [Required, StringLength(600)] string Address, decimal? Latitude, decimal? Longitude, [StringLength(2000)] string? Notes) { public ConfirmSurveyScheduleCommand ToCommand() => new(ScheduledAtUtc, Address, Latitude, Longitude, Notes); }
public sealed record ConfirmSurveyItemsRequest([StringLength(2000)] string? Notes);
public sealed record CustomerRemoveItemRequest(Guid SurveyItemId, [StringLength(300)] string? Reason);
public sealed record CustomerAddItemRequest([Required, StringLength(120)] string RoomName, Guid HouseholdItemId, [Range(1, 100)] int Quantity, [StringLength(300)] string? Notes);
public sealed record SubmitCustomerChangesRequest(IReadOnlyList<CustomerRemoveItemRequest>? RemovedItems, IReadOnlyList<CustomerAddItemRequest>? AddedItems, [StringLength(2000)] string? Notes)
{ public SubmitCustomerChangesCommand ToCommand() => new((RemovedItems ?? []).Select(x => new CustomerRemoveItemInput(x.SurveyItemId, x.Reason)).ToList(), (AddedItems ?? []).Select(x => new CustomerAddItemInput(x.RoomName, x.HouseholdItemId, x.Quantity, x.Notes)).ToList(), Notes); }
public sealed record TripStepRequest(DateTimeOffset? At, [StringLength(500)] string? Reason) { public TripStepCommand ToCommand() => new(At, Reason); }
public sealed record CompleteSurveyRequest(DateTimeOffset? At, [Range(0, 5000)] decimal? DistanceKm, Guid? ConductedByEmployeeId) { public CompleteSurveyCommand ToCommand() => new(At, DistanceKm, ConductedByEmployeeId); }
public sealed record UpdateSurveyTripRequest([Range(0, 5000)] decimal? DistanceKm, Guid? ConductedByEmployeeId) { public UpdateSurveyTripCommand ToCommand() => new(DistanceKm, ConductedByEmployeeId); }
public sealed record SaveSurveyExpenseRequest([Required, StringLength(30)] string Category, [Range(0.0001, 10000000)] decimal Amount, [Required, StringLength(3, MinimumLength = 3)] string Currency, DateTimeOffset IncurredAtUtc, Guid? PaidByEmployeeId, [StringLength(500)] string? Notes, decimal? ExchangeRate = null)
{ public SaveSurveyExpenseCommand ToCommand() => new(Category, Amount, Currency, IncurredAtUtc, PaidByEmployeeId, Notes, ExchangeRate); }

[AttributeUsage(AttributeTargets.Parameter | AttributeTargets.Property)]
public sealed class OptionalSurveyEmailAttribute : ValidationAttribute
{
    public OptionalSurveyEmailAttribute() : base("Enter a valid email address or leave it blank.") { }
    public override bool IsValid(object? value) => value is null ||
        value is string email && (string.IsNullOrWhiteSpace(email) || new EmailAddressAttribute().IsValid(email.Trim()));
}
