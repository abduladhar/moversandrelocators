using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Movers.Api.Configuration;
using Movers.Api.Security;
using Movers.Api.Tenancy;
using Movers.DAL;
using Movers.Services.Auditing;
using Movers.Services.Employees;
using Movers.Services.Security;
using Movers.Services.Sales;
using Movers.Services.Tenancy;
using Movers.Services.Tenants;
using Movers.Services.Tasks;
using Movers.Services.Aws;
using Movers.Services.OpenAi;
using Movers.Api.Storage;
using Movers.Services.Surveys;
using Movers.Services.Quotations;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddScoped<Movers.Services.Operations.IShipmentService, Movers.Services.Operations.ShipmentService>();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("customer-links", context => System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
        { PermitLimit = 60, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new()
    {
        Name = "Authorization",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "JWT access token returned by /api/auth/login."
    });
});
// Required settings are validated up front; secrets must be environment variables outside Development/Testing.
var clientOrigins = builder.Urls("ClientOrigin");
builder.Url(Movers.Api.Configuration.PublicLinks.Key);
// Optional: the API's own public address, needed when the web app is on a different domain (local file links).
if (!string.IsNullOrWhiteSpace(builder.Configuration["PublicApi:BaseUrl"])) builder.Url("PublicApi:BaseUrl");
builder.Services.AddCors(options => options.AddPolicy("client", policy =>
    policy.WithOrigins(clientOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()));

var databaseProvider = builder.Configuration["Database:Provider"]
    ?? throw new InvalidOperationException("Database:Provider must be configured as 'SqlServer' or 'PostgreSql'.");
var connectionStringName = databaseProvider.Trim().ToLowerInvariant() switch
{
    "sqlserver" or "mssql" => "SqlServer",
    "postgresql" or "postgres" or "npgsql" => "PostgreSql",
    "sqlite" when builder.Environment.IsEnvironment("Testing") => "Sqlite",
    _ => throw new InvalidOperationException(
        $"Unsupported database provider '{databaseProvider}'. Use 'SqlServer' or 'PostgreSql'.")
};
var connectionString = builder.Secret("ConnectionStrings:" + connectionStringName);
builder.Services.AddScoped<Movers.Services.Reporting.ReportTemplateV2Service>();
builder.Services.AddScoped<Movers.Services.Reporting.ReportDataService>();
builder.Services.AddScoped<Movers.Services.Reporting.ReportBrandingService>();
builder.Services.AddScoped<Movers.Services.Packing.PackingService>();
builder.Services.AddScoped<Movers.Services.Delivery.DeliveryService>();
builder.Services.AddSingleton<Movers.Api.Configuration.PublicLinks>();
// Starter taxes and charges for new tenants (country-specific), from appsettings TenantDefaults.
var tenantDefaults = builder.Configuration.GetSection("TenantDefaults");
builder.Services.AddSingleton(new TenantSeedDefaults(tenantDefaults.GetSection("Taxes").Get<TenantTaxSeed[]>() ?? [], tenantDefaults.GetSection("Charges").Get<TenantChargeSeed[]>() ?? []));
builder.Services.AddScoped<ITenantContext, TenantContext>();
builder.Services.AddScoped<ITenantService, TenantService>();
builder.Services.AddScoped<Movers.Services.Operations.IOperationsService, Movers.Services.Operations.OperationsService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IUserContext, UserContext>();
builder.Services.AddScoped<IPasswordHasher, PasswordHasher>();
builder.Services.AddScoped<IAuthenticationService, AuthenticationService>();
builder.Services.AddScoped<ISecurityService, SecurityService>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<IEmployeeService, EmployeeService>();
builder.Services.AddScoped<ISalesService, SalesService>();
builder.Services.AddScoped<ITaskService, TaskService>();
builder.Services.AddScoped<IAwsConfigurationService, AwsConfigurationService>();
builder.Services.AddScoped<IOpenAiConfigurationService, OpenAiConfigurationService>();
builder.Services.AddScoped<ILeadUploadService, LeadUploadService>();
builder.Services.AddScoped<LeadExtractionService>();
builder.Services.AddHttpClient<IInventoryVisionGateway, OpenAiVisionGateway>(client => client.Timeout = TimeSpan.FromSeconds(180));
builder.Services.AddHttpClient<Movers.Services.Sales.IObjectUploader, Movers.Api.Storage.HttpObjectUploader>(client => client.Timeout = TimeSpan.FromSeconds(60));
builder.Services.AddScoped<ISurveyService, SurveyService>();
builder.Services.AddScoped<ISurveyFileService, SurveyFileService>();
builder.Services.AddScoped<ISurveyTripService, SurveyTripService>();
builder.Services.AddScoped<Movers.Services.Pickups.IPickupWorkService, Movers.Services.Pickups.PickupWorkService>();
builder.Services.AddScoped<Movers.Services.Pickups.IPickupCollectionService, Movers.Services.Pickups.PickupCollectionService>();
builder.Services.AddScoped<Movers.Services.Crew.ICrewService, Movers.Services.Crew.CrewService>();
builder.Services.AddScoped<IQuotationService, QuotationService>();
builder.Services.AddScoped<Movers.Services.Pickups.IPickupService, Movers.Services.Pickups.PickupService>();
builder.Services.AddSingleton<LocalObjectStorage>();
if (string.Equals(builder.Configuration["Storage:Provider"], "Local", StringComparison.OrdinalIgnoreCase))
    builder.Services.AddSingleton<IAwsObjectStorage>(sp => sp.GetRequiredService<LocalObjectStorage>());
else
    builder.Services.AddSingleton<IAwsObjectStorage, S3ObjectStorage>();
builder.Services.AddSingleton<ISecretProtector, AesGcmSecretProtector>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddMoversDataAccess(databaseProvider, connectionString);

var jwtKey = builder.Secret("Jwt:SigningKey");
if (Encoding.UTF8.GetByteCount(jwtKey) < 32) throw new InvalidOperationException("Jwt:SigningKey must be at least 32 characters.");
builder.Secret("CredentialEncryption:Key");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });
builder.Services.AddAuthorization(options =>
{
    foreach (var permission in SecurityPermissions.All)
        options.AddPolicy(permission.Code, policy => policy.RequireClaim("permission", permission.Code));
    // Packing was split out of Pickup: operations users keep access without a role change or re-login.
    options.AddPolicy(SecurityPermissions.PackingManage, policy => policy.RequireClaim("permission",
        SecurityPermissions.PackingManage, SecurityPermissions.OperationsManage));
    // Delivery is an operations module too: operations users get it without a role change or re-login.
    options.AddPolicy(SecurityPermissions.DeliveryManage, policy => policy.RequireClaim("permission",
        SecurityPermissions.DeliveryManage, SecurityPermissions.OperationsManage));
});

