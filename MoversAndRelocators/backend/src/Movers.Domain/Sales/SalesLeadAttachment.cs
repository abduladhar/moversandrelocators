using Movers.Domain.Common;

namespace Movers.Domain.Sales;

public sealed class SalesLeadAttachment : TenantOwnedEntity
{
    private SalesLeadAttachment() { }
    public SalesLeadAttachment(Guid tenantId, Guid salesLeadId, Guid uploadLinkId, string originalFileName,
        string contentType, long declaredSizeBytes) : base(tenantId)
    { SalesLeadId = salesLeadId; UploadLinkId = uploadLinkId; OriginalFileName = originalFileName; ContentType = contentType; DeclaredSizeBytes = declaredSizeBytes; S3ObjectKey = $"tenants/{tenantId:N}/sales-leads/{salesLeadId:N}/attachments/{Id:N}/{originalFileName}"; CreatedAtUtc = DateTimeOffset.UtcNow; }
    public Guid SalesLeadId { get; private set; }
    public Guid UploadLinkId { get; private set; }
    public string OriginalFileName { get; private set; } = string.Empty;
    public string ContentType { get; private set; } = string.Empty;
    public long DeclaredSizeBytes { get; private set; }
    public long? StoredSizeBytes { get; private set; }
    public string S3ObjectKey { get; private set; } = string.Empty;
    public bool IsUploaded { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset? UploadedAtUtc { get; private set; }
    public string? ExtractionJson { get; private set; }
    public void SaveExtraction(string json) => ExtractionJson = json;
    public void MarkUploaded(long sizeBytes) { StoredSizeBytes = sizeBytes; IsUploaded = true; UploadedAtUtc = DateTimeOffset.UtcNow; }
}
