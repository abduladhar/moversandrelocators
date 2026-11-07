using Movers.Services.CustomerLinks;
using Movers.Services.Sales;
using Movers.Services.Security;
using Movers.Services.Surveys;

namespace Movers.Services.Tasks;

/// <summary>
/// Acts on a My Tasks item by changing the record behind it, through that record's own service so its rules and
/// history apply: a sales follow-up (status, next date; reassigning moves the lead), a survey (new time, surveyor;
/// starting and completing stay in the survey visit) or a customer reply (mark handled; it belongs to the whole module).
/// </summary>
public sealed class TaskActionService(IUserContext user, ISalesRepository sales, ISalesService leads, ISurveyRepository surveyRecords,
    ISurveyService surveys, ICustomerReplyQueries replies, TimeProvider clock)
{
    private const int NotesLimit = 2000;

    public async Task<TaskActionOptions> OptionsAsync(CancellationToken t)
    {
        var canSales = user.HasPermission(SecurityPermissions.SalesManage);
        var statuses = canSales ? (await sales.ListFollowUpStatusesAsync(t)).Where(x => x.IsActive).OrderBy(x => x.DisplayOrder).Select(x => new TaskOption(x.Id, x.Name, x.IsCompleted)).ToList() : [];
        var employees = canSales || user.HasPermission(SecurityPermissions.SurveysManage)
            ? (await sales.ListEmployeesAsync(t)).Where(x => x.IsActive).OrderBy(x => x.FullName).Select(x => new TaskOption(x.Id, x.FullName)).ToList() : [];
        return new(statuses, employees);
    }

    public async Task<bool> UpdateAsync(string taskId, UpdateTaskCommand c, CancellationToken t)
    {
        var (kind, id, replyType) = Parse(taskId);
        switch (kind)
        {
            case "sales-follow-up":
            {
                Require(SecurityPermissions.SalesManage);
                var f = await sales.GetFollowUpAsync(id, false, t); if (f is null) return false;
                var statusId = c.StatusId ?? f.StatusId;
                var status = await sales.GetFollowUpStatusAsync(statusId, false, t);
                if (status is null || !status.IsActive) throw new InvalidOperationException("Select an active follow-up status.");
                // Done with no new date closes the task. A new date moves it: the next follow-up, or this one while it has none.
                var next = c.DueAtUtc is { } due ? (f.NextFollowUpAtUtc is not null || status.IsCompleted ? due : null) : status.IsCompleted ? null : f.NextFollowUpAtUtc;
                var scheduled = c.DueAtUtc is { } when && f.NextFollowUpAtUtc is null && !status.IsCompleted ? when : f.ScheduledAtUtc;
                return await leads.UpdateFollowUpAsync(id, new SaveFollowUpCommand(scheduled, statusId, AddNote(f.Notes, c.Note) ?? f.Notes, next), t) is not null;
            }
            case "survey":
            {
                Require(SecurityPermissions.SurveysManage);
                if (c.StatusId is not null) throw new InvalidOperationException("A survey's progress is recorded by starting and completing the survey visit.");
                var s = await surveyRecords.GetSurveyAsync(id, false, t); if (s is null) return false;
                return await surveys.UpdateSurveyAsync(id, new SaveSurveyCommand(s.SurveyNumber, s.SalesLeadId, s.CustomerName, s.Phone, s.Email, s.AssignedEmployeeId,
                    c.DueAtUtc ?? s.ScheduledAtUtc, s.Address, AddNote(s.Notes, c.Note)), t) is not null;
            }
            case "customer-reply":
                return await replies.MarkHandledAsync(replyType!, id, Clean(c.Note), t) is not null;
            default: return false;
        }
    }

    public async Task<bool> ReassignAsync(string taskId, ReassignTaskCommand c, CancellationToken t)
    {
        var (kind, id, _) = Parse(taskId);
        if (kind == "customer-reply") throw new InvalidOperationException("Customer replies go to everyone in the module, so they cannot be reassigned.");
        if (kind is not ("sales-follow-up" or "survey")) return false;
        Require(kind == "survey" ? SecurityPermissions.SurveysManage : SecurityPermissions.SalesManage);
        var employee = await sales.GetEmployeeAsync(c.EmployeeId, t);
        if (employee is null || !employee.IsActive) throw new InvalidOperationException("Select an active employee.");
        var handover = $"Reassigned to {employee.FullName}{(Clean(c.Note) is { } note ? ": " + note : "")}";
        if (kind == "survey")
        {
            var s = await surveyRecords.GetSurveyAsync(id, false, t); if (s is null) return false;
            return await surveys.UpdateSurveyAsync(id, new SaveSurveyCommand(s.SurveyNumber, s.SalesLeadId, s.CustomerName, s.Phone, s.Email, employee.Id,
                s.ScheduledAtUtc, s.Address, AddNote(s.Notes, handover)), t) is not null;
        }
        // A follow-up belongs to whoever owns the lead, so the lead (and its later follow-ups) moves to the new person.
        var f = await sales.GetFollowUpAsync(id, false, t); if (f is null) return false;
        var lead = await sales.GetLeadAsync(f.SalesLeadId, false, t); if (lead is null) return false;
        await leads.UpdateLeadAsync(lead.Id, new SaveSalesLeadCommand(lead.LeadNumber, lead.CustomerName, lead.Phone, lead.Email, lead.Source, lead.MoveTypeId,
            lead.Origin, lead.Destination, lead.ExpectedMoveDate, lead.StatusId, employee.Id, lead.Notes), t);
        return await leads.UpdateFollowUpAsync(id, new SaveFollowUpCommand(f.ScheduledAtUtc, f.StatusId, AddNote(f.Notes, handover) ?? f.Notes, f.NextFollowUpAtUtc), t) is not null;
    }

    /// <summary>Task ids: "sales-follow-up:{id}", "survey:{id}", "customer-reply:{recordType}:{id}".</summary>
    private static (string Kind, Guid Id, string? ReplyType) Parse(string taskId) => (taskId ?? "").Split(':') switch
    {
        ["customer-reply", var type, var raw] when Guid.TryParse(raw, out var id) => ("customer-reply", id, type.Trim().ToUpperInvariant()),
        [var kind, var raw] when Guid.TryParse(raw, out var id) => (kind, id, null),
        _ => ("", Guid.Empty, null),
    };

    private void Require(string permission) { if (!user.HasPermission(permission)) throw new UnauthorizedAccessException(); }
    private static string? Clean(string? note) => string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    /// <summary>The record's notes with a dated line added, e.g. "[07 Nov 2026] Customer asked to call after 5 pm".</summary>
    private string? AddNote(string? notes, string? note)
    {
        if (Clean(note) is not { } line) return notes;
        var result = (string.IsNullOrWhiteSpace(notes) ? "" : notes.TrimEnd() + "\n") + $"[{clock.GetUtcNow():dd MMM yyyy}] {line}";
        return result.Length > NotesLimit ? throw new InvalidOperationException("The notes are full. Shorten the note or edit the record's notes.") : result;
    }
}
