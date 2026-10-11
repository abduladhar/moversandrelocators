using Movers.Domain.Tenants;

namespace Movers.Api.Tests;

public sealed class TenantTests
{
    [Fact]
    public void Constructor_normalizes_values_and_activates_tenant()
    {
        var tenant = new Tenant("  Northstar Movers  ", " NorthStar-Movers ", " ops@test.com ", null, " Bengaluru ");

        Assert.Equal("Northstar Movers", tenant.Name);
        Assert.Equal("northstar-movers", tenant.Slug);
        Assert.Equal("ops@test.com", tenant.ContactEmail);
        Assert.Equal("Bengaluru", tenant.Address);
        Assert.True(tenant.IsActive);
    }

    [Fact]
    public void SetActive_changes_status_and_update_timestamp()
    {
        var tenant = new Tenant("Northstar", "northstar", null, null, null);
        var originalUpdate = tenant.UpdatedAtUtc;

        tenant.SetActive(false);

        Assert.False(tenant.IsActive);
        Assert.True(tenant.UpdatedAtUtc >= originalUpdate);
    }
}
