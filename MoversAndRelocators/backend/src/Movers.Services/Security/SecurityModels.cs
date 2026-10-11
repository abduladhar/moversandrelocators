namespace Movers.Services.Security;

public sealed record RoleModel(Guid Id, int SerialNo, string Name, string Code, bool IsSystemRole, IReadOnlyList<string> Permissions);
public sealed record UserModel(Guid Id, int SerialNo, string FullName, string Email, bool IsActive,
    DateTimeOffset? LastLoginAtUtc, Guid? EmployeeId, string? EmployeeName, IReadOnlyList<RoleModel> Roles)
{
    /// <summary>Null: a tenant user who can switch between companies.</summary>
    public Guid? CompanyId { get; init; }
    public string? CompanyName { get; init; }
}
public sealed record CreateUserCommand(string FullName, string Email, string Password, Guid RoleId, Guid EmployeeId, Guid? CompanyId = null);
public sealed record CreateRoleCommand(string Name, IReadOnlyList<Guid> PermissionIds);
public sealed record AuthenticatedUser(Guid Id, string FullName, string Email, Guid? TenantId,
    Guid? EmployeeId, bool IsSystemAdmin, IReadOnlyList<string> Roles, IReadOnlyList<string> Permissions)
{
    public Guid? CompanyId { get; init; }
}
public sealed record AuthenticationResult(AuthenticatedUser User, Guid? ActingTenantId, string? ActingTenantName)
{
    /// <summary>The company the session works in.</summary>
    public Movers.Services.Tenants.CompanyOption? Company { get; init; }
    /// <summary>Companies the user can switch to.</summary>
    public IReadOnlyList<Movers.Services.Tenants.CompanyOption> Companies { get; init; } = [];
    /// <summary>Tenant users and system administrators can switch; company users cannot.</summary>
    public bool CanSwitchCompany { get; init; }
}
public sealed record PermissionModel(Guid Id, int SerialNo, string Code, string Name, string Module);
