using System.Text.Json;
using Anthropic;
using Anthropic.Exceptions;
using Anthropic.Models.Messages;
using Movers.Services.Assistant;
using Movers.Services.Sales;

namespace Movers.Api.Assistant;

/// <summary>
/// The management assistant on Claude (Messages API, manual tool-use loop). Earlier questions and answers go in as
/// plain text; within one question the history is only ever appended to (each assistant turn is sent back exactly as
/// it came, thinking blocks included), and every tool_use gets its tool_result in one user message.
/// </summary>
public sealed class ClaudeAssistantGateway(HttpClient http) : IAssistantModelGateway
{
    private const int MaxRounds = 10;
    public string Provider => AiProviders.Claude;

    public async Task<AssistantModelResult> Run(string apiKey, string model, string? effort, string system, IReadOnlyList<AssistantHistoryTurn> history, string question,
        IReadOnlyList<AssistantTool> tools, AssistantToolRunner run, CancellationToken ct)
    {
        var client = new AnthropicClient { ApiKey = apiKey, HttpClient = http, Timeout = TimeSpan.FromMinutes(5) };
        var messages = new List<MessageParam>();
        foreach (var turn in history)
            messages.Add(turn.Role == "assistant" ? new MessageParam { Role = Role.Assistant, Content = turn.Text } : new MessageParam { Role = Role.User, Content = turn.Text });
        messages.Add(new MessageParam { Role = Role.User, Content = question });
        var toolList = tools.Select(t => (ToolUnion)new Tool
        {
            Name = t.Name,
            Description = t.Description,
            InputSchema = new()
            {
                Properties = t.Schema.GetProperty("properties").EnumerateObject().ToDictionary(p => p.Name, p => p.Value.Clone()),
                Required = t.Schema.TryGetProperty("required", out var r) ? r.EnumerateArray().Select(x => x.GetString()!).ToList() : [],
            },
        }).ToList();

        int input = 0, cached = 0, output = 0;
        var text = "";
        for (var round = 0; round < MaxRounds; round++)
        {
            var parameters = new MessageCreateParams
            {
                Model = model,
                MaxTokens = 16000,
                // The instructions and tools are the same for every round of a question: cache them.
                System = new List<TextBlockParam> { new() { Text = system, CacheControl = new CacheControlEphemeral() } },
                Tools = toolList,
                Messages = messages,
                OutputConfig = new OutputConfig { Effort = effort switch { "low" => Effort.Low, "high" => Effort.High, _ => Effort.Medium } },
            };
            Message message;
            try { message = await client.Messages.Create(parameters, ct); }
            catch (AnthropicRateLimitException) { throw new InvalidOperationException("Claude is rate limited or out of credit. Try later or check billing."); }
            catch (AnthropicUnauthorizedException) { throw new InvalidOperationException("Claude rejected the API key. Check Settings › Claude configuration."); }
            catch (AnthropicForbiddenException) { throw new InvalidOperationException("This Claude API key may not use the selected model. Check Settings › Claude configuration."); }
            catch (Anthropic4xxException) { throw new InvalidOperationException("Claude could not answer. Check the tenant API key and model."); }
            catch (Anthropic5xxException e) { throw new HttpRequestException("Claude is unavailable.", e); }
            catch (AnthropicIOException e) { throw new HttpRequestException("Claude could not be reached.", e); }

            input += (int)message.Usage.InputTokens + (int)(message.Usage.CacheReadInputTokens ?? 0) + (int)(message.Usage.CacheCreationInputTokens ?? 0);
            cached += (int)(message.Usage.CacheReadInputTokens ?? 0);
            output += (int)message.Usage.OutputTokens;
            if (message.StopReason == "refusal") throw new InvalidOperationException("Claude declined to answer this question.");

            var echo = new List<ContentBlockParam>();
            var results = new List<ContentBlockParam>();
            var parts = new List<string>();
            foreach (var block in message.Content)
            {
                if (block.TryPickText(out var t)) { echo.Add(new TextBlockParam { Text = t.Text }); parts.Add(t.Text); }
                else if (block.TryPickThinking(out var thinking)) echo.Add(new ThinkingBlockParam { Thinking = thinking.Thinking, Signature = thinking.Signature });
                else if (block.TryPickRedactedThinking(out var redacted)) echo.Add(new RedactedThinkingBlockParam { Data = redacted.Data });
                else if (block.TryPickToolUse(out var use))
                {
                    echo.Add(new ToolUseBlockParam { ID = use.ID, Name = use.Name, Input = use.Input });
                    var result = await run(use.Name, JsonSerializer.SerializeToElement(use.Input), ct);
                    results.Add(new ToolResultBlockParam { ToolUseID = use.ID, Content = result });
                }
            }
            text = string.Join("\n\n", parts.Where(p => !string.IsNullOrWhiteSpace(p)));
            if (results.Count == 0)
            {
                if (message.StopReason == "max_tokens" && text.Length == 0) throw new InvalidOperationException("Claude's answer was cut short. Ask a narrower question.");
                return new(text, input, cached, output);
            }
            messages.Add(new MessageParam { Role = Role.Assistant, Content = echo });
            messages.Add(new MessageParam { Role = Role.User, Content = results });
        }
        return new(text.Length > 0 ? text : "I needed too many steps for this question. Try asking it in smaller parts.", input, cached, output);
    }
}
