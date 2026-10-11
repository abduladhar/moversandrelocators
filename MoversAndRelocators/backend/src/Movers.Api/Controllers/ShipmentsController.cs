using Movers.Api.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Movers.Services.Operations;
using Movers.Services.Security;
namespace Movers.Api.Controllers;

[ApiController, Authorize(Policy = SecurityPermissions.OperationsManage), Route("api/shipments")]
public sealed class ShipmentsController(IShipmentService service, PublicLinks links) : ControllerBase
{
    [HttpGet("{pickupId:guid}")] public Task<IActionResult> Get(Guid pickupId, CancellationToken ct) => Run(() => service.Get(pickupId, ct));
    [HttpPost("{pickupId:guid}/share")]
    public Task<IActionResult> Share(Guid pickupId, SharePacking c, CancellationToken ct) => Run(async () =>
    {
        var link = await service.Share(pickupId, c, ct);
        return new { url = links.BaseUrl + "/packing/" + link.Token, link.ExpiresAtUtc };
    });
    [HttpPost("{pickupId:guid}/revoke")]
    public Task<IActionResult> Revoke(Guid pickupId, CancellationToken ct) => Run(async () => { await service.Revoke(pickupId, ct); return new { revoked = true }; });
    [HttpPost("{pickupId:guid}/handovers")] public Task<IActionResult> Handover(Guid pickupId, HandoverInput c, CancellationToken ct) => Run(() => service.Handover(pickupId, c, ct));
    [HttpPost("claims")] public Task<IActionResult> Claim(ClaimInput c, CancellationToken ct) => Run(() => service.Claim(c, ct));
    [HttpPost("claims/{id:guid}/resolve")] public Task<IActionResult> Resolve(Guid id, ResolveClaim c, CancellationToken ct) => Run(() => service.ResolveClaim(id, c, ct));
    private async Task<IActionResult> Run<T>(Func<Task<T>> action)
    {
        try { return Ok(await action()); }
        catch (OperationConflictException e) { return Conflict(new { message = e.Message }); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
        catch (KeyNotFoundException) { return NotFound(new { message = "Move or claim not found." }); }
    }
}
[ApiController, AllowAnonymous, EnableRateLimiting("customer-links"), Route("api/public/packing/{token}")]
public sealed class PublicPackingController(IShipmentService service, Movers.Services.Reporting.ReportTemplateV2Service templates, Movers.Services.Reporting.ReportDataService reports) : ControllerBase
{
    /// <summary>Packing list for the customer: the tenant's default PACKING_LIST template (layout only) plus the snapshot data.</summary>
    [HttpGet("report-v2")] public Task<IActionResult> ReportV2(string token,CancellationToken ct) => Run(async()=>{
        var data=await reports.PublicPacking(token,ct);
        var template=await templates.Default("PACKING_LIST",ct);
        return new{layout=template?.Details.Layout,name=template?.Details.Name,data};
    });
    [HttpGet] public Task<IActionResult> Get(string token, CancellationToken ct) => Run(() => service.Public(token, ct));
    [HttpPost("respond")] public Task<IActionResult> Respond(string token, PackingResponse c, CancellationToken ct) => Run(() => service.Respond(token, c, ct));
    private async Task<IActionResult> Run<T>(Func<Task<T>> action)
    {
        Response.Headers.CacheControl = "no-store"; Response.Headers["Referrer-Policy"] = "no-referrer";
        try { return Ok(await action()); }
        catch (OperationConflictException e) { return Conflict(new { message = e.Message }); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
        catch (KeyNotFoundException) { return NotFound(new { message = "This link is expired, revoked, or unavailable." }); }
    }
}

