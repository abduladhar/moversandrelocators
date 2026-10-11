using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Configuration;
using Movers.Domain.Employees;
using Movers.Domain.Operations;
using Movers.Domain.Pickups;
using Movers.Domain.Quotations;
using Movers.Domain.Sales;
using Movers.Domain.Surveys;
using Movers.Services.Pickups;

namespace Movers.DAL.Pickups;

public sealed class PickupWorkRepository(MoversDbContext db) : IPickupWorkRepository
{
    public Task<SalesLead?> LeadAsync(Guid id, CancellationToken t) => db.SalesLeads.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, t);
    public Task<Employee?> EmployeeAsync(Guid id, CancellationToken t) => db.Employees.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, t);
    public async Task<IReadOnlyList<Employee>> EmployeesAsync(CancellationToken t) => await db.Employees.AsNoTracking().ToListAsync(t);
    public async Task<IReadOnlyList<BoxTypeMaterial>> RecipeAsync(Guid boxTypeId, CancellationToken t) => await db.BoxTypeMaterials.AsNoTracking().Where(x => x.BoxTypeId == boxTypeId).ToListAsync(t);
    public async Task<IReadOnlyList<QuotationItem>> QuotationItemsAsync(Guid quotationId, CancellationToken t) => await db.QuotationItems.AsNoTracking().Where(x => x.QuotationId == quotationId).OrderBy(x => x.SerialNo).ToListAsync(t);
    public async Task<Guid?> LatestSurveyIdForLeadAsync(Guid salesLeadId, CancellationToken t) =>
        await db.Surveys.AsNoTracking().Where(x => x.SalesLeadId == salesLeadId).OrderByDescending(x => x.SerialNo).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(t);
    public async Task<IReadOnlyList<(string RoomName, Guid HouseholdItemId, string ItemName, int Quantity)>> SurveyInventoryAsync(Guid surveyId, CancellationToken t)
    {
        var rows = await (from item in db.SurveyItems.AsNoTracking().Where(x => x.SurveyId == surveyId)
                          join room in db.SurveyRooms.AsNoTracking() on item.RoomId equals room.Id
                          join master in db.HouseholdItems.AsNoTracking() on item.HouseholdItemId equals master.Id
                          orderby room.DisplayOrder, item.SerialNo
                          select new { room.Name, item.HouseholdItemId, ItemName = master.Name, item.Quantity }).ToListAsync(t);
        return rows.Select(x => (x.Name, x.HouseholdItemId, x.ItemName, x.Quantity)).ToList();
    }

    // Ordered by insertion in SQL (SQLite cannot sort DateTimeOffset), then by time in memory.
    public async Task<IReadOnlyList<PickupTimeEvent>> TimeEventsAsync(Guid pickupId, CancellationToken t) => (await db.Set<PickupTimeEvent>().AsNoTracking().Where(x => x.PickupId == pickupId).OrderBy(x => x.SerialNo).ToListAsync(t)).OrderBy(x => x.OccurredAtUtc).ToList();
    public async Task<IReadOnlyList<PickupExpense>> ExpensesAsync(Guid pickupId, CancellationToken t) => (await db.Set<PickupExpense>().AsNoTracking().Where(x => x.PickupId == pickupId).OrderBy(x => x.SerialNo).ToListAsync(t)).OrderBy(x => x.IncurredAtUtc).ToList();
    public Task<PickupExpense?> ExpenseAsync(Guid id, bool track, CancellationToken t) => (track ? db.Set<PickupExpense>() : db.Set<PickupExpense>().AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, t);
    public async Task<IReadOnlyList<PickupAttachment>> AttachmentsAsync(Guid pickupId, CancellationToken t) => await db.Set<PickupAttachment>().AsNoTracking().Where(x => x.PickupId == pickupId && x.IsUploaded).OrderByDescending(x => x.SerialNo).ToListAsync(t);
    public Task<PickupAttachment?> AttachmentAsync(Guid id, bool track, CancellationToken t) => (track ? db.Set<PickupAttachment>() : db.Set<PickupAttachment>().AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, t);
    public async Task<IReadOnlyList<PickupSignoff>> SignoffsAsync(Guid pickupId, CancellationToken t) => await db.Set<PickupSignoff>().AsNoTracking().Where(x => x.PickupId == pickupId).OrderBy(x => x.SerialNo).ToListAsync(t);
    public async Task<IReadOnlyList<PackageHandover>> HandoversAsync(Guid pickupId, CancellationToken t) => await db.Set<PackageHandover>().AsNoTracking().Where(x => x.PickupId == pickupId).OrderBy(x => x.SerialNo).ToListAsync(t);
    public async Task<IReadOnlyList<Warehouse>> WarehousesAsync(CancellationToken t) => await db.Set<Warehouse>().AsNoTracking().OrderBy(x => x.Name).ToListAsync(t);
    public Task<Warehouse?> WarehouseAsync(Guid id, bool track, CancellationToken t) => (track ? db.Set<Warehouse>() : db.Set<Warehouse>().AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, t);
    public Task<bool> WarehouseCodeExistsAsync(string code, Guid? excludingId, CancellationToken t) => db.Set<Warehouse>().AnyAsync(x => x.Code == code && (!excludingId.HasValue || x.Id != excludingId), t);
    public Task<TenantAwsConfiguration?> AwsAsync(CancellationToken t) => db.TenantAwsConfigurations.AsNoTracking().SingleOrDefaultAsync(t);

    public void Add(object entity) => db.Add(entity);
    public void Remove(object entity) => db.Remove(entity);
}
