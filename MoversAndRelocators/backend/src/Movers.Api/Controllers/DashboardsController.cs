using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Dashboards;

namespace Movers.Api.Controllers;

/// <summary>The module dashboards. Each one shows only the sections the user's permissions allow (Finance needs billing.view).</summary>
[ApiController, Authorize, Route("api/dashboards")]
public sealed class DashboardsController(DashboardService service) : ControllerBase
{
    [HttpGet("sales")] public async Task<ActionResult> Sales([FromQuery] int timezoneOffsetMinutes = 0, CancellationToken t = default) => Ok(await service.SalesAsync(timezoneOffsetMinutes, t));
    [HttpGet("operations")] public async Task<ActionResult> Operations([FromQuery] int timezoneOffsetMinutes = 0, CancellationToken t = default) => Ok(await service.OperationsAsync(timezoneOffsetMinutes, t));
    [HttpGet("finance")]
    public async Task<ActionResult> Finance([FromQuery] int timezoneOffsetMinutes = 0, CancellationToken t = default)
    {
        try { return Ok(await service.FinanceAsync(timezoneOffsetMinutes, t)); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }
}
