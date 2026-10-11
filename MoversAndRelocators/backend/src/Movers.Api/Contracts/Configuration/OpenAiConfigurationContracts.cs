using System.ComponentModel.DataAnnotations;
using Movers.Services.OpenAi;

namespace Movers.Api.Contracts.Configuration;

public sealed record SaveOpenAiConfigurationRequest(
    [StringLength(300, MinimumLength = 20)] string? ApiKey,
    [Required, StringLength(120, MinimumLength = 3)] string ExtractionModel,
    [Required, StringLength(120, MinimumLength = 3)] string TranscriptionModel,
    [Range(0, 1000)] decimal? InputPricePerMillion = null, [Range(0, 1000)] decimal? CachedInputPricePerMillion = null,
    [Range(0, 1000)] decimal? OutputPricePerMillion = null, [Range(0, 1000)] decimal? TranscriptionPricePerMinute = null)
{
    public SaveOpenAiConfigurationCommand ToCommand() => new(ApiKey, ExtractionModel, TranscriptionModel, InputPricePerMillion, CachedInputPricePerMillion, OutputPricePerMillion, TranscriptionPricePerMinute);
}
