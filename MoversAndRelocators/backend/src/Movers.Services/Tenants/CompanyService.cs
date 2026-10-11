using System.Text.RegularExpressions;
using Movers.Domain.Common;
using Movers.Domain.Tenants;
using Movers.Services.Tenancy;

namespace Movers.Services.Tenants;

public sealed record CompanyModel(Guid Id, int SerialNo, string Code, string Name, string? LegalName, string? TaxNumber,
    string? Address, string? Phone, string? Email, string? Website, string? NumberCode, bool IsDefault, bool IsActive, int UserCount);
public sealed record SaveCompanyCommand(string Code, string Name, string? LegalName, string? TaxNumber, string? Address,
    string? Phone, string? Email, string? Website, string? NumberCode);
/// <summary>A company the signed-in user can work in (the company switcher).</summary>
public sealed record CompanyOption(Guid Id, string Code, string Name, bool IsDefault);

public interface ICompanyRepository
{
    /// <summary>All companies of a tenant, ignoring the request filters (also used while signing in).</summary>
    Task<IReadOnlyList<Company>> ListAsync(Guid tenantId, CancellationToken cancellationToken);
    Task<Company?> GetAsync(Guid tenantId, Guid id, bool trackChanges, CancellationToken cancellationToken);
    /// <summary>The company a user is limited to; null for tenant users and unknown users.</summary>
    Task<Guid?> UserCompanyAsync(Guid userId, CancellationToken cancellationToken);
    Task<IReadOnlyDictionary<Guid, int>> UserCountsAsync(Guid tenantId, CancellationToken cancellationToken);
    void Add(Company company);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}

/// <summary>Customer links: scope the request to the company of the record the link points at.</summary>
public interface ICompanyScope
{
    Task UseCompanyOfAsync(TenantOwnedEntity record, CancellationToken cancellationToken);
}

public sealed class CompanyScope(ITenantContext tenant, ICompanyRepository companies) : ICompanyScope
{
    public async Task UseCompanyOfAsync(TenantOwnedEntity record, CancellationToken cancellationToken)
    {
        if (tenant.IsCompanyResolved || !tenant.IsResolved || record.CompanyId is not { } id) return;
        var company = await companies.GetAsync(record.TenantId, id, false, cancellationToken);
        if (company is not null) tenant.SetCompany(company);
    }
}

public sealed partial class CompanyService(ICompanyRepository repository, ITenantContext tenant)
{
    public async Task<IReadOnlyList<CompanyModel>> ListAsync(CancellationToken cancellationToken)
    {
        var counts = await repository.UserCountsAsync(tenant.TenantId, cancellationToken);
        return (await repository.ListAsync(tenant.TenantId, cancellationToken))
            .OrderByDescending(x => x.IsDefault).ThenBy(x => x.Name)
            .Select(x => Map(x, counts.GetValueOrDefault(x.Id))).ToList();
    }

    public async Task<CompanyModel> CreateAsync(SaveCompanyCommand command, CancellationToken cancellationToken)
    {
        var all = await repository.ListAsync(tenant.TenantId, cancellationToken);
        Validate(command, null, all);
        var company = new Company(tenant.TenantId, command.Code, command.Name, all.Count == 0);
        Apply(company, command);
        repository.Add(company);
        await repository.SaveChangesAsync(cancellationToken);
        return Map(company, 0);
    }

    public async Task<CompanyModel?> UpdateAsync(Guid id, SaveCompanyCommand command, CancellationToken cancellationToken)
    {
        var company = await repository.GetAsync(tenant.TenantId, id, true, cancellationToken);
        if (company is null) return null;
        Validate(command, id, await repository.ListAsync(tenant.TenantId, cancellationToken));
        Apply(company, command);
        await repository.SaveChangesAsync(cancellationToken);
        return await MapAsync(company, cancellationToken);
    }

    public async Task<CompanyModel?> SetActiveAsync(Guid id, bool active, CancellationToken cancellationToken)
    {
        var company = await repository.GetAsync(tenant.TenantId, id, true, cancellationToken);
        if (company is null) return null;
        if (!active && company.IsDefault) throw new InvalidOperationException("The default company cannot be deactivated. Make another company the default first.");
        if (!active && company.Id == tenant.Company?.Id) throw new InvalidOperationException("Switch to another company before deactivating the one you are working in.");
        company.SetActive(active);
        await repository.SaveChangesAsync(cancellationToken);
        return await MapAsync(company, cancellationToken);
    }

