using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Sales;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

public sealed record SaveLeadInventoryRequest(IReadOnlyList<SaveLeadInventoryLine>? Lines);

/// <summary>Expected inventory of a sales lead (items and boxes with CBM and fragile flags), filled by AI extraction and edited by staff.</summary>
[ApiController, Authorize, Route("api/sales/leads/{leadId:guid}/inventory")]
public sealed class SalesLeadInventoryController(LeadInventoryService service) : ControllerBase
{
    [HttpGet, Authorize(Policy = SecurityPermissions.SalesView)]
    public async Task<ActionResult> Get(Guid leadId, CancellationToken ct) { var x = await service.Get(leadId, ct); return x is null ? NotFound() : Ok(x); }

    [HttpPut, Authorize(Policy = SecurityPermissions.SalesManage)]
    public async Task<ActionResult> Save(Guid leadId, SaveLeadInventoryRequest request, CancellationToken ct)
    {
        try { var x = await service.Save(leadId, request.Lines ?? [], ct); return x is null ? NotFound() : Ok(x); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
    }
}
