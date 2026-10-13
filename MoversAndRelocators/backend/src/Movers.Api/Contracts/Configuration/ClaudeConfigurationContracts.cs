using System.ComponentModel.DataAnnotations;
using Movers.Services.Claude;

namespace Movers.Api.Contracts.Configuration;

public sealed record SaveClaudeConfigurationRequest(
    [StringLength(300, MinimumLength = 20)] string? ApiKey,
    [Required, StringLength(120, MinimumLength = 3)] string ExtractionModel,
    [Required, StringLength(20)] string Effort,
    [Range(0, 1000)] decimal? InputPricePerMillion = null, [Range(0, 1000)] decimal? CachedInputPricePerMillion = null,
    [Range(0, 1000)] decimal? OutputPricePerMillion = null)
{
    public SaveClaudeConfigurationCommand ToCommand() => new(ApiKey, ExtractionModel, Effort, InputPricePerMillion, CachedInputPricePerMillion, OutputPricePerMillion);
}
