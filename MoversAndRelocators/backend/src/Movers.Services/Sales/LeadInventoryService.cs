using Movers.Domain.Sales;
using Movers.Services.Packing;
using Movers.Services.Surveys;
using Movers.Services.Tenancy;

namespace Movers.Services.Sales;

public sealed record LeadInventoryLineModel(Guid Id, string Kind, string? Room, string Name, int Quantity, decimal UnitCbm, decimal TotalCbm, bool Fragile, string? Handling, string? Notes, Guid? SourceAttachmentId);
/// <param name="ExpectedCbm">Sum of all lines (items and boxes), in cubic metres.</param>
/// <param name="FragileItems">Number of fragile pieces (quantity of fragile lines).</param>
/// <param name="AiRuns">OpenAI runs made for this lead; AiCost is their approximate total (USD), null when no prices are set.</param>
public sealed record LeadInventoryModel(Guid SalesLeadId, IReadOnlyList<LeadInventoryLineModel> Lines, decimal ExpectedCbm, int ItemCount, int BoxCount, int FragileItems, int AiRuns = 0, decimal? AiCost = null);
public sealed record SaveLeadInventoryLine(string Kind, string? Room, string Name, int Quantity, decimal UnitCbm, bool Fragile, string? Handling, string? Notes, Guid? SourceAttachmentId);
/// <summary>Per-lead totals for the leads list.</summary>
public sealed record LeadInventoryTotals(decimal ExpectedCbm, int FragileItems);

public interface ILeadInventoryRepository
{
    Task<IReadOnlyList<SalesLeadInventoryItem>> Lines(Guid leadId, bool track, CancellationToken ct);
    Task<IReadOnlyDictionary<Guid, LeadInventoryTotals>> Totals(CancellationToken ct);
    void Add(SalesLeadInventoryItem line);
    void Remove(SalesLeadInventoryItem line);
    Task Save(CancellationToken ct);
}

/// <summary>
/// The expected inventory of a sales lead. AI extraction of a lead video/photo writes its lines here (replacing the
/// earlier lines of that same file); staff can review and edit the whole list. Volumes come from the Household items
/// master when the name matches, otherwise from the AI estimate; boxes use the box type's capacity.
/// </summary>
public sealed class LeadInventoryService(ILeadInventoryRepository repository, ISalesRepository leads, ISurveyRepository surveys, IPackingRepository packing, Movers.Services.OpenAi.AiUsageService usage, ITenantContext tenant)
{
    public const int MaxLines = 500;

    public async Task<LeadInventoryModel?> Get(Guid leadId, CancellationToken ct)
    {
        if (await leads.GetLeadAsync(leadId, false, ct) is null) return null;
        return await WithCost(Model(leadId, await repository.Lines(leadId, false, ct)), ct);
    }

    private async Task<LeadInventoryModel> WithCost(LeadInventoryModel model, CancellationToken ct)
    {
        var (runs, cost) = await usage.ForLead(model.SalesLeadId, ct);
        return model with { AiRuns = runs, AiCost = cost };
    }

    /// <summary>Replaces the lead's inventory with the reviewed list.</summary>
    public async Task<LeadInventoryModel?> Save(Guid leadId, IReadOnlyList<SaveLeadInventoryLine> lines, CancellationToken ct)
    {
        if (await leads.GetLeadAsync(leadId, false, ct) is null) return null;
        if (lines.Count > MaxLines) throw new InvalidOperationException($"An inventory can have at most {MaxLines} lines.");
        foreach (var l in lines) Validate(l.Kind, l.Room, l.Name, l.Quantity, l.UnitCbm, l.Handling, l.Notes);
        foreach (var x in await repository.Lines(leadId, true, ct)) repository.Remove(x);
        foreach (var l in lines) repository.Add(new SalesLeadInventoryItem(tenant.TenantId, leadId, l.Kind.Trim().ToUpperInvariant(), l.Room, l.Name, l.Quantity, Math.Round(l.UnitCbm, 3), l.Fragile, l.Handling, l.Notes, l.SourceAttachmentId));
        await repository.Save(ct);
        return await WithCost(Model(leadId, await repository.Lines(leadId, false, ct)), ct);
    }

