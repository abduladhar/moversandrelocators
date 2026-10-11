using Movers.Domain.Employees;
using Movers.Services.Tenancy;

namespace Movers.Services.Employees;

public sealed class EmployeeService(IEmployeeRepository repository, ITenantContext tenantContext, Movers.Services.Numbering.IRecordNumbers numbers) : IEmployeeService
{
    public async Task<IReadOnlyList<DesignationModel>> ListDesignationsAsync(CancellationToken cancellationToken) =>
        (await repository.ListDesignationsAsync(cancellationToken)).Select(Map).ToList();

    public async Task<DesignationModel> CreateDesignationAsync(SaveDesignationCommand command, CancellationToken cancellationToken)
    {
        await EnsureDesignationCodeAsync(command.Code, null, cancellationToken);
        var item = new Designation(tenantContext.TenantId, command.Code, command.Name, command.Level, command.Description, command.IsSalesman);
        repository.AddDesignation(item); await repository.SaveChangesAsync(cancellationToken); return Map(item);
    }

    public async Task<DesignationModel?> UpdateDesignationAsync(Guid id, SaveDesignationCommand command, CancellationToken cancellationToken)
    {
        var item = await repository.GetDesignationAsync(id, true, cancellationToken); if (item is null) return null;
        await EnsureDesignationCodeAsync(command.Code, id, cancellationToken);
        item.Update(command.Code, command.Name, command.Level, command.Description, command.IsSalesman);
        await repository.SaveChangesAsync(cancellationToken); return Map(item);
    }

    public async Task<DesignationModel?> SetDesignationStatusAsync(Guid id, bool active, CancellationToken cancellationToken)
    {
        var item = await repository.GetDesignationAsync(id, true, cancellationToken); if (item is null) return null;
        item.SetActive(active); await repository.SaveChangesAsync(cancellationToken); return Map(item);
    }

    public async Task<IReadOnlyList<EmployeeModel>> ListEmployeesAsync(CancellationToken cancellationToken)
    {
        var employees = await repository.ListEmployeesAsync(cancellationToken);
        var designations = (await repository.ListDesignationsAsync(cancellationToken)).ToDictionary(x => x.Id);
        var names = employees.ToDictionary(x => x.Id, x => x.FullName);
        return employees.Select(x => Map(x, designations[x.DesignationId],
            x.ReportsToEmployeeId.HasValue && names.TryGetValue(x.ReportsToEmployeeId.Value, out var name) ? name : null)).ToList();
    }

    public async Task<EmployeeModel?> GetEmployeeAsync(Guid id, CancellationToken cancellationToken)
    {
        var employee = await repository.GetEmployeeAsync(id, false, cancellationToken); if (employee is null) return null;
        var designation = await repository.GetDesignationAsync(employee.DesignationId, false, cancellationToken);
        var manager = employee.ReportsToEmployeeId.HasValue
            ? await repository.GetEmployeeAsync(employee.ReportsToEmployeeId.Value, false, cancellationToken) : null;
        return Map(employee, designation!, manager?.FullName);
    }

    public async Task<EmployeeModel> CreateEmployeeAsync(SaveEmployeeCommand command, CancellationToken cancellationToken)
    {
        command = command with { EmployeeNumber = await numbers.Next("EMP", cancellationToken) };
        await ValidateEmployeeAsync(null, command, cancellationToken);
        var employee = new Employee(tenantContext.TenantId, command.EmployeeNumber, command.FirstName, command.LastName,
            command.WorkEmail, command.Phone, command.JoiningDate, command.DesignationId, command.ReportsToEmployeeId);
        repository.AddEmployee(employee); await repository.SaveChangesAsync(cancellationToken);
        return (await GetEmployeeAsync(employee.Id, cancellationToken))!;
    }

