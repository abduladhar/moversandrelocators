using Movers.Domain.Common;

namespace Movers.Domain.Configuration;

public sealed class TenantOpenAiConfiguration : TenantOwnedEntity
{
    private TenantOpenAiConfiguration() { }

    public TenantOpenAiConfiguration(Guid tenantId, string encryptedApiKey, string apiKeyLastFour,
        string extractionModel, string transcriptionModel) : base(tenantId)
    {
        CreatedAtUtc = DateTimeOffset.UtcNow;
        Update(encryptedApiKey, apiKeyLastFour, extractionModel, transcriptionModel);
    }

    public string EncryptedApiKey { get; private set; } = string.Empty;
    public string ApiKeyLastFour { get; private set; } = string.Empty;
    public string ExtractionModel { get; private set; } = string.Empty;
    public string TranscriptionModel { get; private set; } = string.Empty;
    /* Optional prices (USD) used to estimate what each AI run costs; copy them from OpenAI's pricing page for your models. */
    public decimal? InputPricePerMillion { get; private set; }
    public decimal? CachedInputPricePerMillion { get; private set; }
    public decimal? OutputPricePerMillion { get; private set; }
    public decimal? TranscriptionPricePerMinute { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public void SetPrices(decimal? input, decimal? cachedInput, decimal? output, decimal? transcriptionPerMinute)
    {
        InputPricePerMillion = input; CachedInputPricePerMillion = cachedInput; OutputPricePerMillion = output; TranscriptionPricePerMinute = transcriptionPerMinute;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void Update(string? encryptedApiKey, string? apiKeyLastFour, string extractionModel, string transcriptionModel)
    {
        if (!string.IsNullOrWhiteSpace(encryptedApiKey)) EncryptedApiKey = encryptedApiKey;
        if (!string.IsNullOrWhiteSpace(apiKeyLastFour)) ApiKeyLastFour = apiKeyLastFour;
        ExtractionModel = extractionModel.Trim();
        TranscriptionModel = transcriptionModel.Trim();
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }
}
