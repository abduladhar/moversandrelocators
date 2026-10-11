using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Common;
using Movers.Domain.Employees;
using Movers.Domain.Masters;
using Movers.Domain.Pickups;
using Movers.Domain.Quotations;
using Movers.Domain.Sales;
using Movers.Domain.Surveys;
using Movers.Services.Tenants;

namespace Movers.DAL.Tenants;

// Business masters (customers, vendors, pickup lists) are keyed by kind + code; every other master by its ID.
// The company filter already hides records another company keeps to itself, so only visible records can change.
public sealed class MasterScopeRepository(MoversDbContext db) : IMasterScopeRepository
{
    private static readonly Dictionary<string, Type> Types = new()
    {
        ["employee"] = typeof(Employee), ["designation"] = typeof(Designation), ["team"] = typeof(Team),
        ["lead-status"] = typeof(LeadStatus), ["follow-up-status"] = typeof(FollowUpStatus), ["move-type"] = typeof(MoveType),
        ["household-item"] = typeof(HouseholdItem), ["packing-material"] = typeof(PackingMaterial), ["box-type"] = typeof(BoxType),
        ["charge"] = typeof(ChargeMaster), ["tax"] = typeof(TaxMaster),
        ["pickup-status"] = typeof(PickupStatus), ["vehicle"] = typeof(Vehicle), ["warehouse"] = typeof(Warehouse),
    };

    public async Task<IReadOnlyList<string>> CompanyOnlyKeysAsync(string kind, CancellationToken cancellationToken) =>
        Types.TryGetValue(kind, out var type)
            ? await (Task<List<string>>)Generic(nameof(Keys), type).Invoke(this, [cancellationToken])!
            : await db.BusinessMasters.Where(x => x.Kind == kind && x.CompanyId != null).Select(x => x.Code).ToListAsync(cancellationToken);

    public async Task<bool> SetAsync(string kind, string key, Guid? companyId, CancellationToken cancellationToken)
    {
        TenantOwnedEntity? record;
        if (Types.TryGetValue(kind, out var type))
        {
            if (!Guid.TryParse(key, out var id)) return false;
            record = await (Task<TenantOwnedEntity?>)Generic(nameof(Find), type).Invoke(this, [id, cancellationToken])!;
        }
        // Built-in pickup entries that were never saved have no row yet: they are shared until edited and saved.
        else record = await db.BusinessMasters.SingleOrDefaultAsync(x => x.Kind == kind && x.Code == key, cancellationToken);
        if (record is null) return false;
        record.SetCompanyScope(companyId);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private System.Reflection.MethodInfo Generic(string name, Type type) =>
        typeof(MasterScopeRepository).GetMethod(name, System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)!.MakeGenericMethod(type);

    private Task<List<string>> Keys<T>(CancellationToken cancellationToken) where T : TenantOwnedEntity =>
        db.Set<T>().Where(x => x.CompanyId != null).Select(x => x.Id.ToString()).ToListAsync(cancellationToken);

    private async Task<TenantOwnedEntity?> Find<T>(Guid id, CancellationToken cancellationToken) where T : TenantOwnedEntity =>
        await db.Set<T>().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
}
