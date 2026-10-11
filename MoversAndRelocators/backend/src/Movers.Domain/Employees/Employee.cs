using Movers.Domain.Common;

namespace Movers.Domain.Employees;

public sealed class Employee : TenantOwnedEntity
{
    private Employee() { }

    public Employee(Guid tenantId, string employeeNumber, string firstName, string lastName,
        string? workEmail, string? phone, DateOnly joiningDate, Guid designationId, Guid? reportsToEmployeeId)
        : base(tenantId)
    {
        CreatedAtUtc = DateTimeOffset.UtcNow;
        Update(employeeNumber, firstName, lastName, workEmail, phone, joiningDate, designationId, reportsToEmployeeId);
        IsActive = true;
    }

    public string EmployeeNumber { get; private set; } = string.Empty;
    public string FirstName { get; private set; } = string.Empty;
    public string LastName { get; private set; } = string.Empty;
    public string FullName => $"{FirstName} {LastName}".Trim();
    public string? WorkEmail { get; private set; }
    public string? Phone { get; private set; }
    public DateOnly JoiningDate { get; private set; }
    public Guid DesignationId { get; private set; }
    public Guid? ReportsToEmployeeId { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public void Update(string employeeNumber, string firstName, string lastName, string? workEmail,
        string? phone, DateOnly joiningDate, Guid designationId, Guid? reportsToEmployeeId)
    {
        EmployeeNumber = employeeNumber.Trim().ToUpperInvariant();
        FirstName = firstName.Trim();
        LastName = lastName.Trim();
        WorkEmail = string.IsNullOrWhiteSpace(workEmail) ? null : workEmail.Trim();
        Phone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
        JoiningDate = joiningDate;
        DesignationId = designationId;
        ReportsToEmployeeId = reportsToEmployeeId;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void SetActive(bool active) { IsActive = active; UpdatedAtUtc = DateTimeOffset.UtcNow; }
}
