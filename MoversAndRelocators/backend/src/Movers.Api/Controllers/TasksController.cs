using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Tasks;

namespace Movers.Api.Controllers;

[ApiController, Authorize, Route("api/tasks")]
public sealed class TasksController(ITaskService service) : ControllerBase
{
    [HttpGet("mine")]
    public async Task<ActionResult> Mine([FromQuery] int timezoneOffsetMinutes = 0, CancellationToken token = default) =>
        Ok(await service.GetMyTasksAsync(timezoneOffsetMinutes, token));
}
