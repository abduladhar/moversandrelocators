using Movers.Domain.Common;

namespace Movers.Domain.Sales;

public sealed class LeadFollowUp : TenantOwnedEntity
{
    private LeadFollowUp() { }
    public LeadFollowUp(Guid tenantId, Guid salesLeadId, DateTimeOffset scheduledAtUtc, Guid statusId, string notes, DateTimeOffset? nextFollowUpAtUtc) : base(tenantId) { SalesLeadId = salesLeadId; CreatedAtUtc = DateTimeOffset.UtcNow; Update(scheduledAtUtc, statusId, notes, nextFollowUpAtUtc); }
    public Guid SalesLeadId { get; private set; }
    public DateTimeOffset ScheduledAtUtc { get; private set; }
    public Guid StatusId { get; private set; }
    public string Notes { get; private set; } = string.Empty;
    public DateTimeOffset? NextFollowUpAtUtc { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public void Update(DateTimeOffset scheduledAtUtc, Guid statusId, string notes, DateTimeOffset? nextFollowUpAtUtc) { ScheduledAtUtc = scheduledAtUtc; StatusId = statusId; Notes = notes.Trim(); NextFollowUpAtUtc = nextFollowUpAtUtc; UpdatedAtUtc = DateTimeOffset.UtcNow; }
}
