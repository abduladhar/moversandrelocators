using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Operations;
using Movers.Domain.Tenants;
using Movers.Services.Sales;

namespace Movers.DAL.Sales;

public sealed class WebLeadFormRepository(MoversDbContext db) : IWebLeadFormRepository
{
    public async Task<(Tenant Tenant, BillingRecord Form)?> FindAsync(string kind, string number, CancellationToken t)
    {
        var form = await db.Set<BillingRecord>().IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(x => x.Kind == kind && x.Number == number, t);
        if (form is null) return null;
        var tenant = await db.Tenants.AsNoTracking().SingleOrDefaultAsync(x => x.Id == form.TenantId && x.IsActive, t);
        return tenant is null ? null : (tenant, form);
    }
}
