using System.Text.Json.Serialization;
using Movers.Services.Sales;

namespace Movers.Api.Captcha;

/// <summary>Captcha keys for public forms (Cloudflare Turnstile). The secret is a secret: environment variable Captcha__SecretKey outside Development.</summary>
public sealed record CaptchaOptions(string SiteKey, string SecretKey);

/// <summary>Asks Cloudflare whether a Turnstile token is genuine, unused and recent. Any failure to reach Cloudflare counts as "not verified".</summary>
public sealed class TurnstileCaptchaVerifier(HttpClient http, CaptchaOptions options, ILogger<TurnstileCaptchaVerifier> log) : ICaptchaVerifier
{
    public const string VerifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
    public string? SiteKey => options.SiteKey;

    public async Task<bool> VerifyAsync(string? token, string? remoteIp, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 2048) return false;
        var form = new Dictionary<string, string> { ["secret"] = options.SecretKey, ["response"] = token };
        if (!string.IsNullOrWhiteSpace(remoteIp)) form["remoteip"] = remoteIp;
        try
        {
            using var response = await http.PostAsync(VerifyUrl, new FormUrlEncodedContent(form), ct);
            var result = await response.Content.ReadFromJsonAsync<Result>(ct);
            if (result?.Success == true) return true;
            log.LogInformation("Captcha rejected: {Errors}", string.Join(",", result?.ErrorCodes ?? []));
            return false;
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        { log.LogWarning(e, "Captcha check could not reach Cloudflare."); return false; }
    }

    private sealed record Result(bool Success, [property: JsonPropertyName("error-codes")] string[]? ErrorCodes);
}
