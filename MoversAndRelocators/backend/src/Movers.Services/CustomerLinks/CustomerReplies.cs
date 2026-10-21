namespace Movers.Services.CustomerLinks;

/// <summary>
/// Records the customer side of shared links. Services call it when they share a link and when the customer answers;
/// the change is saved with the service's own SaveChanges (same unit of work).
/// </summary>
public interface ICustomerReplies
{
    Task SharedAsync(string recordType, Guid recordId, DateTimeOffset expiresAtUtc, CancellationToken t);
    /// <summary>All links of the record were revoked, so nothing is awaited from the customer any more.</summary>
    Task WithdrawnAsync(string recordType, Guid recordId, CancellationToken t);
    Task RepliedAsync(string recordType, Guid recordId, string kind, string? note, CancellationToken t);
    /// <summary>The office dealt with the customer's answer through the record itself (applied the changes, for example). action: CustomerReplyActions.</summary>
    Task HandledAsync(string recordType, Guid recordId, string action, CancellationToken t);
}

public sealed record CustomerReplyModel(string RecordType, Guid RecordId, string State, DateTimeOffset? SharedAtUtc, DateTimeOffset? ExpiresAtUtc,
    DateTimeOffset? RepliedAtUtc, string? ReplyKind, string? ReplyNote, DateTimeOffset? HandledAtUtc = null, string? HandledBy = null, string? HandledAction = null, string? HandledNote = null);

/// <summary>One step of a record's customer history. Event: CustomerReplyEvents; Detail: the reply kind or the action; Actor: staff name, or CUSTOMER.</summary>
public sealed record CustomerReplyEventModel(string Event, string? Detail, string? Note, string Actor, DateTimeOffset AtUtc, DateTimeOffset? ExpiresAtUtc);

/// <summary>Reply kinds, translated by the client (customerReplies.kind.*).</summary>
public static class CustomerReplyKinds
{
    public const string LeadDetails = "LEAD_DETAILS", LeadFiles = "LEAD_FILES", LeadInventory = "LEAD_INVENTORY";
    public const string QuotationAccepted = "QUOTATION_ACCEPTED", QuotationRejected = "QUOTATION_REJECTED", QuotationRequote = "QUOTATION_REQUOTE";
    public const string SurveySchedule = "SURVEY_SCHEDULE", SurveyItems = "SURVEY_ITEMS", SurveyChanges = "SURVEY_CHANGES", SurveyFiles = "SURVEY_FILES";
    public const string PickupConfirmed = "PICKUP_CONFIRMED", PackingListConfirmed = "PACKING_LIST_CONFIRMED", PackingListDisputed = "PACKING_LIST_DISPUTED";
    public const string PackingSchedule = "PACKING_SCHEDULE", PackingLocation = "PACKING_LOCATION", PackingItemsConfirmed = "PACKING_ITEMS_CONFIRMED", PackingItemsCorrections = "PACKING_ITEMS_CORRECTIONS";
    public const string DeliveryConfirmed = "DELIVERY_CONFIRMED", DeliveryReschedule = "DELIVERY_RESCHEDULE", DeliveryLocation = "DELIVERY_LOCATION";
}

/// <summary>What the office reads and does about customer replies (list pages, My Tasks, "Mark handled").</summary>
public interface ICustomerReplyQueries
{
    /// <summary>Records with something to show (pending, expired, replied or action taken), limited to the modules the user can see.</summary>
    Task<IReadOnlyList<CustomerReplyModel>> ListAsync(string? recordType, CancellationToken t);
    /// <summary>Records that the office acted on the customer's reply (or an expired link), with an optional note. Returns null when the record has none.</summary>
    Task<CustomerReplyModel?> MarkHandledAsync(string recordType, Guid recordId, string? note, CancellationToken t);
    /// <summary>The ids of the records of one type whose customer state is <paramref name="state"/> now (for list filters).</summary>
    Task<IReadOnlyCollection<Guid>> RecordIdsInStateAsync(string recordType, string state, CancellationToken t);
    /// <summary>The record's customer history, newest first.</summary>
    Task<IReadOnlyList<CustomerReplyEventModel>> HistoryAsync(string recordType, Guid recordId, CancellationToken t);
}
