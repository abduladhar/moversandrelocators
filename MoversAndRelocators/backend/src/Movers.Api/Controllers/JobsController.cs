using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Operations;
using Movers.Services.Security;
namespace Movers.Api.Controllers;
[ApiController, Authorize(Policy = SecurityPermissions.OperationsManage), Route("api/jobs")]
public sealed class JobsController(JobService service) : ControllerBase {
 [HttpGet] public Task<IActionResult> List(CancellationToken ct) => Run(() => service.List(ct));
 [HttpGet("{id:guid}")] public Task<IActionResult> Get(Guid id, CancellationToken ct) => Run(() => service.Get(id, ct));
 [HttpPost] public Task<IActionResult> Create(CreateJob input, CancellationToken ct) => Run(() => service.Create(input, ct));
 [HttpPut("{id:guid}")] public Task<IActionResult> Edit(Guid id, EditJob input, CancellationToken ct) => Run(() => service.Edit(id, input, ct));
 [HttpPost("{id:guid}/load")] public Task<IActionResult> Load(Guid id, LoadJob input, CancellationToken ct) => Run(() => service.Load(id, input, ct));
 [HttpPost("{id:guid}/cargo/{cargoId:guid}/return")] public Task<IActionResult> Return(Guid id, Guid cargoId, JobStep input, CancellationToken ct) => Run(() => service.Unload(id, cargoId, input, ct));
 [HttpPost("{id:guid}/actions/{operation}")] public Task<IActionResult> Step(Guid id, string operation, JobStep input, CancellationToken ct) => Run(() => service.Step(id, operation, input, ct));
 private async Task<IActionResult> Run<T>(Func<Task<T>> action) {
  try { return Ok(await action()); }
  catch (OperationConflictException e) { return Conflict(new { message = e.Message }); }
  catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
  catch (KeyNotFoundException) { return NotFound(); }
 }
}

