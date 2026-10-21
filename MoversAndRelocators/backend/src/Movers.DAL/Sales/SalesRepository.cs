using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Employees;
using Movers.Domain.Sales;
using Movers.DAL.Common;
using Movers.Services.Common;
using Movers.Services.Sales;

namespace Movers.DAL.Sales;

public sealed class SalesRepository(MoversDbContext db) : ISalesRepository
{
    public async Task<IReadOnlyList<LeadStatus>> ListLeadStatusesAsync(CancellationToken t) => await db.LeadStatuses.AsNoTracking().OrderByDescending(x => x.SerialNo).ToListAsync(t);
    public Task<LeadStatus?> GetLeadStatusAsync(Guid id, bool track, CancellationToken t) => (track ? db.LeadStatuses : db.LeadStatuses.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, t);
    public Task<bool> LeadStatusCodeExistsAsync(string code, Guid? excludingId, CancellationToken t) => db.LeadStatuses.AnyAsync(x => x.Code == code && (!excludingId.HasValue || x.Id != excludingId), t);
    public void AddLeadStatus(LeadStatus item) => db.LeadStatuses.Add(item);
    public async Task<IReadOnlyList<FollowUpStatus>> ListFollowUpStatusesAsync(CancellationToken t) => await db.FollowUpStatuses.AsNoTracking().OrderByDescending(x => x.SerialNo).ToListAsync(t);
    public Task<FollowUpStatus?> GetFollowUpStatusAsync(Guid id, bool track, CancellationToken t) => (track ? db.FollowUpStatuses : db.FollowUpStatuses.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, t);
    public Task<bool> FollowUpStatusCodeExistsAsync(string code, Guid? excludingId, CancellationToken t) => db.FollowUpStatuses.AnyAsync(x => x.Code == code && (!excludingId.HasValue || x.Id != excludingId), t);
    public void AddFollowUpStatus(FollowUpStatus item) => db.FollowUpStatuses.Add(item);
    public async Task<IReadOnlyList<MoveType>> ListMoveTypesAsync(CancellationToken t) => await db.MoveTypes.AsNoTracking().OrderByDescending(x => x.SerialNo).ToListAsync(t);
    public Task<MoveType?> GetMoveTypeAsync(Guid id, bool track, CancellationToken t) => (track ? db.MoveTypes : db.MoveTypes.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, t);
    public Task<bool> MoveTypeCodeExistsAsync(string code, Guid? excludingId, CancellationToken t) => db.MoveTypes.AnyAsync(x => x.Code == code && (!excludingId.HasValue || x.Id != excludingId), t);
    public void AddMoveType(MoveType item) => db.MoveTypes.Add(item);
    public async Task<IReadOnlyList<SalesLead>> ListLeadsAsync(CancellationToken t) => await db.SalesLeads.AsNoTracking().OrderByDescending(x => x.SerialNo).ToListAsync(t);
    // Sorts that need a master's name are correlated subqueries, so the map is built per call (it uses this context).
    private SortMap<SalesLead> LeadSorts => new SortMap<SalesLead>("serialNo", true, x => x.SerialNo)
        .Add("serialNo", x => x.SerialNo).Add("customerName", x => x.CustomerName).Add("leadNumber", x => x.LeadNumber).Add("expectedMoveDate", x => x.ExpectedMoveDate)
        .Add("moveTypeName", x => db.MoveTypes.Where(m => m.Id == x.MoveTypeId).Select(m => m.Name).FirstOrDefault())
        .Add("statusName", x => db.LeadStatuses.Where(s => s.Id == x.StatusId).Select(s => s.Name).FirstOrDefault());
    public async Task<(IReadOnlyList<SalesLead> Items, int Total)> SearchLeadsAsync(SalesLeadListFilter filter, ListQuery list, IReadOnlyCollection<Guid>? onlyIds, CancellationToken t)
    {
        var q = db.SalesLeads.AsNoTracking();
        if (filter.StatusId is { } status) q = q.Where(x => x.StatusId == status);
        if (filter.MoveTypeId is { } moveType) q = q.Where(x => x.MoveTypeId == moveType);
        if (filter.EmployeeId is { } employee) q = q.Where(x => x.AssignedEmployeeId == employee);
        if (filter.Active is { } active) q = q.Where(x => x.IsActive == active);
        if (onlyIds is not null) q = q.Where(x => onlyIds.Contains(x.Id));
        q = q.Search(list, w => x => x.LeadNumber.ToLower().Contains(w) || x.CustomerName.ToLower().Contains(w) || x.Phone.ToLower().Contains(w)
            || (x.Email ?? "").ToLower().Contains(w) || x.Origin.ToLower().Contains(w) || x.Destination.ToLower().Contains(w)
            || db.MoveTypes.Any(m => m.Id == x.MoveTypeId && m.Name.ToLower().Contains(w)));
        var (items, total) = await q.Sort(list, LeadSorts).PageAsync(list, t);
        return (items, total);
    }
    private static readonly SortMap<LeadStatus> LeadStatusSorts = new SortMap<LeadStatus>("displayOrder", false, x => x.SerialNo).Add("displayOrder", x => x.DisplayOrder).Add("serialNo", x => x.SerialNo).Add("name", x => x.Name).Add("code", x => x.Code);
    private static readonly SortMap<FollowUpStatus> FollowUpStatusSorts = new SortMap<FollowUpStatus>("displayOrder", false, x => x.SerialNo).Add("displayOrder", x => x.DisplayOrder).Add("serialNo", x => x.SerialNo).Add("name", x => x.Name).Add("code", x => x.Code);
    private static readonly SortMap<MoveType> MoveTypeSorts = new SortMap<MoveType>("displayOrder", false, x => x.SerialNo).Add("displayOrder", x => x.DisplayOrder).Add("serialNo", x => x.SerialNo).Add("name", x => x.Name).Add("code", x => x.Code);
    // Summary covers the whole master (not the filtered rows): the form's next display order default.
    public async Task<(IReadOnlyList<LeadStatus> Items, int Total, SalesMasterSummary Summary)> SearchLeadStatusesAsync(bool? active, ListQuery list, CancellationToken t)
    {
        var all = db.LeadStatuses.AsNoTracking(); var summary = new SalesMasterSummary(await all.CountAsync(t), await all.MaxAsync(x => (int?)x.DisplayOrder, t) ?? 0);
        var (items, total) = await all.Where(x => active == null || x.IsActive == active).Search(list, w => x => x.Code.ToLower().Contains(w) || x.Name.ToLower().Contains(w)).Sort(list, LeadStatusSorts).PageAsync(list, t);
        return (items, total, summary);
    }
    public async Task<(IReadOnlyList<FollowUpStatus> Items, int Total, SalesMasterSummary Summary)> SearchFollowUpStatusesAsync(bool? active, ListQuery list, CancellationToken t)
    {
        var all = db.FollowUpStatuses.AsNoTracking(); var summary = new SalesMasterSummary(await all.CountAsync(t), await all.MaxAsync(x => (int?)x.DisplayOrder, t) ?? 0);
        var (items, total) = await all.Where(x => active == null || x.IsActive == active).Search(list, w => x => x.Code.ToLower().Contains(w) || x.Name.ToLower().Contains(w)).Sort(list, FollowUpStatusSorts).PageAsync(list, t);
        return (items, total, summary);
    }
    public async Task<(IReadOnlyList<MoveType> Items, int Total, SalesMasterSummary Summary)> SearchMoveTypesAsync(bool? active, ListQuery list, CancellationToken t)
    {
        var all = db.MoveTypes.AsNoTracking(); var summary = new SalesMasterSummary(await all.CountAsync(t), await all.MaxAsync(x => (int?)x.DisplayOrder, t) ?? 0);
        var (items, total) = await all.Where(x => active == null || x.IsActive == active).Search(list, w => x => x.Code.ToLower().Contains(w) || x.Name.ToLower().Contains(w) || (x.Description ?? "").ToLower().Contains(w)).Sort(list, MoveTypeSorts).PageAsync(list, t);
        return (items, total, summary);
    }
    public Task<SalesLead?> GetLeadAsync(Guid id, bool track, CancellationToken t) => (track ? db.SalesLeads : db.SalesLeads.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, t);
    public Task<bool> LeadNumberExistsAsync(string number, Guid? excludingId, CancellationToken t) => db.SalesLeads.AnyAsync(x => x.LeadNumber == number && (!excludingId.HasValue || x.Id != excludingId), t);
    public void AddLead(SalesLead lead) => db.SalesLeads.Add(lead);
    public async Task<IReadOnlyList<LeadFollowUp>> ListFollowUpsAsync(Guid leadId, CancellationToken t) => await db.LeadFollowUps.AsNoTracking().Where(x => x.SalesLeadId == leadId).OrderByDescending(x => x.SerialNo).ToListAsync(t);
    public Task<LeadFollowUp?> GetFollowUpAsync(Guid id, bool track, CancellationToken t) => (track ? db.LeadFollowUps : db.LeadFollowUps.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, t);
    public void AddFollowUp(LeadFollowUp followUp) => db.LeadFollowUps.Add(followUp);
    public Task<Employee?> GetEmployeeAsync(Guid id, CancellationToken t) => db.Employees.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, t);
    public async Task<IReadOnlyList<Employee>> ListEmployeesAsync(CancellationToken t) => await db.Employees.AsNoTracking().ToListAsync(t);
    public async Task SaveChangesAsync(CancellationToken t) => await db.SaveChangesAsync(t);
}
