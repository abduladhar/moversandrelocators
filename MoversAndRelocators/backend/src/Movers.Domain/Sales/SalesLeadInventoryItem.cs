using Movers.Domain.Common;

namespace Movers.Domain.Sales;

/// <summary>Kinds of inventory lines on a sales lead.</summary>
public static class LeadInventoryKinds
{
    public const string Item = "ITEM", Box = "BOX";
}

/// <summary>
/// One line of a sales lead's expected inventory: an item (sofa, fridge…) or a number of boxes for loose contents.
/// Lines come from AI extraction of a lead video/photo (SourceAttachmentId set) or are entered by staff.
/// The lead's expected volume is the sum of Quantity × UnitCbm.
/// </summary>
public sealed class SalesLeadInventoryItem : TenantOwnedEntity
{
    private SalesLeadInventoryItem() { }
    public SalesLeadInventoryItem(Guid tenantId, Guid salesLeadId, string kind, string? room, string name, int quantity, decimal unitCbm, bool fragile, string? handling, string? notes, Guid? sourceAttachmentId) : base(tenantId)
    {
        SalesLeadId = salesLeadId; Kind = kind; Room = Clean(room); Name = name.Trim(); Quantity = quantity; UnitCbm = unitCbm;
        Fragile = fragile; Handling = Clean(handling); Notes = Clean(notes); SourceAttachmentId = sourceAttachmentId; CreatedAtUtc = DateTimeOffset.UtcNow;
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
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public decimal TotalCbm => Quantity * UnitCbm;
    private static string? Clean(string? x) => string.IsNullOrWhiteSpace(x) ? null : x.Trim();
}
