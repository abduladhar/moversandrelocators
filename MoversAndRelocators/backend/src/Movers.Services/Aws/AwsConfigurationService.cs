using Movers.Domain.Configuration;
using Movers.Services.Tenancy;

namespace Movers.Services.Aws;

public sealed class AwsConfigurationService(
    IAwsConfigurationRepository repository,
    ITenantContext tenantContext,
    ISecretProtector protector) : IAwsConfigurationService
{
    public async Task<AwsConfigurationModel?> GetAsync(CancellationToken token)
    {
        var configuration = await repository.GetAsync(false, token);
        return configuration is null ? null : Map(configuration);
    }

    public async Task<AwsConfigurationModel> SaveAsync(SaveAwsConfigurationCommand command, CancellationToken token)
    {
        var existing = await repository.GetAsync(true, token);
        if (existing is null && (string.IsNullOrWhiteSpace(command.AccessKey) || string.IsNullOrWhiteSpace(command.SecretKey)))
            throw new InvalidOperationException("Access key and secret key are required for the initial AWS configuration.");

        var tenantId = tenantContext.TenantId;
        var accessKey = string.IsNullOrWhiteSpace(command.AccessKey) ? null : command.AccessKey.Trim();
        var secretKey = string.IsNullOrWhiteSpace(command.SecretKey) ? null : command.SecretKey.Trim();
        var encryptedAccess = accessKey is null ? null : protector.Protect(accessKey, $"aws-access:{tenantId}");
        var encryptedSecret = secretKey is null ? null : protector.Protect(secretKey, $"aws-secret:{tenantId}");
        var lastFour = accessKey is null ? null : accessKey[^Math.Min(4, accessKey.Length)..];

        if (existing is null)
        {
            existing = new TenantAwsConfiguration(tenantId, command.Region, command.BucketName, encryptedAccess!, lastFour!, encryptedSecret!);
            repository.Add(existing);
        }
        else
        {
            existing.Update(command.Region, command.BucketName, encryptedAccess, lastFour, encryptedSecret);
        }

        await repository.SaveChangesAsync(token);
        return Map(existing);
    }

    private static AwsConfigurationModel Map(TenantAwsConfiguration x) => new(x.SerialNo, x.Id, x.Region, x.BucketName,
        $"••••{x.AccessKeyLastFour}", x.EncryptedAccessKey.Length > 0, x.EncryptedSecretKey.Length > 0,
        x.CreatedAtUtc, x.UpdatedAtUtc);
}
