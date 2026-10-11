using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Tenants;
using Movers.Services.Tenants;

namespace Movers.DAL.Tenants;

public sealed class TenantRepository(MoversDbContext db) : ITenantRepository
{
    public async Task<IReadOnlyList<Tenant>> ListAsync(CancellationToken cancellationToken) =>
        await db.Tenants.AsNoTracking().OrderByDescending(x => x.SerialNo).ToListAsync(cancellationToken);

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
