namespace Movers.Services.Security;

public sealed record RoleModel(Guid Id, int SerialNo, string Name, string Code, bool IsSystemRole, IReadOnlyList<string> Permissions);
public sealed record UserModel(Guid Id, int SerialNo, string FullName, string Email, bool IsActive,
    DateTimeOffset? LastLoginAtUtc, Guid? EmployeeId, string? EmployeeName, IReadOnlyList<RoleModel> Roles);
public sealed record CreateUserCommand(string FullName, string Email, string Password, Guid RoleId, Guid EmployeeId);
public sealed record CreateRoleCommand(string Name, IReadOnlyList<Guid> PermissionIds);
public sealed record AuthenticatedUser(Guid Id, string FullName, string Email, Guid? TenantId,
    Guid? EmployeeId, bool IsSystemAdmin, IReadOnlyList<string> Roles, IReadOnlyList<string> Permissions);
public sealed record AuthenticationResult(AuthenticatedUser User, Guid? ActingTenantId, string? ActingTenantName);
public sealed record PermissionModel(Guid Id, int SerialNo, string Code, string Name, string Module);
