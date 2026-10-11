using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Movers.DAL.Persistence;
using Movers.DAL.Auditing;
using Movers.DAL.Security;
using Movers.DAL.Employees;
using Movers.Services.Auditing;
using Movers.Services.Security;
using Movers.Services.Employees;
using Movers.Services.Sales;
using Movers.DAL.Sales;
using Movers.DAL.Tenants;
using Movers.Services.Tenants;
using Movers.DAL.Tasks;
using Movers.Services.Tasks;
using Movers.DAL.Configuration;
using Movers.Services.Aws;
using Movers.Services.OpenAi;
using Movers.Services.Surveys;
using Movers.DAL.Surveys;
using Movers.Services.Quotations;
using Movers.DAL.Quotations;
using Movers.Services.Pickups;
using Movers.DAL.Pickups;

namespace Movers.DAL;

public static class DataAccessRegistration
{
    public static IServiceCollection AddMoversDataAccess(
        this IServiceCollection services,
        string provider,
        string connectionString)
    {
        services.AddDbContext<MoversDbContext>(options => ConfigureProvider(options, provider, connectionString));
        services.AddScoped<ITenantRepository, TenantRepository>();
        services.AddScoped<ISecurityRepository, SecurityRepository>();
        services.AddScoped<IAuditRepository, AuditRepository>();
        services.AddScoped<IEmployeeRepository, EmployeeRepository>();
        services.AddScoped<ISalesRepository, SalesRepository>();
        services.AddScoped<ILeadUploadRepository, LeadUploadRepository>();
        services.AddScoped<ITodayTaskSource, SalesFollowUpTaskSource>();
        services.AddScoped<ITodayTaskSource, SurveyTaskSource>();
        services.AddScoped<ISurveyRepository, SurveyRepository>();
        services.AddScoped<IQuotationRepository, QuotationRepository>();
        services.AddScoped<IPickupRepository, PickupRepository>();
        services.AddScoped<IPickupWorkRepository, PickupWorkRepository>();
        services.AddScoped<IPickupCollectionRepository, PickupCollectionRepository>();
        services.AddScoped<Movers.Services.Crew.ICrewRepository, Movers.DAL.Crew.CrewRepository>();
        services.AddScoped<Movers.Services.Packing.IPackingRepository, Movers.DAL.Packing.PackingRepository>();
        services.AddScoped<Movers.Services.Delivery.IDeliveryRepository, Movers.DAL.Delivery.DeliveryRepository>();
        services.AddScoped<IAwsConfigurationRepository, AwsConfigurationRepository>();
        services.AddScoped<IOpenAiConfigurationRepository, OpenAiConfigurationRepository>();
        services.AddScoped<Movers.Services.Operations.IOperationsRepository, Movers.DAL.Operations.OperationsRepository>();
        services.AddScoped<Movers.Services.Operations.IShipmentRepository, Movers.DAL.Operations.ShipmentRepository>();
        services.AddScoped<Movers.Services.Masters.IBusinessMasterRepository, Movers.DAL.Masters.BusinessMasterRepository>();
        services.AddScoped<Movers.Services.Masters.BusinessMasterService>();
        services.AddScoped<Movers.Services.Operations.IWarehouseRepository, Movers.DAL.Operations.WarehouseRepository>();
        services.AddScoped<Movers.Services.Operations.WarehouseService>();
        services.AddScoped<Movers.Services.Operations.IWarehouseAttachmentRepository, Movers.DAL.Operations.WarehouseAttachmentRepository>();
        services.AddScoped<Movers.Services.Operations.WarehouseAttachmentService>();
        services.AddScoped<Movers.Services.Operations.IExpenseAttachmentRepository, Movers.DAL.Operations.ExpenseAttachmentRepository>();
        services.AddScoped<Movers.Services.Operations.ExpenseReceiptService>();
        services.AddScoped<Movers.Services.Operations.IJobRepository, Movers.DAL.Operations.JobRepository>();
        services.AddScoped<Movers.Services.Operations.JobService>();
        services.AddScoped<Movers.Services.Billing.IBillingRepository, Movers.DAL.Operations.BillingRepository>();
        services.AddScoped<Movers.Services.Billing.BillingService>(); services.AddScoped<Movers.Services.Currencies.CurrencyService>();
        services.AddScoped<SecuritySeeder>();
        services.AddScoped<Movers.Services.Numbering.INumberSequenceRepository, Movers.DAL.Numbering.NumberSequenceRepository>();
        services.AddScoped<Movers.Services.Numbering.IRecordNumbers, Movers.Services.Numbering.RecordNumbers>();
        return services;
    }

    private static void ConfigureProvider(DbContextOptionsBuilder options, string provider, string connectionString)
    {
        switch (provider.Trim().ToLowerInvariant())
        {
            case "sqlserver":
            case "mssql":
                options.UseSqlServer(connectionString, sql =>
                    sql.MigrationsAssembly(typeof(MoversDbContext).Assembly.FullName));
                break;
            case "postgresql":
            case "postgres":
            case "npgsql":
                options.UseNpgsql(connectionString, postgres =>
                    postgres.MigrationsAssembly(typeof(MoversDbContext).Assembly.FullName));
                break;
            case "sqlite":
                // Lightweight provider reserved for isolated automated tests.
                options.UseSqlite(connectionString);
                break;
            default:
                throw new InvalidOperationException(
                    $"Unsupported database provider '{provider}'. Use 'SqlServer' or 'PostgreSql'.");
        }
    }

    public static async Task InitializeMoversDatabaseAsync(
        this IServiceProvider services,
        string? systemAdminEmail,
        string? systemAdminPassword,
        bool resetSystemAdminPassword = false)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MoversDbContext>();
        await db.Database.EnsureCreatedAsync();
        await Movers.DAL.Persistence.BusinessMasterSchema.Apply(db);
        await Movers.DAL.Persistence.WarehouseReceiptSchema.Apply(db);
        await Movers.DAL.Persistence.WarehouseAttachmentSchema.Apply(db);
        await Movers.DAL.Persistence.JobSchema.Apply(db);
        await Movers.DAL.Persistence.BillingSchema.Apply(db);
        await Movers.DAL.Persistence.LeadMediaSchema.Apply(db);
        await Movers.DAL.Persistence.SurveyMediaSchema.Apply(db);
        await Movers.DAL.Persistence.SurveyTripSchema.Apply(db);
        await Movers.DAL.Persistence.PickupWorkSchema.Apply(db);
        await Movers.DAL.Persistence.PackingSchema.Apply(db);
        await Movers.DAL.Persistence.DeliverySchema.Apply(db);
        await Movers.DAL.Persistence.PickupCollectionSchema.Apply(db);
        await Movers.DAL.Persistence.CrewSchema.Apply(db);
        await Movers.DAL.Persistence.CrewScheduleSchema.Apply(db);
        await Movers.DAL.Persistence.CurrencyPrecisionSchema.Apply(db);
        await Movers.DAL.Persistence.ExpenseAttachmentSchema.Apply(db);
        await Movers.DAL.Numbering.NumberSequenceRepository.Initialize(db);
        var seeder = scope.ServiceProvider.GetRequiredService<SecuritySeeder>();
        await seeder.SeedAsync(systemAdminEmail, systemAdminPassword, resetSystemAdminPassword);
    }
}








