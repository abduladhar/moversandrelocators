using Microsoft.EntityFrameworkCore;
using Movers.DAL.Common;
using Movers.DAL.Persistence;
using Movers.Domain.Employees;
using Movers.Domain.Packing;
using Movers.Domain.Pickups;
using Movers.Domain.Quotations;
using Movers.Domain.Sales;
using Movers.Domain.Surveys;
using Movers.Services.Common;
using Movers.Services.Packing;

namespace Movers.DAL.Packing;

public sealed class PackingRepository(MoversDbContext db) : IPackingRepository
{
    public async Task<IReadOnlyList<PackingJob>> Jobs(CancellationToken t) => await db.Set<PackingJob>().AsNoTracking().ToListAsync(t);
    private static readonly SortMap<PackingJob> JobSorts = new SortMap<PackingJob>("serialNo", true, x => x.SerialNo)
        .Add("serialNo", x => x.SerialNo).Add("scheduledAtUtc", x => x.ScheduledAtUtc).Add("customerName", x => x.CustomerName).Add("jobNumber", x => x.JobNumber).Add("status", x => x.Status);
    public async Task<(IReadOnlyList<PackingJob> Items, int Total)> SearchJobs(PackingListFilter filter, ListQuery list, IReadOnlyCollection<Guid>? onlyIds, CancellationToken t)
    {
        var q = db.Set<PackingJob>().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(filter.Status)) q = q.Where(x => x.Status == filter.Status);
        if (onlyIds is not null) q = q.Where(x => onlyIds.Contains(x.Id));
        q = q.Search(list, w => x => x.JobNumber.ToLower().Contains(w) || x.CustomerName.ToLower().Contains(w) || x.Address.ToLower().Contains(w)
            || db.Pickups.Any(p => p.Id == x.PickupId && p.PickupNumber.ToLower().Contains(w))
            || db.Quotations.Any(o => o.Id == x.QuotationId && o.QuotationNumber.ToLower().Contains(w)));
        var (items, total) = await q.Sort(list, JobSorts).PageAsync(list, t);
        return (items, total);
    }
    public Task<PackingJob?> Job(Guid id, bool track, CancellationToken t) => (track ? db.Set<PackingJob>() : db.Set<PackingJob>().AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, t);
    /// <summary>Resolves a customer link across tenants (anonymous request) together with its active tenant.</summary>
    public async Task<(PackingJobLink Link, PackingJob Job, Movers.Domain.Tenants.Tenant Tenant)?> SharedJob(string tokenHash, CancellationToken t)
    {
        var link = await db.Set<PackingJobLink>().IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.TokenHash == tokenHash, t);
        if (link is null) return null;
        var job = await db.Set<PackingJob>().IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == link.PackingJobId && x.TenantId == link.TenantId, t);
        if (job is null) return null;
        var tenant = await db.Tenants.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == job.TenantId && x.IsActive, t);
        return tenant is null ? null : (link, job, tenant);
    }
    public async Task<IReadOnlyList<PackingJobLink>> Links(Guid jobId, bool track, CancellationToken t) => await (track ? db.Set<PackingJobLink>() : db.Set<PackingJobLink>().AsNoTracking()).Where(x => x.PackingJobId == jobId).ToListAsync(t);
    public async Task<IReadOnlyList<PackingJobTimeEvent>> TimeEvents(IReadOnlyCollection<Guid> jobIds, CancellationToken t) => (await db.Set<PackingJobTimeEvent>().AsNoTracking().Where(x => jobIds.Contains(x.PackingJobId)).ToListAsync(t)).OrderBy(x => x.OccurredAtUtc).ThenBy(x => x.SerialNo).ToList();
    public async Task<IReadOnlyList<PackingJobCrew>> CrewOf(IReadOnlyCollection<Guid> jobIds, CancellationToken t) => await db.Set<PackingJobCrew>().AsNoTracking().Where(x => jobIds.Contains(x.PackingJobId)).ToListAsync(t);
    public async Task<IReadOnlyList<PackingJobCrew>> Crew(Guid jobId, CancellationToken t) => await db.Set<PackingJobCrew>().Where(x => x.PackingJobId == jobId).OrderBy(x => x.SerialNo).ToListAsync(t);
    public async Task<IReadOnlyList<PackingJobBox>> Boxes(Guid jobId, bool track, CancellationToken t) => await (track ? db.Set<PackingJobBox>() : db.Set<PackingJobBox>().AsNoTracking()).Where(x => x.PackingJobId == jobId).OrderBy(x => x.SerialNo).ToListAsync(t);
    public async Task<IReadOnlyList<PackingJobBoxItem>> BoxItems(IReadOnlyCollection<Guid> boxIds, bool track, CancellationToken t) => await (track ? db.Set<PackingJobBoxItem>() : db.Set<PackingJobBoxItem>().AsNoTracking()).Where(x => boxIds.Contains(x.PackingJobBoxId)).ToListAsync(t);
    public async Task<IReadOnlyList<PackingJobBoxMaterial>> BoxMaterials(IReadOnlyCollection<Guid> boxIds, bool track, CancellationToken t) => await (track ? db.Set<PackingJobBoxMaterial>() : db.Set<PackingJobBoxMaterial>().AsNoTracking()).Where(x => boxIds.Contains(x.PackingJobBoxId)).ToListAsync(t);
    public async Task<IReadOnlyList<PackingJobMaterial>> Materials(Guid jobId, bool track, CancellationToken t) => await (track ? db.Set<PackingJobMaterial>() : db.Set<PackingJobMaterial>().AsNoTracking()).Where(x => x.PackingJobId == jobId).ToListAsync(t);
    public async Task<IReadOnlyList<PackingJobTransaction>> Transactions(Guid jobId, CancellationToken t) => await db.Set<PackingJobTransaction>().AsNoTracking().Where(x => x.PackingJobId == jobId).OrderByDescending(x => x.SerialNo).ToListAsync(t);
    public async Task<IReadOnlyDictionary<Guid, int>> BoxCounts(CancellationToken t) => await db.Set<PackingJobBox>().GroupBy(x => x.PackingJobId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, t);
    public async Task<IReadOnlyDictionary<Guid, int>> PendingLabels(CancellationToken t) => await db.Set<PackingJobBox>().Where(x => x.LabelPrintedAtUtc == null).GroupBy(x => x.PackingJobId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, t);
    public async Task<IReadOnlyDictionary<Guid, int>> BoxCounts(IReadOnlyCollection<Guid> jobIds, CancellationToken t) => await db.Set<PackingJobBox>().Where(x => jobIds.Contains(x.PackingJobId)).GroupBy(x => x.PackingJobId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, t);
    public async Task<IReadOnlyDictionary<Guid, int>> PendingLabels(IReadOnlyCollection<Guid> jobIds, CancellationToken t) => await db.Set<PackingJobBox>().Where(x => jobIds.Contains(x.PackingJobId) && x.LabelPrintedAtUtc == null).GroupBy(x => x.PackingJobId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, t);
    public async Task<IReadOnlyList<Pickup>> PickupsById(IReadOnlyCollection<Guid> ids, CancellationToken t) => ids.Count == 0 ? [] : await db.Pickups.AsNoTracking().Where(x => ids.Contains(x.Id)).ToListAsync(t);
    public async Task<IReadOnlyList<Quotation>> QuotationsById(IReadOnlyCollection<Guid> ids, CancellationToken t) => ids.Count == 0 ? [] : await db.Quotations.AsNoTracking().Where(x => ids.Contains(x.Id)).ToListAsync(t);
    public async Task<IReadOnlyList<Employee>> ActiveEmployees(CancellationToken t) => await db.Employees.AsNoTracking().Where(x => x.IsActive).ToListAsync(t);
    public async Task<IReadOnlyList<BoxType>> ActiveBoxTypes(CancellationToken t) => await db.BoxTypes.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name).ToListAsync(t);
    public async Task<IReadOnlyList<BoxTypeMaterial>> Recipes(CancellationToken t) => await db.BoxTypeMaterials.AsNoTracking().ToListAsync(t);
    public async Task<IReadOnlyList<PackingMaterial>> ActiveMaterials(CancellationToken t) => await db.PackingMaterials.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name).ToListAsync(t);
    public async Task<IReadOnlyList<Pickup>> Pickups(CancellationToken t) => await db.Pickups.AsNoTracking().ToListAsync(t);
    public async Task<IReadOnlyList<Quotation>> Quotations(CancellationToken t) => await db.Quotations.AsNoTracking().ToListAsync(t);
    public Task<SalesLead?> Lead(Guid id, CancellationToken t) => db.Set<SalesLead>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, t);
    public async Task<IReadOnlyDictionary<Guid, string>> EmployeeNames(CancellationToken t) => (await db.Employees.AsNoTracking().ToListAsync(t)).ToDictionary(x => x.Id, x => x.FullName);
    public void Add(object entity) => db.Add(entity);
    public void Remove(object entity) => db.Remove(entity);
    public async Task Save(CancellationToken t)
    {
        try { await db.SaveChangesAsync(t); }
        catch (DbUpdateConcurrencyException) { throw new InvalidOperationException("The packing job changed. Refresh before saving."); }
    }
}
