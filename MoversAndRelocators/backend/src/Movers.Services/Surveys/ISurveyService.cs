namespace Movers.Services.Surveys;

public interface ISurveyService
{
    Task<IReadOnlyList<HouseholdItemModel>> ListItemsAsync(CancellationToken token);
    Task<HouseholdItemModel> CreateItemAsync(SaveHouseholdItemCommand command, CancellationToken token);
    Task<HouseholdItemModel?> UpdateItemAsync(Guid id, SaveHouseholdItemCommand command, CancellationToken token);
    Task<HouseholdItemModel?> SetItemActiveAsync(Guid id, bool active, CancellationToken token);
    Task<IReadOnlyList<MaterialModel>> ListMaterialsAsync(CancellationToken token);
    Task<MaterialModel> CreateMaterialAsync(SaveMaterialCommand command, CancellationToken token);
    Task<MaterialModel?> UpdateMaterialAsync(Guid id, SaveMaterialCommand command, CancellationToken token);
    Task<MaterialModel?> SetMaterialActiveAsync(Guid id, bool active, CancellationToken token);
    Task<IReadOnlyList<BoxTypeModel>> ListBoxTypesAsync(CancellationToken token);
    Task<BoxTypeModel> CreateBoxTypeAsync(SaveBoxTypeCommand command, CancellationToken token);
    Task<BoxTypeModel?> UpdateBoxTypeAsync(Guid id, SaveBoxTypeCommand command, CancellationToken token);
    Task<BoxTypeModel?> SetBoxTypeActiveAsync(Guid id, bool active, CancellationToken token);
    Task<IReadOnlyList<SurveyModel>> ListSurveysAsync(CancellationToken token);
    Task<SurveyModel> CreateSurveyAsync(SaveSurveyCommand command, CancellationToken token);
    Task<SurveyModel?> UpdateSurveyAsync(Guid id, SaveSurveyCommand command, CancellationToken token);
    Task<SurveyDetailModel?> GetSurveyAsync(Guid id, CancellationToken token);
    Task<SurveyDetailModel?> SaveDetailsAsync(Guid id, SaveSurveyDetailsCommand command, CancellationToken token);
    /// <summary>Adds the sales lead's expected inventory to this survey's rooms, without disturbing what is already there.</summary>
    Task<LeadInventoryIntoSurveyModel?> ImportLeadInventoryAsync(Guid id, CancellationToken token);
    Task<GeneratedSurveyLinkModel> GenerateConfirmationLinkAsync(Guid id, int validDays, CancellationToken token);
    Task<PublicSurveyModel?> GetPublicAsync(string token, CancellationToken cancellationToken);
    Task<PublicSurveyModel?> ConfirmScheduleAsync(string token, ConfirmSurveyScheduleCommand command, CancellationToken cancellationToken);
    Task<PublicSurveyModel?> ConfirmItemsAsync(string token, string? notes, CancellationToken cancellationToken);
    Task<IReadOnlyList<PublicCatalogItemModel>?> GetPublicCatalogAsync(string token, CancellationToken cancellationToken);
    Task<PublicSurveyModel?> SubmitCustomerChangesAsync(string token, SubmitCustomerChangesCommand command, CancellationToken cancellationToken);
    Task<SurveyDetailModel?> ApplyCustomerChangesAsync(Guid id, CancellationToken token);
    Task<SurveyDetailModel?> DismissCustomerChangesAsync(Guid id, CancellationToken token);
}
