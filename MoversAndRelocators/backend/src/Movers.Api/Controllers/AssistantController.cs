using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Assistant;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

/// <summary>Ask Crateway: the management assistant. Its answers only use data the user's other permissions let them see.</summary>
[ApiController, Authorize(Policy = SecurityPermissions.AssistantUse), Route("api/assistant")]
public sealed class AssistantController(AssistantService service) : ControllerBase
{
    [HttpGet("status")] public async Task<ActionResult<AssistantStatus>> Status(CancellationToken t) => Ok(await service.Status(t));
    [HttpGet("conversations")] public async Task<ActionResult> List(CancellationToken t) => Ok(await service.List(t));

    [HttpGet("conversations/{id:guid}")]
    public async Task<ActionResult> Get(Guid id, CancellationToken t) => await service.Get(id, t) is { } c ? Ok(c) : NotFound();

    [HttpDelete("conversations/{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken t) => await service.Delete(id, t) ? NoContent() : NotFound();

    [HttpPost("ask")]
    public async Task<ActionResult<AssistantAnswer>> Ask(AskAssistantCommand command, CancellationToken t)
    {
        try { return Ok(await service.Ask(command, t)); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (HttpRequestException e) { return StatusCode(StatusCodes.Status502BadGateway, new { message = e.Message }); }
    }
}
