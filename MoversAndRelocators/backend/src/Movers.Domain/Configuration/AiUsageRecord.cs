using Movers.Domain.Common;

namespace Movers.Domain.Configuration;

/// <summary>
/// One paid OpenAI run (for example extracting a sales-lead video): tokens and audio used, and the approximate cost
/// worked out with the tenant's prices at that moment. Cost fields are null when no prices were configured.
/// </summary>
public sealed class AiUsageRecord : TenantOwnedEntity
{
    public const string LeadExtraction = "LEAD_EXTRACTION";
    private AiUsageRecord() { }
    public AiUsageRecord(Guid tenantId, string feature, Guid? salesLeadId, Guid? attachmentId, string model, int inputTokens, int cachedInputTokens, int outputTokens,
        string? transcriptionModel, decimal audioSeconds, decimal? visionCost, decimal? transcriptionCost, string createdBy) : base(tenantId)
    {
        Feature = feature; SalesLeadId = salesLeadId; AttachmentId = attachmentId; Model = model; InputTokens = inputTokens; CachedInputTokens = cachedInputTokens;
        OutputTokens = outputTokens; TranscriptionModel = transcriptionModel; AudioSeconds = audioSeconds; VisionCost = visionCost; TranscriptionCost = transcriptionCost;
        TotalCost = visionCost is null && transcriptionCost is null ? null : (visionCost ?? 0) + (transcriptionCost ?? 0);
        CreatedBy = createdBy; CreatedAtUtc = DateTimeOffset.UtcNow;
    }
    public string Feature { get; private set; } = "";
    public Guid? SalesLeadId { get; private set; }
    public Guid? AttachmentId { get; private set; }
    public string Model { get; private set; } = "";
    public int InputTokens { get; private set; }
    public int CachedInputTokens { get; private set; }
    public int OutputTokens { get; private set; }
    public string? TranscriptionModel { get; private set; }
    public decimal AudioSeconds { get; private set; }
    /// <summary>Approximate cost in USD of the picture analysis; null when prices are not configured.</summary>
    public decimal? VisionCost { get; private set; }
    public decimal? TranscriptionCost { get; private set; }
    public decimal? TotalCost { get; private set; }
    public string Currency { get; private set; } = "USD";
    public string CreatedBy { get; private set; } = "";
    public DateTimeOffset CreatedAtUtc { get; private set; }
}
