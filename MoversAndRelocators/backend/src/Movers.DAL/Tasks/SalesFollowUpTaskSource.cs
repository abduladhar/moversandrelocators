using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Services.Security;
using Movers.Services.Tasks;

namespace Movers.DAL.Tasks;

/// <summary>
/// Follow-ups on the leads the user owns. Open while a next follow-up is planned, or while its status is not a
/// completed one; due at the next follow-up, else at its own time.
/// </summary>
public sealed class SalesFollowUpTaskSource(MoversDbContext db, IUserContext userContext) : ITaskSource
{
    public async Task<IReadOnlyList<MyTaskModel>> GetTasksAsync(CancellationToken token)
    {
        if (!userContext.HasPermission(SecurityPermissions.SalesView)) return [];
        var employeeId = userContext.EmployeeId;
        var email = userContext.Email.Trim().ToLower();
        if (!employeeId.HasValue && (!userContext.IsSystemAdmin || email.Length == 0)) return [];

        var rows = await (
            from followUp in db.LeadFollowUps.AsNoTracking()
            join lead in db.SalesLeads.AsNoTracking() on followUp.SalesLeadId equals lead.Id
            join employee in db.Employees.AsNoTracking() on lead.AssignedEmployeeId equals employee.Id
            join status in db.FollowUpStatuses.AsNoTracking() on followUp.StatusId equals status.Id
            where lead.IsActive && employee.IsActive
                && (employeeId.HasValue ? employee.Id == employeeId.Value : employee.WorkEmail != null && employee.WorkEmail.ToLower() == email)
            select new { followUp.Id, LeadId = lead.Id, lead.CustomerName, lead.LeadNumber, followUp.Notes, followUp.StatusId, StatusName = status.Name, EmployeeId = employee.Id, employee.FirstName, employee.LastName,
                followUp.NextFollowUpAtUtc, followUp.ScheduledAtUtc, status.IsCompleted, followUp.CreatedAtUtc, followUp.UpdatedAtUtc }
        ).ToListAsync(token);

        return rows.Select(x =>
        {
            var open = x.NextFollowUpAtUtc.HasValue || !x.IsCompleted;
            return new MyTaskModel($"sales-follow-up:{x.Id}", "sales_follow_up", "Sales", $"Follow up with {x.CustomerName}", $"{x.LeadNumber} · {Purpose(x.Notes)}",
                x.NextFollowUpAtUtc ?? x.ScheduledAtUtc, false, x.LeadId.ToString(), "sales", x.StatusName, x.StatusId, x.EmployeeId, $"{x.FirstName} {x.LastName}".Trim(),
                open, x.CreatedAtUtc, open ? null : x.UpdatedAtUtc);
        }).ToList();
    }

    /// <summary>What the follow-up is about: the first line of its notes (later lines are dated updates added by My Tasks).</summary>
    private static string Purpose(string notes) => notes.Split('\n', 2)[0].Trim();
}
