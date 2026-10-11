using Movers.Domain.Surveys;

namespace Movers.Services.Surveys;

/// <summary>Shared trip-clock rules for surveys and pickups: leave office → pause/resume → back at office.</summary>
public static class TripClock
{
    public sealed record Step(string Type, DateTimeOffset At);

    /// <summary>Active time runs from leaving the office to returning, excluding paused intervals; an open trip runs to now.</summary>
    public static (long ActiveSeconds, long PausedSeconds) Durations(DateTimeOffset? startedAt, DateTimeOffset? endedAt, IReadOnlyList<Step> steps, DateTimeOffset now)
    {
        // Records started before step logging existed only have the start/end stamps.
        var start = steps.FirstOrDefault(e => e.Type == SurveyTimeEventTypes.Started)?.At ?? startedAt;
        if (start is null) return (0, 0);
        var end = steps.LastOrDefault(e => e.Type == SurveyTimeEventTypes.Completed)?.At ?? endedAt;
        var stop = end ?? now; DateTimeOffset? pausedAt = null; var paused = TimeSpan.Zero;
        foreach (var e in steps)
        {
            if (e.Type == SurveyTimeEventTypes.Paused && pausedAt is null) pausedAt = e.At;
            else if (e.Type is SurveyTimeEventTypes.Resumed or SurveyTimeEventTypes.Completed && pausedAt is not null) { paused += e.At - pausedAt.Value; pausedAt = null; }
        }
        if (pausedAt is not null) paused += stop - pausedAt.Value;
        var total = stop - start.Value;
        return ((long)Math.Max(0, (total - paused).TotalSeconds), (long)Math.Max(0, paused.TotalSeconds));
    }

    /// <summary>Resolves the time for a new step: now by default, never in the future, never before the previous step.</summary>
    public static DateTimeOffset StepTime(DateTimeOffset? requested, DateTimeOffset? previous, bool isStart, DateTimeOffset now)
    {
        var at = requested ?? now;
        if (at > now.AddMinutes(5)) throw new InvalidOperationException("A trip step cannot be recorded in the future.");
        if (!isStart && previous is not null && at < previous) throw new InvalidOperationException("Each step must be recorded after the previous one.");
        return at;
    }

    public static void ValidateExpense(string? category, decimal amount, string? currency, DateTimeOffset incurredAtUtc, string? notes, DateTimeOffset now)
    {
        if (!SurveyExpenseCategories.All.Contains(category?.Trim().ToUpperInvariant())) throw new InvalidOperationException("Choose an expense category.");
        if (amount is <= 0 or > 10_000_000) throw new InvalidOperationException("Expense amount must be greater than zero.");
        if (currency is null || currency.Trim().Length != 3 || !currency.Trim().All(char.IsLetter)) throw new InvalidOperationException("Use a three-letter currency code, such as INR.");
        if (incurredAtUtc > now.AddDays(1)) throw new InvalidOperationException("Expense date cannot be in the future.");
        if (notes?.Length > 500) throw new InvalidOperationException("Keep expense notes under 500 characters.");
    }
}
