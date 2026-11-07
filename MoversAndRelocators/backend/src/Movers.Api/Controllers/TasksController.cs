using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Tasks;

namespace Movers.Api.Controllers;

[ApiController, Authorize, Route("api/tasks")]
public sealed class TasksController(ITaskService service, TaskActionService actions) : ControllerBase
{
    [HttpGet("mine")]
    public async Task<ActionResult> Mine([FromQuery] int timezoneOffsetMinutes = 0, CancellationToken token = default) =>
        Ok(await service.GetMyTasksAsync(timezoneOffsetMinutes, token));

    /// <summary>The user's tasks, newest first: state = open (default), completed or all; search matches the text, status and person.</summary>
    [HttpGet]
    public async Task<ActionResult> Search([FromQuery] string? state, [FromQuery] Movers.Services.Common.ListQuery query, [FromQuery] int timezoneOffsetMinutes = 0, CancellationToken token = default) =>
        Ok(await service.SearchAsync(state, query, timezoneOffsetMinutes, token));

    /// <summary>What happened to the task, oldest first: opened, status changes, rescheduled, reassigned, notes, completed.</summary>
    [HttpGet("{taskId}/history")]
    public async Task<ActionResult> History(string taskId, [FromServices] ITaskHistoryQuery history, CancellationToken token) =>
        await history.GetAsync(taskId, token) is { } steps ? Ok(steps) : NotFound();

    /// <summary>Statuses and people the user can pick in the task dialogs.</summary>
    [HttpGet("options")]
    public async Task<ActionResult> Options(CancellationToken token) => Ok(await actions.OptionsAsync(token));

    /// <summary>Changes the status, date or notes of the record behind a task (each module's own permission applies).</summary>
    [HttpPost("{taskId}/update")]
    public Task<ActionResult> Update(string taskId, UpdateTaskRequest request, CancellationToken token) =>
        Run(async () => await actions.UpdateAsync(taskId, new(request.StatusId, request.DueAtUtc, request.Note), token));

    /// <summary>Hands the task to another employee: the survey's surveyor, or the owner of the lead behind a follow-up.</summary>
    [HttpPost("{taskId}/reassign")]
    public Task<ActionResult> Reassign(string taskId, ReassignTaskRequest request, CancellationToken token) =>
        Run(async () => await actions.ReassignAsync(taskId, new(request.EmployeeId, request.Note), token));

    private async Task<ActionResult> Run(Func<Task<bool>> action)
    {
        try { return await action() ? NoContent() : NotFound(); }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
    }
}

public sealed record UpdateTaskRequest(Guid? StatusId, DateTimeOffset? DueAtUtc, [StringLength(1000)] string? Note);
public sealed record ReassignTaskRequest([Required] Guid EmployeeId, [StringLength(1000)] string? Note);
