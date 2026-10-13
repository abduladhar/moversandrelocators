using System.Net;
using System.Text;
using System.Text.Json;
using Movers.Api.Storage;
using Movers.Services.Sales;
using Movers.Services.Security;

namespace Movers.Api.Tests;

public class LeadExtractionTests
{
    [Theory]
    [InlineData(false, false)]
    [InlineData(false, true)]
    [InlineData(true, false)]
    public async Task Extraction_requires_authentication_and_permission(bool authenticated, bool permitted)
    {
        var service = new LeadExtractionService(null!, null!, null!, null!, null!, null!, null!, null!, null!, null!, null!, null!, new User(authenticated, permitted), TimeProvider.System);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.Extract(Guid.NewGuid(), Guid.NewGuid(), null, null, default));
    }

    [Fact]
    public async Task Gateway_sends_signed_image_and_frames_as_vision_inputs_without_storing_response()
    {
        var handler = new Handler(HttpStatusCode.OK, """
            {"status":"completed","usage":{"input_tokens":1500,"input_tokens_details":{"cached_tokens":300},"output_tokens":120},"output":[{"content":[{"type":"output_text","text":"{\"items\":[]}"}]}]}
            """);
        var gateway = new OpenAiVisionGateway(new HttpClient(handler));
        var images = new[] { "https://bucket.s3.amazonaws.com/photo.jpg?signature=test", "data:image/jpeg;base64,/9j/" };
        var vision = await gateway.Extract("test-key", "test-model", new ExtractionInput(images, "Three boxes of books", ["Book carton (0.06 CBM)"]), default);
        Assert.Equal("{\"items\":[]}", vision.Json);
        Assert.Equal((1500, 300, 120), (vision.InputTokens, vision.CachedInputTokens, vision.OutputTokens));
        Assert.Equal("https://api.openai.com/v1/responses", handler.Url);
        Assert.Equal("Bearer test-key", handler.Authorization);
        using var document = JsonDocument.Parse(handler.Body!);
        var root = document.RootElement;
        Assert.False(root.GetProperty("store").GetBoolean());
        Assert.Equal("test-model", root.GetProperty("model").GetString());
        var content = root.GetProperty("input")[0].GetProperty("content");
        Assert.Contains("Book carton", content[0].GetProperty("text").GetString());
        Assert.Contains("Three boxes of books", content[1].GetProperty("text").GetString());
        Assert.Equal(images[0], content[2].GetProperty("image_url").GetString());
        Assert.Equal(images[1], content[3].GetProperty("image_url").GetString());
        var schema = root.GetProperty("text").GetProperty("format").GetProperty("schema").GetProperty("properties");
        Assert.True(schema.TryGetProperty("boxes", out _));
        Assert.True(schema.GetProperty("items").GetProperty("items").GetProperty("properties").TryGetProperty("fragile", out _));
        Assert.True(root.GetProperty("text").GetProperty("format").GetProperty("strict").GetBoolean());
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.TooManyRequests)]
    public async Task Upstream_errors_do_not_expose_provider_response(HttpStatusCode status)
    {
        var gateway = new OpenAiVisionGateway(new HttpClient(new Handler(status, "private-provider-detail")));
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => gateway.Extract("test-key", "model", new ExtractionInput([], null, []), default));
        Assert.DoesNotContain("private-provider-detail", error.Message);
        Assert.DoesNotContain("test-key", error.Message);
    }

    [Fact]
    public async Task Transcription_posts_the_sound_with_the_tenant_model()
    {
        var handler = new Handler(HttpStatusCode.OK, "Three boxes of books in the study");
        var gateway = new OpenAiVisionGateway(new HttpClient(handler));
        Assert.Equal("Three boxes of books in the study", await gateway.Transcribe("test-key", "transcribe-model", [1, 2, 3], "narration.wav", "audio/wav", default));
        Assert.Equal("https://api.openai.com/v1/audio/transcriptions", handler.Url);
        Assert.Contains("transcribe-model", handler.Body);
        Assert.Contains("narration.wav", handler.Body);
    }

    private const string ClaudeReply = """
        {"id":"msg_test","type":"message","role":"assistant","model":"claude-opus-5-5","content":[{"type":"text","text":"{\"items\":[],\"boxes\":[]}"}],"stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":1000,"output_tokens":120,"cache_read_input_tokens":300,"cache_creation_input_tokens":0}}
        """;

    [Fact]
    public async Task Claude_gateway_sends_signed_links_and_inline_frames_with_the_inventory_schema()
    {
        var handler = new Handler(HttpStatusCode.OK, ClaudeReply);
        var gateway = new ClaudeVisionGateway(new HttpClient(handler));
        var images = new[] { "https://bucket.s3.amazonaws.com/frames/frame-01.jpg?X-Amz-Signature=test", "data:image/jpeg;base64,/9j/AAAA" };
        var vision = await gateway.Extract("sk-ant-test-key", "claude-opus-5-5", "high", new ExtractionInput(images, "Three boxes of books", ["Book carton (0.06 CBM)"]), default);

        Assert.Equal("{\"items\":[],\"boxes\":[]}", vision.Json);
        Assert.Equal((1300, 300, 120), (vision.InputTokens, vision.CachedInputTokens, vision.OutputTokens));
        Assert.StartsWith("https://api.anthropic.com/v1/messages", handler.Url);
        Assert.Equal("sk-ant-test-key", handler.ApiKey);
        Assert.Contains("server-side-fallback-2026-07-01", handler.Beta);
        using var document = JsonDocument.Parse(handler.Body!);
        var root = document.RootElement;
        Assert.Equal("claude-opus-5-5", root.GetProperty("model").GetString());
        Assert.Equal("default", root.GetProperty("fallbacks").GetString());
        Assert.Equal("high", root.GetProperty("output_config").GetProperty("effort").GetString());
        var format = root.GetProperty("output_config").GetProperty("format");
        Assert.Equal("json_schema", format.GetProperty("type").GetString());
        Assert.True(format.GetProperty("schema").GetProperty("properties").GetProperty("items").GetProperty("items").GetProperty("properties").TryGetProperty("volumeCbm", out _));
        var content = root.GetProperty("messages")[0].GetProperty("content");
        Assert.Contains("Book carton", content[0].GetProperty("text").GetString());
        Assert.Contains("Three boxes of books", content[1].GetProperty("text").GetString());
        Assert.Equal("url", content[2].GetProperty("source").GetProperty("type").GetString());
        Assert.Equal(images[0], content[2].GetProperty("source").GetProperty("url").GetString());
        Assert.Equal("base64", content[3].GetProperty("source").GetProperty("type").GetString());
        Assert.Equal("image/jpeg", content[3].GetProperty("source").GetProperty("media_type").GetString());
        Assert.Equal("/9j/AAAA", content[3].GetProperty("source").GetProperty("data").GetString());
    }

    [Fact]
    public async Task Item_pictures_number_the_images_and_ask_for_each_items_best_picture()
    {
        var images = new[] { "https://example.test/frame-01.jpg", "https://example.test/frame-02.jpg" };
        var claudeHandler = new Handler(HttpStatusCode.OK, ClaudeReply);
        await new ClaudeVisionGateway(new HttpClient(claudeHandler)).Extract("sk-ant-test-key", "claude-opus-5-5", "medium", new ExtractionInput(images, null, [], Pictures: true), default);
        using (var document = JsonDocument.Parse(claudeHandler.Body!))
        {
            var content = document.RootElement.GetProperty("messages")[0].GetProperty("content");
            Assert.Contains("number of the picture", content[0].GetProperty("text").GetString());
            Assert.Equal(["Picture 1:", "image", "Picture 2:", "image"], content.EnumerateArray().Skip(1).Select(b => b.GetProperty("type").GetString() == "text" ? b.GetProperty("text").GetString() : "image").ToArray());
            var item = document.RootElement.GetProperty("output_config").GetProperty("format").GetProperty("schema").GetProperty("properties").GetProperty("items").GetProperty("items");
            Assert.Contains("mark", item.GetProperty("required").EnumerateArray().Select(x => x.GetString()));
            Assert.Equal(["x", "y", "width", "height"], item.GetProperty("properties").GetProperty("mark").GetProperty("required").EnumerateArray().Select(x => x.GetString()).ToArray());
            Assert.Contains("tight box", content[0].GetProperty("text").GetString());
            Assert.Contains("picture", item.GetProperty("required").EnumerateArray().Select(x => x.GetString()));
        }

        var openAiHandler = new Handler(HttpStatusCode.OK, """{"status":"completed","output":[{"content":[{"type":"output_text","text":"{\"items\":[]}"}]}]}""");
        await new OpenAiVisionGateway(new HttpClient(openAiHandler)).Extract("test-key", "test-model", new ExtractionInput(images, null, [], Pictures: true), default);
        using (var document = JsonDocument.Parse(openAiHandler.Body!))
        {
            var content = document.RootElement.GetProperty("input")[0].GetProperty("content");
            Assert.Equal("Picture 2:", content[3].GetProperty("text").GetString());
            Assert.Equal(images[1], content[4].GetProperty("image_url").GetString());
            Assert.True(document.RootElement.GetProperty("text").GetProperty("format").GetProperty("schema").GetProperty("properties").GetProperty("items").GetProperty("items").GetProperty("properties").TryGetProperty("picture", out _));
        }
    }

    [Fact]
    public async Task Claude_gateway_sends_no_fallbacks_for_models_without_them()
    {
        var handler = new Handler(HttpStatusCode.OK, ClaudeReply);
        await new ClaudeVisionGateway(new HttpClient(handler)).Extract("sk-ant-test-key", "claude-haiku-5-5", "low", new ExtractionInput(["https://example.test/a.jpg"], null, []), default);
        using var document = JsonDocument.Parse(handler.Body!);
        Assert.False(document.RootElement.TryGetProperty("fallbacks", out _));
        Assert.DoesNotContain("server-side-fallback", handler.Beta ?? "");
    }

    [Fact]
    public async Task Claude_errors_and_refusals_do_not_expose_provider_response()
    {
        var gateway = new ClaudeVisionGateway(new HttpClient(new Handler(HttpStatusCode.Unauthorized, """{"type":"error","error":{"type":"authentication_error","message":"private-provider-detail"}}""")));
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => gateway.Extract("sk-ant-test-key", "claude-opus-5-5", "medium", new ExtractionInput([], null, []), default));
        Assert.DoesNotContain("private-provider-detail", error.Message);
        Assert.DoesNotContain("sk-ant-test-key", error.Message);

        var refusal = new ClaudeVisionGateway(new HttpClient(new Handler(HttpStatusCode.OK, ClaudeReply.Replace("\"end_turn\"", "\"refusal\""))));
        await Assert.ThrowsAsync<InvalidOperationException>(() => refusal.Extract("sk-ant-test-key", "claude-opus-5-5", "medium", new ExtractionInput([], null, []), default));
    }

    private sealed class User(bool authenticated, bool permitted) : IUserContext
    {
        public Guid? UserId => null;
        public Guid? EmployeeId => null;
        public string Email => "test@example.invalid";
        public string? IpAddress => null;
        public bool IsAuthenticated => authenticated;
        public bool IsSystemAdmin => false;
        public bool HasPermission(string permission) => permitted && permission == SecurityPermissions.SalesExtract;
    }
    private sealed class Handler(HttpStatusCode status, string response) : HttpMessageHandler
    {
        public string? Body { get; private set; }
        public string? Url { get; private set; }
        public string? Authorization { get; private set; }
        public string? ApiKey { get; private set; }
        public string? Beta { get; private set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Body = await request.Content!.ReadAsStringAsync(ct);
            Url = request.RequestUri!.ToString();
            Authorization = request.Headers.Authorization?.ToString();
            ApiKey = request.Headers.TryGetValues("x-api-key", out var key) ? key.Single() : null;
            Beta = request.Headers.TryGetValues("anthropic-beta", out var beta) ? string.Join(",", beta) : null;
            return new HttpResponseMessage(status) { Content = new StringContent(response, Encoding.UTF8, "application/json") };
        }
    }
}
