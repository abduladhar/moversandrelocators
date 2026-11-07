using Movers.Services.Common;

namespace Movers.Services.Tasks;

public sealed class TaskService(IEnumerable<ITaskSource> sources, TimeProvider timeProvider) : ITaskService
{
    public async Task<IReadOnlyList<MyTaskModel>> GetMyTasksAsync(int timezoneOffsetMinutes, CancellationToken token)
    {
        var endOfTodayUtc = EndOfToday(timezoneOffsetMinutes);
        return (await AllAsync(token))
            .Where(x => x.IsOpen && x.DueAtUtc <= endOfTodayUtc)
            .OrderByDescending(x => x.IsOverdue)
            .ThenBy(x => x.DueAtUtc)
            .ToList();
    }

    public async Task<PagedResult<MyTaskModel>> SearchAsync(string? state, ListQuery query, int timezoneOffsetMinutes, CancellationToken token)
    {
        query = query.Normalized();
        var all = await AllAsync(token);
        var endOfTodayUtc = EndOfToday(timezoneOffsetMinutes);
        var open = all.Where(x => x.IsOpen).ToList();
        var summary = new TaskSummary(open.Count, open.Count(x => !x.IsOverdue && x.DueAtUtc <= endOfTodayUtc), open.Count(x => x.IsOverdue), all.Count - open.Count);
        IEnumerable<MyTaskModel> rows = (state ?? TaskStates.Open).Trim().ToLowerInvariant() switch
        {
            TaskStates.All => all,
            TaskStates.Completed => all.Where(x => !x.IsOpen),
            _ => open,
        };
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var words = query.Search.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            rows = rows.Where(x => words.All(w => new[] { x.Title, x.Description, x.Module, x.Status, x.AssignedTo }.Any(v => v?.Contains(w, StringComparison.OrdinalIgnoreCase) == true)));
        }
        // Newest first: the order the tasks were created in.
        var ordered = rows.OrderByDescending(x => x.CreatedAtUtc ?? x.DueAtUtc).ThenByDescending(x => x.DueAtUtc).ToList();
        return new(ordered.Skip(query.Skip).Take(query.Take).ToList(), ordered.Count, summary);
    }

    private async Task<List<MyTaskModel>> AllAsync(CancellationToken token)
    {
        var now = timeProvider.GetUtcNow();
        // Task sources use the same request-scoped EF Core DbContext. DbContext is not thread-safe,
        // so execute the sources in sequence instead of starting overlapping database operations.
        var tasks = new List<MyTaskModel>();
        foreach (var source in sources)
            tasks.AddRange(await source.GetTasksAsync(token));
        return tasks.Select(x => x with { IsOverdue = x.IsOpen && x.DueAtUtc < now }).ToList();
    }

    private DateTimeOffset EndOfToday(int timezoneOffsetMinutes)
    {
        var utcToLocalOffset = TimeSpan.FromMinutes(-Math.Clamp(timezoneOffsetMinutes, -840, 840));
        var localNow = timeProvider.GetUtcNow().ToOffset(utcToLocalOffset);
        return new DateTimeOffset(localNow.Date.AddDays(1).AddTicks(-1), utcToLocalOffset).ToUniversalTime();
    }
}
