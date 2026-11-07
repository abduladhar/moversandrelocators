using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Surveys;
using Movers.Services.Security;
using Movers.Services.Tasks;

namespace Movers.DAL.Tasks;

/// <summary>Surveys the user is the surveyor of: open until the visit is completed, due at the survey time.</summary>
public sealed class SurveyTaskSource(MoversDbContext db, IUserContext userContext) : ITaskSource
{
    public async Task<IReadOnlyList<MyTaskModel>> GetTasksAsync(CancellationToken token)
    {
        if (!userContext.HasPermission(SecurityPermissions.SurveysManage)) return [];
        var employeeId = userContext.EmployeeId;
        var email = userContext.Email.Trim().ToLower();
        if (!employeeId.HasValue && (!userContext.IsSystemAdmin || email.Length == 0)) return [];
        var rows = await (from survey in db.Surveys.AsNoTracking()
                          join employee in db.Employees.AsNoTracking() on survey.AssignedEmployeeId equals employee.Id
                          where employee.IsActive && (employeeId.HasValue ? employee.Id == employeeId.Value : employee.WorkEmail != null && employee.WorkEmail.ToLower() == email)
                          select new { survey.Id, survey.SurveyNumber, survey.CustomerName, survey.Address, survey.ScheduledAtUtc, survey.Status, EmployeeId = employee.Id, employee.FirstName, employee.LastName,
                              survey.CreatedAtUtc, survey.EndedAtUtc, survey.UpdatedAtUtc }).ToListAsync(token);
        return rows.Select(x =>
        {
            var open = x.Status != SurveyStatuses.Completed;
            return new MyTaskModel($"survey:{x.Id}", "survey", "Surveys", $"Survey for {x.CustomerName}", $"{x.SurveyNumber} · {x.Address}", x.ScheduledAtUtc, false,
                x.Id.ToString(), "surveys", x.Status, null, x.EmployeeId, $"{x.FirstName} {x.LastName}".Trim(), open, x.CreatedAtUtc, open ? null : x.EndedAtUtc ?? x.UpdatedAtUtc);
        }).ToList();
    }
}
