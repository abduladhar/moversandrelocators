namespace Movers.Services.Auditing;

public sealed record AuditLogModel(int SerialNo, Guid Id, Guid? TenantId, Guid? ActorUserId,
    string ActorEmail, string Action, string EntityType, string? EntityId, string Changes,
    string? IpAddress, DateTimeOffset CreatedAtUtc);
