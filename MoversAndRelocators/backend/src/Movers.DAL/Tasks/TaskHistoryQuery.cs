using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.CustomerLinks;
using Movers.Domain.Surveys;
using Movers.Services.CustomerLinks;
using Movers.Services.Security;
using Movers.Services.Tasks;
using Movers.Services.Tenancy;

namespace Movers.DAL.Tasks;

/// <summary>
/// A task's history, read from the audit log of the record behind it, so changes made anywhere (My Tasks, the
/// lead, the survey screens) appear: opened, status changes, completed / reopened, rescheduled, reassigned, notes added.
/// Customer replies use their own history (replied = opened, office action = completed).
/// </summary>
public sealed partial class TaskHistoryQuery(MoversDbContext db, IUserContext user, ITenantContext tenant, ICustomerReplyQueries replies) : ITaskHistoryQuery
{
    private sealed record Audit(DateTimeOffset At, string Action, string Changes, Guid? ActorId, string ActorEmail);

    public async Task<IReadOnlyList<TaskHistoryStep>?> GetAsync(string taskId, CancellationToken t)
    {
        var parts = (taskId ?? "").Split(':');
        if (parts is ["customer-reply", var type, var raw] && Guid.TryParse(raw, out var recordId)) return await Replies(type.Trim().ToUpperInvariant(), recordId, t);
        if (parts is not [var kind, var rawId] || !Guid.TryParse(rawId, out var id)) return null;
        return kind switch
        {
            "sales-follow-up" when user.HasPermission(SecurityPermissions.SalesView) => await FollowUp(id, t),
            "survey" when user.HasPermission(SecurityPermissions.SurveysManage) => await Survey(id, t),
            _ => null,
        };
    }

