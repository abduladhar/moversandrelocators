using Movers.Domain.Common;

namespace Movers.Domain.Tenants;

public sealed class Tenant : Entity
{
    private Tenant() { }

    public Tenant(string name, string slug, string? contactEmail, string? phone, string? address)
    {
        CreatedAtUtc = DateTimeOffset.UtcNow;
        Update(name, slug, contactEmail, phone, address);
        IsActive = true;
    }

    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;
    public string? ContactEmail { get; private set; }
    public string? Phone { get; private set; }
    public string? Address { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public void Update(string name, string slug, string? contactEmail, string? phone, string? address)
    {
        Name = name.Trim();
        Slug = NormalizeSlug(slug);
        ContactEmail = NormalizeOptional(contactEmail);
        Phone = NormalizeOptional(phone);
        Address = NormalizeOptional(address);
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void SetActive(bool active)
    {
        IsActive = active;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public static string NormalizeSlug(string slug) => slug.Trim().ToLowerInvariant();
    private static string? NormalizeOptional(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
