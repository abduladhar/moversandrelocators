using Movers.Domain.Common;

namespace Movers.Domain.Security;

public sealed class Role : Entity
{
    private Role() { }

    public Role(Guid? tenantId, string name, string code, bool isSystemRole)
    {
        TenantId = tenantId;
        Name = name.Trim();
        Code = code.Trim();
        IsSystemRole = isSystemRole;
        CreatedAtUtc = DateTimeOffset.UtcNow;
    }

    public Guid? TenantId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Code { get; private set; } = string.Empty;
    public bool IsSystemRole { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }

    public void Rename(string name)
    {
        if (IsSystemRole) throw new InvalidOperationException("System roles cannot be renamed.");
        Name = name.Trim();
    }
}
