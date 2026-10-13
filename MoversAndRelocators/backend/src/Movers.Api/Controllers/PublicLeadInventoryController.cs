using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Sales;

namespace Movers.Api.Controllers;

public sealed record LeadInventoryReviewRequest(IReadOnlyList<LeadInventoryDecision>? Lines);

/// <summary>
/// The expected inventory of a sales lead, opened by the customer through the link their coordinator shared.
/// They cannot change what is on the list, only say which of it they actually want moved; what they drop is left
/// out of the confirmed volume and of the quotation built from the inventory.
/// </summary>
[ApiController, AllowAnonymous, Route("api/public/lead-inventory/{token}")]
public sealed class PublicLeadInventoryController(ILeadUploadService links, LeadInventoryService inventory) : ControllerBase
{
    private const string Gone = "This inventory link is invalid or expired.";

    [HttpGet]
    public async Task<ActionResult> Get(string token, CancellationToken ct)
    {
        var lead = await links.ResolveLeadAsync(token, ct);
        if (lead is null) return NotFound(new { message = Gone });
        return Ok(new PublicLeadInventoryModel(lead.TenantName, lead.LeadNumber, lead.CustomerName, lead.ExpiresAtUtc, await inventory.PublicLines(lead.LeadId, ct)));
    }

    [HttpPut]
    public async Task<ActionResult> Review(string token, LeadInventoryReviewRequest request, CancellationToken ct)
    {
        var lead = await links.ResolveLeadAsync(token, ct);
        if (lead is null) return NotFound(new { message = Gone });
        try
        {
            await inventory.Review(lead.LeadId, request.Lines ?? [], ct);
            return Ok(new PublicLeadInventoryModel(lead.TenantName, lead.LeadNumber, lead.CustomerName, lead.ExpiresAtUtc, await inventory.PublicLines(lead.LeadId, ct)));
        }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
    }
}
