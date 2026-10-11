namespace Movers.Services.Tenants;

public sealed record SaveTenantCommand(string Name, string Slug, string? ContactEmail, string? Phone, string? Address);

public sealed record TenantModel(
    int SerialNo, Guid Id, string Name, string Slug, string? ContactEmail, string? Phone, string? Address,
    bool IsActive, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc);
