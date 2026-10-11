using Movers.Domain.Configuration;
using Movers.Services.Aws;
using Movers.Services.Tenancy;

namespace Movers.Services.OpenAi;

public sealed class OpenAiConfigurationService(
    IOpenAiConfigurationRepository repository,
    ITenantContext tenantContext,
    ISecretProtector protector) : IOpenAiConfigurationService
{
    public async Task<OpenAiConfigurationModel?> GetAsync(CancellationToken token)
    {
        var configuration = await repository.GetAsync(false, token);
        return configuration is null ? null : Map(configuration);
    }

    public async Task<OpenAiConfigurationModel> SaveAsync(SaveOpenAiConfigurationCommand command, CancellationToken token)
    {
        var existing = await repository.GetAsync(true, token);
        if (existing is null && string.IsNullOrWhiteSpace(command.ApiKey))
            throw new InvalidOperationException("An OpenAI API key is required for the initial configuration.");

        var tenantId = tenantContext.TenantId;
        var apiKey = string.IsNullOrWhiteSpace(command.ApiKey) ? null : command.ApiKey.Trim();
        var encryptedKey = apiKey is null ? null : protector.Protect(apiKey, $"openai-api:{tenantId}");
        var lastFour = apiKey is null ? null : apiKey[^Math.Min(4, apiKey.Length)..];

        if (existing is null)
        {
            existing = new TenantOpenAiConfiguration(tenantId, encryptedKey!, lastFour!,
                command.ExtractionModel, command.TranscriptionModel);
            repository.Add(existing);
        }
        else
        {
            existing.Update(encryptedKey, lastFour, command.ExtractionModel, command.TranscriptionModel);
        }

        await repository.SaveChangesAsync(token);
        return Map(existing);
    }

    private static OpenAiConfigurationModel Map(TenantOpenAiConfiguration x) => new(x.SerialNo, x.Id,
        $"••••{x.ApiKeyLastFour}", x.EncryptedApiKey.Length > 0, x.ExtractionModel, x.TranscriptionModel,
        x.CreatedAtUtc, x.UpdatedAtUtc);
}
