using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Api.Security;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

public sealed record CreateSystemAdminRequest(
    [Required, StringLength(160, MinimumLength = 2)] string FullName,
    [Required, EmailAddress, StringLength(254)] string Email,
    [Required, MinLength(10), StringLength(200)] string Password,
    [StringLength(200)] string? SetupKey = null);

/// <summary>Creates (or, with the setup key, resets) a system administrator from the sign-in page, then signs them in.</summary>
[ApiController, AllowAnonymous, Route("api/setup")]
public sealed class SetupController(FirstRunSetupService setup, IAuthenticationService authentication, IJwtTokenService tokens) : ControllerBase
{
    [HttpGet("status")] public async Task<ActionResult> Status(CancellationToken t) => Ok(await setup.StatusAsync(t));

    [HttpPost("system-admin")]
    public async Task<ActionResult> CreateSystemAdmin(CreateSystemAdminRequest r, CancellationToken t)
    {
        CreateSystemAdminResult result;
        try { result = await setup.CreateSystemAdminAsync(new(r.FullName, r.Email, r.Password, r.SetupKey), t); }
        catch (SetupCompletedException e) { return Conflict(new { message = e.Message }); }
        catch (UnauthorizedAccessException e) { return StatusCode(StatusCodes.Status403Forbidden, new { message = e.Message }); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
        var signedIn = await authentication.AuthenticateAsync(r.Email, r.Password, t);
        if (signedIn is null) return Ok(new { created = true, passwordReset = result.Reset });
        var token = tokens.Issue(signedIn);
        return Ok(new { token.AccessToken, token.ExpiresAtUtc, user = signedIn.User, tenantId = signedIn.ActingTenantId, tenantName = signedIn.ActingTenantName, passwordReset = result.Reset });
    }
}
