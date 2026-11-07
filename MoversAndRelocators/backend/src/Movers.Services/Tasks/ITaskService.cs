using Movers.Services.Common;

namespace Movers.Services.Tasks;

public interface ITaskService
{
    /// <summary>Open tasks due by the end of the user's today (overdue first) — the original "today's work" list.</summary>
    Task<IReadOnlyList<MyTaskModel>> GetMyTasksAsync(int timezoneOffsetMinutes, CancellationToken token);
    /// <summary>
    /// The user's tasks, newest first. state: open (default), completed or all; query.Search matches title, description,
    /// module, status and assignee. The summary (TaskSummary) counts every task, whatever the filter.
    /// </summary>
    Task<PagedResult<MyTaskModel>> SearchAsync(string? state, ListQuery query, int timezoneOffsetMinutes, CancellationToken token);
}
