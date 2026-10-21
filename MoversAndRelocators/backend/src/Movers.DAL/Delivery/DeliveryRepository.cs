using Microsoft.EntityFrameworkCore;
using Movers.DAL.Common;
using Movers.DAL.Persistence;
using Movers.Domain.Delivery;
using Movers.Domain.Employees;
using Movers.Domain.Pickups;
using Movers.Services.Common;
using Movers.Services.Delivery;

namespace Movers.DAL.Delivery;

public sealed class DeliveryRepository(MoversDbContext db) : IDeliveryRepository
{
    public async Task<IReadOnlyList<DeliveryJob>> Jobs(CancellationToken t) => await db.Set<DeliveryJob>().AsNoTracking().ToListAsync(t);
    private static readonly SortMap<DeliveryJob> JobSorts = new SortMap<DeliveryJob>("serialNo", true, x => x.SerialNo)
        .Add("serialNo", x => x.SerialNo).Add("scheduledAtUtc", x => x.ScheduledAtUtc).Add("deliveryNumber", x => x.DeliveryNumber).Add("status", x => x.Status);
    public async Task<(IReadOnlyList<DeliveryJob> Items, int Total)> SearchJobs(DeliveryListFilter filter, ListQuery list, IReadOnlyCollection<Guid>? onlyIds, CancellationToken t)
    {
        var q = db.Set<DeliveryJob>().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(filter.Status)) q = q.Where(x => x.Status == filter.Status);
        if (onlyIds is not null) q = q.Where(x => onlyIds.Contains(x.Id));
        // Customers are the delivery notes' customer names (as the register shows them).
        q = q.Search(list, w => x => x.DeliveryNumber.ToLower().Contains(w)
            || db.Set<DeliveryNote>().Any(n => n.DeliveryJobId == x.Id && n.CustomerName.ToLower().Contains(w))
            || db.Vehicles.Any(v => v.Id == x.VehicleId && (v.RegistrationNumber.ToLower().Contains(w) || v.Name.ToLower().Contains(w)))
            || db.Employees.Any(e => e.Id == x.DriverEmployeeId && (e.FirstName + " " + e.LastName).ToLower().Contains(w)));
        var (items, total) = await q.Sort(list, JobSorts).PageAsync(list, t);
        return (items, total);
    }
    public async Task<IReadOnlyList<DeliveryItem>> ItemsOf(IReadOnlyCollection<Guid> jobIds, CancellationToken t) => jobIds.Count == 0 ? [] : await db.Set<DeliveryItem>().AsNoTracking().Where(x => jobIds.Contains(x.DeliveryJobId)).ToListAsync(t);
    public async Task<IReadOnlyList<DeliveryNoteSummary>> NoteSummaries(IReadOnlyCollection<Guid> jobIds, CancellationToken t) => jobIds.Count == 0 ? [] : await db.Set<DeliveryNote>().AsNoTracking().Where(x => jobIds.Contains(x.DeliveryJobId)).Select(x => new DeliveryNoteSummary(x.DeliveryJobId, x.SerialNo, x.CustomerName, x.SignedAtUtc != null)).ToListAsync(t);
    public Task<DeliveryJob?> Job(Guid id, bool track, CancellationToken t) => Query<DeliveryJob>(track).SingleOrDefaultAsync(x => x.Id == id, t);
    public async Task<IReadOnlyList<DeliveryJobCrew>> Crew(Guid jobId, bool track, CancellationToken t) => await Query<DeliveryJobCrew>(track).Where(x => x.DeliveryJobId == jobId).ToListAsync(t);
    public async Task<IReadOnlyList<DeliveryNote>> Notes(Guid jobId, bool track, CancellationToken t) => await Query<DeliveryNote>(track).Where(x => x.DeliveryJobId == jobId).ToListAsync(t);
    public async Task<IReadOnlyList<DeliveryItem>> Items(Guid jobId, bool track, CancellationToken t) => await Query<DeliveryItem>(track).Where(x => x.DeliveryJobId == jobId).ToListAsync(t);
    public async Task<IReadOnlyList<DeliveryItem>> AllItems(CancellationToken t) => await db.Set<DeliveryItem>().AsNoTracking().ToListAsync(t);
    public async Task<IReadOnlyList<DeliveryNoteSummary>> NoteSummaries(CancellationToken t) => await db.Set<DeliveryNote>().AsNoTracking().Select(x => new DeliveryNoteSummary(x.DeliveryJobId, x.SerialNo, x.CustomerName, x.SignedAtUtc != null)).ToListAsync(t);
    public async Task<IReadOnlyList<DeliveryJobTransaction>> Transactions(Guid jobId, CancellationToken t) => await db.Set<DeliveryJobTransaction>().AsNoTracking().Where(x => x.DeliveryJobId == jobId).OrderByDescending(x => x.SerialNo).ToListAsync(t);
    public async Task<IReadOnlyList<DeliveryJobTimeEvent>> TimeEvents(Guid jobId, CancellationToken t) => (await db.Set<DeliveryJobTimeEvent>().AsNoTracking().Where(x => x.DeliveryJobId == jobId).ToListAsync(t)).OrderBy(x => x.OccurredAtUtc).ThenBy(x => x.SerialNo).ToList();
    public async Task<IReadOnlyList<Guid>> HeldBoxIds(CancellationToken t) => await HeldBoxIds(db).ToListAsync(t);
    public async Task<IReadOnlyList<DeliveryNoteLink>> Links(Guid jobId, bool track, CancellationToken t) => await Query<DeliveryNoteLink>(track).Where(x => x.DeliveryJobId == jobId).ToListAsync(t);
    /// <summary>Resolves a customer link across tenants (anonymous request) together with its note, run and active tenant.</summary>
    public async Task<(DeliveryNoteLink Link, DeliveryNote Note, DeliveryJob Job, Movers.Domain.Tenants.Tenant Tenant)?> SharedNote(string tokenHash, CancellationToken t)
    {
        var link = await db.Set<DeliveryNoteLink>().IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.TokenHash == tokenHash, t);
        if (link is null) return null;
        var note = await db.Set<DeliveryNote>().IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == link.DeliveryNoteId && x.TenantId == link.TenantId, t);
        var job = await db.Set<DeliveryJob>().IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == link.DeliveryJobId && x.TenantId == link.TenantId, t);
        if (note is null || job is null) return null;
        var tenant = await db.Tenants.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == job.TenantId && x.IsActive, t);
        return tenant is null ? null : (link, note, job, tenant);
    }
    public async Task<IReadOnlyList<Employee>> ActiveEmployees(CancellationToken t) => await db.Employees.AsNoTracking().Where(x => x.IsActive).ToListAsync(t);
    public async Task<IReadOnlyList<Vehicle>> Vehicles(CancellationToken t) => await db.Vehicles.AsNoTracking().ToListAsync(t);
    public async Task<IReadOnlyDictionary<Guid, string>> EmployeeNames(CancellationToken t) => (await db.Employees.AsNoTracking().ToListAsync(t)).ToDictionary(x => x.Id, x => x.FullName);
    public void Add(object entity) => db.Add(entity);
    public void Remove(object entity) => db.Remove(entity);
    public async Task Save(CancellationToken t)
    {
        try { await db.SaveChangesAsync(t); }
        catch (DbUpdateConcurrencyException) { throw new InvalidOperationException("The delivery changed. Refresh before saving."); }
    }

    /// <summary>
    /// Boxes a delivery holds: anything on a live run (planned or out), and packages delivered on a completed run.
    /// Packages not delivered on a completed run, and everything on a cancelled run, are released.
    /// </summary>
    internal static IQueryable<Guid> HeldBoxIds(MoversDbContext db) =>
        from i in db.Set<DeliveryItem>()
        join j in db.Set<DeliveryJob>() on i.DeliveryJobId equals j.Id
        where j.Status != DeliveryStatuses.Cancelled && (j.Status != DeliveryStatuses.Completed || i.Status == DeliveryItemStatuses.Delivered)
        select i.BoxId;

    private IQueryable<T> Query<T>(bool track) where T : class => track ? db.Set<T>() : db.Set<T>().AsNoTracking();
}
