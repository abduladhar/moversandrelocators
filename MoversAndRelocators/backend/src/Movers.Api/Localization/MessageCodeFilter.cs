using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Movers.Api.Localization;

/// <summary>
/// Tags every error response that carries a message with its code (and the placeholder values), so the client can show
/// it in the user's language: { code, params, message } — message stays as the English fallback. Success responses
/// are left alone; the client words its own success messages.
/// </summary>
public sealed class MessageCodeFilter : IAlwaysRunResultFilter
{
    public void OnResultExecuting(ResultExecutingContext context)
    {
        if (context.Result is not ObjectResult { Value: { } value } result) return;
        var status = result.StatusCode ?? (result is BadRequestObjectResult ? 400 : 200);
        if (status < 400 || value is ProblemDetails) return;

        // Anonymous objects such as new { message = e.Message }: read them as JSON to keep any other fields.
        var element = JsonSerializer.SerializeToElement(value, value.GetType(), JsonSerializerOptions.Web);
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty("message", out var message) || message.ValueKind != JsonValueKind.String) return;
        if (element.TryGetProperty("code", out _)) return;
        var body = element.EnumerateObject().ToDictionary(p => p.Name, p => (object?)p.Value);
        var (code, parameters) = ServerMessages.Describe(message.GetString());
        body["code"] = code;
        if (parameters is not null) body["params"] = parameters;
        result.Value = body;
        result.DeclaredType = null;
    }

    public void OnResultExecuted(ResultExecutedContext context) { }

    /// <summary>Model validation (data annotations): one code, plus the fields that failed, instead of English sentences.</summary>
    public static IActionResult Validation(ActionContext context)
    {
        var errors = context.ModelState.Where(x => x.Value?.Errors.Count > 0)
            .ToDictionary(x => x.Key.TrimStart('$', '.'), x => x.Value!.Errors.Select(e => e.ErrorMessage).ToArray());
        var fields = errors.Keys.Where(x => x.Length > 0).Select(x => x.Split('.').Last()).Distinct().ToArray();
        return new BadRequestObjectResult(new
        {
            code = ServerMessages.ValidationFailed,
            message = "Some fields are missing or not valid: " + string.Join(", ", fields) + ".",
            @params = new { fields = string.Join(", ", fields) },
            errors
        });
    }
}