    /// <summary>Stores an AI extraction on the lead, replacing the lines previously extracted from the same file.</summary>
    public async Task<LeadInventoryModel> Import(Guid leadId, Guid attachmentId, ExtractionResult result, CancellationToken ct)
    {
        var masters = (await surveys.ListItemsAsync(ct)).Where(x => x.IsActive).ToList();
        var boxTypes = await packing.ActiveBoxTypes(ct);
        static string Norm(string x) => new string(x.ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());
        decimal ItemCbm(ExtractedMoveItem item)
        {
            var name = Norm(item.Name);
            var master = masters.FirstOrDefault(m => Norm(m.Name) == name)
                // A more specific item name may contain the master name ("Television 55 inch" → Television), not the reverse:
                // a plain "Sofa" must not take the volume of "Large sofa".
                ?? masters.Where(m => Norm(m.Name).Length >= 4 && name.Contains(Norm(m.Name))).OrderByDescending(m => m.Name.Length).FirstOrDefault();
            return master?.VolumeCbm ?? Math.Clamp(item.VolumeCbm, 0m, 50m);
        }
        decimal BoxCbm(string boxType) =>
            boxTypes.FirstOrDefault(b => Norm(boxType).StartsWith(Norm(b.Name), StringComparison.Ordinal))?.CapacityCbm ?? 0m;

        foreach (var x in (await repository.Lines(leadId, true, ct)).Where(x => x.SourceAttachmentId == attachmentId)) repository.Remove(x);
        foreach (var item in result.Items.Take(MaxLines))
            repository.Add(new SalesLeadInventoryItem(tenant.TenantId, leadId, LeadInventoryKinds.Item, item.Room, Trim(item.Name, 160), item.Quantity, Math.Round(ItemCbm(item), 3), item.Fragile, Trim(item.Handling, 300), Trim(item.Notes, 1000), attachmentId));
        foreach (var box in (result.Boxes ?? []).Take(100))
        {
            var type = box.BoxType.Split(" (")[0].Trim();
            repository.Add(new SalesLeadInventoryItem(tenant.TenantId, leadId, LeadInventoryKinds.Box, box.Room, Trim(type, 160), box.Quantity, BoxCbm(type), false, null, Trim(box.Contents, 1000), attachmentId));
        }
        await repository.Save(ct);
        return await WithCost(Model(leadId, await repository.Lines(leadId, false, ct)), ct);
    }

    private static string? Trim(string? x, int max) => x is null ? null : x.Length > max ? x[..max] : x;

    private static void Validate(string kind, string? room, string name, int quantity, decimal unitCbm, string? handling, string? notes)
    {
        if (kind?.Trim().ToUpperInvariant() is not (LeadInventoryKinds.Item or LeadInventoryKinds.Box)) throw new InvalidOperationException("Each line must be an item or boxes.");
        if (string.IsNullOrWhiteSpace(name) || name.Length > 160) throw new InvalidOperationException("Each line needs a name of up to 160 characters.");
        if (quantity is < 1 or > 10000) throw new InvalidOperationException("Quantity must be between 1 and 10,000.");
        if (unitCbm is < 0 or > 100) throw new InvalidOperationException("Volume per unit must be between 0 and 100 CBM.");
        if (room?.Length > 80 || handling?.Length > 300 || notes?.Length > 1000) throw new InvalidOperationException("Room, handling or notes are too long.");
    }

    private static LeadInventoryModel Model(Guid leadId, IReadOnlyList<SalesLeadInventoryItem> lines)
    {
        var models = lines.OrderBy(x => x.Room ?? "~").ThenBy(x => x.Kind).ThenBy(x => x.SerialNo)
            .Select(x => new LeadInventoryLineModel(x.Id, x.Kind, x.Room, x.Name, x.Quantity, x.UnitCbm, Math.Round(x.TotalCbm, 3), x.Fragile, x.Handling, x.Notes, x.SourceAttachmentId)).ToList();
        return new(leadId, models, Math.Round(lines.Sum(x => x.TotalCbm), 3),
            lines.Where(x => x.Kind == LeadInventoryKinds.Item).Sum(x => x.Quantity), lines.Where(x => x.Kind == LeadInventoryKinds.Box).Sum(x => x.Quantity),
            lines.Where(x => x.Fragile).Sum(x => x.Quantity));
    }
}
