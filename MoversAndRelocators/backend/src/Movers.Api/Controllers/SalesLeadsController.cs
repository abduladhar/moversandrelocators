using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Api.Contracts.Sales;
using Movers.Services.Sales;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

[ApiController, Authorize, Route("api/sales/leads")]
public sealed class SalesLeadsController(ISalesService service) : ControllerBase
{
    [HttpGet, Authorize(Policy = SecurityPermissions.SalesView)] public async Task<ActionResult> List(CancellationToken t) => Ok(await service.ListLeadsAsync(t));
    [HttpGet("search"), Authorize(Policy = SecurityPermissions.SalesView)] public async Task<ActionResult> Search([FromQuery] Movers.Services.Common.ListQuery query, [FromQuery] Guid? statusId, [FromQuery] Guid? moveTypeId, [FromQuery] Guid? employeeId, [FromQuery] bool? active, [FromQuery] string? customerState, CancellationToken t) => Ok(await service.SearchLeadsAsync(new SalesLeadListFilter(statusId, moveTypeId, employeeId, active, customerState), query, t));
    [HttpPost, Authorize(Policy = SecurityPermissions.SalesManage)] public async Task<ActionResult> Create(SaveSalesLeadRequest r, CancellationToken t) { try { return Ok(await service.CreateLeadAsync(r.ToCommand(), t)); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    [HttpPut("{id:guid}"), Authorize(Policy = SecurityPermissions.SalesManage)] public async Task<ActionResult> Update(Guid id, SaveSalesLeadRequest r, CancellationToken t) { try { var x = await service.UpdateLeadAsync(id, r.ToCommand(), t); return x is null ? NotFound() : Ok(x); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    [HttpPatch("{id:guid}/status"), Authorize(Policy = SecurityPermissions.SalesManage)] public async Task<ActionResult> Status(Guid id, SetStatusRequest r, CancellationToken t) { var x = await service.SetLeadActiveAsync(id, r.IsActive, t); return x is null ? NotFound() : Ok(x); }
    [HttpGet("{leadId:guid}/follow-ups"), Authorize(Policy = SecurityPermissions.SalesView)] public async Task<ActionResult> FollowUps(Guid leadId, CancellationToken t) => Ok(await service.ListFollowUpsAsync(leadId, t));
    [HttpPost("{leadId:guid}/follow-ups"), Authorize(Policy = SecurityPermissions.SalesManage)] public async Task<ActionResult> AddFollowUp(Guid leadId, SaveFollowUpRequest r, CancellationToken t) { try { return Ok(await service.CreateFollowUpAsync(leadId, r.ToCommand(), t)); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    [HttpPut("follow-ups/{id:guid}"), Authorize(Policy = SecurityPermissions.SalesManage)] public async Task<ActionResult> UpdateFollowUp(Guid id, SaveFollowUpRequest r, CancellationToken t) { try { var x = await service.UpdateFollowUpAsync(id, r.ToCommand(), t); return x is null ? NotFound() : Ok(x); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
}