    public async Task<EmployeeModel?> UpdateEmployeeAsync(Guid id, SaveEmployeeCommand command, CancellationToken cancellationToken)
    {
        var employee = await repository.GetEmployeeAsync(id, true, cancellationToken); if (employee is null) return null;
        command = command with { EmployeeNumber = employee.EmployeeNumber };
        await ValidateEmployeeAsync(id, command, cancellationToken);
        employee.Update(command.EmployeeNumber, command.FirstName, command.LastName, command.WorkEmail, command.Phone,
            command.JoiningDate, command.DesignationId, command.ReportsToEmployeeId);
        await repository.SaveChangesAsync(cancellationToken);
        return await GetEmployeeAsync(id, cancellationToken);
    }

    public async Task<EmployeeModel?> SetEmployeeStatusAsync(Guid id, bool active, CancellationToken cancellationToken)
    {
        var employee = await repository.GetEmployeeAsync(id, true, cancellationToken); if (employee is null) return null;
        employee.SetActive(active); await repository.SaveChangesAsync(cancellationToken); return await GetEmployeeAsync(id, cancellationToken);
    }

    public async Task<IReadOnlyList<EmployeeHierarchyNode>> GetHierarchyAsync(CancellationToken cancellationToken)
    {
        var employees = (await repository.ListEmployeesAsync(cancellationToken)).Where(x => x.IsActive).ToList();
        var designations = (await repository.ListDesignationsAsync(cancellationToken)).ToDictionary(x => x.Id, x => x.Name);
        EmployeeHierarchyNode Build(Employee employee) => new(employee.Id, employee.EmployeeNumber, employee.FullName,
            designations[employee.DesignationId], employees.Where(x => x.ReportsToEmployeeId == employee.Id).Select(Build).ToList());
        return employees.Where(x => x.ReportsToEmployeeId is null).Select(Build).ToList();
    }

    private async Task ValidateEmployeeAsync(Guid? employeeId, SaveEmployeeCommand command, CancellationToken cancellationToken)
    {
        var number = command.EmployeeNumber.Trim().ToUpperInvariant();
        if (await repository.EmployeeNumberExistsAsync(number, employeeId, cancellationToken))
            throw new InvalidOperationException("This employee number is already in use.");
        var designation = await repository.GetDesignationAsync(command.DesignationId, false, cancellationToken);
        if (designation is null || !designation.IsActive) throw new InvalidOperationException("Select an active designation.");
        if (!command.ReportsToEmployeeId.HasValue) return;
        if (command.ReportsToEmployeeId == employeeId) throw new InvalidOperationException("An employee cannot report to themselves.");
        var manager = await repository.GetEmployeeAsync(command.ReportsToEmployeeId.Value, false, cancellationToken);
        if (manager is null || !manager.IsActive) throw new InvalidOperationException("Select an active reporting manager.");
        var managerDesignation = await repository.GetDesignationAsync(manager.DesignationId, false, cancellationToken);
        if (managerDesignation is null || managerDesignation.Level >= designation.Level)
            throw new InvalidOperationException("The reporting manager must have a higher designation level.");
        var visited = new HashSet<Guid>();
        while (manager is not null && manager.ReportsToEmployeeId.HasValue)
        {
            if (!visited.Add(manager.Id) || manager.ReportsToEmployeeId == employeeId)
                throw new InvalidOperationException("This reporting relationship would create a cycle.");
            manager = await repository.GetEmployeeAsync(manager.ReportsToEmployeeId.Value, false, cancellationToken);
        }
    }

    private async Task EnsureDesignationCodeAsync(string code, Guid? id, CancellationToken token)
    { if (await repository.DesignationCodeExistsAsync(code.Trim().ToUpperInvariant(), id, token)) throw new InvalidOperationException("This designation code is already in use."); }
    private static DesignationModel Map(Designation x) => new(x.SerialNo, x.Id, x.Code, x.Name, x.Level, x.Description, x.IsSalesman, x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc);
    private static EmployeeModel Map(Employee x, Designation d, string? manager) => new(x.SerialNo, x.Id, x.EmployeeNumber,
        x.FirstName, x.LastName, x.FullName, x.WorkEmail, x.Phone, x.JoiningDate, x.DesignationId, d.Name, d.Level,
        x.ReportsToEmployeeId, manager, x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc);
}
