namespace Movers.Services.Tasks;

public sealed record MyTaskModel(string Id, string Type, string Module, string Title, string Description,
    DateTimeOffset DueAtUtc, bool IsOverdue, string EntityId, string NavigationTarget);

public interface ITodayTaskSource
{
    Task<IReadOnlyList<MyTaskModel>> GetTasksDueThroughAsync(DateTimeOffset endUtc, CancellationToken token);
}
