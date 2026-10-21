using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.CustomerLinks;

namespace Movers.Api.Controllers;

/// <summary>The customer side of shared links: what is awaited from the customer, what they answered, the office's action, and the history.
/// Each record type is limited to the users of that module (checked in the service).</summary>
[ApiController, Authorize, Route("api/customer-replies")]
public sealed class CustomerRepliesController(ICustomerReplyQueries service) : ControllerBase
{
    [HttpGet] public async Task<ActionResult> List([FromQuery] string? type, CancellationToken t) => Ok(await service.ListAsync(string.IsNullOrWhiteSpace(type) ? null : Type(type), t));

    [HttpGet("{type}/{id:guid}/history")]
    public Task<ActionResult> History(string type, Guid id, CancellationToken t) => Run(async () => Ok(await service.HistoryAsync(Type(type), id, t)));

    /// <summary>Records that the office acted on the reply; the note (optional) says what was done.</summary>
    [HttpPost("{type}/{id:guid}/handled")]
    public Task<ActionResult> Handled(string type, Guid id, [FromBody] MarkHandledRequest? request, CancellationToken t) =>
        Run(async () => await service.MarkHandledAsync(Type(type), id, request?.Note, t) is { } x ? Ok(x) : NotFound());

    private static string Type(string type) => type.Trim().ToUpperInvariant();
    private async Task<ActionResult> Run(Func<Task<ActionResult>> action)
    {
        try { return await action(); }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
    }
}

public sealed record MarkHandledRequest(string? Note);
