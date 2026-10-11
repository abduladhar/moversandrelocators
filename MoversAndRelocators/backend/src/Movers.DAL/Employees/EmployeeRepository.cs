using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Employees;
using Movers.Services.Employees;

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
}
