using Movers.Domain.Common;

namespace Movers.Domain.Security;

public sealed class UserRole : Entity
{
    private UserRole() { }
    public UserRole(Guid userId, Guid roleId) { UserId = userId; RoleId = roleId; }
    public Guid UserId { get; private set; }
    public Guid RoleId { get; private set; }
}
