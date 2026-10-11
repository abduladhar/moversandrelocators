namespace Movers.Services.Employees;

public sealed record SaveDesignationCommand(string Code, string Name, int Level, string? Description, bool IsSalesman);
public sealed record DesignationModel(int SerialNo, Guid Id, string Code, string Name, int Level,
    string? Description, bool IsSalesman, bool IsActive, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc);
public sealed record SaveEmployeeCommand(string EmployeeNumber, string FirstName, string LastName,
    string? WorkEmail, string? Phone, DateOnly JoiningDate, Guid DesignationId, Guid? ReportsToEmployeeId);
public sealed record EmployeeModel(int SerialNo, Guid Id, string EmployeeNumber, string FirstName, string LastName,
    string FullName, string? WorkEmail, string? Phone, DateOnly JoiningDate, Guid DesignationId,
    string DesignationName, int DesignationLevel, Guid? ReportsToEmployeeId, string? ReportsToName,
    bool IsActive, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc);
public sealed record EmployeeHierarchyNode(Guid Id, string EmployeeNumber, string FullName, string Designation,
    IReadOnlyList<EmployeeHierarchyNode> DirectReports);
