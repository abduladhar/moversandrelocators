using System.Text.Json;
using Anthropic;
using Anthropic.Exceptions;
using Anthropic.Models.Beta.Messages;
using Movers.Services.Sales;
namespace Movers.Api.Storage;

/// <summary>
/// Claude (Anthropic Messages API) picture analysis for lead inventory. Claude reads images, not video: it gets the S3
/// presigned links of the video frames (or inline JPEGs for local storage) plus the narration transcript, and answers
/// with the same strict JSON schema as OpenAI (structured outputs).
/// </summary>
public sealed class ClaudeVisionGateway(HttpClient http) : IClaudeVisionGateway
{
    /// <summary>Models that accept server-side refusal fallbacks: a declined request is re-served by another Claude model in the same call.</summary>
    private static readonly string[] FallbackModels = ["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"];

    public async Task<VisionResult> Extract(string apiKey, string model, string effort, ExtractionInput input, CancellationToken ct)
    {
        var client = new AnthropicClient { ApiKey = apiKey, HttpClient = http, Timeout = TimeSpan.FromMinutes(5) };
        var content = new List<BetaContentBlockParam> { new BetaTextBlockParam { Text = InventoryPrompt.Instructions(input) } };
        if (InventoryPrompt.Narration(input) is { } narration) content.Add(new BetaTextBlockParam { Text = narration });
        for (var i = 0; i < input.Images.Count; i++)
        {
            if (input.Pictures) content.Add(new BetaTextBlockParam { Text = $"Picture {i + 1}:" });
            content.Add(new BetaImageBlockParam { Source = Source(input.Images[i]) });
        }
        var schema = JsonSerializer.SerializeToElement(InventoryPrompt.Schema(input.Pictures)).EnumerateObject().ToDictionary(p => p.Name, p => p.Value);
        var fallback = FallbackModels.Contains(model);
        var parameters = new MessageCreateParams
        {
            Model = model,
            MaxTokens = 16000,
            Messages = [new() { Role = Role.User, Content = content }],
            OutputConfig = new BetaOutputConfig
            {
                Effort = effort switch { "low" => Effort.Low, "high" => Effort.High, _ => Effort.Medium },
                Format = new BetaJsonOutputFormat { Schema = schema },
            },
        };
        // Only models with server-side fallbacks get the parameter (an explicit null would still be sent).
        if (fallback) parameters = parameters with { Betas = ["server-side-fallback-2026-07-01"], Fallbacks = new Default() };

        BetaMessage message;
        try { message = await client.Beta.Messages.Create(parameters, ct); }
        catch (AnthropicRateLimitException) { throw new InvalidOperationException("Claude is rate limited or out of credit. Try later or check billing."); }
        catch (AnthropicUnauthorizedException) { throw new InvalidOperationException("Claude rejected the API key. Check Settings › Claude configuration."); }
        catch (AnthropicForbiddenException) { throw new InvalidOperationException("This Claude API key may not use the selected model. Check Settings › Claude configuration."); }
        catch (Anthropic4xxException) { throw new InvalidOperationException("Claude extraction failed. Check the tenant API key, model and media access."); }
        catch (Anthropic5xxException e) { throw new HttpRequestException("Claude is unavailable.", e); }
        catch (AnthropicIOException e) { throw new HttpRequestException("Claude could not be reached.", e); }

        if (message.StopReason == "refusal") throw new InvalidOperationException("Claude declined to analyse these pictures.");
        if (message.StopReason == "max_tokens") throw new InvalidOperationException("Claude's inventory was cut short. Retry with a shorter video.");
        // input_tokens excludes cache reads and writes; the total input includes them, as for OpenAI.
        var cached = (int)(message.Usage.CacheReadInputTokens ?? 0);
        var input_ = (int)message.Usage.InputTokens + cached + (int)(message.Usage.CacheCreationInputTokens ?? 0);
        var text = string.Concat(message.Content.Select(b => b.TryPickText(out var t) ? t.Text : ""));
        if (string.IsNullOrWhiteSpace(text)) throw new InvalidOperationException("No inventory was returned by Claude.");
        return new VisionResult(text, input_, cached, (int)message.Usage.OutputTokens);
    }

    /// <summary>A presigned https link is fetched by Anthropic; an inline data URL (local storage) is sent as base64.</summary>
    private static BetaImageBlockParamSource Source(string image)
    {
        if (!image.StartsWith("data:", StringComparison.Ordinal)) return new BetaUrlImageSource { Url = image };
        var comma = image.IndexOf(',');
        var mediaType = image[5..image.IndexOf(';')];
        return new BetaBase64ImageSource
        {
            Data = image[(comma + 1)..],
            MediaType = mediaType switch { "image/png" => MediaType.ImagePng, "image/webp" => MediaType.ImageWebP, "image/gif" => MediaType.ImageGif, _ => MediaType.ImageJpeg },
        };
    }
}
