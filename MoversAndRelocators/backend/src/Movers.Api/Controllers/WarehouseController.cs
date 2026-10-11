using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Operations;
using Movers.Services.Security;
namespace Movers.Api.Controllers;
[ApiController, Authorize(Policy = SecurityPermissions.OperationsManage), Route("api/warehouse")]
public sealed class WarehouseController(WarehouseService service, WarehouseAttachmentService attachments) : ControllerBase {
 [HttpGet("stock")] public Task<IActionResult> Stock(CancellationToken ct) => Run(() => service.Stock(ct));
 [HttpGet("receipts")] public Task<IActionResult> Receipts(CancellationToken ct) => Run(() => service.Receipts(ct));
 [HttpPost("receive-office")] public Task<IActionResult> Office(ReceiveOfficeBoxes input, CancellationToken ct) => Run(() => service.ReceiveOffice(input, ct));
 [HttpPost("receive-pickup")] public Task<IActionResult> Pickup(ReceivePickupBoxes input, CancellationToken ct) => Run(() => service.ReceivePickup(input, ct));
 [HttpPut("receipts/{id:guid}/shipping")] public Task<IActionResult> Shipping(Guid id, UpdateWarehouseShipping input, CancellationToken ct) => Run(() => service.UpdateShipping(id, input, ct));
 [HttpGet("receipts/{id:guid}/attachments")] public Task<IActionResult> Files(Guid id, CancellationToken ct) => Run(() => attachments.List(id, ct));
 [HttpPost("receipts/{id:guid}/attachments/upload-requests")] public Task<IActionResult> Upload(Guid id, Movers.Services.Sales.UploadRequestModel input, CancellationToken ct) => Run(() => attachments.Create(id, input, ct));
 [HttpPost("receipts/{id:guid}/attachments/{fileId:guid}/complete")] public Task<IActionResult> Complete(Guid id, Guid fileId, CancellationToken ct) => Run(() => attachments.Complete(id, fileId, ct));
 [HttpGet("receipts/{id:guid}/attachments/{fileId:guid}/download")] public Task<IActionResult> Download(Guid id, Guid fileId, CancellationToken ct) => Run(async () => new { url = await attachments.Download(id, fileId, ct) });
 [HttpDelete("receipts/{id:guid}/attachments/{fileId:guid}")] public Task<IActionResult> Remove(Guid id, Guid fileId, CancellationToken ct) => Run(() => attachments.Remove(id, fileId, ct));
 private async Task<IActionResult> Run<T>(Func<Task<T>> action) {
  try { return Ok(await action()); }
  catch (OperationConflictException e) { return Conflict(new { message = e.Message }); }
  catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
  catch (KeyNotFoundException) { return NotFound(); }
 }
}

