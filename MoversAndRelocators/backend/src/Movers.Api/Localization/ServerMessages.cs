using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Movers.Api.Localization;

/// <summary>
/// The catalog of messages the API can send (server-messages.json, built by tools/i18n/extract-server-messages.mjs from
/// the messages in the code). Each English message has a stable code; the client shows the message in the user's
/// language from that code, filling {placeholders} from the params. A message not in the catalog gets code UNKNOWN and
/// the client falls back to the English text.
/// </summary>
public static partial class ServerMessages
{
    public const string Unknown = "UNKNOWN";
    public const string ValidationFailed = "VALIDATION_FAILED";

    private static readonly Dictionary<string, string> CodeByText;
    private static readonly List<(string Code, Regex Pattern, string[] Names)> Templates = [];

    /// <summary>Code to English template, as shipped in the catalog.</summary>
    public static IReadOnlyDictionary<string, string> Catalog { get; }

    static ServerMessages()
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("Movers.Api.Localization.server-messages.json")
            ?? throw new InvalidOperationException("The server message catalog is missing from the build.");
        Catalog = JsonSerializer.Deserialize<Dictionary<string, string>>(stream)!;
        CodeByText = new(StringComparer.Ordinal);
        foreach (var (code, text) in Catalog)
        {
            var names = Placeholder().Matches(text).Select(m => m.Groups[1].Value).ToArray();
            if (names.Length == 0) { CodeByText.TryAdd(text, code); continue; }
            // "Box {trackingNumber} is already stored…" -> ^Box (.+?) is already stored…$
            var pattern = "^" + string.Concat(Placeholder().Split(text).Select((part, i) => i % 2 == 0 ? Regex.Escape(part) : "(.+?)")) + "$";
            Templates.Add((code, new Regex(pattern, RegexOptions.Singleline | RegexOptions.CultureInvariant), names));
        }
        // Most specific first, so "{name} is unavailable…" does not swallow a longer fixed message.
        Templates.Sort((a, b) => b.Pattern.ToString().Length.CompareTo(a.Pattern.ToString().Length));
    }

    /// <summary>The code of an English message and the values of its placeholders.</summary>
    public static (string Code, IReadOnlyDictionary<string, string>? Params) Describe(string? message)
    {
        if (string.IsNullOrWhiteSpace(message)) return (Unknown, null);
        var text = message.Trim();
        if (CodeByText.TryGetValue(text, out var code)) return (code, null);
        foreach (var (templateCode, pattern, names) in Templates)
        {
            var match = pattern.Match(text);
            if (!match.Success) continue;
            var values = new Dictionary<string, string>();
            for (var i = 0; i < names.Length; i++) values[names[i]] = match.Groups[i + 1].Value;
            return (templateCode, values);
        }
        return (Unknown, null);
    }

    [GeneratedRegex(@"\{(\w+)\}")]
    private static partial Regex Placeholder();
}
