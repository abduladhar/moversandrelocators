using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Api.Contracts.Security;
using Movers.Services.Auditing;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/security")]
public sealed class SecurityController(ISecurityService securityService, IAuditService auditService) : ControllerBase
{
    [Authorize(Policy = SecurityPermissions.UsersView)]
    [HttpGet("users")]
    public async Task<ActionResult> Users(CancellationToken cancellationToken) =>
        Ok((await securityService.ListUsersAsync(cancellationToken)).Select(UserResponse.From));

    [Authorize(Policy = SecurityPermissions.UsersManage)]
    [HttpPost("users")]
    public async Task<ActionResult> CreateUser(CreateUserRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var user = await securityService.CreateUserAsync(
                new(request.FullName, request.Email, request.Password, request.RoleId, request.EmployeeId), cancellationToken);
            return Created($"/api/security/users/{user.Id}", UserResponse.From(user));
        }
        catch (InvalidOperationException exception) { return BadRequest(new { message = exception.Message }); }
    }

    [Authorize(Policy = SecurityPermissions.UsersManage)]
    [HttpPatch("users/{id:guid}/status")]
    public async Task<ActionResult> SetUserStatus(Guid id, SetUserStatusRequest request, CancellationToken cancellationToken)
    {
        var user = await securityService.SetUserStatusAsync(id, request.IsActive, cancellationToken);
        return user is null ? NotFound() : Ok(UserResponse.From(user));
    }

    [Authorize(Policy = SecurityPermissions.UsersManage)]
    [HttpPatch("users/{id:guid}/employee")]
    public async Task<ActionResult> SetUserEmployee(Guid id, SetUserEmployeeRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var user = await securityService.SetUserEmployeeAsync(id, request.EmployeeId, cancellationToken);
            return user is null ? NotFound() : Ok(UserResponse.From(user));
        }
        catch (InvalidOperationException exception) { return BadRequest(new { message = exception.Message }); }
    }

    [Authorize(Policy = SecurityPermissions.RolesView)]
    [HttpGet("roles")]
    public async Task<ActionResult> Roles(CancellationToken cancellationToken) =>
        Ok(await securityService.ListRolesAsync(cancellationToken));

    [Authorize(Policy = SecurityPermissions.RolesManage)]
    [HttpPost("roles")]
    public async Task<ActionResult> CreateRole(CreateRoleRequest request, CancellationToken cancellationToken) =>
        Ok(await securityService.CreateRoleAsync(new(request.Name, request.PermissionIds), cancellationToken));

    [Authorize(Policy = SecurityPermissions.RolesView)]
    [HttpGet("permissions")]
    public async Task<ActionResult> Permissions(CancellationToken cancellationToken) =>
        Ok(await securityService.ListPermissionsAsync(cancellationToken));

    [Authorize(Policy = SecurityPermissions.AuditView)]
    [HttpGet("audit")]
    public async Task<ActionResult> Audit([FromQuery] int take = 100, CancellationToken cancellationToken = default) =>
        Ok(await auditService.ListAsync(take, cancellationToken));
}
