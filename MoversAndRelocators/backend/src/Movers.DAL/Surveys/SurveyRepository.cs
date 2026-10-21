using Microsoft.EntityFrameworkCore;
using Movers.DAL.Common;
using Movers.DAL.Persistence;
using Movers.Domain.Configuration;
using Movers.Domain.Employees;
using Movers.Domain.Sales;
using Movers.Domain.Surveys;
using Movers.Services.Common;
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
    // Sorts named after the survey register's sort fields; the employee name comes from a subquery (so not static).
    private SortMap<Survey> SurveySorts => new SortMap<Survey>("serialNo", true, x => x.SerialNo)
        .Add("serialNo", x => x.SerialNo).Add("scheduledAtUtc", x => x.ScheduledAtUtc)
        .Add("assignedEmployeeName", x => db.Employees.Where(e => e.Id == x.AssignedEmployeeId).Select(e => e.FirstName + " " + e.LastName).FirstOrDefault());
    public async Task<(IReadOnlyList<Survey> Items, int Total)> SearchSurveysAsync(SurveyListFilter filter, ListQuery list, IReadOnlyCollection<Guid>? onlyIds, CancellationToken t)
    {
        var q = db.Surveys.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(filter.Status)) q = q.Where(x => x.Status == filter.Status);
        if (onlyIds is not null) q = q.Where(x => onlyIds.Contains(x.Id));
        q = q.Search(list, w => x => x.SurveyNumber.ToLower().Contains(w) || x.CustomerName.ToLower().Contains(w) || x.Address.ToLower().Contains(w)
            || db.Employees.Any(e => e.Id == x.AssignedEmployeeId && (e.FirstName + " " + e.LastName).ToLower().Contains(w)));
        var (items, total) = await q.Sort(list, SurveySorts).PageAsync(list, t);
        return (items, total);
    }
    public async Task<SurveyListSummary> SurveySummaryAsync(CancellationToken t)
    {
        var q = db.Surveys.AsNoTracking();
        return new(await q.CountAsync(t), await q.CountAsync(x => x.ScheduleConfirmedAtUtc == null, t), await q.CountAsync(x => x.Status == SurveyStatuses.InProgress, t), await q.CountAsync(x => x.Status == SurveyStatuses.Completed, t));
    }
    private static readonly SortMap<HouseholdItem> ItemSorts = new SortMap<HouseholdItem>("serialNo", true, x => x.SerialNo)
        .Add("serialNo", x => x.SerialNo).Add("name", x => x.Name).Add("code", x => x.Code).Add("volumeCbm", x => (double)x.VolumeCbm);
    private static readonly SortMap<PackingMaterial> MaterialSorts = new SortMap<PackingMaterial>("serialNo", true, x => x.SerialNo)
        .Add("serialNo", x => x.SerialNo).Add("name", x => x.Name).Add("code", x => x.Code).Add("currentUnitCost", x => (double)x.CurrentUnitCost);
    private static readonly SortMap<BoxType> BoxSorts = new SortMap<BoxType>("serialNo", true, x => x.SerialNo)
        .Add("serialNo", x => x.SerialNo).Add("name", x => x.Name).Add("code", x => x.Code).Add("capacityCbm", x => (double)x.CapacityCbm);
    public async Task<(IReadOnlyList<HouseholdItem> Items, int Total)> SearchItemsAsync(bool? active, ListQuery list, CancellationToken t)
    {
        var q = db.HouseholdItems.AsNoTracking().Where(x => !active.HasValue || x.IsActive == active);
        q = q.Search(list, w => x => x.Code.ToLower().Contains(w) || x.Name.ToLower().Contains(w) || (x.Description ?? "").ToLower().Contains(w));
        var (items, total) = await q.Sort(list, ItemSorts).PageAsync(list, t);
        return (items, total);
    }
    public async Task<(IReadOnlyList<PackingMaterial> Items, int Total)> SearchMaterialsAsync(bool? active, ListQuery list, CancellationToken t)
    {
        var q = db.PackingMaterials.AsNoTracking().Where(x => !active.HasValue || x.IsActive == active);
        q = q.Search(list, w => x => x.Code.ToLower().Contains(w) || x.Name.ToLower().Contains(w) || (x.Description ?? "").ToLower().Contains(w));
        var (items, total) = await q.Sort(list, MaterialSorts).PageAsync(list, t);
        return (items, total);
    }
    public async Task<(IReadOnlyList<BoxType> Items, int Total)> SearchBoxTypesAsync(bool? active, ListQuery list, CancellationToken t)
    {
        var q = db.BoxTypes.AsNoTracking().Where(x => !active.HasValue || x.IsActive == active);
        q = q.Search(list, w => x => x.Code.ToLower().Contains(w) || x.Name.ToLower().Contains(w) || (x.Description ?? "").ToLower().Contains(w));
        var (items, total) = await q.Sort(list, BoxSorts).PageAsync(list, t);
        return (items, total);
    }
    public async Task<SurveyMasterCounts> MasterCountsAsync(CancellationToken t) => new(await db.HouseholdItems.CountAsync(t), await db.PackingMaterials.CountAsync(t), await db.BoxTypes.CountAsync(t));
    public async Task<(IReadOnlyList<BoxTypeMaterial> Recipes, IReadOnlyList<PackingMaterial> Materials)> ListBoxRecipesAsync(IReadOnlyCollection<Guid> boxTypeIds, CancellationToken t)
    {
        var recipes = await db.BoxTypeMaterials.AsNoTracking().Where(x => boxTypeIds.Contains(x.BoxTypeId)).ToListAsync(t);
        var materialIds = recipes.Select(x => x.MaterialId).Distinct().ToList();
        return (recipes, await db.PackingMaterials.AsNoTracking().Where(x => materialIds.Contains(x.Id)).ToListAsync(t));
    }
    public async Task<IReadOnlyList<Employee>> ListEmployeesAsync(IReadOnlyCollection<Guid> ids, CancellationToken t) => await db.Employees.AsNoTracking().Where(x => ids.Contains(x.Id)).ToListAsync(t);
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
