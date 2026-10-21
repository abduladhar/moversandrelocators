using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Security;
using Movers.Services.Security;
using Movers.Domain.Employees;
using Movers.DAL.Common;
using Movers.Services.Common;

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

    private IQueryable<User> TenantUsers(Guid tenantId, Guid? companyId) => db.Users.AsNoTracking().Where(x => x.TenantId == tenantId && (companyId == null || x.CompanyId == companyId));
    private static readonly SortMap<User> UserSorts = new SortMap<User>("serialNo", true, x => x.SerialNo)
        .Add("serialNo", x => x.SerialNo).Add("fullName", x => x.FullName).Add("email", x => x.Email).Add("lastLoginAtUtc", x => x.LastLoginAtUtc).Add("isActive", x => x.IsActive);
    public async Task<(IReadOnlyList<User> Items, int Total)> SearchUsersAsync(Guid tenantId, Guid? companyId, UserListFilter filter, ListQuery list, CancellationToken t)
    {
        var q = TenantUsers(tenantId, companyId);
        if (filter.IsActive is { } active) q = q.Where(x => x.IsActive == active);
        if (filter.RoleId is { } roleId) q = q.Where(x => db.UserRoles.Any(r => r.UserId == x.Id && r.RoleId == roleId));
        q = q.Search(list, w => x => x.FullName.ToLower().Contains(w) || x.Email.ToLower().Contains(w));
        var (items, total) = await q.Sort(list, UserSorts).PageAsync(list, t);
        return (items, total);
    }
    public async Task<IReadOnlyList<Guid>> LinkedEmployeeIdsAsync(Guid tenantId, Guid? companyId, CancellationToken t) =>
        await TenantUsers(tenantId, companyId).Where(x => x.EmployeeId != null).Select(x => x.EmployeeId!.Value).Distinct().ToListAsync(t);

    private static readonly SortMap<Role> RoleSorts = new SortMap<Role>("serialNo", true, x => x.SerialNo)
        .Add("serialNo", x => x.SerialNo).Add("name", x => x.Name).Add("code", x => x.Code).Add("isSystemRole", x => x.IsSystemRole);
    public async Task<(IReadOnlyList<Role> Items, int Total)> SearchRolesAsync(Guid tenantId, RoleListFilter filter, ListQuery list, CancellationToken t)
    {
        var q = db.Roles.AsNoTracking().Where(x => x.TenantId == tenantId || (x.TenantId == null && x.Code == RoleCodes.TenantAdmin));
        if (filter.IsSystemRole is { } system) q = q.Where(x => x.IsSystemRole == system);
        q = q.Search(list, w => x => x.Name.ToLower().Contains(w) || x.Code.ToLower().Contains(w)
            || db.RolePermissions.Any(rp => rp.RoleId == x.Id && db.Permissions.Any(p => p.Id == rp.PermissionId && p.Code.ToLower().Contains(w))));
        var (items, total) = await q.Sort(list, RoleSorts).PageAsync(list, t);
        return (items, total);
    }
}
