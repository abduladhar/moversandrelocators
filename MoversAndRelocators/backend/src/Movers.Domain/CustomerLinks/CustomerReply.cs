using Movers.Domain.Common;

namespace Movers.Domain.CustomerLinks;

/// <summary>The kinds of record a customer link is shared from. One CustomerReply row is kept per record.</summary>
public static class CustomerReplyRecordTypes
{
    public const string SalesLead = "SALES_LEAD", Quotation = "QUOTATION", Survey = "SURVEY", Pickup = "PICKUP", PackingJob = "PACKING_JOB", DeliveryJob = "DELIVERY_JOB";
    public static readonly string[] All = [SalesLead, Quotation, Survey, Pickup, PackingJob, DeliveryJob];
}

/// <summary>What the office sees about a record's customer links, worked out from the timestamps below.</summary>
public static class CustomerReplyStates
{
    /// <summary>Nothing shared, or the last reply (or an expired link) was marked as handled.</summary>
    public const string None = "NONE";
    /// <summary>A link was shared and the customer has not answered yet.</summary>
    public const string Pending = "PENDING";
    /// <summary>The link expired before the customer answered.</summary>
    public const string Expired = "EXPIRED";
    /// <summary>The customer answered and the office has not acted on it yet.</summary>
    public const string Replied = "REPLIED";
    /// <summary>The office acted on the customer's answer (or on an expired link). Lasts until a new link is shared.</summary>
    public const string ActionTaken = "ACTION_TAKEN";
}

/// <summary>What happened in a record's customer history (CustomerReplyEvent.Event).</summary>
public static class CustomerReplyEvents
{
    public const string Shared = "SHARED", Replied = "REPLIED", ActionTaken = "ACTION_TAKEN", Withdrawn = "WITHDRAWN";
}

/// <summary>How the office acted on a reply (translated by the client). Marked is the manual "Mark action taken".</summary>
public static class CustomerReplyActions
{
    public const string Marked = "MARKED", RequoteApplied = "REQUOTE_APPLIED", QuotationRevised = "QUOTATION_REVISED",
        SurveyChangesApplied = "SURVEY_CHANGES_APPLIED", SurveyChangesDismissed = "SURVEY_CHANGES_DISMISSED";
}

/// <summary>
/// Tracks the customer side of a record: when a link was last shared, when the customer last answered (and how), and when
/// the office acted on it. Sharing a new link starts a new round, so the record waits for the customer again. Every step is
/// also kept as a CustomerReplyEvent, which is the record's customer history.
/// </summary>
public sealed class CustomerReply : TenantOwnedEntity
{
    private CustomerReply() { }
    public CustomerReply(Guid tenantId, string recordType, Guid recordId) : base(tenantId) { RecordType = recordType; RecordId = recordId; }
    public string RecordType { get; private set; } = "";
    public Guid RecordId { get; private set; }
    public DateTimeOffset? SharedAtUtc { get; private set; }
    public DateTimeOffset? ExpiresAtUtc { get; private set; }
    public DateTimeOffset? RepliedAtUtc { get; private set; }
    /// <summary>A code for what the customer did (QUOTATION_ACCEPTED, SURVEY_CHANGES...), translated by the client.</summary>
    public string? ReplyKind { get; private set; }
    /// <summary>The customer's own words with the reply, when they gave any.</summary>
    public string? ReplyNote { get; private set; }
    public DateTimeOffset? HandledAtUtc { get; private set; }
    public string? HandledBy { get; private set; }
    /// <summary>How the office acted (CustomerReplyActions) and what they wrote about it.</summary>
    public string? HandledAction { get; private set; }
    public string? HandledNote { get; private set; }

    public void Share(DateTimeOffset at, DateTimeOffset expiresAtUtc) { SharedAtUtc = at; ExpiresAtUtc = expiresAtUtc; }
    /// <summary>The links were revoked: nothing is awaited from the customer any more (an unhandled reply stays).</summary>
    public void Withdraw() { SharedAtUtc = null; ExpiresAtUtc = null; }
    public void Reply(string kind, string? note, DateTimeOffset at) { RepliedAtUtc = at; ReplyKind = kind; ReplyNote = Note(note); }
    public void MarkHandled(string action, string? note, string by, DateTimeOffset at) { HandledAtUtc = at; HandledBy = by; HandledAction = action; HandledNote = Note(note); }
    public static string? Note(string? note)
    {
        note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        return note is { Length: > 500 } ? note[..500] : note;
    }

    public string StateAt(DateTimeOffset now)
    {
        var handled = HandledAtUtc ?? DateTimeOffset.MinValue;
        if (RepliedAtUtc is { } replied && replied >= (SharedAtUtc ?? DateTimeOffset.MinValue) && replied > handled) return CustomerReplyStates.Replied;
        if (SharedAtUtc is { } shared && shared > (RepliedAtUtc ?? DateTimeOffset.MinValue) && shared > handled)
            return ExpiresAtUtc < now ? CustomerReplyStates.Expired : CustomerReplyStates.Pending;
        if (HandledAtUtc.HasValue && (RepliedAtUtc.HasValue || HandledAction is not null)) return CustomerReplyStates.ActionTaken;
        return CustomerReplyStates.None;
    }
}

/// <summary>One step in a record's customer history: a link shared, the customer's answer, the office's action, links revoked.</summary>
public sealed class CustomerReplyEvent : TenantOwnedEntity
{
    private CustomerReplyEvent() { }
    public CustomerReplyEvent(Guid tenantId, string recordType, Guid recordId, string @event, string? detail, string? note, string actor, DateTimeOffset atUtc, DateTimeOffset? expiresAtUtc = null) : base(tenantId)
    { RecordType = recordType; RecordId = recordId; Event = @event; Detail = detail; Note = CustomerReply.Note(note); Actor = actor.Length > 200 ? actor[..200] : actor; AtUtc = atUtc; ExpiresAtUtc = expiresAtUtc; }
    public string RecordType { get; private set; } = "";
    public Guid RecordId { get; private set; }
    /// <summary>CustomerReplyEvents.</summary>
    public string Event { get; private set; } = "";
    /// <summary>The reply kind (REPLIED) or the action (ACTION_TAKEN).</summary>
    public string? Detail { get; private set; }
    public string? Note { get; private set; }
    /// <summary>Who did it: the staff member's name, or null/"CUSTOMER" for the customer.</summary>
    public string Actor { get; private set; } = "";
    public DateTimeOffset AtUtc { get; private set; }
    public DateTimeOffset? ExpiresAtUtc { get; private set; }
}
