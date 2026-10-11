using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Pickups;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

public sealed record AddPackingJobsRequest([Required, MinLength(1)] IReadOnlyList<Guid> PackingJobIds) { public AddPackingJobsCommand Command() => new(PackingJobIds); }
public sealed record SetBoxStatusRequest([Required, StringLength(20)] string Source, Guid BoxId, [Required, StringLength(20)] string Status, [StringLength(20)] string? Method, [StringLength(500)] string? Reason)
{ public SetBoxStatusCommand Command() => new(Source, BoxId, Status, string.IsNullOrWhiteSpace(Method) ? "LIST" : Method, Reason); }
public sealed record SetBoxConditionRequest([Required, StringLength(20)] string Source, Guid BoxId, [Required, StringLength(20)] string Condition, [StringLength(1000)] string? Notes)
{ public SetBoxConditionCommand Command() => new(Source, BoxId, Condition, Notes); }
public sealed record AddManualBoxRequest(Guid BoxTypeId, [StringLength(120)] string? RoomName, bool IsFragile, [StringLength(500)] string? Notes, [Range(1, 50)] int Copies = 1)
{ public AddManualBoxCommand Command() => new(BoxTypeId, RoomName, IsFragile, Notes, Copies); }
public sealed record ScanBoxRequest([Required, StringLength(80)] string TrackingNumber, [StringLength(20)] string? Status, [StringLength(500)] string? Reason)
{ public ScanBoxCommand Command() => new(TrackingNumber, Status ?? "PICKED", Reason); }
public sealed record BulkBoxStatusRequest([Required, StringLength(20)] string Status, Guid? PackingJobId, [StringLength(500)] string? Reason) { public BulkBoxStatusCommand Command() => new(Status, PackingJobId, Reason); }
public sealed record ApproveCollectionRequest(Guid? WarehouseId, [StringLength(500)] string? Notes, bool AcceptMissing = false) { public ApproveCollectionCommand Command() => new(WarehouseId, Notes, AcceptMissing); }
public sealed record ReopenCollectionRequest([Required, StringLength(500)] string Reason) { public ReopenCollectionCommand Command() => new(Reason); }

/// <summary>What a pickup collects: the packing jobs on it, the status of every expected box, and the warehouse
/// approval that closes it. Reopening an approved collection needs its own permission, checked in the service.</summary>
[ApiController, Authorize(Policy = SecurityPermissions.OperationsManage), Route("api/pickups/{id:guid}/collection")]
public sealed class PickupCollectionController(IPickupCollectionService collection) : ControllerBase
{
    [HttpGet] public async Task<ActionResult> Get(Guid id, CancellationToken t) { var x = await collection.GetAsync(id, t); return x is null ? NotFound() : Ok(x); }

    [HttpGet("packing-jobs/selectable")] public async Task<ActionResult> Selectable(Guid id, [FromQuery] string? search, CancellationToken t) => Ok(await collection.SelectableJobsAsync(id, search, t));

    [HttpPost("packing-jobs")] public Task<ActionResult> AddJobs(Guid id, AddPackingJobsRequest r, CancellationToken t) => Run(() => collection.AddJobsAsync(id, r.Command(), t));

    [HttpDelete("packing-jobs/{packingJobId:guid}")] public Task<ActionResult> RemoveJob(Guid id, Guid packingJobId, CancellationToken t) => Run(() => collection.RemoveJobAsync(id, packingJobId, t));

    [HttpPut("boxes")] public Task<ActionResult> SetStatus(Guid id, SetBoxStatusRequest r, CancellationToken t) => Run(() => collection.SetBoxStatusAsync(id, r.Command(), t));

    [HttpPut("boxes/condition")] public Task<ActionResult> SetCondition(Guid id, SetBoxConditionRequest r, CancellationToken t) => Run(() => collection.SetConditionAsync(id, r.Command(), t));

    [HttpPost("boxes")] public Task<ActionResult> AddBox(Guid id, AddManualBoxRequest r, CancellationToken t) => Run(() => collection.AddManualBoxAsync(id, r.Command(), t));

    [HttpPost("scan")] public Task<ActionResult> Scan(Guid id, ScanBoxRequest r, CancellationToken t) => Run(() => collection.ScanAsync(id, r.Command(), t));

    [HttpPost("boxes/bulk")] public Task<ActionResult> Bulk(Guid id, BulkBoxStatusRequest r, CancellationToken t) => Run(() => collection.BulkAsync(id, r.Command(), t));

    [HttpGet("history")] public async Task<ActionResult> History(Guid id, [FromQuery] string? source, [FromQuery] Guid? boxId, CancellationToken t) => Ok(await collection.HistoryAsync(id, source, boxId, t));

    [HttpPost("approve")] public Task<ActionResult> Approve(Guid id, ApproveCollectionRequest r, CancellationToken t) => Run(() => collection.ApproveAsync(id, r.Command(), t));

    [HttpPost("reopen")] public Task<ActionResult> Reopen(Guid id, ReopenCollectionRequest r, CancellationToken t) => Run(() => collection.ReopenAsync(id, r.Command(), t));

    private async Task<ActionResult> Run(Func<Task<PickupCollectionModel?>> action)
    {
        try { var x = await action(); return x is null ? NotFound() : Ok(x); }
        catch (UnauthorizedAccessException e) { return StatusCode(StatusCodes.Status403Forbidden, new { message = e.Message }); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
    }
}
