namespace Movers.Services.Employees;

public interface IEmployeeService
{
    Task<IReadOnlyList<DesignationModel>> ListDesignationsAsync(CancellationToken cancellationToken);
    Task<DesignationModel> CreateDesignationAsync(SaveDesignationCommand command, CancellationToken cancellationToken);
    Task<DesignationModel?> UpdateDesignationAsync(Guid id, SaveDesignationCommand command, CancellationToken cancellationToken);
    Task<DesignationModel?> SetDesignationStatusAsync(Guid id, bool active, CancellationToken cancellationToken);
    Task<IReadOnlyList<EmployeeModel>> ListEmployeesAsync(CancellationToken cancellationToken);
    Task<EmployeeModel?> GetEmployeeAsync(Guid id, CancellationToken cancellationToken);
    Task<EmployeeModel> CreateEmployeeAsync(SaveEmployeeCommand command, CancellationToken cancellationToken);
    Task<EmployeeModel?> UpdateEmployeeAsync(Guid id, SaveEmployeeCommand command, CancellationToken cancellationToken);
    Task<EmployeeModel?> SetEmployeeStatusAsync(Guid id, bool active, CancellationToken cancellationToken);
    Task<IReadOnlyList<EmployeeHierarchyNode>> GetHierarchyAsync(CancellationToken cancellationToken);
}
