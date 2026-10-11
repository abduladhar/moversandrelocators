namespace Movers.Services.Tasks;

public interface ITaskService
{
    Task<IReadOnlyList<MyTaskModel>> GetMyTasksAsync(int timezoneOffsetMinutes, CancellationToken token);
}
