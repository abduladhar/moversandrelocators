using Movers.Domain.Common;

namespace Movers.Domain.Configuration;

public sealed class TenantAwsConfiguration : TenantOwnedEntity
{
    private TenantAwsConfiguration() { }

    public TenantAwsConfiguration(Guid tenantId, string region, string bucketName, string encryptedAccessKey,
        string accessKeyLastFour, string encryptedSecretKey) : base(tenantId)
    {
        CreatedAtUtc = DateTimeOffset.UtcNow;
        Update(region, bucketName, encryptedAccessKey, accessKeyLastFour, encryptedSecretKey);
    }

    public string Region { get; private set; } = string.Empty;
    public string BucketName { get; private set; } = string.Empty;
    public string EncryptedAccessKey { get; private set; } = string.Empty;
    public string AccessKeyLastFour { get; private set; } = string.Empty;
    public string EncryptedSecretKey { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public void Update(string region, string bucketName, string? encryptedAccessKey = null, string? accessKeyLastFour = null,
        string? encryptedSecretKey = null)
    {
        Region = region.Trim().ToLowerInvariant();
        BucketName = bucketName.Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(encryptedAccessKey)) EncryptedAccessKey = encryptedAccessKey;
        if (!string.IsNullOrWhiteSpace(accessKeyLastFour)) AccessKeyLastFour = accessKeyLastFour;
        if (!string.IsNullOrWhiteSpace(encryptedSecretKey)) EncryptedSecretKey = encryptedSecretKey;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }
}
