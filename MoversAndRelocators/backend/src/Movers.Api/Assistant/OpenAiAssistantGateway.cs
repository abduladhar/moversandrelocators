using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Movers.Services.Assistant;
using Movers.Services.Sales;

namespace Movers.Api.Assistant;

/// <summary>
/// The management assistant on OpenAI (Responses API with function tools, nothing stored at OpenAI). Each round's
/// output items go back in as they came (with the encrypted reasoning of reasoning models), followed by one
/// function_call_output per function_call, until the model answers in text.
/// </summary>
public sealed class OpenAiAssistantGateway(HttpClient client) : IAssistantModelGateway
{
    private const int MaxRounds = 10;
    public string Provider => AiProviders.OpenAi;

    /// <summary>Reasoning models (o-series, gpt-5 family) return encrypted reasoning that must be passed back with store=false.</summary>
    private static bool Reasoning(string model) => model.StartsWith("o", StringComparison.OrdinalIgnoreCase) || model.StartsWith("gpt-5", StringComparison.OrdinalIgnoreCase);

    public async Task<AssistantModelResult> Run(string apiKey, string model, string? effort, string system, IReadOnlyList<AssistantHistoryTurn> history, string question,
        IReadOnlyList<AssistantTool> tools, AssistantToolRunner run, CancellationToken ct)
    {
        var items = new JsonArray();
        foreach (var turn in history) items.Add(new JsonObject { ["role"] = turn.Role == "assistant" ? "assistant" : "user", ["content"] = turn.Text });
        items.Add(new JsonObject { ["role"] = "user", ["content"] = question });
        var toolList = tools.Select(t => new { type = "function", name = t.Name, description = t.Description, parameters = t.Schema }).ToList();

        int input = 0, cached = 0, output = 0;
        var text = "";
        for (var round = 0; round < MaxRounds; round++)
        {
            var body = new JsonObject
            {
                ["model"] = model, ["store"] = false, ["instructions"] = system, ["max_output_tokens"] = 12000,
                ["input"] = JsonNode.Parse(items.ToJsonString()), ["tools"] = JsonSerializer.SerializeToNode(toolList),
            };
            if (Reasoning(model)) body["include"] = new JsonArray("reasoning.encrypted_content");
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/responses") { Content = JsonContent.Create(body) };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            using var response = await client.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
                throw response.StatusCode switch
                {
                    HttpStatusCode.TooManyRequests => new InvalidOperationException("OpenAI is rate limited or out of quota. Try later or check billing."),
                    HttpStatusCode.Unauthorized => new InvalidOperationException("OpenAI rejected the API key. Check Settings › OpenAI configuration."),
                    >= HttpStatusCode.InternalServerError => new HttpRequestException("OpenAI is unavailable."),
                    _ => new InvalidOperationException("OpenAI could not answer. Check the tenant API key and model."),
                };
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            var root = document.RootElement;
            if (root.TryGetProperty("usage", out var usage) && usage.ValueKind == JsonValueKind.Object)
            {
                input += usage.TryGetProperty("input_tokens", out var i) ? i.GetInt32() : 0;
                output += usage.TryGetProperty("output_tokens", out var o) ? o.GetInt32() : 0;
                cached += usage.TryGetProperty("input_tokens_details", out var d) && d.ValueKind == JsonValueKind.Object && d.TryGetProperty("cached_tokens", out var c) ? c.GetInt32() : 0;
            }

            var calls = new List<(string CallId, string Name, string Arguments)>();
            var parts = new List<string>();
            foreach (var item in root.GetProperty("output").EnumerateArray())
            {
                items.Add(JsonNode.Parse(item.GetRawText()));
                var type = item.TryGetProperty("type", out var ty) ? ty.GetString() : null;
                if (type == "function_call")
                    calls.Add((item.GetProperty("call_id").GetString()!, item.GetProperty("name").GetString()!, item.TryGetProperty("arguments", out var a) ? a.GetString() ?? "{}" : "{}"));
                else if (type == "message" && item.TryGetProperty("content", out var content))
                    foreach (var part in content.EnumerateArray())
                        if (part.TryGetProperty("type", out var pt) && pt.GetString() == "output_text") parts.Add(part.GetProperty("text").GetString() ?? "");
            }
            text = string.Join("\n\n", parts.Where(p => !string.IsNullOrWhiteSpace(p)));
            if (calls.Count == 0)
            {
                if (text.Length == 0 && root.TryGetProperty("status", out var status) && status.GetString() == "incomplete")
                    throw new InvalidOperationException("OpenAI's answer was cut short. Ask a narrower question.");
                return new(text, input, cached, output);
            }
            foreach (var call in calls)
            {
                JsonElement arguments;
                try { arguments = JsonDocument.Parse(call.Arguments).RootElement.Clone(); }
                catch (JsonException) { items.Add(new JsonObject { ["type"] = "function_call_output", ["call_id"] = call.CallId, ["output"] = "{\"error\":\"The arguments were not valid JSON.\"}" }); continue; }
                var result = await run(call.Name, arguments, ct);
                items.Add(new JsonObject { ["type"] = "function_call_output", ["call_id"] = call.CallId, ["output"] = result });
            }
        }
        return new(text.Length > 0 ? text : "I needed too many steps for this question. Try asking it in smaller parts.", input, cached, output);
    }
}
