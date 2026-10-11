using Microsoft.Extensions.DependencyInjection;
using Movers.DAL;
using Movers.DAL.Persistence;
using Movers.Services.Tenancy;

namespace Movers.Api.Tests;

public sealed class DatabaseProviderTests
{
    [Theory]
    [InlineData("SqlServer", "Server=localhost;Database=Movers;User Id=sa;Password=Test123!;TrustServerCertificate=True", "Microsoft.EntityFrameworkCore.SqlServer")]
    [InlineData("PostgreSql", "Host=localhost;Database=movers;Username=postgres;Password=test", "Npgsql.EntityFrameworkCore.PostgreSQL")]
    public void Registration_selects_requested_ef_provider(string provider, string connectionString, string expectedProvider)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddScoped<ITenantContext, TenantContext>();
        services.AddScoped<Movers.Services.Security.IUserContext, TestUserContext>();
        services.AddMoversDataAccess(provider, connectionString);

        using var serviceProvider = services.BuildServiceProvider();
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MoversDbContext>();

        Assert.Equal(expectedProvider, db.Database.ProviderName);
    }

    private sealed class TestUserContext : Movers.Services.Security.IUserContext
    {
        public Guid? UserId => null;
        public string Email => string.Empty;
        public string? IpAddress => null;
        public bool IsAuthenticated => false;
        public bool IsSystemAdmin => false;
        public Guid? EmployeeId => null;
        public bool HasPermission(string permission) => false;
    }
}
