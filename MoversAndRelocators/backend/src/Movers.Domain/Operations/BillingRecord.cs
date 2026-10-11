using Movers.Domain.Common;
namespace Movers.Domain.Operations;
// Typed payloads keep financial snapshots immutable while the row supplies tenant isolation,
// optimistic concurrency, request deduplication and mandatory audit tracking.
public sealed class BillingRecord(Guid tenantId) : TenantOwnedEntity(tenantId) {
 public string Kind { get; set; } = "";
 public string Number { get; set; } = "";
 public Guid RequestId { get; set; }
 public string RequestHash { get; set; } = "";
 public string Payload { get; set; } = "";
 public Guid Version { get; set; } = Guid.NewGuid();
 public Guid? JournalId { get; set; }
}
