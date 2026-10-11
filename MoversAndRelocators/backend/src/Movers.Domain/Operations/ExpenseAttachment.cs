using Movers.Domain.Common;

namespace Movers.Domain.Operations;

/// <summary>Which kind of record an expense receipt belongs to.</summary>
public static class ExpenseReceiptKinds
{
    public const string Survey = "SURVEY", Pickup = "PICKUP", Packing = "PACKING", Delivery = "DELIVERY", Operations = "OPERATIONS", Cash = "CASH";
    public static readonly string[] All = [Survey, Pickup, Packing, Delivery, Operations, Cash];
}

/// <summary>
/// A receipt, bill photo or document attached to an expense (survey trip, pickup, packing, delivery, operations
/// vendor expense or billing cash entry). ExpenseId is the expense row's own id, which is also its id in the
/// accountant's cash-posting queue.
/// </summary>
public sealed class ExpenseAttachment : TenantOwnedEntity
{
    private ExpenseAttachment() { }
    public ExpenseAttachment(Guid tenantId, string kind, Guid expenseId, string originalFileName, string contentType, long declaredSizeBytes, string uploadedBy) : base(tenantId)
    {
        Kind = kind; ExpenseId = expenseId; OriginalFileName = originalFileName; ContentType = contentType; DeclaredSizeBytes = declaredSizeBytes;
        UploadedBy = uploadedBy; CreatedAtUtc = DateTimeOffset.UtcNow;
        ObjectKey = $"tenants/{tenantId:N}/expense-receipts/{kind.ToLowerInvariant()}/{expenseId:N}/{Id:N}/{originalFileName}";
    }
    public string Kind { get; private set; } = "";
    public Guid ExpenseId { get; private set; }
    public string OriginalFileName { get; private set; } = "";
    public string ContentType { get; private set; } = "";
    public long DeclaredSizeBytes { get; private set; }
    public long? StoredSizeBytes { get; private set; }
    public string ObjectKey { get; private set; } = "";
    public bool IsUploaded { get; private set; }
    public bool IsDeleted { get; private set; }
    public string UploadedBy { get; private set; } = "";
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset? UploadedAtUtc { get; private set; }

    public void MarkUploaded(long sizeBytes, DateTimeOffset at) { StoredSizeBytes = sizeBytes; IsUploaded = true; UploadedAtUtc = at; }
    /// <summary>Hides the receipt; the stored object is kept, like other attachments.</summary>
    public void Delete() => IsDeleted = true;
}
