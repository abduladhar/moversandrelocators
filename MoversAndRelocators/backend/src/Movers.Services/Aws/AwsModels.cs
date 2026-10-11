namespace Movers.Services.Aws;

public sealed record SaveAwsConfigurationCommand(string Region, string BucketName, string? AccessKey, string? SecretKey);
public sealed record AwsConfigurationModel(int SerialNo, Guid Id, string Region, string BucketName, string MaskedAccessKey,
    bool HasAccessKey, bool HasSecretKey, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc);
