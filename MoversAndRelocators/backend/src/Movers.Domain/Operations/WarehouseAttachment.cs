using Movers.Domain.Common;
namespace Movers.Domain.Operations;
public sealed class WarehouseAttachment(Guid tenantId) : TenantOwnedEntity(tenantId) {
    public Guid ReceiptId { get; set; }
    public string OriginalFileName { get; set; } = "";
    public string ContentType { get; set; } = "";
    public long DeclaredSizeBytes { get; set; }
    public long? StoredSizeBytes { get; set; }
    public string ObjectKey { get; set; } = "";
    public string UploadedBy { get; set; } = "";
    public bool IsUploaded { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset? UploadedAtUtc { get; set; }
}
