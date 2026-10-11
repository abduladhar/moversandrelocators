namespace Movers.Services.OpenAi;

/// <param name="InputPricePerMillion">Optional USD prices used to estimate the cost of each AI run.</param>
public sealed record SaveOpenAiConfigurationCommand(string? ApiKey, string ExtractionModel, string TranscriptionModel,
    decimal? InputPricePerMillion = null, decimal? CachedInputPricePerMillion = null, decimal? OutputPricePerMillion = null, decimal? TranscriptionPricePerMinute = null);
public sealed record OpenAiConfigurationModel(int SerialNo, Guid Id, string MaskedApiKey, bool HasApiKey,
    string ExtractionModel, string TranscriptionModel, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc,
    decimal? InputPricePerMillion = null, decimal? CachedInputPricePerMillion = null, decimal? OutputPricePerMillion = null, decimal? TranscriptionPricePerMinute = null);
