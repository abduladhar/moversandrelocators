using Movers.Domain.Common;

namespace Movers.Domain.Security;

public sealed class RolePermission : Entity
{
    private RolePermission() { }
    public RolePermission(Guid roleId, Guid permissionId) { RoleId = roleId; PermissionId = permissionId; }
    public Guid RoleId { get; private set; }
    public Guid PermissionId { get; private set; }
}
