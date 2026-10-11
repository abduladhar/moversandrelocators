using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Movers.Api.Contracts.Sales;
using Movers.Api.Contracts.Surveys;
using Movers.Services.Operations;
using Movers.Services.Pickups;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

public sealed record CompletePickupTripRequest(DateTimeOffset? At, [Range(0, 5000)] decimal? DistanceKm);
public sealed record PickupDistanceRequest([Range(0, 5000)] decimal? DistanceKm);
public sealed record SavePickupExpenseRequest([Required, StringLength(30)] string Category, [Range(0.0001, 10000000)] decimal Amount, [Required, StringLength(3, MinimumLength = 3)] string Currency, DateTimeOffset IncurredAtUtc, Guid? PaidByEmployeeId, [StringLength(500)] string? Notes, decimal? ExchangeRate = null)
{ public SavePickupExpenseCommand Command() => new(Category, Amount, Currency, IncurredAtUtc, PaidByEmployeeId, Notes, ExchangeRate); }
public sealed record PickupUploadRequest([Required, StringLength(20)] string Stage, [StringLength(120)] string? RoomName, [Required, StringLength(255)] string FileName, [Required, StringLength(150)] string ContentType, [Range(1, 524288000)] long SizeBytes, [StringLength(20)] string? BoxSource = null, Guid? BoxId = null);
public sealed record PickupSignoffRequest([Required, StringLength(20)] string Party, [Required, StringLength(160)] string SignerName, Guid? EmployeeId, [Required, StringLength(1000)] string Statement, [StringLength(1000)] string? Remarks, [Required] string SignaturePng)
{ public PickupSignoffCommand Command() => new(Party, SignerName, EmployeeId, Statement, Remarks, SignaturePng); }
public sealed record StoreInWarehouseRequest(Guid WarehouseId, [StringLength(80)] string? Bay, [Required] IReadOnlyList<Guid> PackageIds, [Required, StringLength(160)] string ReceivedBy, [StringLength(2000)] string? Notes)
{ public StoreInWarehouseCommand Command() => new(WarehouseId, Bay, PackageIds, ReceivedBy, Notes); }
public sealed record SaveWarehouseRequest([Required, StringLength(40)] string Code, [Required, StringLength(160)] string Name, [StringLength(500)] string? Address) { public SaveWarehouseCommand Command() => new(Code, Name, Address); }

