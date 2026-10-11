using Movers.Domain.Common;

namespace Movers.Domain.Security;

public sealed class User : Entity
{
    private User() { }

    public User(Guid? tenantId, string fullName, string email, string passwordHash, Guid? employeeId = null)
    {
        TenantId = tenantId;
        FullName = fullName.Trim();
        Email = email.Trim();
        NormalizedEmail = NormalizeEmail(email);
        PasswordHash = passwordHash;
        EmployeeId = employeeId;
        IsActive = true;
        CreatedAtUtc = UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public Guid? TenantId { get; private set; }
    public string FullName { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;
    public string NormalizedEmail { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public Guid? EmployeeId { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset? LastLoginAtUtc { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public void UpdateProfile(string fullName, string email)
    {
        FullName = fullName.Trim();
        Email = email.Trim();
        NormalizedEmail = NormalizeEmail(email);
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void ChangePassword(string passwordHash)
    {
        PasswordHash = passwordHash;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void SetActive(bool active)
    {
        IsActive = active;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void LinkEmployee(Guid employeeId)
    {
        EmployeeId = employeeId;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void RecordLogin() => LastLoginAtUtc = DateTimeOffset.UtcNow;
    public static string NormalizeEmail(string email) => email.Trim().ToUpperInvariant();
}
