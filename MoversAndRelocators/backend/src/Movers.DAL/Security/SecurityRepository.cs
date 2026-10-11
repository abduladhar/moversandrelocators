using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Security;
using Movers.Services.Security;
using Movers.Domain.Employees;

namespace Movers.DAL.Security;

public sealed class SecurityRepository(MoversDbContext db) : ISecurityRepository
{
    public Task<User?> FindUserByEmailAsync(string normalizedEmail, CancellationToken cancellationToken) =>
        db.Users.SingleOrDefaultAsync(x => x.NormalizedEmail == normalizedEmail, cancellationToken);

    public async Task<IReadOnlyList<Role>> GetUserRolesAsync(Guid userId, CancellationToken cancellationToken)
    {
        var roleIds = db.UserRoles.Where(x => x.UserId == userId).Select(x => x.RoleId);
        return await db.Roles.AsNoTracking().Where(x => roleIds.Contains(x.Id)).OrderBy(x => x.Name).ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<string>> GetUserPermissionsAsync(Guid userId, CancellationToken cancellationToken)
    {
        var roleIds = db.UserRoles.Where(x => x.UserId == userId).Select(x => x.RoleId);
        var permissionIds = db.RolePermissions.Where(x => roleIds.Contains(x.RoleId)).Select(x => x.PermissionId);
        return await db.Permissions.AsNoTracking().Where(x => permissionIds.Contains(x.Id))
            .Select(x => x.Code).Distinct().OrderBy(x => x).ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<User>> ListUsersAsync(Guid tenantId, CancellationToken cancellationToken) =>
        await db.Users.Where(x => x.TenantId == tenantId).OrderByDescending(x => x.SerialNo).ToListAsync(cancellationToken);

    public Task<bool> EmailExistsAsync(string normalizedEmail, CancellationToken cancellationToken) =>
        db.Users.AnyAsync(x => x.NormalizedEmail == normalizedEmail, cancellationToken);
    public Task<Employee?> GetEmployeeAsync(Guid employeeId, CancellationToken cancellationToken) => db.Employees.AsNoTracking().SingleOrDefaultAsync(x => x.Id == employeeId, cancellationToken);
    public Task<bool> EmployeeHasUserAsync(Guid employeeId, Guid? excludingUserId, CancellationToken cancellationToken) => db.Users.AnyAsync(x => x.EmployeeId == employeeId && (!excludingUserId.HasValue || x.Id != excludingUserId), cancellationToken);

    public Task<Role?> GetRoleAsync(Guid roleId, Guid tenantId, CancellationToken cancellationToken) =>
        db.Roles.AsNoTracking().SingleOrDefaultAsync(x => x.Id == roleId &&
            (x.TenantId == tenantId || (x.TenantId == null && x.Code == RoleCodes.TenantAdmin)), cancellationToken);

    public Task<bool> AnyActiveSystemAdminAsync(CancellationToken cancellationToken) =>
        (from user in db.Users
         join userRole in db.UserRoles on user.Id equals userRole.UserId
         join role in db.Roles on userRole.RoleId equals role.Id
         where user.IsActive && role.Code == RoleCodes.SystemAdmin && role.TenantId == null
         select user.Id).AnyAsync(cancellationToken);

    public Task<Role?> GetGlobalRoleAsync(string code, CancellationToken cancellationToken) =>
        db.Roles.AsNoTracking().SingleOrDefaultAsync(x => x.TenantId == null && x.Code == code, cancellationToken);

    public async Task<IReadOnlyList<Role>> ListRolesAsync(Guid tenantId, CancellationToken cancellationToken) =>
        await db.Roles.AsNoTracking().Where(x => x.TenantId == tenantId ||
            (x.TenantId == null && x.Code == RoleCodes.TenantAdmin)).OrderBy(x => x.Name).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Permission>> ListPermissionsAsync(CancellationToken cancellationToken) =>
        await db.Permissions.AsNoTracking().OrderBy(x => x.Module).ThenBy(x => x.Name).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<string>> GetRolePermissionsAsync(Guid roleId, CancellationToken cancellationToken)
    {
        var ids = db.RolePermissions.Where(x => x.RoleId == roleId).Select(x => x.PermissionId);
        return await db.Permissions.AsNoTracking().Where(x => ids.Contains(x.Id)).Select(x => x.Code).OrderBy(x => x).ToListAsync(cancellationToken);
    }

    public void AddUser(User user) => db.Users.Add(user);
    public void AddUserRole(UserRole userRole) => db.UserRoles.Add(userRole);
    public void AddRole(Role role) => db.Roles.Add(role);

    public async Task ReplaceRolePermissionsAsync(Guid roleId, IReadOnlyList<Guid> permissionIds, CancellationToken cancellationToken)
    {
        var existing = await db.RolePermissions.Where(x => x.RoleId == roleId).ToListAsync(cancellationToken);
        db.RolePermissions.RemoveRange(existing);
        var validIds = await db.Permissions.Where(x => permissionIds.Contains(x.Id)).Select(x => x.Id).ToListAsync(cancellationToken);
        db.RolePermissions.AddRange(validIds.Distinct().Select(x => new RolePermission(roleId, x)));
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken) => await db.SaveChangesAsync(cancellationToken);
}
