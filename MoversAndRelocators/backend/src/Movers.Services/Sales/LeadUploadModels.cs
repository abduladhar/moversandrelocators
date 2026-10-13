namespace Movers.Services.Sales;

public sealed record UploadLinkModel(int SerialNo, Guid Id, Guid SalesLeadId, DateTimeOffset ExpiresAtUtc, bool IsActive, DateTimeOffset CreatedAtUtc, string? RequestedItems = null, string? Description = null, string? CustomerItems = null, string? CustomerDescription = null);
public sealed record GeneratedUploadLinkModel(UploadLinkModel Link, string Token);
public sealed record AttachmentModel(int SerialNo, Guid Id, Guid SalesLeadId, string OriginalFileName, string ContentType,
    long DeclaredSizeBytes, long? StoredSizeBytes, bool IsUploaded, DateTimeOffset CreatedAtUtc, DateTimeOffset? UploadedAtUtc, string? ExtractionJson = null);
/// <summary>The lead behind a customer link, for the pages that work on the lead itself rather than on its files.</summary>
public sealed record PublicLinkLeadModel(Guid LeadId, string TenantName, string LeadNumber, string CustomerName, DateTimeOffset ExpiresAtUtc);
public sealed record PublicUploadInfoModel(string TenantName, string LeadNumber, string CustomerName, DateTimeOffset ExpiresAtUtc, string? RequestedItems = null, string? Description = null, string? CustomerItems = null, string? CustomerDescription = null);
public sealed record UploadRequestModel(string FileName, string ContentType, long SizeBytes);
public sealed record PresignedUploadModel(Guid AttachmentId, string UploadUrl, DateTimeOffset UrlExpiresAtUtc);
public sealed record AwsStorageCredentials(string Region, string BucketName, string AccessKey, string SecretKey);
public sealed record StoredObjectInfo(long SizeBytes);

public interface IAwsObjectStorage
{
    bool RequiresTenantCredentials => true;
    Task<string> CreateUploadUrlAsync(AwsStorageCredentials credentials, string key, string contentType, DateTimeOffset expiresAtUtc, CancellationToken token);
    Task<string> CreateDownloadUrlAsync(AwsStorageCredentials credentials, string key, string fileName, DateTimeOffset expiresAtUtc, CancellationToken token);
    Task<StoredObjectInfo?> GetObjectInfoAsync(AwsStorageCredentials credentials, string key, CancellationToken token);
    /// <summary>Writes a small server-made file directly (in-house storage only; S3 is written through a presigned upload URL).</summary>
    Task WriteAsync(string key, byte[] content, string contentType, CancellationToken token) =>
        throw new NotSupportedException("This storage is written through presigned upload URLs.");
}
