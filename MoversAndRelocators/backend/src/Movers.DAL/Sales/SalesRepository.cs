using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Employees;
using Movers.Domain.Sales;
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
