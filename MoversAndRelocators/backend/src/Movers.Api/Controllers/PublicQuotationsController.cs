using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Api.Contracts.Quotations;
using Movers.Services.Quotations;

namespace Movers.Api.Controllers;

[ApiController, AllowAnonymous, Route("api/public/quotations/{token}")]
public sealed class PublicQuotationsController(IQuotationService service) : ControllerBase
{
    [HttpGet] public async Task<ActionResult> Get(string token, CancellationToken t) { var x = await service.GetPublicAsync(token, t); return x is null ? NotFound(new { message = "This quotation link is invalid or expired." }) : Ok(x); }
    [HttpPost("accept")] public async Task<ActionResult> Accept(string token, CancellationToken t) { try { var x = await service.AcceptAsync(token, t); return x is null ? NotFound() : Ok(x); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    [HttpPost("reject")] public async Task<ActionResult> Reject(string token, RejectQuotationRequest r, CancellationToken t) { try { var x = await service.RejectAsync(token, r.Reason, t); return x is null ? NotFound() : Ok(x); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    [HttpPost("request-requote")] public async Task<ActionResult> RequestRequote(string token, SubmitRequoteRequest r, CancellationToken t) { try { var x = await service.RequestRequoteAsync(token, r.ToCommand(), t); return x is null ? NotFound() : Ok(x); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
}
