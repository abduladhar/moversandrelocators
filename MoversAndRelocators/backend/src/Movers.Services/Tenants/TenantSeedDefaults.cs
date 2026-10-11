namespace Movers.Services.Tenants;

/// <summary>A tax created for every new tenant (configuration section TenantDefaults:Taxes).</summary>
public sealed record TenantTaxSeed(string Code, string Name, string Kind, string CalculationBasis, decimal Rate, bool IsDefault = false, string? Description = null);
/// <summary>A charge created for every new tenant (configuration section TenantDefaults:Charges). Rates are in the tenant's own currency.</summary>
public sealed record TenantChargeSeed(string Code, string Name, string Unit, decimal DefaultRate, decimal TaxPercent, string? Description = null);
/// <summary>
/// Starter taxes and charges for new tenants. They depend on the country and price level, so they come from
/// configuration (appsettings TenantDefaults) rather than code; with none configured, a tenant starts without them.
/// </summary>
public sealed record TenantSeedDefaults(IReadOnlyList<TenantTaxSeed> Taxes, IReadOnlyList<TenantChargeSeed> Charges)
{
    public static readonly TenantSeedDefaults None = new([], []);
}
