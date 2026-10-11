using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Tenants;
using Movers.Services.Security;
using Movers.Services.Tenancy;
namespace Movers.Api.Tests;

public sealed class AtomicAuditTests
{
    [Fact]
    public async Task Failed_mandatory_audit_rolls_back_the_business_write()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<MoversDbContext>().UseSqlite(connection).Options;
        await using var db = new MoversDbContext(options, new TenantContext(), new MissingActor());
        await db.Database.EnsureCreatedAsync();
        db.Tenants.Add(new Tenant("Rollback company", "rollback", null, null, null));
        // The business row is valid, but the mandatory audit references a nonexistent actor.
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        db.ChangeTracker.Clear();
        Assert.Equal(0, await db.Tenants.CountAsync());
        Assert.Equal(0, await db.AuditLogs.CountAsync());
    }
    private sealed class MissingActor : IUserContext
    {
        public Guid? UserId => Guid.Parse("15151515-1515-1515-1515-151515151515");
        public string Email => "missing@example.test";
        public string? IpAddress => null;
        public bool IsAuthenticated => true;
        public bool IsSystemAdmin => true;
        public Guid? EmployeeId => null;
        public bool HasPermission(string permission) => true;
    }
}