    private async Task<IReadOnlyList<TaskHistoryStep>?> FollowUp(Guid id, CancellationToken t)
    {
        var followUp = await db.LeadFollowUps.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, t); if (followUp is null) return null;
        var statuses = await db.FollowUpStatuses.AsNoTracking().ToDictionaryAsync(x => x.Id, x => (x.Name, x.IsCompleted), t);
        (string Name, bool Done)? Status(string? value) => Guid.TryParse(value, out var s) && statuses.TryGetValue(s, out var x) ? x : null;
        var steps = new List<TaskHistoryStep>();
        var audits = await Audits("LeadFollowUp", id, t);
        foreach (var a in audits)
        {
            var c = Parse(a.Changes); var actor = await Actor(a, t); var before = steps.Count;
            if (a.Action == "ADDED") { steps.Add(new(a.At, "OPENED", To: Status(Value(c, "StatusId"))?.Name, Note: Value(c, "Notes"), Actor: actor)); continue; }
            if (Change(c, "StatusId") is var (oldId, newId))
            {
                var (from, to) = (Status(oldId), Status(newId));
                steps.Add(new(a.At, to?.Done == true && from?.Done != true ? "COMPLETED" : from?.Done == true && to?.Done != true ? "REOPENED" : "STATUS", from?.Name, to?.Name, Actor: actor));
            }
            var moved = Change(c, "NextFollowUpAtUtc")?.New ?? Change(c, "ScheduledAtUtc")?.New;
            if (moved is not null && DateTimeOffset.TryParse(moved, out var when)) steps.Add(new(a.At, "RESCHEDULED", Date: when, Actor: actor));
            Note(a.At, Added(Change(c, "Notes")), actor, steps, before);
        }
        if (audits.Count == 0) steps.Add(new(followUp.CreatedAtUtc, "OPENED", To: statuses.GetValueOrDefault(followUp.StatusId).Name));
        // The task belongs to the lead's owner: a change of owner after the follow-up was made is a reassignment.
        var since = steps.FirstOrDefault()?.AtUtc ?? followUp.CreatedAtUtc;
        // Only while the task was open: a later change of the lead's owner did not move a follow-up that was already completed.
        var until = steps.LastOrDefault(x => x.Event is "COMPLETED" or "REOPENED") is { Event: "COMPLETED" } closed ? closed.AtUtc : DateTimeOffset.MaxValue;
        await Reassignments("SalesLead", followUp.SalesLeadId, since, steps, t, until: until);
        return steps.OrderBy(x => x.AtUtc).ToList();
    }

    private async Task<IReadOnlyList<TaskHistoryStep>?> Survey(Guid id, CancellationToken t)
    {
        var survey = await db.Surveys.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, t); if (survey is null) return null;
        var steps = new List<TaskHistoryStep>();
        var audits = await Audits("Survey", id, t);
        foreach (var a in audits)
        {
            var c = Parse(a.Changes); var actor = await Actor(a, t); var before = steps.Count;
            if (a.Action == "ADDED") { steps.Add(new(a.At, "OPENED", To: Value(c, "Status"), Actor: actor)); continue; }
            if (Change(c, "Status") is var (from, to))
                steps.Add(new(a.At, to == SurveyStatuses.Completed ? "COMPLETED" : from == SurveyStatuses.Completed ? "REOPENED" : "STATUS", from, to, Actor: actor));
            if (Change(c, "ScheduledAtUtc")?.New is { } moved && DateTimeOffset.TryParse(moved, out var when)) steps.Add(new(a.At, "RESCHEDULED", Date: when, Actor: actor));
            Note(a.At, Added(Change(c, "Notes")), actor, steps, before);
        }
        if (audits.Count == 0) steps.Add(new(survey.CreatedAtUtc, "OPENED", To: survey.Status));
        await Reassignments("Survey", id, DateTimeOffset.MinValue, steps, t, "AssignedEmployeeId");
        return steps.OrderBy(x => x.AtUtc).ToList();
    }

    private async Task<IReadOnlyList<TaskHistoryStep>?> Replies(string recordType, Guid recordId, CancellationToken t)
    {
        try
        {
            return (await replies.HistoryAsync(recordType, recordId, t))
                .Where(x => x.Event is CustomerReplyEvents.Replied or CustomerReplyEvents.ActionTaken)
                .Select(x => x.Event == CustomerReplyEvents.Replied
                    ? new TaskHistoryStep(x.AtUtc, "OPENED", To: "REPLIED", Note: x.Note, Actor: x.Actor)
                    : new TaskHistoryStep(x.AtUtc, "COMPLETED", To: "HANDLED", Note: x.Note, Actor: x.Actor))
                .OrderBy(x => x.AtUtc).ToList();
        }
        catch (UnauthorizedAccessException) { return null; }
    }

    /// <summary>Adds a REASSIGNED step for each change of the assigned employee on the record after <paramref name="since"/>.</summary>
    private async Task Reassignments(string entityType, Guid id, DateTimeOffset since, List<TaskHistoryStep> steps, CancellationToken t, string property = "AssignedEmployeeId", DateTimeOffset? until = null)
    {
        var changes = (await Audits(entityType, id, t)).Where(a => a.Action == "MODIFIED" && a.At >= since && a.At <= (until ?? DateTimeOffset.MaxValue))
            .Select(a => (a, Change: Change(Parse(a.Changes), property))).Where(x => x.Change is not null).ToList();
        if (changes.Count == 0) return;
        var ids = changes.SelectMany(x => new[] { x.Change!.Value.Old, x.Change!.Value.New }).Select(v => Guid.TryParse(v, out var g) ? g : Guid.Empty).Distinct().ToList();
        var names = await db.Employees.AsNoTracking().Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => (x.FirstName + " " + x.LastName).Trim(), t);
        string? Name(string? v) => Guid.TryParse(v, out var g) && names.TryGetValue(g, out var n) ? n : null;
        foreach (var (a, change) in changes)
            steps.Add(new(a.At, "REASSIGNED", Name(change!.Value.Old), Name(change.Value.New), Note: handovers.Where(h => Math.Abs((h.At - a.At).TotalSeconds) < 10).OrderBy(h => Math.Abs((h.At - a.At).Ticks)).FirstOrDefault().Note, Actor: await Actor(a, t)));
    }

    private async Task<List<Audit>> Audits(string entityType, Guid id, CancellationToken t)
    {
        var key = id.ToString(); var tenantId = tenant.TenantId;
        return await db.AuditLogs.AsNoTracking().Where(x => x.TenantId == tenantId && x.EntityType == entityType && x.EntityId == key)
            .OrderBy(x => x.SerialNo).Select(x => new Audit(x.CreatedAtUtc, x.Action, x.Changes, x.ActorUserId, x.ActorEmail)).ToListAsync(t);
    }

    [System.Text.RegularExpressions.GeneratedRegex(@"^\[\d{2} \w{3} \d{4}\] ")] private static partial System.Text.RegularExpressions.Regex DatePrefix();
    private readonly Dictionary<Guid, string> actors = [];
    private readonly List<(DateTimeOffset At, string? Note)> handovers = [];
    /// <summary>
    /// Adds a NOTE step for text added to the notes. Each line My Tasks adds starts with "[07 Nov 2026] " (the step has its own
    /// time, so that is dropped); a "Reassigned to …" line is kept for the REASSIGNED step instead.
    /// </summary>
    private void Note(DateTimeOffset at, string? added, string actor, List<TaskHistoryStep> steps, int stepsBefore)
    {
        if (added is null) return;
        var lines = added.Split('\n').Select(l => DatePrefix().Replace(l.Trim(), "")).Where(l => l.Length > 0).ToList();
        foreach (var line in lines.Where(l => l.StartsWith("Reassigned to ", StringComparison.Ordinal)))
            handovers.Add((at, line.IndexOf(": ", StringComparison.Ordinal) is var i and > 0 ? line[(i + 2)..] : null));
        var text = string.Join("\n", lines.Where(l => !l.StartsWith("Reassigned to ", StringComparison.Ordinal)));
        if (text.Length == 0) return;
        // A note saved with a status change or a new date belongs to that step; on its own it is a NOTE step.
        if (steps.Count > stepsBefore) steps[stepsBefore] = steps[stepsBefore] with { Note = text };
        else steps.Add(new(at, "NOTE", Note: text, Actor: actor));
    }
    private async Task<string> Actor(Audit a, CancellationToken t)
    {
        if (a.ActorId is not { } id) return a.ActorEmail;
        if (!actors.TryGetValue(id, out var name))
            actors[id] = name = await db.Users.AsNoTracking().Where(x => x.Id == id).Select(x => x.FullName).SingleOrDefaultAsync(t) is { Length: > 0 } n ? n : a.ActorEmail;
        return name;
    }

    private static JsonElement Parse(string json) { try { return JsonDocument.Parse(json).RootElement; } catch (JsonException) { return default; } }
    private static string? Text(JsonElement e) => e.ValueKind switch { JsonValueKind.String => e.GetString(), JsonValueKind.Null or JsonValueKind.Undefined => null, _ => e.ToString() };
    /// <summary>A property's value in an ADDED entry.</summary>
    private static string? Value(JsonElement c, string name) => c.ValueKind == JsonValueKind.Object && c.TryGetProperty(name, out var v) ? Text(v) : null;
    /// <summary>A property's old and new values in a MODIFIED entry; null when it did not change.</summary>
    private static (string? Old, string? New)? Change(JsonElement c, string name) =>
        c.ValueKind == JsonValueKind.Object && c.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Object && v.TryGetProperty("New", out var n)
            ? (v.TryGetProperty("Old", out var o) ? Text(o) : null, Text(n)) is var pair && pair.Item1 != pair.Item2 ? pair : null
            : null;
    /// <summary>The text appended to a notes field (notes are added to, not rewritten, by My Tasks).</summary>
    private static string? Added((string? Old, string? New)? change) =>
        change is not { New: { } now } || string.IsNullOrWhiteSpace(now) ? null
        : change.Value.Old is { } before && now.StartsWith(before, StringComparison.Ordinal) ? now[before.Length..].Trim() is { Length: > 0 } extra ? extra : null
        : now.Trim();
}
