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
        var service = new LeadExtractionService(null!, null!, null!, null!, null!, null!, null!, null!, null!, null!, new User(authenticated, permitted), TimeProvider.System);
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
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Body = await request.Content!.ReadAsStringAsync(ct);
            Url = request.RequestUri!.ToString();
            Authorization = request.Headers.Authorization!.ToString();
            return new HttpResponseMessage(status) { Content = new StringContent(response, Encoding.UTF8, "application/json") };
        }
    }
}
