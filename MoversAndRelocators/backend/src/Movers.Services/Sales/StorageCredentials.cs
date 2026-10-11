using Movers.Domain.Configuration;
using Movers.Services.Aws;

namespace Movers.Services.Sales;

/// <summary>Resolves the credentials for the tenant's file storage (S3, or the in-house store which needs none).</summary>
public static class StorageCredentials
{
    public static AwsStorageCredentials Resolve(IAwsObjectStorage storage, ISecretProtector protector, TenantAwsConfiguration? aws) => !storage.RequiresTenantCredentials
        ? new("local", "local", "", "")
        : aws is null || string.IsNullOrWhiteSpace(aws.BucketName) ? throw new InvalidOperationException("File storage is not configured for this company yet.") : new(aws.Region, aws.BucketName,
            protector.Unprotect(aws.EncryptedAccessKey, $"aws-access:{aws.TenantId}"),
            protector.Unprotect(aws.EncryptedSecretKey, $"aws-secret:{aws.TenantId}"));
}
