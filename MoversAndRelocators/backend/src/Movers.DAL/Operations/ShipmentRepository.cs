using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Operations;
using Movers.Domain.Tenants;
using Movers.Services.Operations;
namespace Movers.DAL.Operations;
public sealed class ShipmentRepository(MoversDbContext db) : IShipmentRepository
{
    public Task<PackingConfirmation?> Confirmation(Guid pickupId, CancellationToken ct) => db.Set<PackingConfirmation>().SingleOrDefaultAsync(x => x.PickupId == pickupId, ct);
    public async Task<(PackingConfirmation Confirmation, Tenant Tenant)?> Resolve(string hash, CancellationToken ct)
    {
        var confirmation = await db.Set<PackingConfirmation>().IgnoreQueryFilters().SingleOrDefaultAsync(x => x.TokenHash == hash, ct);
        if (confirmation is null) return null;
        var tenant = await db.Tenants.SingleOrDefaultAsync(x => x.Id == confirmation.TenantId && x.IsActive, ct);
        return tenant is null ? null : (confirmation, tenant);
    }
    public async Task<IReadOnlyList<PackageHandover>> History(Guid id, CancellationToken ct) => await db.Set<PackageHandover>().Where(x => x.PickupId == id).OrderBy(x => x.SerialNo).ToListAsync(ct);
    public async Task<IReadOnlyList<ShipmentClaim>> Claims(Guid id, CancellationToken ct) => await db.Set<ShipmentClaim>().Where(x => x.PickupId == id).OrderByDescending(x => x.SerialNo).ToListAsync(ct);
    public Task<ShipmentClaim?> Claim(Guid id, CancellationToken ct) => db.Set<ShipmentClaim>().SingleOrDefaultAsync(x => x.Id == id, ct);
}
