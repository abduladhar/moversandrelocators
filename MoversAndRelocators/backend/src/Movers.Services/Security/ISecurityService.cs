namespace Movers.Services.Security;

public interface ISecurityService
{
    Task<IReadOnlyList<UserModel>> ListUsersAsync(CancellationToken cancellationToken);
    Task<Movers.Services.Common.PagedResult<UserModel>> SearchUsersAsync(UserListFilter filter, Movers.Services.Common.ListQuery query, CancellationToken cancellationToken);
    Task<Movers.Services.Common.PagedResult<RoleModel>> SearchRolesAsync(RoleListFilter filter, Movers.Services.Common.ListQuery query, CancellationToken cancellationToken);
    Task<UserModel> CreateUserAsync(CreateUserCommand command, CancellationToken cancellationToken);
    Task<UserModel?> SetUserStatusAsync(Guid id, bool active, CancellationToken cancellationToken);
    Task<UserModel?> SetUserEmployeeAsync(Guid id, Guid employeeId, CancellationToken cancellationToken);
    Task<UserModel?> SetUserCompanyAsync(Guid id, Guid? companyId, CancellationToken cancellationToken);
    Task<IReadOnlyList<RoleModel>> ListRolesAsync(CancellationToken cancellationToken);
    Task<RoleModel> CreateRoleAsync(CreateRoleCommand command, CancellationToken cancellationToken);
    Task<IReadOnlyList<PermissionModel>> ListPermissionsAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<UserModel>> ListTenantUsersAsync(Guid tenantId, CancellationToken cancellationToken);
    Task<IReadOnlyList<RoleModel>> ListTenantRolesAsync(Guid tenantId, CancellationToken cancellationToken);
    Task<UserModel> CreateTenantUserAsync(Guid tenantId, string fullName, string email, string password, Guid roleId, CancellationToken cancellationToken, Guid? companyId = null);
    Task<UserModel?> SetTenantUserStatusAsync(Guid tenantId, Guid id, bool active, CancellationToken cancellationToken);
}

/// <summary>Advanced search filters of the Users page.</summary>
public sealed record UserListFilter(bool? IsActive = null, Guid? RoleId = null);
/// <summary>Employees already linked to one of the users the requester can see (the create/link forms hide them).</summary>
public sealed record UserListSummary(IReadOnlyList<Guid> LinkedEmployeeIds);
/// <summary>Advanced search filters of the Roles page (IsSystemRole = built-in vs custom).</summary>
public sealed record RoleListFilter(bool? IsSystemRole = null);
