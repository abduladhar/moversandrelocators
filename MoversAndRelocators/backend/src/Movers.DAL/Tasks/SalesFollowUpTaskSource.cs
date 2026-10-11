using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Services.Security;
using Movers.Services.Tasks;

namespace Movers.DAL.Tasks;

public sealed class SalesFollowUpTaskSource(MoversDbContext db, IUserContext userContext) : ITodayTaskSource
{
    public async Task<IReadOnlyList<MyTaskModel>> GetTasksDueThroughAsync(DateTimeOffset endUtc, CancellationToken token)
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
            let dueAt = followUp.NextFollowUpAtUtc ?? followUp.ScheduledAtUtc
            select new { followUp.Id, LeadId = lead.Id, lead.CustomerName, lead.LeadNumber, followUp.Notes,
                followUp.NextFollowUpAtUtc, followUp.ScheduledAtUtc, status.IsCompleted, DueAtUtc = dueAt }
        ).ToListAsync(token);

        return rows
            .Where(x => (x.NextFollowUpAtUtc.HasValue && x.NextFollowUpAtUtc <= endUtc)
                || (!x.NextFollowUpAtUtc.HasValue && !x.IsCompleted && x.ScheduledAtUtc <= endUtc))
            .Select(x => new MyTaskModel($"sales-follow-up:{x.Id}", "sales_follow_up", "Sales",
            $"Follow up with {x.CustomerName}", $"{x.LeadNumber} · {x.Notes}", x.DueAtUtc,
            false, x.LeadId.ToString(), "sales")).ToList();
    }
}
