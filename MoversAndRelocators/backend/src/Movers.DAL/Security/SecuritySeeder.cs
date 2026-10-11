using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Security;
using Movers.Services.Security;

namespace Movers.DAL.Security;

internal sealed class SecuritySeeder(MoversDbContext db, IPasswordHasher passwordHasher)
{
    /// <summary>Seeds permissions and the built-in roles; creates the bootstrap system administrator only when one is configured
    /// (otherwise the first administrator is created through first-time setup).</summary>
    /// <param name="resetPassword">Recovery switch (Bootstrap:ResetPassword): sets the existing bootstrap administrator's password to the configured one and reactivates it.</param>
    public async Task SeedAsync(string? systemAdminEmail, string? systemAdminPassword, bool resetPassword = false, CancellationToken cancellationToken = default)
    {
        foreach (var definition in SecurityPermissions.All)
        {
            if (!await db.Permissions.AnyAsync(x => x.Code == definition.Code, cancellationToken))
                db.Permissions.Add(new Permission(definition.Code, definition.Name, definition.Module));
        }
        await db.SaveChangesAsync(cancellationToken);

        var systemRole = await GetOrCreateRoleAsync("System administrator", RoleCodes.SystemAdmin, cancellationToken);
        var tenantRole = await GetOrCreateRoleAsync("Tenant administrator", RoleCodes.TenantAdmin, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        var permissions = await db.Permissions.ToListAsync(cancellationToken);
        await GrantMissingAsync(systemRole.Id, permissions, cancellationToken);
        await GrantMissingAsync(tenantRole.Id,
            permissions.Where(x => x.Code != SecurityPermissions.TenantsManage).ToList(), cancellationToken);

        if (string.IsNullOrWhiteSpace(systemAdminEmail) || string.IsNullOrWhiteSpace(systemAdminPassword)) return;
        var normalizedEmail = User.NormalizeEmail(systemAdminEmail);
        var administrator = await db.Users.SingleOrDefaultAsync(
            x => x.NormalizedEmail == normalizedEmail, cancellationToken);
        if (administrator is null)
        {
            administrator = new User(null, "System Administrator", systemAdminEmail, passwordHasher.Hash(systemAdminPassword));
            db.Users.Add(administrator);
        }
        else if (administrator.TenantId.HasValue)
        {
            throw new InvalidOperationException(
                $"The bootstrap system administrator email '{systemAdminEmail}' is already assigned to a tenant user.");
        }
        else if (resetPassword)
        {
            administrator.ChangePassword(passwordHasher.Hash(systemAdminPassword));
            administrator.SetActive(true);
        }

        if (!await db.UserRoles.AnyAsync(x => x.UserId == administrator.Id && x.RoleId == systemRole.Id, cancellationToken))
            db.UserRoles.Add(new UserRole(administrator.Id, systemRole.Id));
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<Role> GetOrCreateRoleAsync(string name, string code, CancellationToken cancellationToken)
    {
        var role = await db.Roles.SingleOrDefaultAsync(x => x.TenantId == null && x.Code == code, cancellationToken);
        if (role is not null) return role;
        role = new Role(null, name, code, true);
        db.Roles.Add(role);
        return role;
    }

    private async Task GrantMissingAsync(Guid roleId, IReadOnlyCollection<Permission> permissions, CancellationToken cancellationToken)
    {
        var existing = await db.RolePermissions.Where(x => x.RoleId == roleId)
            .Select(x => x.PermissionId).ToListAsync(cancellationToken);
        db.RolePermissions.AddRange(permissions.Where(x => !existing.Contains(x.Id))
            .Select(x => new RolePermission(roleId, x.Id)));
        await db.SaveChangesAsync(cancellationToken);
    }
}
