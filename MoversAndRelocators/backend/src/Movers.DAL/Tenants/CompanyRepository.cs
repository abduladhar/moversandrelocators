using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Tenants;
using Movers.Services.Tenants;

namespace Movers.DAL.Tenants;

// Explicit tenant arguments: sign-in and the request middleware use this before the tenant filter applies.
public sealed class CompanyRepository(MoversDbContext db) : ICompanyRepository
{
    public async Task<IReadOnlyList<Company>> ListAsync(Guid tenantId, CancellationToken cancellationToken) =>
        await db.Companies.IgnoreQueryFilters().AsNoTracking().Where(x => x.TenantId == tenantId).OrderBy(x => x.SerialNo).ToListAsync(cancellationToken);

    public Task<Company?> GetAsync(Guid tenantId, Guid id, bool trackChanges, CancellationToken cancellationToken)
    {
        var query = db.Companies.IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.Id == id);
        return (trackChanges ? query : query.AsNoTracking()).SingleOrDefaultAsync(cancellationToken);
    }

    public Task<Guid?> UserCompanyAsync(Guid userId, CancellationToken cancellationToken) =>
        db.Users.AsNoTracking().Where(x => x.Id == userId).Select(x => x.CompanyId).SingleOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, int>> UserCountsAsync(Guid tenantId, CancellationToken cancellationToken) =>
        await db.Users.AsNoTracking().Where(x => x.TenantId == tenantId && x.CompanyId != null)
            .GroupBy(x => x.CompanyId!.Value).Select(x => new { x.Key, Count = x.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, cancellationToken);

    public void Add(Company company) => db.Companies.Add(company);
    public Task SaveChangesAsync(CancellationToken cancellationToken) => db.SaveChangesAsync(cancellationToken);
}
