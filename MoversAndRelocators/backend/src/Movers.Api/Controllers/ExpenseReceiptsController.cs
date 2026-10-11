using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Operations;
using Movers.Services.Sales;

namespace Movers.Api.Controllers;

/// <summary>
/// Receipts for every kind of expense: SURVEY, PICKUP, PACKING, DELIVERY, OPERATIONS and CASH. Access follows the
/// module that owns the expense; accountants (billing.view) can view all receipts.
/// </summary>
[ApiController, Authorize, Route("api/expense-receipts")]
public sealed class ExpenseReceiptsController(ExpenseReceiptService service) : ControllerBase
{
    /// <summary>Receipts of the given expenses (comma-separated ids).</summary>
    [HttpGet] public Task<ActionResult> List([FromQuery] string? ids, CancellationToken t) => Run(() => service.List(Ids(ids), t));

    public sealed record ReceiptQuery(IReadOnlyList<Guid>? ExpenseIds);
    /// <summary>Same as GET, for long lists (e.g. the whole cash-posting queue) that would not fit in a URL.</summary>
    [HttpPost("query")] public Task<ActionResult> Query(ReceiptQuery q, CancellationToken t) => Run(() => service.List((q.ExpenseIds ?? []).Distinct().ToList(), t));

    [HttpPost("{kind}/{expenseId:guid}/upload-requests")]
    public Task<ActionResult> Upload(string kind, Guid expenseId, UploadRequestModel input, CancellationToken t) => Run(() => service.Create(ExpenseReceiptService.Kind(kind), expenseId, input, t));

    [HttpPost("{id:guid}/complete")] public Task<ActionResult> Complete(Guid id, CancellationToken t) => Run(() => service.Complete(id, t));
    [HttpGet("{id:guid}/download")] public Task<ActionResult> Download(Guid id, CancellationToken t) => Run(async () => new { url = await service.Download(id, t) });
    [HttpDelete("{id:guid}")] public Task<ActionResult> Remove(Guid id, CancellationToken t) => Run(() => service.Remove(id, t));

    private static IReadOnlyCollection<Guid> Ids(string? ids) =>
        (ids ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(x => Guid.TryParse(x, out var g) ? g : Guid.Empty).Where(g => g != Guid.Empty).Distinct().ToList();

    private async Task<ActionResult> Run<T>(Func<Task<T>> action)
    {
        try { return Ok(await action()); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (UnauthorizedAccessException e) { return StatusCode(StatusCodes.Status403Forbidden, new { message = e.Message }); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
    }
}
