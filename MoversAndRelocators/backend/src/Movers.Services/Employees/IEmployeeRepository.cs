using Movers.Domain.Employees;

namespace Movers.Services.Employees;

public interface IEmployeeRepository
{
    Task<IReadOnlyList<Designation>> ListDesignationsAsync(CancellationToken cancellationToken);
    Task<(IReadOnlyList<Designation> Items, int Total)> SearchDesignationsAsync(DesignationListFilter filter, Movers.Services.Common.ListQuery query, CancellationToken cancellationToken);
    Task<DesignationListSummary> DesignationSummaryAsync(CancellationToken cancellationToken);
    Task<Designation?> GetDesignationAsync(Guid id, bool trackChanges, CancellationToken cancellationToken);
    Task<bool> DesignationCodeExistsAsync(string code, Guid? excludingId, CancellationToken cancellationToken);
    void AddDesignation(Designation designation);
    Task<IReadOnlyList<Employee>> ListEmployeesAsync(CancellationToken cancellationToken);
    Task<(IReadOnlyList<Employee> Items, int Total)> SearchEmployeesAsync(EmployeeListFilter filter, Movers.Services.Common.ListQuery query, CancellationToken cancellationToken);
    Task<EmployeeListSummary> EmployeeSummaryAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<Employee>> ListEmployeesByIdsAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken);
    Task<Employee?> GetEmployeeAsync(Guid id, bool trackChanges, CancellationToken cancellationToken);
    Task<bool> EmployeeNumberExistsAsync(string employeeNumber, Guid? excludingId, CancellationToken cancellationToken);
    void AddEmployee(Employee employee);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
