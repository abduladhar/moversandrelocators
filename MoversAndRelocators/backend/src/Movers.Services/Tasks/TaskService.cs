namespace Movers.Services.Tasks;

public sealed class TaskService(IEnumerable<ITodayTaskSource> sources, TimeProvider timeProvider) : ITaskService
{
    public async Task<IReadOnlyList<MyTaskModel>> GetMyTasksAsync(int timezoneOffsetMinutes, CancellationToken token)
    {
        var now = timeProvider.GetUtcNow();
        var utcToLocalOffset = TimeSpan.FromMinutes(-Math.Clamp(timezoneOffsetMinutes, -840, 840));
        var localNow = now.ToOffset(utcToLocalOffset);
        var endOfTodayUtc = new DateTimeOffset(localNow.Date.AddDays(1).AddTicks(-1), utcToLocalOffset).ToUniversalTime();
        // Task sources use the same request-scoped EF Core DbContext. DbContext is not thread-safe,
        // so execute the sources in sequence instead of starting overlapping database operations.
        var tasks = new List<MyTaskModel>();
        foreach (var source in sources)
            tasks.AddRange(await source.GetTasksDueThroughAsync(endOfTodayUtc, token));
        return tasks
            .Select(x => x with { IsOverdue = x.DueAtUtc < now })
            .OrderByDescending(x => x.IsOverdue)
            .ThenBy(x => x.DueAtUtc)
            .ToList();
    }
}
