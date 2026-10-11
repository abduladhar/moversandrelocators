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
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public void Update(string? encryptedApiKey, string? apiKeyLastFour, string extractionModel, string transcriptionModel)
    {
        if (!string.IsNullOrWhiteSpace(encryptedApiKey)) EncryptedApiKey = encryptedApiKey;
        if (!string.IsNullOrWhiteSpace(apiKeyLastFour)) ApiKeyLastFour = apiKeyLastFour;
        ExtractionModel = extractionModel.Trim();
        TranscriptionModel = transcriptionModel.Trim();
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }
}
