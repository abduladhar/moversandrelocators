using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Configuration;
using Movers.Domain.Employees;
using Movers.Domain.Sales;
using Movers.Domain.Surveys;
using Movers.Services.Surveys;

namespace Movers.DAL.Surveys;

public sealed class SurveyRepository(MoversDbContext db) : ISurveyRepository
{
    public async Task<IReadOnlyList<HouseholdItem>> ListItemsAsync(CancellationToken t) => await db.HouseholdItems.AsNoTracking().OrderByDescending(x => x.SerialNo).ToListAsync(t);
    public Task<HouseholdItem?> GetItemAsync(Guid id, bool track, CancellationToken t) => (track ? db.HouseholdItems : db.HouseholdItems.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, t);
    public Task<bool> ItemCodeExistsAsync(string code, Guid? excludingId, CancellationToken t) => db.HouseholdItems.AnyAsync(x => x.Code == code && (!excludingId.HasValue || x.Id != excludingId), t);
    public void AddItem(HouseholdItem x) => db.HouseholdItems.Add(x);
    public async Task<IReadOnlyList<PackingMaterial>> ListMaterialsAsync(CancellationToken t) => await db.PackingMaterials.AsNoTracking().OrderByDescending(x => x.SerialNo).ToListAsync(t);
    public Task<PackingMaterial?> GetMaterialAsync(Guid id, bool track, CancellationToken t) => (track ? db.PackingMaterials : db.PackingMaterials.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, t);
    public Task<bool> MaterialCodeExistsAsync(string code, Guid? excludingId, CancellationToken t) => db.PackingMaterials.AnyAsync(x => x.Code == code && (!excludingId.HasValue || x.Id != excludingId), t);
    public void AddMaterial(PackingMaterial x) => db.PackingMaterials.Add(x);
    public async Task<IReadOnlyList<BoxType>> ListBoxTypesAsync(CancellationToken t) => await db.BoxTypes.AsNoTracking().OrderByDescending(x => x.SerialNo).ToListAsync(t);
    public Task<BoxType?> GetBoxTypeAsync(Guid id, bool track, CancellationToken t) => (track ? db.BoxTypes : db.BoxTypes.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, t);
    public Task<bool> BoxCodeExistsAsync(string code, Guid? excludingId, CancellationToken t) => db.BoxTypes.AnyAsync(x => x.Code == code && (!excludingId.HasValue || x.Id != excludingId), t);
    public void AddBoxType(BoxType x) => db.BoxTypes.Add(x);
    public async Task<IReadOnlyList<BoxTypeMaterial>> ListBoxMaterialsAsync(CancellationToken t) => await db.BoxTypeMaterials.AsNoTracking().ToListAsync(t);
    public async Task<IReadOnlyList<BoxTypeMaterial>> ListBoxMaterialsAsync(Guid boxTypeId, CancellationToken t) => await db.BoxTypeMaterials.Where(x => x.BoxTypeId == boxTypeId).ToListAsync(t);
    public void AddBoxMaterial(BoxTypeMaterial x) => db.BoxTypeMaterials.Add(x);
    public void RemoveBoxMaterials(IEnumerable<BoxTypeMaterial> x) => db.BoxTypeMaterials.RemoveRange(x);
    public async Task<IReadOnlyList<Survey>> ListSurveysAsync(CancellationToken t) => await db.Surveys.AsNoTracking().OrderByDescending(x => x.SerialNo).ToListAsync(t);
    public Task<Survey?> GetSurveyAsync(Guid id, bool track, CancellationToken t) => (track ? db.Surveys : db.Surveys.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, t);
    public Task<bool> SurveyNumberExistsAsync(string number, Guid? excludingId, CancellationToken t) => db.Surveys.AnyAsync(x => x.SurveyNumber == number && (!excludingId.HasValue || x.Id != excludingId), t);
    public void AddSurvey(Survey x) => db.Surveys.Add(x);
    public Task<Employee?> GetEmployeeAsync(Guid id, CancellationToken t) => db.Employees.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, t);
    public async Task<IReadOnlyList<Employee>> ListEmployeesAsync(CancellationToken t) => await db.Employees.AsNoTracking().ToListAsync(t);
    public Task<SalesLead?> GetLeadAsync(Guid id, CancellationToken t) => db.SalesLeads.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, t);
    public async Task<IReadOnlyList<SurveyRoom>> ListRoomsAsync(Guid id, CancellationToken t) => await db.SurveyRooms.AsNoTracking().Where(x => x.SurveyId == id).OrderBy(x => x.DisplayOrder).ThenBy(x => x.SerialNo).ToListAsync(t);
    public async Task<IReadOnlyList<SurveyItem>> ListSurveyItemsAsync(Guid id, CancellationToken t) => await db.SurveyItems.AsNoTracking().Where(x => x.SurveyId == id).OrderBy(x => x.SerialNo).ToListAsync(t);
    public async Task<IReadOnlyList<SurveyExtraMaterial>> ListExtraMaterialsAsync(Guid id, CancellationToken t) => await db.SurveyExtraMaterials.AsNoTracking().Where(x => x.SurveyId == id).ToListAsync(t);
    public void AddRooms(IEnumerable<SurveyRoom> x) => db.SurveyRooms.AddRange(x);
    public void AddSurveyItems(IEnumerable<SurveyItem> x) => db.SurveyItems.AddRange(x);
    public void AddExtraMaterials(IEnumerable<SurveyExtraMaterial> x) => db.SurveyExtraMaterials.AddRange(x);
    public void RemoveRooms(IEnumerable<SurveyRoom> x) => db.SurveyRooms.RemoveRange(x);
    public void RemoveSurveyItems(IEnumerable<SurveyItem> x) => db.SurveyItems.RemoveRange(x);
    public void RemoveExtraMaterials(IEnumerable<SurveyExtraMaterial> x) => db.SurveyExtraMaterials.RemoveRange(x);
    public async Task<PublicSurveyResolution?> ResolvePublicAsync(string hash, CancellationToken t)
    {
        var survey = await db.Surveys.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.ConfirmationTokenHash == hash, t);
        if (survey is null) return null;
        var tenant = await db.Tenants.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == survey.TenantId && x.IsActive, t);
        return tenant is null ? null : new(survey, tenant);
    }
    public async Task<IReadOnlyList<SurveyAttachment>> ListAttachmentsAsync(Guid surveyId, CancellationToken t) => await db.SurveyAttachments.AsNoTracking().Where(x => x.SurveyId == surveyId && x.IsUploaded).OrderByDescending(x => x.SerialNo).ToListAsync(t);
    public Task<SurveyAttachment?> GetAttachmentAsync(Guid id, bool track, CancellationToken t) => (track ? db.SurveyAttachments : db.SurveyAttachments.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, t);
    public void AddAttachment(SurveyAttachment x) => db.SurveyAttachments.Add(x);
    public void RemoveAttachment(SurveyAttachment x) => db.SurveyAttachments.Remove(x);
    public Task<TenantAwsConfiguration?> GetAwsAsync(CancellationToken t) => db.TenantAwsConfigurations.AsNoTracking().SingleOrDefaultAsync(t);
    public async Task<IReadOnlyList<SurveyTimeEvent>> ListTimeEventsAsync(Guid surveyId, CancellationToken t) => (await db.SurveyTimeEvents.AsNoTracking().Where(x => x.SurveyId == surveyId).OrderBy(x => x.SerialNo).ToListAsync(t)).OrderBy(x => x.OccurredAtUtc).ToList();
    public void AddTimeEvent(SurveyTimeEvent x) => db.SurveyTimeEvents.Add(x);
    public async Task<IReadOnlyList<Movers.Domain.Sales.SalesLeadInventoryItem>> ListLeadInventoryAsync(Guid leadId, CancellationToken t) => await db.Set<Movers.Domain.Sales.SalesLeadInventoryItem>().AsNoTracking().Where(x => x.SalesLeadId == leadId).OrderBy(x => x.SerialNo).ToListAsync(t);
    public async Task<IReadOnlyList<SurveyExpense>> ListExpensesAsync(Guid surveyId, CancellationToken t) => (await db.SurveyExpenses.AsNoTracking().Where(x => x.SurveyId == surveyId).OrderBy(x => x.SerialNo).ToListAsync(t)).OrderBy(x => x.IncurredAtUtc).ToList();
    public Task<SurveyExpense?> GetExpenseAsync(Guid id, bool track, CancellationToken t) => (track ? db.SurveyExpenses : db.SurveyExpenses.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, t);
    public void AddExpense(SurveyExpense x) => db.SurveyExpenses.Add(x);
    public void RemoveExpense(SurveyExpense x) => db.SurveyExpenses.Remove(x);
    public async Task SaveChangesAsync(CancellationToken t) => await db.SaveChangesAsync(t);
}
