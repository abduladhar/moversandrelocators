namespace Movers.Services.OpenAi;

public sealed record SaveOpenAiConfigurationCommand(string? ApiKey, string ExtractionModel, string TranscriptionModel);
public sealed record OpenAiConfigurationModel(int SerialNo, Guid Id, string MaskedApiKey, bool HasApiKey,
    string ExtractionModel, string TranscriptionModel, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc);
