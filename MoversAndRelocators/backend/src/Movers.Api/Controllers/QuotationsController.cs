using Movers.Api.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Api.Contracts.Quotations;
using Movers.Services.Quotations;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

[ApiController, Authorize(Policy = SecurityPermissions.QuotesManage), Route("api/quotations")]
public sealed class QuotationsController(IQuotationService service, PublicLinks links) : ControllerBase
{
    [HttpGet] public async Task<ActionResult> List(CancellationToken t) => await Run(() => service.ListAsync(t));
    /// <summary>Advanced search: ?search=&sort=&desc=&skip=&take= plus status, employeeId and customerState.</summary>
    [HttpGet("search")] public async Task<ActionResult> Search([FromQuery] Movers.Services.Common.ListQuery query, [FromQuery] string? status, [FromQuery] Guid? employeeId, [FromQuery] string? customerState, CancellationToken t) => await Run(() => service.SearchAsync(new QuotationListFilter(status, employeeId, customerState), query, t));
    [HttpGet("{id:guid}")] public async Task<ActionResult> Get(Guid id, CancellationToken t) => await RunNullable(() => service.GetAsync(id, t));
    [HttpPost] public async Task<ActionResult> Create(SaveQuotationRequest r, CancellationToken t) => await Run(() => service.CreateAsync(r.ToCommand(), t));
    [HttpPost("{id:guid}/revisions")] public async Task<ActionResult> Revise(Guid id, CancellationToken t) => await RunNullable(() => service.CreateRevisionAsync(id, t));
    [HttpPut("{id:guid}")] public async Task<ActionResult> Update(Guid id, SaveQuotationRequest r, CancellationToken t) => await RunNullable(() => service.UpdateAsync(id, r.ToCommand(), t));
    [HttpPut("{id:guid}/lines")] public async Task<ActionResult> Lines(Guid id, SaveQuotationLinesRequest r, CancellationToken t) => await RunNullable(() => service.SaveLinesAsync(id, r.Lines.Select(x => x.ToCommand()).ToList(), t));
    [HttpPut("{id:guid}/items")] public async Task<ActionResult> Items(Guid id, SaveQuotationItemsRequest r, CancellationToken t) => await RunNullable(() => service.SaveItemsAsync(id, r.Items.Select(x => x.ToCommand()).ToList(), t));
    [HttpPost("{id:guid}/items/from-lead-inventory")] public async Task<ActionResult> ImportLeadInventory(Guid id, CancellationToken t) => await RunNullable(() => service.ImportLeadInventoryAsync(id, t));
    [HttpPost("{id:guid}/share-link")] public async Task<ActionResult> Share(Guid id, GenerateQuotationLinkRequest r, CancellationToken t) { try { var x = await service.GenerateLinkAsync(id, r.ValidDays, t); var baseUrl = links.BaseUrl; return Ok(new { url = $"{baseUrl}/quotation/{Uri.EscapeDataString(x.Token)}", x.ExpiresAtUtc }); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    [HttpPost("{id:guid}/requote-requests/{requestId:guid}/apply")] public async Task<ActionResult> ApplyRequote(Guid id, Guid requestId, CancellationToken t) => await RunNullable(() => service.ApplyRequoteRequestAsync(id, requestId, t));
    private async Task<ActionResult> Run<T>(Func<Task<T>> action) { try { return Ok(await action()); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    private async Task<ActionResult> RunNullable<T>(Func<Task<T?>> action) where T : class { try { var x = await action(); return x is null ? NotFound() : Ok(x); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
}
