using System.ComponentModel.DataAnnotations;
using Movers.Services.Aws;

namespace Movers.Api.Contracts.Configuration;

public sealed record SaveAwsConfigurationRequest(
    [Required, StringLength(60, MinimumLength = 5), RegularExpression("^[a-z]{2}(?:-[a-z0-9]+)+-[0-9]+$")] string Region,
    [Required, StringLength(63, MinimumLength = 3), RegularExpression("^[a-z0-9][a-z0-9.-]+[a-z0-9]$")] string BucketName,
    [StringLength(128, MinimumLength = 16)] string? AccessKey,
    [StringLength(256, MinimumLength = 16)] string? SecretKey)
{
    public SaveAwsConfigurationCommand ToCommand() => new(Region, BucketName, AccessKey, SecretKey);
}
