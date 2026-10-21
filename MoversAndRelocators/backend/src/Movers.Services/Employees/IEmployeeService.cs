namespace Movers.Services.Employees;

public interface IEmployeeService
{
    Task<IReadOnlyList<DesignationModel>> ListDesignationsAsync(CancellationToken cancellationToken);
    Task<Movers.Services.Common.PagedResult<DesignationModel>> SearchDesignationsAsync(DesignationListFilter filter, Movers.Services.Common.ListQuery query, CancellationToken cancellationToken);
    Task<DesignationModel> CreateDesignationAsync(SaveDesignationCommand command, CancellationToken cancellationToken);
    Task<DesignationModel?> UpdateDesignationAsync(Guid id, SaveDesignationCommand command, CancellationToken cancellationToken);
    Task<DesignationModel?> SetDesignationStatusAsync(Guid id, bool active, CancellationToken cancellationToken);
    Task<IReadOnlyList<EmployeeModel>> ListEmployeesAsync(CancellationToken cancellationToken);
    Task<Movers.Services.Common.PagedResult<EmployeeModel>> SearchEmployeesAsync(EmployeeListFilter filter, Movers.Services.Common.ListQuery query, CancellationToken cancellationToken);
    Task<EmployeeModel?> GetEmployeeAsync(Guid id, CancellationToken cancellationToken);
    Task<EmployeeModel> CreateEmployeeAsync(SaveEmployeeCommand command, CancellationToken cancellationToken);
    Task<EmployeeModel?> UpdateEmployeeAsync(Guid id, SaveEmployeeCommand command, CancellationToken cancellationToken);
    Task<EmployeeModel?> SetEmployeeStatusAsync(Guid id, bool active, CancellationToken cancellationToken);
    Task<IReadOnlyList<EmployeeHierarchyNode>> GetHierarchyAsync(CancellationToken cancellationToken);
}

/// <summary>Advanced search filters of the Designations page.</summary>
public sealed record DesignationListFilter(bool? IsActive = null, int? Level = null);
/// <summary>Whole-list figures for the Designations page: stats cards and the level filter options.</summary>
public sealed record DesignationListSummary(int Total, int Active, IReadOnlyList<int> Levels);
/// <summary>Advanced search filters of the Employees page (ManagerId = reports to).</summary>
public sealed record EmployeeListFilter(bool? IsActive = null, Guid? DesignationId = null, Guid? ManagerId = null);
/// <summary>Whole-list figures for the Employees page stats cards (TeamLeads = distinct managers someone reports to).</summary>
public sealed record EmployeeListSummary(int Total, int Active, int TeamLeads);
