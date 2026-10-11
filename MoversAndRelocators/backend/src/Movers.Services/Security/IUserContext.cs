namespace Movers.Services.Security;

public interface IUserContext
{
    Guid? UserId { get; }
    Guid? EmployeeId { get; }
    string Email { get; }
    string? IpAddress { get; }
    bool IsAuthenticated { get; }
    bool IsSystemAdmin { get; }
    bool HasPermission(string permission);
}
