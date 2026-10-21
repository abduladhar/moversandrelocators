using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Tenants;
using Movers.Services.Tenants;
using Movers.DAL.Common;
using Movers.Services.Common;

namespace Movers.DAL.Tenants;

public sealed class TenantRepository(MoversDbContext db) : ITenantRepository
{
    public async Task<IReadOnlyList<Tenant>> ListAsync(CancellationToken cancellationToken) =>
        await db.Tenants.AsNoTracking().OrderByDescending(x => x.SerialNo).ToListAsync(cancellationToken);

    private static readonly SortMap<Tenant> TenantSorts = new SortMap<Tenant>("serialNo", true, x => x.SerialNo)
        .Add("serialNo", x => x.SerialNo).Add("name", x => x.Name).Add("contactEmail", x => x.ContactEmail).Add("isActive", x => x.IsActive);
    public async Task<(IReadOnlyList<Tenant> Items, int Total)> SearchAsync(TenantListFilter filter, ListQuery list, CancellationToken t)
    {
        var q = db.Tenants.AsNoTracking();
        if (filter.IsActive is { } active) q = q.Where(x => x.IsActive == active);
        q = q.Search(list, w => x => x.Name.ToLower().Contains(w) || (x.ContactEmail ?? "").ToLower().Contains(w) || (x.Phone ?? "").ToLower().Contains(w) || (x.Address ?? "").ToLower().Contains(w));
        var (items, total) = await q.Sort(list, TenantSorts).PageAsync(list, t);
        return (items, total);
    }
    public async Task<TenantListSummary> SummaryAsync(CancellationToken t)
    {
        var total = await db.Tenants.CountAsync(t); var active = await db.Tenants.CountAsync(x => x.IsActive, t);
        return new(total, active, total - active);
    }

    public Task<Tenant?> GetAsync(Guid id, bool trackChanges, CancellationToken cancellationToken)
    {
        var query = trackChanges ? db.Tenants : db.Tenants.AsNoTracking();
        return query.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
    }

    public Task<Tenant?> FindActiveAsync(Guid? id, string? slug, CancellationToken cancellationToken)
    {
        if (id.HasValue)
            return db.Tenants.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.IsActive, cancellationToken);
        if (slug is not null)
            return db.Tenants.AsNoTracking().SingleOrDefaultAsync(x => x.Slug == slug && x.IsActive, cancellationToken);
        return Task.FromResult<Tenant?>(null);
    }

    public Task<bool> SlugExistsAsync(string slug, Guid? excludingId, CancellationToken cancellationToken) =>
        db.Tenants.AnyAsync(x => x.Slug == slug && (!excludingId.HasValue || x.Id != excludingId), cancellationToken);

    public void Add(Tenant tenant) => db.Tenants.Add(tenant);
    public async Task SaveChangesAsync(CancellationToken cancellationToken) => await db.SaveChangesAsync(cancellationToken);
}
