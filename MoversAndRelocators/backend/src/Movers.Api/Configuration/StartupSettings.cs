using Microsoft.Extensions.Configuration.EnvironmentVariables;

namespace Movers.Api.Configuration;

/// <summary>
/// Required settings, checked at startup. Development and Testing may take every value from appsettings or
/// environment variables; any other environment must supply secrets as environment variables
/// (e.g. Jwt__SigningKey), so they never live in a deployed settings file.
/// </summary>
public static class StartupSettings
{
    private static bool LocalEnvironment(WebApplicationBuilder b) => b.Environment.IsDevelopment() || b.Environment.IsEnvironment("Testing");
    private static string EnvironmentName(string key) => key.Replace(":", "__");

    /// <summary>A non-secret value that must be set (from any source).</summary>
    public static string Required(this WebApplicationBuilder b, string key) =>
        b.Configuration[key] is { Length: > 0 } value ? value.Trim() : throw new InvalidOperationException($"{key} must be configured (environment variable {EnvironmentName(key)}).");

    /// <summary>A secret: required, and outside Development/Testing it must come from an environment variable.</summary>
    public static string Secret(this WebApplicationBuilder b, string key)
    {
        var value = b.Required(key);
        if (!LocalEnvironment(b) && !FromEnvironmentVariable(b, key))
            throw new InvalidOperationException($"{key} is a secret: in {b.Environment.EnvironmentName} set it with the environment variable {EnvironmentName(key)}, not in a settings file.");
        return value;
    }

    /// <summary>An absolute http(s) address, without a trailing slash.</summary>
    public static string Url(this WebApplicationBuilder b, string key) => CheckUrl(key, b.Required(key));

    /// <summary>One or more absolute addresses separated by commas or semicolons (e.g. several frontend origins for CORS).</summary>
    public static string[] Urls(this WebApplicationBuilder b, string key) =>
        b.Required(key).Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(x => CheckUrl(key, x)).ToArray();

    private static string CheckUrl(string key, string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https" ? value.TrimEnd('/') : throw new InvalidOperationException($"{key} must be an absolute http(s) address, such as https://app.example.com.");

    /// <summary>True when the value that wins for <paramref name="key"/> is supplied by an environment variable.</summary>
    private static bool FromEnvironmentVariable(WebApplicationBuilder b, string key) =>
        ((IConfigurationRoot)b.Configuration).Providers.Reverse().FirstOrDefault(p => p.TryGet(key, out var v) && !string.IsNullOrEmpty(v)) is EnvironmentVariablesConfigurationProvider;
}
