using Movers.Domain.Configuration;
using Movers.Services.Aws;
using Movers.Services.Tenancy;

namespace Movers.Services.Claude;

public sealed record SaveClaudeConfigurationCommand(string? ApiKey, string ExtractionModel, string Effort,
    decimal? InputPricePerMillion = null, decimal? CachedInputPricePerMillion = null, decimal? OutputPricePerMillion = null);
public sealed record ClaudeConfigurationModel(int SerialNo, Guid Id, string MaskedApiKey, bool HasApiKey, string ExtractionModel, string Effort,
    DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc, decimal? InputPricePerMillion = null, decimal? CachedInputPricePerMillion = null, decimal? OutputPricePerMillion = null);

public interface IClaudeConfigurationRepository
{
    Task<TenantClaudeConfiguration?> GetAsync(bool trackChanges, CancellationToken token);
    void Add(TenantClaudeConfiguration configuration);
    Task SaveChangesAsync(CancellationToken token);
}

/// <summary>Tenant Claude (Anthropic) settings: encrypted API key, extraction model, effort and prices.</summary>
public sealed class ClaudeConfigurationService(IClaudeConfigurationRepository repository, ITenantContext tenantContext, ISecretProtector protector)
{
    public static readonly string[] Efforts = ["low", "medium", "high"];
    public static string Purpose(Guid tenantId) => $"claude-api:{tenantId}";

    public async Task<ClaudeConfigurationModel?> GetAsync(CancellationToken token)
    {
        var configuration = await repository.GetAsync(false, token);
        return configuration is null ? null : Map(configuration);
    }

    public async Task<ClaudeConfigurationModel> SaveAsync(SaveClaudeConfigurationCommand command, CancellationToken token)
    {
        var existing = await repository.GetAsync(true, token);
        if (existing is null && string.IsNullOrWhiteSpace(command.ApiKey))
            throw new InvalidOperationException("A Claude API key is required for the initial configuration.");
        if (!command.ExtractionModel.Trim().StartsWith("claude-", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Choose a Claude model (its id starts with \"claude-\").");
        if (!Efforts.Contains(command.Effort.Trim().ToLowerInvariant()))
            throw new InvalidOperationException("Effort must be low, medium or high.");
        foreach (var price in new[] { command.InputPricePerMillion, command.CachedInputPricePerMillion, command.OutputPricePerMillion })
            if (price is < 0 or > 1000) throw new InvalidOperationException("Prices must be between 0 and 1,000 USD.");

        var tenantId = tenantContext.TenantId;
        var apiKey = string.IsNullOrWhiteSpace(command.ApiKey) ? null : command.ApiKey.Trim();
        var encryptedKey = apiKey is null ? null : protector.Protect(apiKey, Purpose(tenantId));
        var lastFour = apiKey is null ? null : apiKey[^Math.Min(4, apiKey.Length)..];
        if (existing is null)
        {
            existing = new TenantClaudeConfiguration(tenantId, encryptedKey!, lastFour!, command.ExtractionModel, command.Effort);
            repository.Add(existing);
        }
        else existing.Update(encryptedKey, lastFour, command.ExtractionModel, command.Effort);
        existing.SetPrices(command.InputPricePerMillion, command.CachedInputPricePerMillion, command.OutputPricePerMillion);
        await repository.SaveChangesAsync(token);
        return Map(existing);
    }

    private static ClaudeConfigurationModel Map(TenantClaudeConfiguration x) => new(x.SerialNo, x.Id, $"••••{x.ApiKeyLastFour}", x.EncryptedApiKey.Length > 0,
        x.ExtractionModel, x.Effort, x.CreatedAtUtc, x.UpdatedAtUtc, x.InputPricePerMillion, x.CachedInputPricePerMillion, x.OutputPricePerMillion);
}
