namespace Movers.Services.OpenAi;

public interface IOpenAiConfigurationService
{
    Task<OpenAiConfigurationModel?> GetAsync(CancellationToken token);
    Task<OpenAiConfigurationModel> SaveAsync(SaveOpenAiConfigurationCommand command, CancellationToken token);
}
