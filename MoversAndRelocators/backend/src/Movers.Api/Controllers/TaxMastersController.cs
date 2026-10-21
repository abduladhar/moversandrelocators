using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Api.Contracts.Quotations;
using Movers.Services.Quotations;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

[ApiController, Authorize(Policy = SecurityPermissions.QuotesManage), Route("api/quotations/taxes")]
public sealed class TaxMastersController(IQuotationService service) : ControllerBase
{
    [HttpGet] public async Task<ActionResult> List(CancellationToken t) => Ok(await service.ListTaxesAsync(t));
    [HttpGet("search")] public async Task<ActionResult> Search([FromQuery] Movers.Services.Common.ListQuery query, [FromQuery] string? kind, CancellationToken t) => await Run(() => service.SearchTaxesAsync(kind, query, t));
    [HttpPost] public async Task<ActionResult> Create(SaveTaxRequest r, CancellationToken t) => await Run(() => service.CreateTaxAsync(r.ToCommand(), t));
    [HttpPut("{id:guid}")] public async Task<ActionResult> Update(Guid id, SaveTaxRequest r, CancellationToken t) => await RunNullable(() => service.UpdateTaxAsync(id, r.ToCommand(), t));
    [HttpPatch("{id:guid}/status")] public async Task<ActionResult> Status(Guid id, SetTaxStatusRequest r, CancellationToken t) => await RunNullable(() => service.SetTaxActiveAsync(id, r.IsActive, t));
    private async Task<ActionResult> Run<T>(Func<Task<T>> action) { try { return Ok(await action()); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    private async Task<ActionResult> RunNullable<T>(Func<Task<T?>> action) where T : class { try { var x = await action(); return x is null ? NotFound() : Ok(x); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
}
