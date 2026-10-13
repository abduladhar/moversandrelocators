using Movers.Domain.Configuration;
using Movers.Services.Sales;
using Movers.Services.Security;
using Movers.Services.Tenancy;

namespace Movers.Services.OpenAi;

/// <summary>Usage and approximate cost of one AI run, returned with its result.</summary>
public sealed record AiUsageModel(int InputTokens, int CachedInputTokens, int OutputTokens, decimal AudioSeconds, decimal? Cost, string Currency, bool PricesConfigured);
public sealed record AiUsageTotals(int Runs, long InputTokens, long OutputTokens, decimal AudioMinutes, decimal? Cost);
public sealed record AiUsageRow(DateTimeOffset CreatedAtUtc, string Feature, Guid? SalesLeadId, string? LeadNumber, string? CustomerName, string Model, int InputTokens, int OutputTokens, decimal AudioSeconds, decimal? Cost, string CreatedBy);
/// <summary>One AI run charged to a sales lead, as it appears in the expenses of the survey or quotation that lead became.</summary>
public sealed record AiSpendLine(Guid Id, DateTimeOffset IncurredAtUtc, string Provider, string Model, string Feature, decimal? Cost, string Currency, string CreatedBy);
/// <param name="Cost">Total of the runs, or null when no prices were configured when they ran.</param>
public sealed record AiSpendModel(int Runs, decimal? Cost, string Currency, IReadOnlyList<AiSpendLine> Lines);
public sealed record AiUsageSummary(string Currency, bool PricesConfigured, AiUsageTotals ThisMonth, AiUsageTotals AllTime, IReadOnlyList<AiUsageRow> Recent);

/// <summary>USD prices of one provider's models (null = not priced). Speech-to-text is OpenAI only.</summary>
public sealed record AiPrices(decimal? InputPerMillion, decimal? CachedInputPerMillion, decimal? OutputPerMillion, decimal? TranscriptionPerMinute = null)
{
    public static AiPrices Of(TenantOpenAiConfiguration c) => new(c.InputPricePerMillion, c.CachedInputPricePerMillion, c.OutputPricePerMillion, c.TranscriptionPricePerMinute);
    public static AiPrices Of(TenantClaudeConfiguration c) => new(c.InputPricePerMillion, c.CachedInputPricePerMillion, c.OutputPricePerMillion);
    public bool Configured => InputPerMillion is not null || OutputPerMillion is not null || TranscriptionPerMinute is not null;
}

public interface IAiUsageRepository
{
    void Add(AiUsageRecord record);
    Task Save(CancellationToken ct);
    Task<IReadOnlyList<AiUsageRecord>> All(CancellationToken ct);
    Task<IReadOnlyList<AiUsageRecord>> ForLead(Guid leadId, CancellationToken ct);
}

/// <summary>
/// Records what each AI run (OpenAI or Claude) used and what it approximately cost, using the prices entered in Settings
/// at the time of the run (so later price changes do not rewrite history). Without prices only usage is recorded.
/// </summary>
public sealed class AiUsageService(IAiUsageRepository repository, ISalesRepository leads, IUserContext user, TimeProvider clock)
{
    public static bool IsClaude(string model) => model.StartsWith("claude", StringComparison.OrdinalIgnoreCase);

    /// <summary>Picture analysis: uncached input, cached input (cheaper when priced) and output tokens.</summary>
    public static decimal? VisionCost(AiPrices c, int input, int cached, int output)
    {
        if (c.InputPerMillion is null && c.OutputPerMillion is null) return null;
        var inputPrice = c.InputPerMillion ?? 0m;
        var cachedPrice = c.CachedInputPerMillion ?? inputPrice;
        var uncached = Math.Max(0, input - cached);
        return Math.Round((uncached * inputPrice + cached * cachedPrice + output * (c.OutputPerMillion ?? 0m)) / 1_000_000m, 6);
    }

    public static decimal? TranscriptionCost(AiPrices c, decimal audioSeconds) =>
        audioSeconds <= 0 || c.TranscriptionPerMinute is null ? null : Math.Round(audioSeconds / 60m * c.TranscriptionPerMinute.Value, 6);

