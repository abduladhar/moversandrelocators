using Movers.Domain.Security;
using Movers.Domain.Employees;

namespace Movers.Services.Security;

public interface ISecurityRepository
{
    Task<User?> FindUserByEmailAsync(string normalizedEmail, CancellationToken cancellationToken);
    Task<IReadOnlyList<Role>> GetUserRolesAsync(Guid userId, CancellationToken cancellationToken);
    Task<IReadOnlyList<string>> GetUserPermissionsAsync(Guid userId, CancellationToken cancellationToken);
    Task<IReadOnlyList<User>> ListUsersAsync(Guid tenantId, CancellationToken cancellationToken);
    /// <summary>One page of the tenant's users; companyId (when set) keeps only that company's users.</summary>
    Task<(IReadOnlyList<User> Items, int Total)> SearchUsersAsync(Guid tenantId, Guid? companyId, UserListFilter filter, Movers.Services.Common.ListQuery query, CancellationToken cancellationToken);
    Task<IReadOnlyList<Guid>> LinkedEmployeeIdsAsync(Guid tenantId, Guid? companyId, CancellationToken cancellationToken);
    Task<(IReadOnlyList<Role> Items, int Total)> SearchRolesAsync(Guid tenantId, RoleListFilter filter, Movers.Services.Common.ListQuery query, CancellationToken cancellationToken);
    Task<bool> EmailExistsAsync(string normalizedEmail, CancellationToken cancellationToken);
    Task<Employee?> GetEmployeeAsync(Guid employeeId, CancellationToken cancellationToken);
    Task<bool> EmployeeHasUserAsync(Guid employeeId, Guid? excludingUserId, CancellationToken cancellationToken);
    Task<Role?> GetRoleAsync(Guid roleId, Guid tenantId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Role>> ListRolesAsync(Guid tenantId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Permission>> ListPermissionsAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<string>> GetRolePermissionsAsync(Guid roleId, CancellationToken cancellationToken);
    /// <summary>True when an active user holds the system administrator role.</summary>
    Task<bool> AnyActiveSystemAdminAsync(CancellationToken cancellationToken);
    /// <summary>A built-in role shared by all tenants (TenantId null), by code.</summary>
    Task<Role?> GetGlobalRoleAsync(string code, CancellationToken cancellationToken);
    void AddUser(User user);
    void AddUserRole(UserRole userRole);
    void AddRole(Role role);
    Task ReplaceRolePermissionsAsync(Guid roleId, IReadOnlyList<Guid> permissionIds, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
