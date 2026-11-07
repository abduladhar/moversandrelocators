using Movers.Domain.Common;

namespace Movers.Domain.Assistant;

/// <summary>
/// One chat with the management assistant ("Ask Crateway"). It belongs to the user who asked and to the company it was
/// asked in (a company record), so switching company never shows answers drawn from another company's data. The
/// questions and answers are kept as a JSON list: they are only ever read back whole, in order.
/// </summary>
public sealed class AssistantConversation : TenantOwnedEntity
{
    public const int TitleLength = 120;
    private AssistantConversation() { }

    public AssistantConversation(Guid tenantId, Guid userId, string title) : base(tenantId)
    {
        UserId = userId; Title = Clip(title); CreatedAtUtc = UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public Guid UserId { get; private set; }
    public string Title { get; private set; } = "";
    public string MessagesJson { get; private set; } = "[]";
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public void SetMessages(string json) { MessagesJson = json; UpdatedAtUtc = DateTimeOffset.UtcNow; }

    private static string Clip(string title)
    {
        var clean = string.Join(' ', (title ?? "").Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return clean.Length <= TitleLength ? clean : clean[..(TitleLength - 1)] + "…";
    }
}
