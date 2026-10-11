namespace Movers.Services.Tenants;

public sealed class DuplicateTenantSlugException(string slug)
    : Exception($"The tenant slug '{slug}' is already in use.");
