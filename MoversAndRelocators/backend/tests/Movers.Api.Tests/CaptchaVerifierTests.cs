using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using Movers.Api.Captcha;

namespace Movers.Api.Tests;

/// <summary>The Turnstile check: Cloudflare's answer decides, and a missing token or an unreachable Cloudflare never passes.</summary>
public sealed class CaptchaVerifierTests
{
    [Theory]
    [InlineData("""{"success":true,"error-codes":[]}""", true)]
    [InlineData("""{"success":false,"error-codes":["invalid-input-response"]}""", false)]
    [InlineData("not json", false)]
    public async Task Cloudflare_answer_decides(string answer, bool expected)
    {
        var handler = new Handler(_ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(answer) });
        var verifier = new TurnstileCaptchaVerifier(new HttpClient(handler), new CaptchaOptions("site", "secret"), NullLogger<TurnstileCaptchaVerifier>.Instance);
        Assert.Equal(expected, await verifier.VerifyAsync("token", "10.0.0.1", CancellationToken.None));
        var sent = await handler.Last!.Content!.ReadAsStringAsync();
        Assert.Equal(TurnstileCaptchaVerifier.VerifyUrl, handler.Last.RequestUri!.ToString());
        Assert.Contains("secret=secret", sent); Assert.Contains("response=token", sent); Assert.Contains("remoteip=10.0.0.1", sent);
    }

    [Fact]
    public async Task No_token_or_no_connection_fails()
    {
        var down = new Handler(_ => throw new HttpRequestException("offline"));
        var verifier = new TurnstileCaptchaVerifier(new HttpClient(down), new CaptchaOptions("site", "secret"), NullLogger<TurnstileCaptchaVerifier>.Instance);
        Assert.False(await verifier.VerifyAsync(null, null, CancellationToken.None));
        Assert.Null(down.Last);
        Assert.False(await verifier.VerifyAsync("token", null, CancellationToken.None));
    }

    private sealed class Handler(Func<HttpRequestMessage, HttpResponseMessage> answer) : HttpMessageHandler
    {
        public HttpRequestMessage? Last;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) { Last = request; return Task.FromResult(answer(request)); }
    }
}
