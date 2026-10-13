namespace Movers.Services.Surveys;

public sealed record SaveHouseholdItemCommand(string Code, string Name, decimal VolumeCbm, string? Description);
public sealed record HouseholdItemModel(int SerialNo, Guid Id, string Code, string Name, decimal VolumeCbm, string? Description, bool IsActive);
public sealed record SaveMaterialCommand(string Code, string Name, string Unit, decimal CurrentUnitCost, string? Description);
public sealed record MaterialModel(int SerialNo, Guid Id, string Code, string Name, string Unit, decimal CurrentUnitCost, string? Description, bool IsActive);
public sealed record BoxMaterialInput(Guid MaterialId, decimal Quantity);
public sealed record SaveBoxTypeCommand(string Code, string Name, decimal CapacityCbm, string? Description, IReadOnlyList<BoxMaterialInput> Materials);
public sealed record BoxMaterialModel(Guid MaterialId, string MaterialName, string Unit, decimal Quantity, decimal UnitCost, decimal Cost);
public sealed record BoxTypeModel(int SerialNo, Guid Id, string Code, string Name, decimal CapacityCbm, string? Description, bool IsActive, IReadOnlyList<BoxMaterialModel> Materials, decimal BuildCost);
public sealed record SaveSurveyCommand(string SurveyNumber, Guid? SalesLeadId, string CustomerName, string Phone, string? Email, Guid AssignedEmployeeId, DateTimeOffset ScheduledAtUtc, string Address, string? Notes);
public sealed record SurveyModel(int SerialNo, Guid Id, string SurveyNumber, Guid? SalesLeadId, string CustomerName, string Phone, string? Email, Guid AssignedEmployeeId, string AssignedEmployeeName, DateTimeOffset ScheduledAtUtc, string Address, decimal? Latitude, decimal? Longitude, string Status, DateTimeOffset? StartedAtUtc, DateTimeOffset? EndedAtUtc, DateTimeOffset? ScheduleConfirmedAtUtc, DateTimeOffset? ItemsConfirmedAtUtc, string? Notes, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc);
public sealed record SurveyItemInput(Guid HouseholdItemId, int Quantity, decimal? VolumePerUnitCbm, string? Notes);
public sealed record SurveyRoomInput(string Name, int DisplayOrder, IReadOnlyList<SurveyItemInput> Items);
public sealed record SurveyExtraMaterialInput(Guid MaterialId, decimal Quantity);
public sealed record SaveSurveyDetailsCommand(IReadOnlyList<SurveyRoomInput> Rooms, IReadOnlyList<SurveyExtraMaterialInput> ExtraMaterials);
public sealed record SurveyItemModel(int SerialNo, Guid Id, Guid HouseholdItemId, string ItemName, int Quantity, decimal VolumePerUnitCbm, decimal TotalVolumeCbm, string? Notes);
public sealed record SurveyRoomModel(int SerialNo, Guid Id, string Name, int DisplayOrder, IReadOnlyList<SurveyItemModel> Items, decimal TotalVolumeCbm);
public sealed record SurveyExtraMaterialModel(Guid MaterialId, string MaterialName, string Unit, decimal Quantity, decimal UnitCost, decimal Cost);
public sealed record BoxContentModel(string RoomName, string ItemName, decimal VolumeCbm);
public sealed record PlannedBoxModel(int Number, Guid BoxTypeId, string BoxTypeName, decimal CapacityCbm, decimal UsedCbm, decimal RemainingCbm, decimal BuildCost, IReadOnlyList<BoxContentModel> Contents);
public sealed record MaterialCostModel(Guid MaterialId, string MaterialName, string Unit, decimal Quantity, decimal UnitCost, decimal Cost);
public sealed record PackingPlanModel(IReadOnlyList<PlannedBoxModel> Boxes, IReadOnlyList<BoxContentModel> UnboxedItems, IReadOnlyList<MaterialCostModel> Materials, decimal ItemsVolumeCbm, decimal BoxCapacityCbm, decimal EstimatedMaterialCost);
/// <param name="LeadAiSpend">What Claude or OpenAI cost on the sales lead this survey came from; null when the survey has no lead.</param>
public sealed record SurveyDetailModel(SurveyModel Survey, IReadOnlyList<SurveyRoomModel> Rooms, IReadOnlyList<SurveyExtraMaterialModel> ExtraMaterials, PackingPlanModel PackingPlan, CustomerChangeRequestModel? CustomerChanges = null, SurveyTripModel? Trip = null, Movers.Services.OpenAi.AiSpendModel? LeadAiSpend = null);
public sealed record GeneratedSurveyLinkModel(string Token, DateTimeOffset ExpiresAtUtc);
public sealed record PublicSurveyModel(Guid Id, string TenantName, string SurveyNumber, string CustomerName, DateTimeOffset ScheduledAtUtc, string Address, string Status, DateTimeOffset ExpiresAtUtc, bool ScheduleConfirmed, bool ItemsConfirmed, IReadOnlyList<SurveyRoomModel> Rooms, decimal TotalVolumeCbm, CustomerChangeRequestModel? CustomerChanges = null);
public sealed record ConfirmSurveyScheduleCommand(DateTimeOffset ScheduledAtUtc, string Address, decimal? Latitude, decimal? Longitude, string? Notes);
public sealed record CustomerRemovedItemModel(Guid SurveyItemId, string RoomName, string ItemName, int Quantity, string? Reason);
public sealed record CustomerAddedItemModel(string RoomName, Guid HouseholdItemId, string ItemName, int Quantity, decimal VolumePerUnitCbm, string? Notes);
public sealed record CustomerChangeRequestModel(DateTimeOffset RequestedAtUtc, string? Notes, IReadOnlyList<CustomerRemovedItemModel> RemovedItems, IReadOnlyList<CustomerAddedItemModel> AddedItems);
public sealed record CustomerRemoveItemInput(Guid SurveyItemId, string? Reason);
public sealed record CustomerAddItemInput(string RoomName, Guid HouseholdItemId, int Quantity, string? Notes);
public sealed record SubmitCustomerChangesCommand(IReadOnlyList<CustomerRemoveItemInput> RemovedItems, IReadOnlyList<CustomerAddItemInput> AddedItems, string? Notes);
public sealed record PublicCatalogItemModel(Guid Id, string Name, decimal VolumeCbm);
public sealed record SurveyAttachmentModel(int SerialNo, Guid Id, Guid SurveyId, string Source, string UploadedBy, string OriginalFileName, string ContentType, long SizeBytes, DateTimeOffset? UploadedAtUtc);
public sealed record SurveyTimeEventModel(Guid Id, string Type, DateTimeOffset OccurredAtUtc, string? Reason, string RecordedBy);
public sealed record SurveyExpenseModel(int SerialNo, Guid Id, string Category, decimal Amount, string Currency, DateTimeOffset IncurredAtUtc, Guid? PaidByEmployeeId, string? PaidByName, string? Notes);
public sealed record ExpenseTotalModel(string Currency, decimal Amount);
public sealed record SurveyTripModel(Guid? ConductedByEmployeeId, string? ConductedByName, decimal? DistanceKm, bool IsPaused, long ActiveSeconds, long PausedSeconds, IReadOnlyList<SurveyTimeEventModel> Events, IReadOnlyList<SurveyExpenseModel> Expenses, IReadOnlyList<ExpenseTotalModel> ExpenseTotals);
public sealed record TripStepCommand(DateTimeOffset? At, string? Reason);
public sealed record CompleteSurveyCommand(DateTimeOffset? At, decimal? DistanceKm, Guid? ConductedByEmployeeId);
public sealed record UpdateSurveyTripCommand(decimal? DistanceKm, Guid? ConductedByEmployeeId);
/// <param name="Added">Items added to the survey's rooms.</param>
/// <param name="AlreadyThere">Lines whose household item was already in that room, left untouched rather than doubled.</param>
/// <param name="Dropped">Lines the customer marked as not needed on the shared inventory.</param>
/// <param name="Boxes">Box lines, which the packing plan works out from the items rather than taking as inventory.</param>
/// <param name="Unmatched">Names with no active household item; they need a master before the survey can carry them.</param>
/// <param name="Unmatched">Lines that could not come in (no volume, or their household item was deactivated).</param>
/// <param name="CreatedItems">Household items added to the master data because no master matched (check their volumes).</param>
public sealed record LeadInventoryIntoSurveyModel(SurveyDetailModel Detail, int Added, int AlreadyThere, int Dropped, int Boxes, IReadOnlyList<string> Unmatched, IReadOnlyList<string>? CreatedItems = null);
public sealed record SaveSurveyExpenseCommand(string Category, decimal Amount, string Currency, DateTimeOffset IncurredAtUtc, Guid? PaidByEmployeeId, string? Notes, decimal? ExchangeRate = null);

