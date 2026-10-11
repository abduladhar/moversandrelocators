using Movers.Domain.Configuration;
using Movers.Services.Sales;
using Movers.Services.Security;
using Movers.Services.Tenancy;

namespace Movers.Services.OpenAi;

/// <summary>Usage and approximate cost of one AI run, returned with its result.</summary>
public sealed record AiUsageModel(int InputTokens, int CachedInputTokens, int OutputTokens, decimal AudioSeconds, decimal? Cost, string Currency, bool PricesConfigured);
public sealed record AiUsageTotals(int Runs, long InputTokens, long OutputTokens, decimal AudioMinutes, decimal? Cost);
public sealed record AiUsageRow(DateTimeOffset CreatedAtUtc, string Feature, Guid? SalesLeadId, string? LeadNumber, string? CustomerName, string Model, int InputTokens, int OutputTokens, decimal AudioSeconds, decimal? Cost, string CreatedBy);
public sealed record AiUsageSummary(string Currency, bool PricesConfigured, AiUsageTotals ThisMonth, AiUsageTotals AllTime, IReadOnlyList<AiUsageRow> Recent);

public interface IAiUsageRepository
{
    void Add(AiUsageRecord record);
    Task Save(CancellationToken ct);
    Task<IReadOnlyList<AiUsageRecord>> All(CancellationToken ct);
    Task<IReadOnlyList<AiUsageRecord>> ForLead(Guid leadId, CancellationToken ct);
}

/// <summary>
/// Records what each OpenAI run used and what it approximately cost, using the prices entered in Settings › OpenAI
/// at the time of the run (so later price changes do not rewrite history). Without prices only usage is recorded.
/// </summary>
public sealed class AiUsageService(IAiUsageRepository repository, ISalesRepository leads, IUserContext user, TimeProvider clock)
{
    public static bool HasPrices(TenantOpenAiConfiguration c) => c.InputPricePerMillion is not null || c.OutputPricePerMillion is not null || c.TranscriptionPricePerMinute is not null;

    /// <summary>Picture analysis: uncached input, cached input (cheaper when priced) and output tokens.</summary>
    public static decimal? VisionCost(TenantOpenAiConfiguration c, int input, int cached, int output)
    {
        if (c.InputPricePerMillion is null && c.OutputPricePerMillion is null) return null;
        var inputPrice = c.InputPricePerMillion ?? 0m;
        var cachedPrice = c.CachedInputPricePerMillion ?? inputPrice;
        var uncached = Math.Max(0, input - cached);
        return Math.Round((uncached * inputPrice + cached * cachedPrice + output * (c.OutputPricePerMillion ?? 0m)) / 1_000_000m, 6);
    }

    public static decimal? TranscriptionCost(TenantOpenAiConfiguration c, decimal audioSeconds) =>
        audioSeconds <= 0 || c.TranscriptionPricePerMinute is null ? null : Math.Round(audioSeconds / 60m * c.TranscriptionPricePerMinute.Value, 6);

    public async Task<AiUsageModel> Record(TenantOpenAiConfiguration config, string feature, Guid? leadId, Guid? attachmentId, string model,
        int inputTokens, int cachedTokens, int outputTokens, string? transcriptionModel, decimal audioSeconds, CancellationToken ct)
    {
        var vision = VisionCost(config, inputTokens, cachedTokens, outputTokens);
        var transcription = TranscriptionCost(config, audioSeconds);
        var record = new AiUsageRecord(config.TenantId, feature, leadId, attachmentId, model, inputTokens, cachedTokens, outputTokens,
            audioSeconds > 0 ? transcriptionModel : null, Math.Round(audioSeconds, 1), vision, transcription, string.IsNullOrWhiteSpace(user.Email) ? "Staff" : user.Email);
        repository.Add(record); await repository.Save(ct);
        return new(inputTokens, cachedTokens, outputTokens, record.AudioSeconds, record.TotalCost, record.Currency, HasPrices(config));
    }

    /// <summary>Runs and approximate cost spent on one sales lead.</summary>
    public async Task<(int Runs, decimal? Cost)> ForLead(Guid leadId, CancellationToken ct)
    {
        var runs = await repository.ForLead(leadId, ct);
        return (runs.Count, runs.Any(r => r.TotalCost is not null) ? runs.Sum(r => r.TotalCost ?? 0) : null);
    }

    public async Task<AiUsageSummary> Summary(TenantOpenAiConfiguration? config, CancellationToken ct)
    {
        var all = await repository.All(ct);
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
        return new("USD", config is not null && HasPrices(config), Totals(all.Where(r => r.CreatedAtUtc >= monthStart).ToList()), Totals(all), recent);
    }
}
