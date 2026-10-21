using Movers.Domain.Configuration;
using Movers.Domain.Employees;
using Movers.Domain.Sales;
using Movers.Domain.Surveys;
using Movers.Domain.Tenants;

namespace Movers.Services.Surveys;

public sealed record PublicSurveyResolution(Survey Survey, Tenant Tenant);

public interface ISurveyRepository
{
    Task<IReadOnlyList<HouseholdItem>> ListItemsAsync(CancellationToken token);
    Task<HouseholdItem?> GetItemAsync(Guid id, bool track, CancellationToken token);
    Task<bool> ItemCodeExistsAsync(string code, Guid? excludingId, CancellationToken token);
    void AddItem(HouseholdItem item);
    Task<IReadOnlyList<PackingMaterial>> ListMaterialsAsync(CancellationToken token);
    Task<PackingMaterial?> GetMaterialAsync(Guid id, bool track, CancellationToken token);
    Task<bool> MaterialCodeExistsAsync(string code, Guid? excludingId, CancellationToken token);
    void AddMaterial(PackingMaterial material);
    Task<IReadOnlyList<BoxType>> ListBoxTypesAsync(CancellationToken token);
    Task<BoxType?> GetBoxTypeAsync(Guid id, bool track, CancellationToken token);
    Task<bool> BoxCodeExistsAsync(string code, Guid? excludingId, CancellationToken token);
    void AddBoxType(BoxType box);
    Task<IReadOnlyList<BoxTypeMaterial>> ListBoxMaterialsAsync(CancellationToken token);
    Task<IReadOnlyList<BoxTypeMaterial>> ListBoxMaterialsAsync(Guid boxTypeId, CancellationToken token);
    void AddBoxMaterial(BoxTypeMaterial material);
    void RemoveBoxMaterials(IEnumerable<BoxTypeMaterial> materials);
    Task<IReadOnlyList<Survey>> ListSurveysAsync(CancellationToken token);
    Task<(IReadOnlyList<Survey> Items, int Total)> SearchSurveysAsync(SurveyListFilter filter, Movers.Services.Common.ListQuery query, IReadOnlyCollection<Guid>? onlyIds, CancellationToken token);
    Task<SurveyListSummary> SurveySummaryAsync(CancellationToken token);
    Task<(IReadOnlyList<HouseholdItem> Items, int Total)> SearchItemsAsync(bool? active, Movers.Services.Common.ListQuery query, CancellationToken token);
    Task<(IReadOnlyList<PackingMaterial> Items, int Total)> SearchMaterialsAsync(bool? active, Movers.Services.Common.ListQuery query, CancellationToken token);
    Task<(IReadOnlyList<BoxType> Items, int Total)> SearchBoxTypesAsync(bool? active, Movers.Services.Common.ListQuery query, CancellationToken token);
    Task<SurveyMasterCounts> MasterCountsAsync(CancellationToken token);
    /// <summary>The recipes of these box types and the materials they use (for mapping one page of box types).</summary>
    Task<(IReadOnlyList<BoxTypeMaterial> Recipes, IReadOnlyList<PackingMaterial> Materials)> ListBoxRecipesAsync(IReadOnlyCollection<Guid> boxTypeIds, CancellationToken token);
    Task<IReadOnlyList<Employee>> ListEmployeesAsync(IReadOnlyCollection<Guid> ids, CancellationToken token);
    Task<Survey?> GetSurveyAsync(Guid id, bool track, CancellationToken token);
    Task<bool> SurveyNumberExistsAsync(string number, Guid? excludingId, CancellationToken token);
    void AddSurvey(Survey survey);
    Task<Employee?> GetEmployeeAsync(Guid id, CancellationToken token);
    Task<IReadOnlyList<Employee>> ListEmployeesAsync(CancellationToken token);
    Task<SalesLead?> GetLeadAsync(Guid id, CancellationToken token);
    Task<IReadOnlyList<SurveyRoom>> ListRoomsAsync(Guid surveyId, CancellationToken token);
    Task<IReadOnlyList<SurveyItem>> ListSurveyItemsAsync(Guid surveyId, CancellationToken token);
    Task<IReadOnlyList<SurveyExtraMaterial>> ListExtraMaterialsAsync(Guid surveyId, CancellationToken token);
    void AddRooms(IEnumerable<SurveyRoom> rooms);
    void AddSurveyItems(IEnumerable<SurveyItem> items);
    void AddExtraMaterials(IEnumerable<SurveyExtraMaterial> materials);
    void RemoveRooms(IEnumerable<SurveyRoom> rooms);
    void RemoveSurveyItems(IEnumerable<SurveyItem> items);
    void RemoveExtraMaterials(IEnumerable<SurveyExtraMaterial> materials);
    Task<PublicSurveyResolution?> ResolvePublicAsync(string tokenHash, CancellationToken token);
    Task<IReadOnlyList<SurveyAttachment>> ListAttachmentsAsync(Guid surveyId, CancellationToken token);
    Task<SurveyAttachment?> GetAttachmentAsync(Guid id, bool track, CancellationToken token);
    void AddAttachment(SurveyAttachment attachment);
    void RemoveAttachment(SurveyAttachment attachment);
    Task<TenantAwsConfiguration?> GetAwsAsync(CancellationToken token);
    Task<IReadOnlyList<SurveyTimeEvent>> ListTimeEventsAsync(Guid surveyId, CancellationToken token);
    void AddTimeEvent(SurveyTimeEvent timeEvent);
    Task<IReadOnlyList<Movers.Domain.Sales.SalesLeadInventoryItem>> ListLeadInventoryAsync(Guid leadId, CancellationToken token);
    Task<IReadOnlyList<SurveyExpense>> ListExpensesAsync(Guid surveyId, CancellationToken token);
    Task<SurveyExpense?> GetExpenseAsync(Guid id, bool track, CancellationToken token);
    void AddExpense(SurveyExpense expense);
    void RemoveExpense(SurveyExpense expense);
    Task SaveChangesAsync(CancellationToken token);
}
