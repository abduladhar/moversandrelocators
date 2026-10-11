using Movers.Domain.Security;
using Movers.Services.Tenancy;

namespace Movers.Services.Security;

public sealed class SecurityService(ISecurityRepository repository, ITenantContext tenantContext, IPasswordHasher passwordHasher)
    : ISecurityService
{
    public async Task<IReadOnlyList<UserModel>> ListUsersAsync(CancellationToken cancellationToken)
    {
        var users = await repository.ListUsersAsync(tenantContext.TenantId, cancellationToken);
        var result = new List<UserModel>();
        foreach (var user in users)
            result.Add(await MapUserAsync(user, cancellationToken));
        return result;
    }

    public Task<UserModel> CreateUserAsync(CreateUserCommand command, CancellationToken cancellationToken) =>
        CreateAsync(tenantContext.TenantId, command.FullName, command.Email, command.Password, command.RoleId, command.EmployeeId, cancellationToken);

    /* Platform (system administrator): manage the users of any tenant without entering it. */
    public async Task<IReadOnlyList<UserModel>> ListTenantUsersAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var result = new List<UserModel>();
        foreach (var user in await repository.ListUsersAsync(tenantId, cancellationToken)) result.Add(await MapUserAsync(user, cancellationToken));
        return result;
    }

    public async Task<IReadOnlyList<RoleModel>> ListTenantRolesAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var result = new List<RoleModel>();
        foreach (var role in await repository.ListRolesAsync(tenantId, cancellationToken)) result.Add(await MapRoleAsync(role, cancellationToken));
        return result;
    }

    /// <summary>Creates a tenant user from the platform. It has no employee link, so a new tenant can get its first administrator; link an employee later from the tenant's Users page.</summary>
    public Task<UserModel> CreateTenantUserAsync(Guid tenantId, string fullName, string email, string password, Guid roleId, CancellationToken cancellationToken) =>
        CreateAsync(tenantId, fullName, email, password, roleId, null, cancellationToken);

    public async Task<UserModel?> SetTenantUserStatusAsync(Guid tenantId, Guid id, bool active, CancellationToken cancellationToken)
    {
        var user = (await repository.ListUsersAsync(tenantId, cancellationToken)).SingleOrDefault(x => x.Id == id);
        if (user is null) return null;
        user.SetActive(active);
        await repository.SaveChangesAsync(cancellationToken);
        return await MapUserAsync(user, cancellationToken);
    }

    private async Task<UserModel> CreateAsync(Guid tenantId, string fullName, string email, string password, Guid roleId, Guid? employeeId, CancellationToken cancellationToken)
    {
        var normalized = User.NormalizeEmail(email);
        if (await repository.EmailExistsAsync(normalized, cancellationToken))
            throw new InvalidOperationException("A user with this email already exists in the system.");
        var role = await repository.GetRoleAsync(roleId, tenantId, cancellationToken)
            ?? throw new InvalidOperationException("The selected role is not available to this tenant.");
        if (role.Code == RoleCodes.SystemAdmin)
            throw new InvalidOperationException("System administrators cannot be created inside a tenant.");
        if (employeeId is { } linked)
        {
            var employee = await repository.GetEmployeeAsync(linked, cancellationToken);
            if (employee is null || !employee.IsActive || employee.TenantId != tenantId) throw new InvalidOperationException("Select an active employee for this user.");
            if (await repository.EmployeeHasUserAsync(linked, null, cancellationToken)) throw new InvalidOperationException("This employee is already linked to a user.");
        }

        var user = new User(tenantId, fullName, email, passwordHasher.Hash(password), employeeId);
        repository.AddUser(user);
        repository.AddUserRole(new UserRole(user.Id, role.Id));
        await repository.SaveChangesAsync(cancellationToken);
        return await MapUserAsync(user, cancellationToken);
    }

    public async Task<UserModel?> SetUserStatusAsync(Guid id, bool active, CancellationToken cancellationToken)
    {
        var users = await repository.ListUsersAsync(tenantContext.TenantId, cancellationToken);
        var user = users.SingleOrDefault(x => x.Id == id);
        if (user is null) return null;
        user.SetActive(active);
        await repository.SaveChangesAsync(cancellationToken);
        return await MapUserAsync(user, cancellationToken);
    }

    public async Task<UserModel?> SetUserEmployeeAsync(Guid id, Guid employeeId, CancellationToken cancellationToken)
    {
        var users = await repository.ListUsersAsync(tenantContext.TenantId, cancellationToken);
        var user = users.SingleOrDefault(x => x.Id == id);
        if (user is null) return null;
        var employee = await repository.GetEmployeeAsync(employeeId, cancellationToken);
        if (employee is null || !employee.IsActive) throw new InvalidOperationException("Select an active employee from this tenant.");
        if (await repository.EmployeeHasUserAsync(employeeId, id, cancellationToken)) throw new InvalidOperationException("This employee is already linked to another user.");
        user.LinkEmployee(employeeId);
        await repository.SaveChangesAsync(cancellationToken);
        return await MapUserAsync(user, cancellationToken);
    }

    public async Task<IReadOnlyList<RoleModel>> ListRolesAsync(CancellationToken cancellationToken)
    {
        var roles = await repository.ListRolesAsync(tenantContext.TenantId, cancellationToken);
        var result = new List<RoleModel>();
        foreach (var role in roles) result.Add(await MapRoleAsync(role, cancellationToken));
        return result;
    }

    public async Task<RoleModel> CreateRoleAsync(CreateRoleCommand command, CancellationToken cancellationToken)
    {
        var role = new Role(tenantContext.TenantId, command.Name, $"CUSTOM_{Guid.NewGuid():N}".ToUpperInvariant(), false);
        repository.AddRole(role);
        await repository.SaveChangesAsync(cancellationToken);
        await repository.ReplaceRolePermissionsAsync(role.Id, command.PermissionIds, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);
        return await MapRoleAsync(role, cancellationToken);
    }

    public async Task<IReadOnlyList<PermissionModel>> ListPermissionsAsync(CancellationToken cancellationToken) =>
        (await repository.ListPermissionsAsync(cancellationToken))
            .Select(x => new PermissionModel(x.Id, x.SerialNo, x.Code, x.Name, x.Module)).ToList();

    private async Task<UserModel> MapUserAsync(User user, CancellationToken cancellationToken)
    {
        var roles = await repository.GetUserRolesAsync(user.Id, cancellationToken);
        var models = new List<RoleModel>();
        foreach (var role in roles) models.Add(await MapRoleAsync(role, cancellationToken));
        var employee = user.EmployeeId.HasValue ? await repository.GetEmployeeAsync(user.EmployeeId.Value, cancellationToken) : null;
        return new UserModel(user.Id, user.SerialNo, user.FullName, user.Email, user.IsActive, user.LastLoginAtUtc, user.EmployeeId, employee?.FullName, models);
    }

    private async Task<RoleModel> MapRoleAsync(Role role, CancellationToken cancellationToken) =>
        new(role.Id, role.SerialNo, role.Name, role.Code, role.IsSystemRole,
            await repository.GetRolePermissionsAsync(role.Id, cancellationToken));
}
