using System.ComponentModel.DataAnnotations;
using Movers.Services.Security;

namespace Movers.Api.Contracts.Security;

public sealed record LoginRequest([Required, EmailAddress] string Email, [Required] string Password);
public sealed record SelectTenantRequest(Guid TenantId);
public sealed record CreateUserRequest(
    [Required, StringLength(160, MinimumLength = 2)] string FullName,
    [Required, EmailAddress] string Email,
    [Required, MinLength(10)] string Password,
    Guid RoleId,
    Guid EmployeeId);
public sealed record SetUserStatusRequest(bool IsActive);
public sealed record SetUserEmployeeRequest(Guid EmployeeId);
public sealed record CreateRoleRequest([Required, StringLength(120, MinimumLength = 2)] string Name, IReadOnlyList<Guid> PermissionIds);
public sealed record UserResponse(Guid Id, int SerialNo, string FullName, string Email, bool IsActive,
    DateTimeOffset? LastLoginAtUtc, Guid? EmployeeId, string? EmployeeName, IReadOnlyList<RoleModel> Roles)
{
    public static UserResponse From(UserModel user) => new(user.Id, user.SerialNo, user.FullName, user.Email,
        user.IsActive, user.LastLoginAtUtc, user.EmployeeId, user.EmployeeName, user.Roles);
}
