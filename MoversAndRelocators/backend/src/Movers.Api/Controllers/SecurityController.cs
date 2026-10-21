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

    /// <summary>The Users register's advanced search: search, sort, desc, skip, take, isActive, roleId. Summary: linkedEmployeeIds.</summary>
    [Authorize(Policy = SecurityPermissions.UsersView)]
    [HttpGet("users/search")]
    public async Task<ActionResult> SearchUsers([FromQuery] Movers.Services.Common.ListQuery query, [FromQuery] bool? isActive, [FromQuery] Guid? roleId, CancellationToken cancellationToken)
    {
        var page = await securityService.SearchUsersAsync(new UserListFilter(isActive, roleId), query, cancellationToken);
        return Ok(new Movers.Services.Common.PagedResult<UserResponse>(page.Items.Select(UserResponse.From).ToList(), page.Total, page.Summary));
    }

    /// <summary>The Roles register's advanced search: search, sort, desc, skip, take, isSystemRole.</summary>
    [Authorize(Policy = SecurityPermissions.RolesView)]
    [HttpGet("roles/search")]
    public async Task<ActionResult> SearchRoles([FromQuery] Movers.Services.Common.ListQuery query, [FromQuery] bool? isSystemRole, CancellationToken cancellationToken) =>
        Ok(await securityService.SearchRolesAsync(new RoleListFilter(isSystemRole), query, cancellationToken));

    /// <summary>Advanced search over the whole audit log: search, sort, desc, skip, take, action, entityType. Summary: actions, entityTypes.</summary>
    [Authorize(Policy = SecurityPermissions.AuditView)]
    [HttpGet("audit/search")]
    public async Task<ActionResult> SearchAudit([FromQuery] Movers.Services.Common.ListQuery query, [FromQuery(Name = "action")] string? auditAction, [FromQuery] string? entityType, CancellationToken cancellationToken) =>
        Ok(await auditService.SearchAsync(new AuditListFilter(auditAction, entityType), query, cancellationToken));

    [Authorize(Policy = SecurityPermissions.UsersManage)]
    [HttpPost("users")]
    public async Task<ActionResult> CreateUser(CreateUserRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var user = await securityService.CreateUserAsync(
                new(request.FullName, request.Email, request.Password, request.RoleId, request.EmployeeId, request.CompanyId), cancellationToken);
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

    [Authorize(Policy = SecurityPermissions.UsersManage)]
    [HttpPatch("users/{id:guid}/company")]
    public async Task<ActionResult> SetUserCompany(Guid id, SetUserCompanyRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var user = await securityService.SetUserCompanyAsync(id, request.CompanyId, cancellationToken);
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
