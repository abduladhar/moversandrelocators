using System.ComponentModel.DataAnnotations;
using Movers.Services.Security;

namespace Movers.Api.Contracts.Security;

/// <param name="CompanyId">Optional: the company to open (the last one used); ignored for company users.</param>
public sealed record LoginRequest([Required, EmailAddress] string Email, [Required] string Password, Guid? CompanyId = null);
public sealed record SelectTenantRequest(Guid TenantId);
public sealed record SelectCompanyRequest(Guid CompanyId);
public sealed record CreateUserRequest(
    [Required, StringLength(160, MinimumLength = 2)] string FullName,
    [Required, EmailAddress] string Email,
    [Required, MinLength(10)] string Password,
    Guid RoleId,
    Guid EmployeeId,
    Guid? CompanyId = null);
public sealed record SetUserStatusRequest(bool IsActive);
public sealed record SetUserEmployeeRequest(Guid EmployeeId);
/// <param name="CompanyId">The user's company; null makes a tenant user who can switch between companies.</param>
public sealed record SetUserCompanyRequest(Guid? CompanyId);
public sealed record CreateRoleRequest([Required, StringLength(120, MinimumLength = 2)] string Name, IReadOnlyList<Guid> PermissionIds);
public sealed record UserResponse(Guid Id, int SerialNo, string FullName, string Email, bool IsActive,
    DateTimeOffset? LastLoginAtUtc, Guid? EmployeeId, string? EmployeeName, IReadOnlyList<RoleModel> Roles, Guid? CompanyId, string? CompanyName)
{
    public static UserResponse From(UserModel user) => new(user.Id, user.SerialNo, user.FullName, user.Email,
        user.IsActive, user.LastLoginAtUtc, user.EmployeeId, user.EmployeeName, user.Roles, user.CompanyId, user.CompanyName);
}
