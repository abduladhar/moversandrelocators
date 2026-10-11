using Movers.Domain.Common;

namespace Movers.Domain.Auditing;

public sealed class AuditLog : Entity
{
    private AuditLog() { }

    public AuditLog(Guid? tenantId, Guid? actorUserId, string actorEmail, string action,
        string entityType, string? entityId, string changes, string? ipAddress)
    {
        TenantId = tenantId;
        ActorUserId = actorUserId;
        ActorEmail = actorEmail;
        Action = action;
        EntityType = entityType;
        EntityId = entityId;
        Changes = changes;
        IpAddress = ipAddress;
        CreatedAtUtc = DateTimeOffset.UtcNow;
    }

    public Guid? TenantId { get; private set; }
    public Guid? ActorUserId { get; private set; }
    public string ActorEmail { get; private set; } = string.Empty;
    public string Action { get; private set; } = string.Empty;
    public string EntityType { get; private set; } = string.Empty;
    public string? EntityId { get; private set; }
    public string Changes { get; private set; } = string.Empty;
    public string? IpAddress { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
}
