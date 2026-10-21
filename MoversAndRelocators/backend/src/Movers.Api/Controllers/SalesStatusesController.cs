using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Api.Contracts.Sales;
using Movers.Services.Sales;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

[ApiController, Authorize, Route("api/sales/statuses")]
public sealed class SalesStatusesController(ISalesService service) : ControllerBase
{
    [HttpGet("leads/search"), Authorize(Policy = SecurityPermissions.SalesView)] public async Task<ActionResult> SearchLeadStatuses([FromQuery] Movers.Services.Common.ListQuery query, [FromQuery] bool? active, CancellationToken t) => Ok(await service.SearchLeadStatusesAsync(active, query, t));
    [HttpGet("follow-ups/search"), Authorize(Policy = SecurityPermissions.SalesView)] public async Task<ActionResult> SearchFollowStatuses([FromQuery] Movers.Services.Common.ListQuery query, [FromQuery] bool? active, CancellationToken t) => Ok(await service.SearchFollowUpStatusesAsync(active, query, t));
    [HttpGet("move-types/search"), Authorize(Policy = SecurityPermissions.SalesView)] public async Task<ActionResult> SearchMoveTypes([FromQuery] Movers.Services.Common.ListQuery query, [FromQuery] bool? active, CancellationToken t) => Ok(await service.SearchMoveTypesAsync(active, query, t));
    [HttpGet("leads"), Authorize(Policy = SecurityPermissions.SalesView)] public async Task<ActionResult> LeadStatuses(CancellationToken t) => Ok(await service.ListLeadStatusesAsync(t));
    [HttpPost("leads"), Authorize(Policy = SecurityPermissions.SalesStatusesManage)] public async Task<ActionResult> CreateLeadStatus(SaveLeadStatusRequest r, CancellationToken t) { try { return Ok(await service.CreateLeadStatusAsync(r.ToCommand(), t)); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    [HttpPut("leads/{id:guid}"), Authorize(Policy = SecurityPermissions.SalesStatusesManage)] public async Task<ActionResult> UpdateLeadStatus(Guid id, SaveLeadStatusRequest r, CancellationToken t) { try { var x = await service.UpdateLeadStatusAsync(id, r.ToCommand(), t); return x is null ? NotFound() : Ok(x); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    [HttpPatch("leads/{id:guid}/status"), Authorize(Policy = SecurityPermissions.SalesStatusesManage)] public async Task<ActionResult> LeadStatusActive(Guid id, SetStatusRequest r, CancellationToken t) { var x = await service.SetLeadStatusActiveAsync(id, r.IsActive, t); return x is null ? NotFound() : Ok(x); }
    [HttpGet("follow-ups"), Authorize(Policy = SecurityPermissions.SalesView)] public async Task<ActionResult> FollowStatuses(CancellationToken t) => Ok(await service.ListFollowUpStatusesAsync(t));
    [HttpPost("follow-ups"), Authorize(Policy = SecurityPermissions.SalesStatusesManage)] public async Task<ActionResult> CreateFollowStatus(SaveFollowUpStatusRequest r, CancellationToken t) { try { return Ok(await service.CreateFollowUpStatusAsync(r.ToCommand(), t)); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    [HttpPut("follow-ups/{id:guid}"), Authorize(Policy = SecurityPermissions.SalesStatusesManage)] public async Task<ActionResult> UpdateFollowStatus(Guid id, SaveFollowUpStatusRequest r, CancellationToken t) { try { var x = await service.UpdateFollowUpStatusAsync(id, r.ToCommand(), t); return x is null ? NotFound() : Ok(x); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    [HttpPatch("follow-ups/{id:guid}/status"), Authorize(Policy = SecurityPermissions.SalesStatusesManage)] public async Task<ActionResult> FollowStatusActive(Guid id, SetStatusRequest r, CancellationToken t) { var x = await service.SetFollowUpStatusActiveAsync(id, r.IsActive, t); return x is null ? NotFound() : Ok(x); }
    [HttpGet("move-types"), Authorize(Policy = SecurityPermissions.SalesView)] public async Task<ActionResult> MoveTypes(CancellationToken t) => Ok(await service.ListMoveTypesAsync(t));
    [HttpPost("move-types"), Authorize(Policy = SecurityPermissions.SalesStatusesManage)] public async Task<ActionResult> CreateMoveType(SaveMoveTypeRequest r, CancellationToken t) { try { return Ok(await service.CreateMoveTypeAsync(r.ToCommand(), t)); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    [HttpPut("move-types/{id:guid}"), Authorize(Policy = SecurityPermissions.SalesStatusesManage)] public async Task<ActionResult> UpdateMoveType(Guid id, SaveMoveTypeRequest r, CancellationToken t) { try { var x = await service.UpdateMoveTypeAsync(id, r.ToCommand(), t); return x is null ? NotFound() : Ok(x); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    [HttpPatch("move-types/{id:guid}/status"), Authorize(Policy = SecurityPermissions.SalesStatusesManage)] public async Task<ActionResult> MoveTypeActive(Guid id, SetStatusRequest r, CancellationToken t) { var x = await service.SetMoveTypeActiveAsync(id, r.IsActive, t); return x is null ? NotFound() : Ok(x); }
}
