using Movers.Domain.Employees;

namespace Movers.Services.Employees;

public interface IEmployeeRepository
{
    Task<IReadOnlyList<Designation>> ListDesignationsAsync(CancellationToken cancellationToken);
    Task<Designation?> GetDesignationAsync(Guid id, bool trackChanges, CancellationToken cancellationToken);
    Task<bool> DesignationCodeExistsAsync(string code, Guid? excludingId, CancellationToken cancellationToken);
    void AddDesignation(Designation designation);
    Task<IReadOnlyList<Employee>> ListEmployeesAsync(CancellationToken cancellationToken);
    Task<Employee?> GetEmployeeAsync(Guid id, bool trackChanges, CancellationToken cancellationToken);
    Task<bool> EmployeeNumberExistsAsync(string employeeNumber, Guid? excludingId, CancellationToken cancellationToken);
    void AddEmployee(Employee employee);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
