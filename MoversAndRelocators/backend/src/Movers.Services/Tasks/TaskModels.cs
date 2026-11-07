namespace Movers.Services.Tasks;

/// <summary>
/// One item on My Tasks. Status / AssignedTo: shown on the task; the Ids feed the update and reassign dialogs.
/// IsOpen: still to be done (any due date); CreatedAtUtc orders the list (newest first); CompletedAtUtc: when it was closed.
/// </summary>
public sealed record MyTaskModel(string Id, string Type, string Module, string Title, string Description,
    DateTimeOffset DueAtUtc, bool IsOverdue, string EntityId, string NavigationTarget,
    string? Status = null, Guid? StatusId = null, Guid? AssignedEmployeeId = null, string? AssignedTo = null,
    bool IsOpen = true, DateTimeOffset? CreatedAtUtc = null, DateTimeOffset? CompletedAtUtc = null);

/// <summary>Every task of one kind for the signed-in user, open and completed; TaskService filters and orders them.</summary>
public interface ITaskSource
{
    Task<IReadOnlyList<MyTaskModel>> GetTasksAsync(CancellationToken token);
}

public static class TaskStates { public const string Open = "open", Completed = "completed", All = "all"; }
/// <summary>Counts for the cards above the list (open tasks only, except Completed).</summary>
public sealed record TaskSummary(int Open, int DueToday, int Overdue, int Completed);

/// <summary>
/// One step in a task's history, oldest first. Event: OPENED, STATUS, COMPLETED, REOPENED, RESCHEDULED, REASSIGNED, NOTE.
/// From/To: the old and new status or person; Date: the new date of a RESCHEDULED step; Actor: who did it.
/// </summary>
public sealed record TaskHistoryStep(DateTimeOffset AtUtc, string Event, string? From = null, string? To = null, DateTimeOffset? Date = null, string? Note = null, string? Actor = null);

public interface ITaskHistoryQuery
{
    /// <summary>The history of the record behind a task id; null when the task does not exist or the user may not see it.</summary>
    Task<IReadOnlyList<TaskHistoryStep>?> GetAsync(string taskId, CancellationToken token);
}

public sealed record TaskOption(Guid Id, string Name, bool IsCompleted = false);
/// <summary>Choices for the task dialogs, limited to what the user may change.</summary>
public sealed record TaskActionOptions(IReadOnlyList<TaskOption> FollowUpStatuses, IReadOnlyList<TaskOption> Employees);
/// <summary>StatusId: follow-up tasks only. DueAtUtc: the new date (next follow-up, or the survey's new time). Note: added to the record's notes.</summary>
public sealed record UpdateTaskCommand(Guid? StatusId, DateTimeOffset? DueAtUtc, string? Note);
public sealed record ReassignTaskCommand(Guid EmployeeId, string? Note);
