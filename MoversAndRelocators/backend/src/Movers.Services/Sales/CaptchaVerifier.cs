namespace Movers.Services.Sales;

/// <summary>Checks that a public form was sent by a person (Cloudflare Turnstile). SiteKey: null when no captcha is configured.</summary>
public interface ICaptchaVerifier
{
    string? SiteKey { get; }
    Task<bool> VerifyAsync(string? token, string? remoteIp, CancellationToken ct);
}

/// <summary>No captcha configured (local development without keys): every submission passes.</summary>
public sealed class NoCaptcha : ICaptchaVerifier
{
    public string? SiteKey => null;
    public Task<bool> VerifyAsync(string? token, string? remoteIp, CancellationToken ct) => Task.FromResult(true);
}
