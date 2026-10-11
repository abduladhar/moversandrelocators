using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Movers.DAL;
using Movers.DAL.Persistence;
using Movers.Services.Security;
using Movers.Services.Tenancy;
namespace Movers.Api.Tests;

public sealed class ProviderSchemaTests
{
    [Theory]
    [InlineData("SqlServer", "Server=localhost;Database=unused;Integrated Security=true;TrustServerCertificate=true")]
    [InlineData("PostgreSql", "Host=localhost;Database=unused;Username=unused")]
    public void Full_schema_is_generated_for_each_provider(string provider, string connection)
    {
        var services = new ServiceCollection();
        services.AddLogging(); services.AddScoped<ITenantContext, TenantContext>();
        services.AddScoped<IUserContext, Anonymous>(); services.AddMoversDataAccess(provider, connection);
        using var container = services.BuildServiceProvider();
        using var scope = container.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MoversDbContext>();
        var script = db.Database.GenerateCreateScript();
        foreach (var table in new[] { "LabourEntries", "TransportTrips", "TripAllocations", "JournalEntries", "JournalLines", "PackingConfirmations", "PackageHandovers", "ShipmentClaims", "SavedReports", "PackingJobs", "PackingJobCrew", "DeliveryJobs", "DeliveryJobCrew", "DeliveryNotes", "DeliveryNoteLinks", "DeliveryItems", "DeliveryJobTransactions", "DeliveryJobTimeEvents", "PackingJobBoxes", "PackingJobBoxItems", "PackingJobMaterials", "PackingJobTransactions" })
            Assert.Contains(table, script);
        Assert.Contains("FOREIGN KEY", script);
        Assert.Contains("UNIQUE", script);
        var output = Environment.GetEnvironmentVariable("MOVERS_SCHEMA_OUTPUT");
        if (!string.IsNullOrWhiteSpace(output))
        {
            Directory.CreateDirectory(output);
            File.WriteAllText(Path.Combine(output, provider.ToLowerInvariant() + "-create.sql"), script);
        }
    }
    private sealed class Anonymous : IUserContext
    {
        public Guid? UserId => null; public string Email => ""; public string? IpAddress => null;
        public bool IsAuthenticated => false; public bool IsSystemAdmin => false; public Guid? EmployeeId => null;
        public bool HasPermission(string permission) => false;
    }
}
