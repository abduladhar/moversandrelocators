using System.ComponentModel.DataAnnotations;
using Movers.Services.Employees;

namespace Movers.Api.Contracts.Employees;

public sealed record SaveDesignationRequest(
    [Required, StringLength(40, MinimumLength = 2), RegularExpression("^[a-zA-Z0-9_-]+$")] string Code,
    [Required, StringLength(120, MinimumLength = 2)] string Name,
    [Range(1, 100)] int Level,
    [StringLength(500)] string? Description,
    bool IsSalesman)
{
    public SaveDesignationCommand ToCommand() => new(Code, Name, Level, Description, IsSalesman);
}

public sealed record SaveEmployeeRequest(
    string? EmployeeNumber,
    [Required, StringLength(100, MinimumLength = 1)] string FirstName,
    [Required, StringLength(100, MinimumLength = 1)] string LastName,
    [EmailAddress, StringLength(254)] string? WorkEmail,
    [StringLength(40)] string? Phone,
    DateOnly JoiningDate,
    Guid DesignationId,
    Guid? ReportsToEmployeeId)
{
    public SaveEmployeeCommand ToCommand() => new(EmployeeNumber ?? "", FirstName, LastName, WorkEmail, Phone,
        JoiningDate, DesignationId, ReportsToEmployeeId);
}

public sealed record SetRecordStatusRequest(bool IsActive);
