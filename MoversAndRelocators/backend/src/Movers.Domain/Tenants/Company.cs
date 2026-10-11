using Movers.Domain.Common;

namespace Movers.Domain.Tenants;

/// <summary>
/// A company inside a tenant (the group). Masters such as customers, employees and items are shared by all
/// companies of the tenant; jobs, documents, the ledger and reports belong to one company.
/// </summary>
public sealed class Company : TenantOwnedEntity
{
    private Company() { }

    public Company(Guid tenantId, string code, string name, bool isDefault) : base(tenantId)
    {
        Code = NormalizeCode(code);
        Name = name.Trim();
        IsDefault = isDefault;
        IsActive = true;
        CreatedAtUtc = UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string? LegalName { get; private set; }
    public string? TaxNumber { get; private set; }
    public string? Address { get; private set; }
    public string? Phone { get; private set; }
    public string? Email { get; private set; }
    public string? Website { get; private set; }
    /// <summary>Inserted into document numbers (QT-DXB-20261011-000001) so each company has its own series. Empty keeps the plain format.</summary>
    public string? NumberCode { get; private set; }
    public bool IsDefault { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public void Update(string code, string name, string? legalName, string? taxNumber, string? address, string? phone,
        string? email, string? website, string? numberCode)
    {
        Code = NormalizeCode(code);
        Name = name.Trim();
        LegalName = Optional(legalName);
        TaxNumber = Optional(taxNumber);
        Address = Optional(address);
        Phone = Optional(phone);
        Email = Optional(email);
        Website = Optional(website);
        NumberCode = Optional(numberCode)?.ToUpperInvariant();
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void SetActive(bool active) { IsActive = active; UpdatedAtUtc = DateTimeOffset.UtcNow; }
    public void SetDefault(bool isDefault) { IsDefault = isDefault; UpdatedAtUtc = DateTimeOffset.UtcNow; }

    public static string NormalizeCode(string code) => code.Trim().ToUpperInvariant();
    private static string? Optional(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
