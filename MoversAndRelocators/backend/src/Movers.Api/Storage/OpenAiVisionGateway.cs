using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Movers.Services.Sales;
namespace Movers.Api.Storage;

/// <summary>OpenAI calls for lead inventory: picture analysis (Responses API) and speech-to-text (audio transcriptions).</summary>
public sealed class OpenAiVisionGateway(HttpClient client) : IInventoryVisionGateway
{
    public async Task<VisionResult> Extract(string apiKey, string model, ExtractionInput input, CancellationToken ct)
    {
        var content = new List<object> { new { type = "input_text", text = InventoryPrompt.Instructions(input) } };
        if (InventoryPrompt.Narration(input) is { } narration) content.Add(new { type = "input_text", text = narration });
        for (var i = 0; i < input.Images.Count; i++)
        {
            if (input.Pictures) content.Add(new { type = "input_text", text = $"Picture {i + 1}:" });
            content.Add(new { type = "input_image", image_url = input.Images[i], detail = "auto" });
        }
        var schema = InventoryPrompt.Schema(input.Pictures);
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/responses");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Content = JsonContent.Create(new { model, store = false, max_output_tokens = 8000,
            input = new[] { new { role = "user", content } },
            text = new { format = new { type = "json_schema", name = "moving_inventory", strict = true, schema } } });
        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException(response.StatusCode == System.Net.HttpStatusCode.TooManyRequests
                ? "OpenAI is rate limited or out of quota. Try later or check billing."
                : "OpenAI extraction failed. Check the tenant API key, vision model and media access.");
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        if (document.RootElement.GetProperty("status").GetString() != "completed")
            throw new InvalidOperationException("OpenAI did not complete extraction. Retry with a shorter video.");
        // Token usage, for the approximate cost of the run.
        int inputTokens = 0, cachedTokens = 0, outputTokens = 0;
        if (document.RootElement.TryGetProperty("usage", out var usage) && usage.ValueKind == JsonValueKind.Object)
        {
            inputTokens = usage.TryGetProperty("input_tokens", out var i) ? i.GetInt32() : 0;
            outputTokens = usage.TryGetProperty("output_tokens", out var o) ? o.GetInt32() : 0;
            cachedTokens = usage.TryGetProperty("input_tokens_details", out var d) && d.ValueKind == JsonValueKind.Object && d.TryGetProperty("cached_tokens", out var c) ? c.GetInt32() : 0;
        }
        foreach (var outputItem in document.RootElement.GetProperty("output").EnumerateArray())
            if (outputItem.TryGetProperty("content", out var parts))
                foreach (var part in parts.EnumerateArray())
                    if (part.GetProperty("type").GetString() == "output_text") return new VisionResult(part.GetProperty("text").GetString()!, inputTokens, cachedTokens, outputTokens);
        throw new InvalidOperationException("No inventory was returned by OpenAI.");
    }

    public async Task<string> Transcribe(string apiKey, string model, byte[] audio, string fileName, string contentType, CancellationToken ct)
    {
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(audio); file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        form.Add(file, "file", fileName);
        form.Add(new StringContent(model), "model");
        form.Add(new StringContent("text"), "response_format");
        form.Add(new StringContent("A walk-through of a home or office for a moving company: rooms, furniture, appliances and boxes."), "prompt");
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/audio/transcriptions") { Content = form };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException("OpenAI could not transcribe the sound.");
        return await response.Content.ReadAsStringAsync(ct);
    }
}

/// <summary>PUTs bytes to a presigned storage URL (S3).</summary>
public sealed class HttpObjectUploader(HttpClient client) : IObjectUploader
{
    public async Task PutAsync(string url, byte[] content, string contentType, CancellationToken ct)
    {
        using var body = new ByteArrayContent(content); body.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        using var response = await client.PutAsync(url, body, ct);
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException("A video frame could not be stored. Check the S3 settings.");
    }
}
