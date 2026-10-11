using Movers.Services.Tenants;

namespace Movers.Services.Security;

public sealed class AuthenticationService(
    ISecurityRepository repository,
    ITenantRepository tenantRepository,
    IPasswordHasher passwordHasher,
    IUserContext userContext,
    ICompanyRepository? companies = null) : IAuthenticationService
{
    public async Task<AuthenticationResult?> AuthenticateAsync(
        string email, string password, CancellationToken cancellationToken, Guid? companyId = null)
    {
        var normalizedEmail = Domain.Security.User.NormalizeEmail(email);
        var user = await repository.FindUserByEmailAsync(normalizedEmail, cancellationToken);
        if (user is null || !user.IsActive || !passwordHasher.Verify(password, user.PasswordHash)) return null;
        var roles = await repository.GetUserRolesAsync(user.Id, cancellationToken);
        var isSystemAdmin = roles.Any(x => x.Code == RoleCodes.SystemAdmin);

        Domain.Tenants.Tenant? tenant = null;
        if (!isSystemAdmin)
        {
            if (!user.TenantId.HasValue) return null;
            tenant = await tenantRepository.GetAsync(user.TenantId.Value, false, cancellationToken);
            if (tenant is null || !tenant.IsActive) return null;
        }

        var permissions = await repository.GetUserPermissionsAsync(user.Id, cancellationToken);
        AuthenticationResult result = new(ToAuthenticated(user, roles, permissions, isSystemAdmin),
            isSystemAdmin ? null : tenant!.Id, isSystemAdmin ? null : tenant!.Name);
        if (!isSystemAdmin)
        {
            // A company user whose company was deactivated cannot sign in.
            var withCompany = await WithCompanyAsync(result, tenant!.Id, user.CompanyId, companyId, cancellationToken);
            if (withCompany is null) return null;
            result = withCompany;
        }
        user.RecordLogin();
        await repository.SaveChangesAsync(cancellationToken);
        return result;
    }

    public async Task<AuthenticationResult?> SelectCompanyAsync(Guid tenantId, Guid companyId, CancellationToken cancellationToken)
    {
        if (!userContext.IsAuthenticated || !userContext.UserId.HasValue) return null;
        var user = await repository.FindUserByEmailAsync(Domain.Security.User.NormalizeEmail(userContext.Email), cancellationToken);
        if (user is null || !user.IsActive || user.Id != userContext.UserId) return null;
        var roles = await repository.GetUserRolesAsync(user.Id, cancellationToken);
        var isSystemAdmin = roles.Any(x => x.Code == RoleCodes.SystemAdmin);
        if (!isSystemAdmin && (user.TenantId != tenantId || user.CompanyId.HasValue)) return null;
        var tenant = await tenantRepository.GetAsync(tenantId, false, cancellationToken);
        if (tenant is null || !tenant.IsActive) return null;
        var permissions = await repository.GetUserPermissionsAsync(user.Id, cancellationToken);
        var result = await WithCompanyAsync(new AuthenticationResult(ToAuthenticated(user, roles, permissions, isSystemAdmin), tenant.Id, tenant.Name),
            tenant.Id, null, companyId, cancellationToken);
        return result?.Company?.Id == companyId ? result : null;
    }

    public async Task<AuthenticationResult?> SelectTenantAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        if (!userContext.IsAuthenticated || !userContext.IsSystemAdmin || !userContext.UserId.HasValue) return null;
        var tenant = await tenantRepository.GetAsync(tenantId, false, cancellationToken);
        if (tenant is null || !tenant.IsActive) return null;
        var user = await repository.FindUserByEmailAsync(Domain.Security.User.NormalizeEmail(userContext.Email), cancellationToken);
        if (user is null) return null;
        var roles = await repository.GetUserRolesAsync(user.Id, cancellationToken);
        var permissions = await repository.GetUserPermissionsAsync(user.Id, cancellationToken);
        return await WithCompanyAsync(new AuthenticationResult(ToAuthenticated(user, roles, permissions, true), tenant.Id, tenant.Name),
            tenant.Id, null, null, cancellationToken);
    }

    /// <summary>
    /// Adds the session company: a company user gets their own company; tenant users and system administrators get
    /// the requested company, else the default one. Null when a company user's company is not active.
    /// </summary>
    private async Task<AuthenticationResult?> WithCompanyAsync(AuthenticationResult result, Guid tenantId, Guid? userCompanyId, Guid? requested, CancellationToken cancellationToken)
    {
        if (companies is null) return result;
        var options = (await companies.ListAsync(tenantId, cancellationToken))
            .Where(x => x.IsActive && (userCompanyId is null || x.Id == userCompanyId))
            .OrderByDescending(x => x.IsDefault).ThenBy(x => x.Name)
            .Select(x => new CompanyOption(x.Id, x.Code, x.Name, x.IsDefault)).ToList();
        var company = userCompanyId is { } own ? options.SingleOrDefault(x => x.Id == own)
            : options.SingleOrDefault(x => x.Id == requested) ?? options.FirstOrDefault(x => x.IsDefault) ?? options.FirstOrDefault();
        if (userCompanyId is not null && company is null) return null;
        return result with { Company = company, Companies = options, CanSwitchCompany = userCompanyId is null };
    }

    private static AuthenticatedUser ToAuthenticated(Domain.Security.User user, IReadOnlyList<Domain.Security.Role> roles,
        IReadOnlyList<string> permissions, bool isSystemAdmin) =>
        new(user.Id, user.FullName, user.Email, user.TenantId, user.EmployeeId, isSystemAdmin,
            roles.Select(x => x.Code).ToList(), permissions) { CompanyId = user.CompanyId };
}
