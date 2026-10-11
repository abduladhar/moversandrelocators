using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Surveys;
using Movers.Services.Security;
using Movers.Services.Tasks;

namespace Movers.DAL.Tasks;

public sealed class SurveyTaskSource(MoversDbContext db, IUserContext userContext) : ITodayTaskSource
{
    public async Task<IReadOnlyList<MyTaskModel>> GetTasksDueThroughAsync(DateTimeOffset endUtc, CancellationToken token)
    {
        if (!userContext.HasPermission(SecurityPermissions.SurveysManage)) return [];
        var employeeId = userContext.EmployeeId;
        var email = userContext.Email.Trim().ToLower();
        if (!employeeId.HasValue && (!userContext.IsSystemAdmin || email.Length == 0)) return [];
        var rows = await (from survey in db.Surveys.AsNoTracking()
                          join employee in db.Employees.AsNoTracking() on survey.AssignedEmployeeId equals employee.Id
                          where employee.IsActive && (employeeId.HasValue ? employee.Id == employeeId.Value : employee.WorkEmail != null && employee.WorkEmail.ToLower() == email)
                              && survey.Status != SurveyStatuses.Completed
                          select new { survey.Id, survey.SurveyNumber, survey.CustomerName, survey.Address, survey.ScheduledAtUtc }).ToListAsync(token);
        return rows.Where(x => x.ScheduledAtUtc <= endUtc).Select(x => new MyTaskModel($"survey:{x.Id}", "survey", "Surveys", $"Survey for {x.CustomerName}", $"{x.SurveyNumber} · {x.Address}", x.ScheduledAtUtc, false, x.Id.ToString(), "surveys")).ToList();
    }
}
