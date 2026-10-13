using Movers.Domain.Common;

namespace Movers.Domain.Sales;

/// <summary>Kinds of inventory lines on a sales lead.</summary>
public static class LeadInventoryKinds
{
    public const string Item = "ITEM", Box = "BOX";
}

/// <summary>What the customer answered about a line when the inventory was shared with them for review.</summary>
public static class LeadInventoryCustomerStatuses
{
    /// <summary>The customer has not answered on this line; every line starts here.</summary>
    public const string Pending = "PENDING";
    public const string Needed = "NEEDED";
    /// <summary>The customer does not want this moved: it is left out of the confirmed volume and of a quotation built from the inventory.</summary>
    public const string NotNeeded = "NOT_NEEDED";
}

/// <summary>
/// One line of a sales lead's expected inventory: an item (sofa, fridge…) or a number of boxes for loose contents.
/// Lines come from AI extraction of a lead video/photo (SourceAttachmentId set) or are entered by staff.
/// The lead's expected volume is the sum of Quantity × UnitCbm.
/// </summary>
public sealed class SalesLeadInventoryItem : TenantOwnedEntity
{
    private SalesLeadInventoryItem() { }
    public SalesLeadInventoryItem(Guid tenantId, Guid salesLeadId, string kind, string? room, string name, int quantity, decimal unitCbm, bool fragile, string? handling, string? notes, Guid? sourceAttachmentId, string? imageKey = null, string? imageMark = null) : base(tenantId)
    {
        SalesLeadId = salesLeadId; Kind = kind; Room = Clean(room); Name = name.Trim(); Quantity = quantity; UnitCbm = unitCbm;
        Fragile = fragile; Handling = Clean(handling); Notes = Clean(notes); SourceAttachmentId = sourceAttachmentId; ImageKey = Clean(imageKey); ImageMark = ImageKey is null ? null : Clean(imageMark); CreatedAtUtc = DateTimeOffset.UtcNow;
    }
    public Guid SalesLeadId { get; private set; }
    public string Kind { get; private set; } = LeadInventoryKinds.Item;
    public string? Room { get; private set; }
    public string Name { get; private set; } = "";
    public int Quantity { get; private set; }
    /// <summary>Volume of one unit in cubic metres.</summary>
    public decimal UnitCbm { get; private set; }
    public bool Fragile { get; private set; }
    public string? Handling { get; private set; }
    public string? Notes { get; private set; }
    /// <summary>The lead attachment (video/photo) this line was extracted from; null for lines entered by staff.</summary>
    public Guid? SourceAttachmentId { get; private set; }
    /// <summary>Storage key of a picture of the item (the lead photo, or the video frame the AI picked); null when none was attached.</summary>
    public string? ImageKey { get; private set; }
    /// <summary>Where the item is in that picture: "x,y,width,height" in thousandths of the picture; null when not marked.</summary>
    public string? ImageMark { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    /// <summary>The customer's answer on this line: PENDING until they review the shared inventory.</summary>
    public string CustomerStatus { get; private set; } = LeadInventoryCustomerStatuses.Pending;
    /// <summary>What the customer typed next to their answer ("selling this", "goes to my sister"), when they typed anything.</summary>
    public string? CustomerNote { get; private set; }
    public DateTimeOffset? CustomerDecidedAtUtc { get; private set; }
    public decimal TotalCbm => Quantity * UnitCbm;
    /// <summary>Volume that still counts towards the move: a line the customer dropped counts for nothing.</summary>
    public decimal ConfirmedCbm => CustomerStatus == LeadInventoryCustomerStatuses.NotNeeded ? 0m : TotalCbm;

    /// <summary>Records the customer's answer from the shared inventory link.</summary>
    public void SetCustomerDecision(bool needed, string? note, DateTimeOffset now)
    {
        CustomerStatus = needed ? LeadInventoryCustomerStatuses.Needed : LeadInventoryCustomerStatuses.NotNeeded;
        CustomerNote = Clean(note);
        CustomerDecidedAtUtc = now;
    }

    /// <summary>
    /// Keeps the customer's answer when staff save the inventory. A save replaces every line, so without this a
    /// coordinator correcting one volume would silently undo everything the customer had already answered.
    /// </summary>
    public void CarryCustomerDecision(string status, string? note, DateTimeOffset? decidedAtUtc)
    {
        if (status is not (LeadInventoryCustomerStatuses.Needed or LeadInventoryCustomerStatuses.NotNeeded)) return;
        CustomerStatus = status; CustomerNote = Clean(note); CustomerDecidedAtUtc = decidedAtUtc;
    }
    private static string? Clean(string? x) => string.IsNullOrWhiteSpace(x) ? null : x.Trim();
}
