using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Employees;
using Movers.Services.Employees;
using Movers.DAL.Common;
using Movers.Services.Common;

namespace Movers.DAL.Employees;

public sealed class EmployeeRepository(MoversDbContext db) : IEmployeeRepository
{
    public async Task<IReadOnlyList<Designation>> ListDesignationsAsync(CancellationToken cancellationToken) =>
        await db.Designations.AsNoTracking().OrderByDescending(x => x.SerialNo).ToListAsync(cancellationToken);
    public Task<Designation?> GetDesignationAsync(Guid id, bool trackChanges, CancellationToken cancellationToken) =>
        (trackChanges ? db.Designations : db.Designations.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
    public Task<bool> DesignationCodeExistsAsync(string code, Guid? excludingId, CancellationToken cancellationToken) =>
        db.Designations.AnyAsync(x => x.Code == code && (!excludingId.HasValue || x.Id != excludingId), cancellationToken);
    public void AddDesignation(Designation designation) => db.Designations.Add(designation);
    public async Task<IReadOnlyList<Employee>> ListEmployeesAsync(CancellationToken cancellationToken) =>
        await db.Employees.AsNoTracking().OrderByDescending(x => x.SerialNo).ToListAsync(cancellationToken);
    public Task<Employee?> GetEmployeeAsync(Guid id, bool trackChanges, CancellationToken cancellationToken) =>
        (trackChanges ? db.Employees : db.Employees.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
    public Task<bool> EmployeeNumberExistsAsync(string employeeNumber, Guid? excludingId, CancellationToken cancellationToken) =>
        db.Employees.AnyAsync(x => x.EmployeeNumber == employeeNumber && (!excludingId.HasValue || x.Id != excludingId), cancellationToken);
    public void AddEmployee(Employee employee) => db.Employees.Add(employee);
    public async Task SaveChangesAsync(CancellationToken cancellationToken) => await db.SaveChangesAsync(cancellationToken);

    private static readonly SortMap<Designation> DesignationSorts = new SortMap<Designation>("serialNo", true, x => x.SerialNo)
        .Add("serialNo", x => x.SerialNo).Add("name", x => x.Name).Add("code", x => x.Code).Add("level", x => x.Level).Add("isActive", x => x.IsActive);
    public async Task<(IReadOnlyList<Designation> Items, int Total)> SearchDesignationsAsync(DesignationListFilter filter, ListQuery list, CancellationToken t)
    {
        var q = db.Designations.AsNoTracking();
        if (filter.IsActive is { } active) q = q.Where(x => x.IsActive == active);
        if (filter.Level is { } level) q = q.Where(x => x.Level == level);
        q = q.Search(list, w => x => x.Code.ToLower().Contains(w) || x.Name.ToLower().Contains(w) || (x.Description ?? "").ToLower().Contains(w));
        var (items, total) = await q.Sort(list, DesignationSorts).PageAsync(list, t);
        return (items, total);
    }
    public async Task<DesignationListSummary> DesignationSummaryAsync(CancellationToken t) => new(await db.Designations.CountAsync(t), await db.Designations.CountAsync(x => x.IsActive, t),
        await db.Designations.Select(x => x.Level).Distinct().OrderBy(x => x).ToListAsync(t));

    /// <summary>Sorts of the Employees register; designation and manager names come from subqueries.</summary>
    private SortMap<Employee> EmployeeSorts() => new SortMap<Employee>("serialNo", true, x => x.SerialNo)
        .Add("serialNo", x => x.SerialNo).Add("fullName", x => x.FirstName + " " + x.LastName).Add("employeeNumber", x => x.EmployeeNumber)
        .Add("designationName", x => db.Designations.Where(d => d.Id == x.DesignationId).Select(d => d.Name).FirstOrDefault())
        .Add("reportsToName", x => db.Employees.Where(e => e.Id == x.ReportsToEmployeeId).Select(e => e.FirstName + " " + e.LastName).FirstOrDefault())
        .Add("joiningDate", x => x.JoiningDate).Add("isActive", x => x.IsActive);
    public async Task<(IReadOnlyList<Employee> Items, int Total)> SearchEmployeesAsync(EmployeeListFilter filter, ListQuery list, CancellationToken t)
    {
        var q = db.Employees.AsNoTracking();
        if (filter.IsActive is { } active) q = q.Where(x => x.IsActive == active);
        if (filter.DesignationId is { } designation) q = q.Where(x => x.DesignationId == designation);
        if (filter.ManagerId is { } manager) q = q.Where(x => x.ReportsToEmployeeId == manager);
        q = q.Search(list, w => x => x.EmployeeNumber.ToLower().Contains(w) || (x.FirstName + " " + x.LastName).ToLower().Contains(w)
            || (x.WorkEmail ?? "").ToLower().Contains(w) || (x.Phone ?? "").ToLower().Contains(w)
            || db.Designations.Any(d => d.Id == x.DesignationId && d.Name.ToLower().Contains(w))
            || db.Employees.Any(e => e.Id == x.ReportsToEmployeeId && (e.FirstName + " " + e.LastName).ToLower().Contains(w)));
        var (items, total) = await q.Sort(list, EmployeeSorts()).PageAsync(list, t);
        return (items, total);
    }
    public async Task<EmployeeListSummary> EmployeeSummaryAsync(CancellationToken t) => new(await db.Employees.CountAsync(t), await db.Employees.CountAsync(x => x.IsActive, t),
        await db.Employees.Where(x => x.ReportsToEmployeeId != null).Select(x => x.ReportsToEmployeeId).Distinct().CountAsync(t));
    public async Task<IReadOnlyList<Employee>> ListEmployeesByIdsAsync(IReadOnlyCollection<Guid> ids, CancellationToken t) =>
        ids.Count == 0 ? [] : await db.Employees.AsNoTracking().Where(x => ids.Contains(x.Id)).ToListAsync(t);
}
