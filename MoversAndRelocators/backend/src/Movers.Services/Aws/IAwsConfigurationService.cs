namespace Movers.Services.Aws;

public interface IAwsConfigurationService
{
    Task<AwsConfigurationModel?> GetAsync(CancellationToken token);
    Task<AwsConfigurationModel> SaveAsync(SaveAwsConfigurationCommand command, CancellationToken token);
}