// The bootstrap administrator is optional: system administrators can also be created on the sign-in page
// with the setup key (Setup:Key), or on a first run in Development/Testing.
var bootstrapEmail = builder.Configuration["Bootstrap:SystemAdminEmail"] is { Length: > 0 } ? builder.Required("Bootstrap:SystemAdminEmail") : null;
var bootstrapPassword = bootstrapEmail is null ? null : builder.Secret("Bootstrap:SystemAdminPassword");
// Recovery: Bootstrap__ResetPassword=true resets the bootstrap administrator's password on start. Remove it afterwards.
var resetBootstrapPassword = bootstrapEmail is not null && builder.Configuration.GetValue<bool>("Bootstrap:ResetPassword");
// The setup key may come from appsettings or an environment variable (the owner's choice); it must be long enough to resist guessing.
var setupKey = builder.Configuration["Setup:Key"] is { Length: > 0 } ? builder.Required("Setup:Key") : null;
if (setupKey is { Length: < 16 }) throw new InvalidOperationException("Setup:Key must be at least 16 characters.");
builder.Services.AddSingleton(new Movers.Services.Security.FirstRunSetupOptions(
    setupKey is not null || builder.Environment.IsDevelopment() || builder.Environment.IsEnvironment("Testing"), setupKey));
builder.Services.AddScoped<Movers.Services.Security.FirstRunSetupService>();

var app = builder.Build();
await app.Services.InitializeMoversDatabaseAsync(bootstrapEmail, bootstrapPassword, resetBootstrapPassword);
if (resetBootstrapPassword)
    app.Logger.LogWarning("Bootstrap:ResetPassword is on: the password of {Email} was reset to Bootstrap:SystemAdminPassword. Remove Bootstrap__ResetPassword now.", bootstrapEmail);

if ((builder.Configuration["SampleRatesTenant"] ?? builder.Configuration["BillingDefaultsTenant"]) is {Length: > 0} sampleTenantName)
{
    if (!app.Environment.IsDevelopment()) throw new InvalidOperationException("Sample rates can only be seeded in Development.");
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<Movers.DAL.Persistence.MoversDbContext>();
    var tenants = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(db.Tenants);
    var selectedTenant = tenants.SingleOrDefault(t => t.Name == sampleTenantName)
        ?? throw new InvalidOperationException("Specify the exact name of one tenant for sample rates.");
    scope.ServiceProvider.GetRequiredService<ITenantContext>().SetTenant(selectedTenant);
    var currencyService = scope.ServiceProvider.GetRequiredService<Movers.Services.Currencies.CurrencyService>();
        if (builder.Configuration["BillingDefaultsTenant"] is not null) {
        var billing = scope.ServiceProvider.GetRequiredService<Movers.Services.Billing.BillingService>();
        var created = await billing.EnsureDefaultCharges(CancellationToken.None);
        var charges = await billing.MappedCharges(CancellationToken.None);
        Console.WriteLine($"Billing defaults for {selectedTenant.Name}: {created} masters created; {charges.Count(c=>c.IsActive&&c.IncomeAccount!=null)} invoice charges, {charges.Count(c=>c.IsActive&&c.ExpenseAccount!=null)} bill charges available.");
        return;
    }
    var added = await currencyService.SeedSampleRates(DateOnly.FromDateTime(DateTime.Today), CancellationToken.None);
    Console.WriteLine($"Created {added.Count} SAMPLE rates for {selectedTenant.Name}; existing currency schedules were preserved.");
    return;
}
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("client");
app.UseRateLimiter();
app.UseAuthentication();
app.UseMiddleware<TenantResolutionMiddleware>();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.Run();

public partial class Program;



