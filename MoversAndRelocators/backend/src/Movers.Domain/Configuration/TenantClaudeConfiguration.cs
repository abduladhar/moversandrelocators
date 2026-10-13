using Movers.Domain.Common;

namespace Movers.Domain.Configuration;

/// <summary>One encrypted Anthropic (Claude) profile per tenant, used for AI inventory extraction from sales-lead pictures and video frames.</summary>
public sealed class TenantClaudeConfiguration : TenantOwnedEntity
{
    private TenantClaudeConfiguration() { }

    public TenantClaudeConfiguration(Guid tenantId, string encryptedApiKey, string apiKeyLastFour, string extractionModel, string effort) : base(tenantId)
    {
        CreatedAtUtc = DateTimeOffset.UtcNow;
        Update(encryptedApiKey, apiKeyLastFour, extractionModel, effort);
    }

    public string EncryptedApiKey { get; private set; } = string.Empty;
    public string ApiKeyLastFour { get; private set; } = string.Empty;
    public string ExtractionModel { get; private set; } = string.Empty;
    /// <summary>How much the model thinks before answering: low, medium or high (more is slower and costs more).</summary>
    public string Effort { get; private set; } = "medium";
    /* Optional prices (USD) used to estimate what each AI run costs; copy them from Anthropic's pricing page for the model. */
    public decimal? InputPricePerMillion { get; private set; }
    public decimal? CachedInputPricePerMillion { get; private set; }
    public decimal? OutputPricePerMillion { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public void SetPrices(decimal? input, decimal? cachedInput, decimal? output)
    {
        InputPricePerMillion = input; CachedInputPricePerMillion = cachedInput; OutputPricePerMillion = output;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void Update(string? encryptedApiKey, string? apiKeyLastFour, string extractionModel, string effort)
    {
        if (!string.IsNullOrWhiteSpace(encryptedApiKey)) EncryptedApiKey = encryptedApiKey;
        if (!string.IsNullOrWhiteSpace(apiKeyLastFour)) ApiKeyLastFour = apiKeyLastFour;
        ExtractionModel = extractionModel.Trim();
        Effort = effort.Trim().ToLowerInvariant();
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }
}