    /// <summary>The default company opens first for tenant users and receives background work.</summary>
    public async Task<CompanyModel?> SetDefaultAsync(Guid id, CancellationToken cancellationToken)
    {
        var all = await repository.ListAsync(tenant.TenantId, cancellationToken);
        if (all.All(x => x.Id != id)) return null;
        foreach (var x in all)
        {
            if (x.Id != id && !x.IsDefault) continue;
            var tracked = (await repository.GetAsync(tenant.TenantId, x.Id, true, cancellationToken))!;
            if (x.Id == id && !tracked.IsActive) throw new InvalidOperationException("Activate the company before making it the default.");
            tracked.SetDefault(x.Id == id);
        }
        await repository.SaveChangesAsync(cancellationToken);
        return await MapAsync((await repository.GetAsync(tenant.TenantId, id, false, cancellationToken))!, cancellationToken);
    }

    /// <summary>
    /// Picks the request company: a company user always works in their own company; tenant users and system
    /// administrators use the company they selected, else the default one. A tenant without companies gets one.
    /// </summary>
    public async Task<bool> ResolveCurrentAsync(Guid? userId, bool isSystemAdmin, string? requestedCompanyId, CancellationToken cancellationToken)
    {
        var all = await repository.ListAsync(tenant.TenantId, cancellationToken);
        if (all.Count == 0)
        {
            var created = new Company(tenant.TenantId, "MAIN", tenant.Tenant!.Name, true);
            repository.Add(created);
            await repository.SaveChangesAsync(cancellationToken);
            all = [created];
        }
        var active = all.Where(x => x.IsActive).ToList();
        var bound = !isSystemAdmin && userId is { } user ? await repository.UserCompanyAsync(user, cancellationToken) : null;
        Company? company;
        if (bound is { } own) company = active.SingleOrDefault(x => x.Id == own);
        else
        {
            var requested = Guid.TryParse(requestedCompanyId, out var id) ? active.SingleOrDefault(x => x.Id == id) : null;
            company = requested ?? active.FirstOrDefault(x => x.IsDefault) ?? active.FirstOrDefault();
        }
        if (company is null) return false;
        tenant.SetCompany(company);
        return true;
    }

    /// <summary>Companies a user may open: their own company, or every active company for tenant users and system administrators.</summary>
    public async Task<IReadOnlyList<CompanyOption>> OptionsAsync(Guid tenantId, Guid? userCompanyId, CancellationToken cancellationToken) =>
        (await repository.ListAsync(tenantId, cancellationToken))
            .Where(x => x.IsActive && (userCompanyId is null || x.Id == userCompanyId))
            .OrderByDescending(x => x.IsDefault).ThenBy(x => x.Name)
            .Select(x => new CompanyOption(x.Id, x.Code, x.Name, x.IsDefault)).ToList();

    private static void Apply(Company company, SaveCompanyCommand c) =>
        company.Update(c.Code, c.Name, c.LegalName, c.TaxNumber, c.Address, c.Phone, c.Email, c.Website, c.NumberCode);

    private static void Validate(SaveCompanyCommand c, Guid? id, IReadOnlyList<Company> all)
    {
        var code = Company.NormalizeCode(c.Code ?? "");
        if (!CodePattern().IsMatch(code)) throw new InvalidOperationException("Use 1 to 20 letters, digits, '-' or '_' for the company code.");
        if (string.IsNullOrWhiteSpace(c.Name) || c.Name.Trim().Length > 160) throw new InvalidOperationException("Enter the company name (up to 160 characters).");
        var others = all.Where(x => x.Id != id).ToList();
        if (others.Any(x => x.Code == code)) throw new InvalidOperationException($"Another company already uses the code {code}.");
        var number = string.IsNullOrWhiteSpace(c.NumberCode) ? null : c.NumberCode.Trim().ToUpperInvariant();
        if (number is not null && !NumberPattern().IsMatch(number)) throw new InvalidOperationException("Use 1 to 6 letters or digits for the number code.");
        // Document numbers must stay unique across the tenant, so only one company may use the plain format.
        if (number is null && others.Any(x => x.NumberCode is null))
            throw new InvalidOperationException("Enter a number code (for example DXB). It keeps this company's document numbers apart from the other companies.");
        if (number is not null && others.Any(x => x.NumberCode == number)) throw new InvalidOperationException($"Another company already uses the number code {number}.");
    }

    private async Task<CompanyModel> MapAsync(Company x, CancellationToken cancellationToken) =>
        Map(x, (await repository.UserCountsAsync(tenant.TenantId, cancellationToken)).GetValueOrDefault(x.Id));

    private static CompanyModel Map(Company x, int users) => new(x.Id, x.SerialNo, x.Code, x.Name, x.LegalName, x.TaxNumber,
        x.Address, x.Phone, x.Email, x.Website, x.NumberCode, x.IsDefault, x.IsActive, users);

    [GeneratedRegex("^[A-Z0-9_-]{1,20}$")] private static partial Regex CodePattern();
    [GeneratedRegex("^[A-Z0-9]{1,6}$")] private static partial Regex NumberPattern();
}
