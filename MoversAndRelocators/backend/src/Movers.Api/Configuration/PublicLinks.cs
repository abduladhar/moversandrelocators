namespace Movers.Api.Configuration;

/// <summary>
/// Customer-facing link URLs (survey, quotation, pickup, packing, delivery, uploads). They are built from
/// PublicApp:BaseUrl, the address customers open the app at; there is no fallback, so a missing setting is
/// caught at startup instead of sending customers to localhost.
/// </summary>
public sealed class PublicLinks(IConfiguration config)
{
    public const string Key = "PublicApp:BaseUrl";
    public string BaseUrl => (config[Key] is { Length: > 0 } value ? value : throw new InvalidOperationException(Key + " must be configured.")).TrimEnd('/');
    /// <summary>The customer page at <paramref name="path"/> for a link token.</summary>
    public string Url(string path, string token) => BaseUrl + "/" + path + "/" + Uri.EscapeDataString(token);
}