    /// <param name="prices">Prices of the provider that analysed the pictures.</param>
    /// <param name="transcriptionPrices">Prices of the speech-to-text (OpenAI), when another provider analysed the pictures.</param>
    public async Task<AiUsageModel> Record(Guid tenantId, AiPrices prices, AiPrices? transcriptionPrices, string feature, Guid? leadId, Guid? attachmentId, string model,
        int inputTokens, int cachedTokens, int outputTokens, string? transcriptionModel, decimal audioSeconds, CancellationToken ct)
    {
        var vision = VisionCost(prices, inputTokens, cachedTokens, outputTokens);
        var transcription = TranscriptionCost(transcriptionPrices ?? prices, audioSeconds);
        var record = new AiUsageRecord(tenantId, feature, leadId, attachmentId, model, inputTokens, cachedTokens, outputTokens,
            audioSeconds > 0 ? transcriptionModel : null, Math.Round(audioSeconds, 1), vision, transcription, string.IsNullOrWhiteSpace(user.Email) ? "Staff" : user.Email);
        repository.Add(record); await repository.Save(ct);
        return new(inputTokens, cachedTokens, outputTokens, record.AudioSeconds, record.TotalCost, record.Currency, prices.Configured);
    }

    /// <summary>Runs and approximate cost spent on one sales lead.</summary>
    public async Task<(int Runs, decimal? Cost)> ForLead(Guid leadId, CancellationToken ct)
    {
        var runs = await repository.ForLead(leadId, ct);
        return (runs.Count, runs.Any(r => r.TotalCost is not null) ? runs.Sum(r => r.TotalCost ?? 0) : null);
    }

    /// <summary>
    /// What the AI cost on one sales lead, line by line. This is a read of the usage records, never a second copy of
    /// them: the survey and the quotation the lead became both show these same lines, so a run is paid for once
    /// however many places it is reported in.
    /// </summary>
    public async Task<AiSpendModel> LeadSpend(Guid leadId, CancellationToken ct)
    {
        var runs = await repository.ForLead(leadId, ct);
        var lines = runs.OrderByDescending(r => r.CreatedAtUtc)
            .Select(r => new AiSpendLine(r.Id, r.CreatedAtUtc, IsClaude(r.Model) ? "Claude" : "OpenAI", r.Model, FeatureName(r.Feature), r.TotalCost, r.Currency, r.CreatedBy)).ToList();
        return new(lines.Count, runs.Any(r => r.TotalCost is not null) ? Math.Round(runs.Sum(r => r.TotalCost ?? 0), 4) : null,
            runs.FirstOrDefault()?.Currency ?? "USD", lines);
    }

    private static string FeatureName(string feature) => feature switch
    {
        Movers.Domain.Configuration.AiUsageRecord.LeadExtraction => "Item extraction",
        _ => feature.Replace('_', ' ').ToLowerInvariant(),
    };

    /// <param name="claude">Claude runs (model claude-*) when true, otherwise the OpenAI runs.</param>
    public async Task<AiUsageSummary> Summary(bool pricesConfigured, bool claude, CancellationToken ct)
    {
        var all = (await repository.All(ct)).Where(r => IsClaude(r.Model) == claude).ToList();
        var now = clock.GetUtcNow();
        var monthStart = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);
        static AiUsageTotals Totals(IReadOnlyCollection<AiUsageRecord> x) => new(x.Count, x.Sum(r => (long)r.InputTokens), x.Sum(r => (long)r.OutputTokens),
            Math.Round(x.Sum(r => r.AudioSeconds) / 60m, 1), x.Any(r => r.TotalCost is not null) ? Math.Round(x.Sum(r => r.TotalCost ?? 0), 4) : null);
        var names = (await leads.ListLeadsAsync(ct)).ToDictionary(l => l.Id, l => (l.LeadNumber, l.CustomerName));
        var recent = all.OrderByDescending(r => r.CreatedAtUtc).Take(25).Select(r =>
        {
            var lead = r.SalesLeadId is { } id && names.TryGetValue(id, out var n) ? n : default;
            return new AiUsageRow(r.CreatedAtUtc, r.Feature, r.SalesLeadId, lead.LeadNumber, lead.CustomerName, r.Model, r.InputTokens, r.OutputTokens, r.AudioSeconds, r.TotalCost, r.CreatedBy);
        }).ToList();
        return new("USD", pricesConfigured, Totals(all.Where(r => r.CreatedAtUtc >= monthStart).ToList()), Totals(all), recent);
    }
}
