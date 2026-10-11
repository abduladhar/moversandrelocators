using System.ComponentModel.DataAnnotations;
using Movers.Services.Tenants;

namespace Movers.Api.Contracts.Tenants;

public sealed record SaveTenantRequest(
    [Required, StringLength(160, MinimumLength = 2)] string Name,
    [Required, StringLength(80, MinimumLength = 2), RegularExpression("^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$")] string Slug,
    [EmailAddress, StringLength(254)] string? ContactEmail,
    [StringLength(40)] string? Phone,
    [StringLength(500)] string? Address);

public sealed record SetTenantStatusRequest(bool IsActive);

public sealed record TenantResponse(
    int SerialNo,
    Guid Id,
    string Name,
    string Slug,
    string? ContactEmail,
    string? Phone,
    string? Address,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc)
{
    public static TenantResponse From(TenantModel tenant) => new(
        tenant.SerialNo, tenant.Id, tenant.Name, tenant.Slug, tenant.ContactEmail, tenant.Phone,
        tenant.Address, tenant.IsActive, tenant.CreatedAtUtc, tenant.UpdatedAtUtc);
}
