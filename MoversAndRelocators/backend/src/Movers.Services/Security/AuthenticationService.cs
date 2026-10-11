using Movers.Services.Tenants;

namespace Movers.Services.Security;

public sealed class AuthenticationService(
    ISecurityRepository repository,
    ITenantRepository tenantRepository,
    IPasswordHasher passwordHasher,
    IUserContext userContext) : IAuthenticationService
{
    public async Task<AuthenticationResult?> AuthenticateAsync(
        string email, string password, CancellationToken cancellationToken)
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
        user.RecordLogin();
        await repository.SaveChangesAsync(cancellationToken);
        return new AuthenticationResult(ToAuthenticated(user, roles, permissions, isSystemAdmin),
            isSystemAdmin ? null : tenant!.Id, isSystemAdmin ? null : tenant!.Name);
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
        return new AuthenticationResult(ToAuthenticated(user, roles, permissions, true), tenant.Id, tenant.Name);
    }

    private static AuthenticatedUser ToAuthenticated(Domain.Security.User user, IReadOnlyList<Domain.Security.Role> roles,
        IReadOnlyList<string> permissions, bool isSystemAdmin) =>
        new(user.Id, user.FullName, user.Email, user.TenantId, user.EmployeeId, isSystemAdmin,
            roles.Select(x => x.Code).ToList(), permissions);
}