/// <summary>Pickup field work: trip clock, crew expenses, stage photos, sign-offs and warehouse storage.</summary>
[ApiController, Authorize(Policy = SecurityPermissions.OperationsManage), Route("api/pickups")]
public sealed class PickupWorkController(IPickupWorkService work) : ControllerBase
{
    [HttpGet("{id:guid}/work")] public async Task<ActionResult> Get(Guid id, CancellationToken t) { var x = await work.GetAsync(id, t); return x is null ? NotFound() : Ok(x); }
    [HttpPost("{id:guid}/trip/start")] public Task<ActionResult> Start(Guid id, [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] TripStepRequest? r, CancellationToken t) => Run(() => work.StartAsync(id, (r ?? new(null, null)).ToCommand(), t));
    [HttpPost("{id:guid}/trip/pause")] public Task<ActionResult> Pause(Guid id, TripStepRequest r, CancellationToken t) => Run(() => work.PauseAsync(id, r.ToCommand(), t));
    [HttpPost("{id:guid}/trip/resume")] public Task<ActionResult> Resume(Guid id, [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] TripStepRequest? r, CancellationToken t) => Run(() => work.ResumeAsync(id, (r ?? new(null, null)).ToCommand(), t));
    [HttpPost("{id:guid}/trip/complete")] public Task<ActionResult> Complete(Guid id, CompletePickupTripRequest r, CancellationToken t) => Run(() => work.CompleteAsync(id, new(r.At, r.DistanceKm), t));
    [HttpPut("{id:guid}/trip/distance")] public Task<ActionResult> Distance(Guid id, PickupDistanceRequest r, CancellationToken t) => Run(() => work.UpdateDistanceAsync(id, r.DistanceKm, t));
    [HttpPost("{id:guid}/expenses")] public Task<ActionResult> AddExpense(Guid id, SavePickupExpenseRequest r, CancellationToken t) => Run(() => work.AddExpenseAsync(id, r.Command(), t));
    [HttpPut("{id:guid}/expenses/{expenseId:guid}")] public Task<ActionResult> UpdateExpense(Guid id, Guid expenseId, SavePickupExpenseRequest r, CancellationToken t) => Run(() => work.UpdateExpenseAsync(id, expenseId, r.Command(), t));
    [HttpDelete("{id:guid}/expenses/{expenseId:guid}")] public Task<ActionResult> DeleteExpense(Guid id, Guid expenseId, CancellationToken t) => Run(() => work.DeleteExpenseAsync(id, expenseId, t));
    [HttpPost("{id:guid}/attachments/upload-requests")] public Task<ActionResult> CreateUpload(Guid id, PickupUploadRequest r, CancellationToken t) => Run(() => work.CreateUploadAsync(id, r.Stage, r.RoomName, new(r.FileName, r.ContentType, r.SizeBytes), t, r.BoxSource, r.BoxId));
    [HttpPost("{id:guid}/attachments/{attachmentId:guid}/complete")] public Task<ActionResult> CompleteUpload(Guid id, Guid attachmentId, CancellationToken t) => Run(() => work.CompleteUploadAsync(id, attachmentId, t));
    [HttpGet("{id:guid}/attachments/{attachmentId:guid}/download")] public async Task<ActionResult> Download(Guid id, Guid attachmentId, CancellationToken t) { try { var url = await work.DownloadUrlAsync(id, attachmentId, t); return url is null ? NotFound() : Ok(new { url }); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    [HttpDelete("{id:guid}/attachments/{attachmentId:guid}")] public async Task<ActionResult> DeleteAttachment(Guid id, Guid attachmentId, CancellationToken t) => await work.DeleteAttachmentAsync(id, attachmentId, t) ? NoContent() : NotFound();
    [HttpPost("{id:guid}/signoffs")] public Task<ActionResult> Sign(Guid id, PickupSignoffRequest r, CancellationToken t) => Run(() => work.SignAsync(id, r.Command(), t));
    [HttpPost("{id:guid}/warehouse")] public Task<ActionResult> Store(Guid id, StoreInWarehouseRequest r, CancellationToken t) => Run(() => work.StoreAsync(id, r.Command(), t));
    [HttpGet("warehouses")] public async Task<ActionResult> Warehouses(CancellationToken t) => Ok(await work.WarehousesAsync(t));
    [HttpPost("warehouses")] public async Task<ActionResult> CreateWarehouse(SaveWarehouseRequest r, CancellationToken t) { try { return Ok(await work.CreateWarehouseAsync(r.Command(), t)); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    [HttpPut("warehouses/{warehouseId:guid}")] public Task<ActionResult> UpdateWarehouse(Guid warehouseId, SaveWarehouseRequest r, CancellationToken t) => Run(() => work.UpdateWarehouseAsync(warehouseId, r.Command(), t));
    [HttpPatch("warehouses/{warehouseId:guid}/status")] public Task<ActionResult> WarehouseActive(Guid warehouseId, Contracts.Pickups.SetPickupMasterStatusRequest r, CancellationToken t) => Run(() => work.SetWarehouseActiveAsync(warehouseId, r.IsActive, t));

    private async Task<ActionResult> Run<T>(Func<Task<T?>> action) where T : class
    {
        try { var x = await action(); return x is null ? NotFound() : Ok(x); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
        catch (OperationConflictException e) { return Conflict(new { message = e.Message }); }
    }
}

