using Movers.Services.Crew;

namespace Movers.Services.Crew;

/// <summary>One booking of a person's time: a pickup or a packing job they are assigned to.</summary>
public sealed record Booking(Guid EmployeeId, string Kind, Guid JobId, string JobNumber, DateTimeOffset From, DateTimeOffset To);

public sealed record ScheduleClash(Guid EmployeeId, string EmployeeName, string Kind, string JobNumber, DateTimeOffset From, DateTimeOffset To);

/// <summary>Decides whether assigning people to a job would double-book them. Jobs occupy a window - scheduled
/// start plus the job's duration - and two windows that overlap are a clash. Touching windows do not overlap,
/// so a job ending at 12:00 and one starting at 12:00 are both allowed.</summary>
public static class ScheduleConflicts
{
    public static bool Overlaps(DateTimeOffset aFrom, DateTimeOffset aTo, DateTimeOffset bFrom, DateTimeOffset bTo)
        => aFrom < bTo && bFrom < aTo;

    /// <summary>Clashes for the given people in the given window, ignoring the job being assigned.</summary>
    public static IReadOnlyList<ScheduleClash> Find(
        IReadOnlyCollection<Guid> employeeIds,
        DateTimeOffset from, DateTimeOffset to,
        string excludeKind, Guid excludeJobId,
        IEnumerable<Booking> bookings,
        IReadOnlyDictionary<Guid, string> names)
    {
        var wanted = employeeIds.ToHashSet();
        return bookings
            .Where(b => wanted.Contains(b.EmployeeId))
            .Where(b => !(b.Kind == excludeKind && b.JobId == excludeJobId))
            .Where(b => Overlaps(from, to, b.From, b.To))
            .Select(b => new ScheduleClash(b.EmployeeId, names.TryGetValue(b.EmployeeId, out var n) ? n : "Someone", b.Kind, b.JobNumber, b.From, b.To))
            .OrderBy(x => x.EmployeeName).ToList();
    }

    /// <summary>A message naming who is busy and on what, because "there is a clash" is not actionable.</summary>
    public static string Describe(IReadOnlyList<ScheduleClash> clashes)
    {
        var parts = clashes.Take(5).Select(c =>
            $"{c.EmployeeName} is on {(c.Kind switch { "PICKUP" => "pickup", "DELIVERY" => "delivery", _ => "packing job" })} {c.JobNumber} ({c.From.ToLocalTime():dd MMM HH:mm}-{c.To.ToLocalTime():HH:mm})");
        var more = clashes.Count > 5 ? $" and {clashes.Count - 5} more" : "";
        return string.Join("; ", parts) + more + ".";
    }
}
