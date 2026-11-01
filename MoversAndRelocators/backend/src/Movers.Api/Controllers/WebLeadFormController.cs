using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Movers.Services.Operations;
using Movers.Services.Sales;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

/// <summary>The company's website form settings (one per company).</summary>
[ApiController, Authorize, Route("api/sales/web-form")]
public sealed class WebLeadFormController(WebLeadFormService service) : ControllerBase
{
    public sealed record NewAddressRequest(Guid? Version);
    [HttpGet, Authorize(Policy = SecurityPermissions.SalesView)] public async Task<ActionResult> Get(CancellationToken t) => Ok(await service.Get(t));
    [HttpPut, Authorize(Policy = SecurityPermissions.SalesManage)] public Task<ActionResult> Save(SaveWebLeadForm r, CancellationToken t) => Run(() => service.Save(r, t));
    [HttpPost("new-address"), Authorize(Policy = SecurityPermissions.SalesManage)] public Task<ActionResult> NewAddress(NewAddressRequest r, CancellationToken t) => Run(() => service.NewAddress(r.Version, t));
    private async Task<ActionResult> Run<T>(Func<Task<T>> action)
    {
        try { return Ok(await action()); }
        catch (OperationConflictException e) { return Conflict(new { message = e.Message }); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
    }
}

public sealed record SubmitWebLeadRequest([Required, StringLength(160, MinimumLength = 2)] string CustomerName, [Required, StringLength(40, MinimumLength = 5)] string Phone,
    [EmailAddress, StringLength(254)] string? Email, Guid? MoveTypeId, [Required, StringLength(300)] string Origin, [Required, StringLength(300)] string Destination,
    DateOnly? ExpectedMoveDate, [StringLength(2000)] string? Notes, [StringLength(200)] string? Website)
{ public SubmitWebLeadCommand ToCommand() => new(CustomerName, Phone, Email, MoveTypeId, Origin, Destination, ExpectedMoveDate, Notes, Website); }

/// <summary>The public form on the company's website: no sign-in. Submissions are limited per address (web-lead-form policy).</summary>
[ApiController, AllowAnonymous, EnableRateLimiting("customer-links"), Route("api/public/lead-form/{key}")]
public sealed class PublicLeadFormController(WebLeadFormService service) : ControllerBase
{
    private const string Unavailable = "This form is not available.";
    [HttpGet] public async Task<ActionResult> Get(string key, CancellationToken t) { var x = await service.GetPublic(key, t); return x is null ? NotFound(new { message = Unavailable }) : Ok(x); }
    [HttpPost, EnableRateLimiting("web-lead-form")]
    public async Task<ActionResult> Submit(string key, SubmitWebLeadRequest r, CancellationToken t)
    {
        try { var x = await service.Submit(key, r.ToCommand(), t); return x is null ? NotFound(new { message = Unavailable }) : Ok(x); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
    }
}
