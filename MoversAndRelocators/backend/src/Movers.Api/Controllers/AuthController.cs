using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Api.Contracts.Security;
using Movers.Api.Security;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IAuthenticationService authenticationService, IJwtTokenService tokens) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var authenticated = await authenticationService.AuthenticateAsync(
            request.Email, request.Password, cancellationToken, request.CompanyId);
        if (authenticated is null) return Unauthorized(new { error = "invalid_credentials", message = "Invalid email or password." });
        return Ok(ToResponse(authenticated));
    }

    [Authorize(Roles = RoleCodes.SystemAdmin)]
    [HttpPost("select-tenant")]
    public async Task<ActionResult> SelectTenant(SelectTenantRequest request, CancellationToken cancellationToken)
    {
        var authenticated = await authenticationService.SelectTenantAsync(request.TenantId, cancellationToken);
        return authenticated is null ? NotFound() : Ok(ToResponse(authenticated));
    }

    /// <summary>Switches a tenant user (or a system administrator inside a tenant) to another company; returns a new token.</summary>
    [Authorize]
    [HttpPost("select-company")]
    public async Task<ActionResult> SelectCompany(SelectCompanyRequest request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirstValue("acting_tenant_id") ?? User.FindFirstValue("tenant_id"), out var tenantId))
            return BadRequest(new { message = "Open a tenant first." });
        var authenticated = await authenticationService.SelectCompanyAsync(tenantId, request.CompanyId, cancellationToken);
        return authenticated is null ? NotFound(new { message = "That company is not available to you." }) : Ok(ToResponse(authenticated));
    }

    [Authorize]
    [HttpGet("me")]
    public ActionResult Me() => Ok(new
    {
        id = User.FindFirstValue(ClaimTypes.NameIdentifier),
        name = User.FindFirstValue(ClaimTypes.Name),
        email = User.FindFirstValue(ClaimTypes.Email),
        roles = User.FindAll(ClaimTypes.Role).Select(x => x.Value),
        permissions = User.FindAll("permission").Select(x => x.Value),
        tenantId = User.FindFirstValue("acting_tenant_id") ?? User.FindFirstValue("tenant_id"),
        tenantName = User.FindFirstValue("acting_tenant_name"),
        companyId = User.FindFirstValue("company_id"),
        companyName = User.FindFirstValue("company_name")
    });

    private object ToResponse(AuthenticationResult authentication)
    {
        var token = tokens.Issue(authentication);
        return new
        {
            token.AccessToken,
            token.ExpiresAtUtc,
            user = authentication.User,
            tenantId = authentication.ActingTenantId,
            tenantName = authentication.ActingTenantName,
            companyId = authentication.Company?.Id,
            companyName = authentication.Company?.Name,
            companies = authentication.Companies,
            canSwitchCompany = authentication.CanSwitchCompany
        };
    }
}
