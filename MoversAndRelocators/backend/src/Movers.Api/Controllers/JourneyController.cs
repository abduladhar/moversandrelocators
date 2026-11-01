using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Sales;

namespace Movers.Api.Controllers;

/// <summary>
/// The move a record belongs to (lead → survey → quotation → packing → pickup → delivery), for the stage bar on
/// record pages. Anyone who works in one of those modules may see it: it shows only numbers, statuses and dates.
/// </summary>
[ApiController, Authorize, Route("api/journey")]
public sealed class JourneyController(ILeadJourneyQuery journey) : ControllerBase
{
    private static readonly string[] Modules = ["sales.view", "surveys.manage", "quotes.manage", "operations.manage", "packing.manage", "delivery.manage"];
    private static readonly string[] Stages = [LeadJourneyStages.Survey, LeadJourneyStages.Quotation, LeadJourneyStages.Pickup, LeadJourneyStages.Packing, LeadJourneyStages.Delivery];

    /// <summary>Returns the lead id (null when the record has no lead) and its journey.</summary>
    [HttpGet("{stage}/{id:guid}")]
    public async Task<ActionResult> ForRecord(string stage, Guid id, CancellationToken token)
    {
        if (!User.FindAll("permission").Any(x => Modules.Contains(x.Value))) return Forbid();
        stage = stage.ToUpperInvariant();
        if (!Stages.Contains(stage)) return BadRequest();
        var leadId = await journey.FindLeadAsync(stage, id, token);
        if (leadId is not { } lead) return Ok(new { leadId, leadNumber = (string?)null, steps = Array.Empty<LeadJourneyStep>() });
        return Ok(new { leadId, leadNumber = await journey.LeadNumberAsync(lead, token), steps = await journey.GetAsync(lead, token) });
    }
}
