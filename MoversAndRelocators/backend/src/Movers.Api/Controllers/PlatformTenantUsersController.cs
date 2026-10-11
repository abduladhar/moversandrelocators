using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Api.Contracts.Security;
using Movers.Services.Security;
using Movers.Services.Tenants;

namespace Movers.Api.Controllers;

public sealed record CreateTenantUserRequest(
    [Required, StringLength(160, MinimumLength = 2)] string FullName,
    [Required, EmailAddress, StringLength(254)] string Email,
    [Required, MinLength(10), StringLength(200)] string Password,
    Guid RoleId);

/// <summary>System administrators manage a tenant's users (for example its first administrator) without entering the tenant.</summary>
[ApiController, Authorize(Roles = RoleCodes.SystemAdmin), Route("api/platform/tenants/{tenantId:guid}")]
public sealed class PlatformTenantUsersController(ITenantService tenants, ISecurityService security) : ControllerBase
{
    [HttpGet("users")]
    public async Task<ActionResult> Users(Guid tenantId, CancellationToken t) =>
        await tenants.GetAsync(tenantId, t) is null ? NotFound() : Ok((await security.ListTenantUsersAsync(tenantId, t)).Select(UserResponse.From));

    [HttpGet("roles")]
    public async Task<ActionResult> Roles(Guid tenantId, CancellationToken t) =>
        await tenants.GetAsync(tenantId, t) is null ? NotFound() : Ok(await security.ListTenantRolesAsync(tenantId, t));

    [HttpPost("users")]
    public async Task<ActionResult> Create(Guid tenantId, CreateTenantUserRequest r, CancellationToken t)
    {
        if (await tenants.GetAsync(tenantId, t) is null) return NotFound();
        try { return Ok(UserResponse.From(await security.CreateTenantUserAsync(tenantId, r.FullName, r.Email, r.Password, r.RoleId, t))); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
    }

    [HttpPatch("users/{id:guid}/status")]
    public async Task<ActionResult> SetStatus(Guid tenantId, Guid id, SetUserStatusRequest r, CancellationToken t)
    {
        var user = await security.SetTenantUserStatusAsync(tenantId, id, r.IsActive, t);
        return user is null ? NotFound() : Ok(UserResponse.From(user));
    }
}
