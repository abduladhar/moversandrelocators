using Movers.Services.Security;
using Movers.Services.Tenancy;

namespace Movers.Services.Tenants;

/// <summary>Which masters the current company keeps to itself, and whether this tenant has more than one company.</summary>
public sealed record MasterScopes(bool Enabled, string? CompanyName, IReadOnlyList<string> CompanyOnly);

public interface IMasterScopeRepository
{
    /// <summary>Keys (code for customers, vendors and other business masters; ID otherwise) of the kind's records marked for the current company.</summary>
    Task<IReadOnlyList<string>> CompanyOnlyKeysAsync(string kind, CancellationToken cancellationToken);
    /// <summary>Sets the record's company (null = shared). False when the record is not visible here.</summary>
    Task<bool> SetAsync(string kind, string key, Guid? companyId, CancellationToken cancellationToken);
}

/// <summary>
/// Masters are shared by every company of the tenant unless marked for one company. Marking always uses the current
/// company, so a user can only keep a record to their own company or share it.
/// </summary>
public sealed class MasterScopeService(IMasterScopeRepository repository, ICompanyRepository companies, ITenantContext tenant)
{
    /// <summary>Master kinds and the permission that manages each (the same permission as its master screen).</summary>
    public static readonly IReadOnlyDictionary<string, string> Kinds = new Dictionary<string, string>
    {
        ["customer"] = SecurityPermissions.OperationsManage, ["vendor"] = SecurityPermissions.OperationsManage,
        ["crew-role"] = SecurityPermissions.OperationsManage, ["payment-method"] = SecurityPermissions.OperationsManage,
        ["payment-purpose"] = SecurityPermissions.OperationsManage, ["expense-category"] = SecurityPermissions.OperationsManage,
        ["employee"] = SecurityPermissions.EmployeesManage, ["designation"] = SecurityPermissions.DesignationsManage, ["team"] = SecurityPermissions.EmployeesManage,
        ["lead-status"] = SecurityPermissions.SalesStatusesManage, ["follow-up-status"] = SecurityPermissions.SalesStatusesManage, ["move-type"] = SecurityPermissions.SalesStatusesManage,
        ["household-item"] = SecurityPermissions.SurveysManage, ["packing-material"] = SecurityPermissions.SurveysManage, ["box-type"] = SecurityPermissions.SurveysManage,
        ["charge"] = SecurityPermissions.QuotesManage, ["tax"] = SecurityPermissions.QuotesManage,
        ["pickup-status"] = SecurityPermissions.OperationsManage, ["vehicle"] = SecurityPermissions.OperationsManage, ["warehouse"] = SecurityPermissions.OperationsManage,
    };

    public async Task<MasterScopes> GetAsync(string kind, CancellationToken cancellationToken)
    {
        Check(kind);
        var active = (await companies.ListAsync(tenant.TenantId, cancellationToken)).Count(x => x.IsActive);
        return new(active > 1, tenant.Company?.Name, await repository.CompanyOnlyKeysAsync(kind, cancellationToken));
    }

    public async Task<bool> SetAsync(string kind, string key, bool companyOnly, CancellationToken cancellationToken)
    {
        Check(kind);
        var company = tenant.Company ?? throw new InvalidOperationException("Open a company first.");
        return await repository.SetAsync(kind, key, companyOnly ? company.Id : null, cancellationToken);
    }

    private static void Check(string kind) { if (!Kinds.ContainsKey(kind)) throw new InvalidOperationException("Unknown master type."); }
}
