using Movers.Domain.Sales;
using Movers.Services.Packing;
using Movers.Services.Surveys;
using Movers.Services.Tenancy;

namespace Movers.Services.Sales;

/// <param name="ImageUrl">Short-lived link to the item's picture (lead photo or the video frame the AI picked); null when none.</param>
/// <param name="ImageMark">Where the item is in that picture (thousandths of the picture), so a frame with several items shows which one is meant.</param>
public sealed record LeadInventoryLineModel(Guid Id, string Kind, string? Room, string Name, int Quantity, decimal UnitCbm, decimal TotalCbm, bool Fragile, string? Handling, string? Notes, Guid? SourceAttachmentId, string? ImageUrl = null, PictureMark? ImageMark = null,
    string CustomerStatus = LeadInventoryCustomerStatuses.Pending, string? CustomerNote = null, DateTimeOffset? CustomerDecidedAtUtc = null);
/// <param name="ExpectedCbm">Sum of all lines (items and boxes), in cubic metres.</param>
/// <param name="FragileItems">Number of fragile pieces (quantity of fragile lines).</param>
/// <param name="AiRuns">AI runs (OpenAI or Claude) made for this lead; AiCost is their approximate total (USD), null when no prices are set.</param>
public sealed record LeadInventoryModel(Guid SalesLeadId, IReadOnlyList<LeadInventoryLineModel> Lines, decimal ExpectedCbm, int ItemCount, int BoxCount, int FragileItems, int AiRuns = 0, decimal? AiCost = null,
    decimal ConfirmedCbm = 0, int NotNeededLines = 0, int PendingLines = 0, DateTimeOffset? LastCustomerReplyAtUtc = null);
/// <param name="ImageFromLineId">Keep the picture of this existing line of the same lead (normally the line's own id); null drops the picture.
/// The client never names a storage key, so it can only keep pictures the lead already has.</param>
public sealed record SaveLeadInventoryLine(string Kind, string? Room, string Name, int Quantity, decimal UnitCbm, bool Fragile, string? Handling, string? Notes, Guid? SourceAttachmentId, Guid? ImageFromLineId = null, Guid? Id = null);
/// <summary>One answer from the customer on the shared inventory: keep this line or drop it, with an optional word of explanation.</summary>
public sealed record LeadInventoryDecision(Guid LineId, bool Needed, string? Note = null);
/// <summary>A line as the customer sees it on the shared link: no volumes and no AI provenance, just what we think we are moving.</summary>
public sealed record PublicLeadInventoryLineModel(Guid Id, string Kind, string? Room, string Name, int Quantity, bool Fragile, string? Notes, string? ImageUrl, PictureMark? ImageMark, string CustomerStatus, string? CustomerNote);
public sealed record PublicLeadInventoryModel(string TenantName, string LeadNumber, string CustomerName, DateTimeOffset ExpiresAtUtc, IReadOnlyList<PublicLeadInventoryLineModel> Lines);
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
public sealed class LeadInventoryService(ILeadInventoryRepository repository, ISalesRepository leads, ISurveyRepository surveys, IPackingRepository packing, Movers.Services.OpenAi.AiUsageService usage, ITenantContext tenant,
    ILeadUploadRepository uploads, IAwsObjectStorage storage, Movers.Services.Aws.ISecretProtector protector, TimeProvider clock)
{
    public const int MaxLines = 500;

    public async Task<LeadInventoryModel?> Get(Guid leadId, CancellationToken ct)
    {
        if (await leads.GetLeadAsync(leadId, false, ct) is null) return null;
        return await Build(leadId, ct);
    }

    /// <summary>The stored lines with their AI cost and a 30-minute link to each item picture.</summary>
    private async Task<LeadInventoryModel> Build(Guid leadId, CancellationToken ct)
    {
        var lines = await repository.Lines(leadId, false, ct);
        var model = Model(leadId, lines);
        var keys = lines.Where(x => x.ImageKey is not null).ToDictionary(x => x.Id, x => x.ImageKey!);
        if (keys.Count > 0)
        {
            try
            {
                var credentials = StorageCredentials.Resolve(storage, protector, await uploads.GetAwsAsync(ct));
                var expires = clock.GetUtcNow().AddMinutes(30);
                var urls = new Dictionary<Guid, string>();
                foreach (var (id, key) in keys) urls[id] = await storage.CreateDownloadUrlAsync(credentials, key, key[(key.LastIndexOf('/') + 1)..], expires, ct);
                model = model with { Lines = model.Lines.Select(l => urls.TryGetValue(l.Id, out var url) ? l with { ImageUrl = url } : l).ToList() };
            }
            // Pictures are a convenience: without storage settings the inventory still opens, just without them.
            catch (InvalidOperationException) { }
        }
        var (runs, cost) = await usage.ForLead(leadId, ct);
        return model with { AiRuns = runs, AiCost = cost };
    }

    /// <summary>Replaces the lead's inventory with the reviewed list.</summary>
    public async Task<LeadInventoryModel?> Save(Guid leadId, IReadOnlyList<SaveLeadInventoryLine> lines, CancellationToken ct)
    {
        if (await leads.GetLeadAsync(leadId, false, ct) is null) return null;
        if (lines.Count > MaxLines) throw new InvalidOperationException($"An inventory can have at most {MaxLines} lines.");
        foreach (var l in lines) Validate(l.Kind, l.Room, l.Name, l.Quantity, l.UnitCbm, l.Handling, l.Notes);
        var existing = await repository.Lines(leadId, true, ct);
        // Pictures can only be kept from this lead's own lines (removing the picture = no ImageFromLineId).
        var pictures = existing.Where(x => x.ImageKey is not null).ToDictionary(x => x.Id, x => (x.ImageKey!, x.ImageMark));
        var answers = existing.ToDictionary(x => x.Id, x => (x.CustomerStatus, x.CustomerNote, x.CustomerDecidedAtUtc));
        foreach (var x in existing) repository.Remove(x);
        foreach (var l in lines)
        {
            var line = new SalesLeadInventoryItem(tenant.TenantId, leadId, l.Kind.Trim().ToUpperInvariant(), l.Room, l.Name, l.Quantity, Math.Round(l.UnitCbm, 3), l.Fragile, l.Handling, l.Notes, l.SourceAttachmentId,
                l.ImageFromLineId is { } from && pictures.TryGetValue(from, out var kept) ? kept.Item1 : null, l.ImageFromLineId is { } mf && pictures.TryGetValue(mf, out var marked) ? marked.Item2 : null);
            // A line the client sends back by id is the same line to the customer, so their answer travels with it.
            if (l.Id is { } id && answers.TryGetValue(id, out var answer)) line.CarryCustomerDecision(answer.CustomerStatus, answer.CustomerNote, answer.CustomerDecidedAtUtc);
            repository.Add(line);
        }
        await repository.Save(ct);
        return await Build(leadId, ct);
    }

    /// <summary>
    /// Records what the customer answered on the inventory shared with them. An unknown line id is ignored rather
    /// than refused: staff may have reshaped the list while the customer had the page open, and losing the rest of
    /// their answers over one stale line would be the worse outcome.
    /// </summary>
    public async Task<int> Review(Guid leadId, IReadOnlyList<LeadInventoryDecision> decisions, CancellationToken ct)
    {
        if (decisions.Count > MaxLines) throw new InvalidOperationException("Too many lines were sent at once.");
        if (decisions.Any(d => d.Note?.Length > 500)) throw new InvalidOperationException("Keep each note under 500 characters.");
        var lines = (await repository.Lines(leadId, true, ct)).ToDictionary(x => x.Id);
        var now = clock.GetUtcNow();
        var applied = 0;
        foreach (var d in decisions) if (lines.TryGetValue(d.LineId, out var line)) { line.SetCustomerDecision(d.Needed, d.Note, now); applied++; }
        if (applied > 0) await repository.Save(ct);
        return applied;
    }

    /// <summary>The inventory as the customer sees it on the shared link.</summary>
    public async Task<IReadOnlyList<PublicLeadInventoryLineModel>> PublicLines(Guid leadId, CancellationToken ct)
    {
        var inventory = await Build(leadId, ct);
        return inventory.Lines.Select(x => new PublicLeadInventoryLineModel(x.Id, x.Kind, x.Room, x.Name, x.Quantity, x.Fragile, x.Notes, x.ImageUrl, x.ImageMark, x.CustomerStatus, x.CustomerNote)).ToList();
    }

    /// <summary>Stores an AI extraction on the lead, replacing the lines previously extracted from the same file.</summary>
    /// <param name="pictureKeys">Storage key of each picture sent to the AI, when item pictures were requested; an item keeps the one it named.</param>
    public async Task<LeadInventoryModel> Import(Guid leadId, Guid attachmentId, ExtractionResult result, CancellationToken ct, IReadOnlyList<string>? pictureKeys = null)
    {
        string? Picture(int number) => pictureKeys is not null && number >= 1 && number <= pictureKeys.Count ? pictureKeys[number - 1] : null;
        var masters = (await surveys.ListItemsAsync(ct)).Where(x => x.IsActive).ToList();
        var boxTypes = await packing.ActiveBoxTypes(ct);
        static string Norm(string x) => HouseholdItemMatching.Normalise(x);
        // The master's volume when the name is one we know, otherwise the AI's own estimate, kept within reason.
        decimal ItemCbm(ExtractedMoveItem item) => HouseholdItemMatching.Find(masters, item.Name)?.VolumeCbm ?? Math.Clamp(item.VolumeCbm, 0m, 50m);
        decimal BoxCbm(string boxType) =>
            boxTypes.FirstOrDefault(b => Norm(boxType).StartsWith(Norm(b.Name), StringComparison.Ordinal))?.CapacityCbm ?? 0m;

        foreach (var x in (await repository.Lines(leadId, true, ct)).Where(x => x.SourceAttachmentId == attachmentId)) repository.Remove(x);
        foreach (var item in result.Items.Take(MaxLines))
            repository.Add(new SalesLeadInventoryItem(tenant.TenantId, leadId, LeadInventoryKinds.Item, item.Room, Trim(item.Name, 160), item.Quantity, Math.Round(ItemCbm(item), 3), item.Fragile, Trim(item.Handling, 300), Trim(item.Notes, 1000), attachmentId, Picture(item.Picture), Picture(item.Picture) is null ? null : PictureMark.Clean(item.Mark)?.ToString()));
        foreach (var box in (result.Boxes ?? []).Take(100))
        {
            var type = box.BoxType.Split(" (")[0].Trim();
            repository.Add(new SalesLeadInventoryItem(tenant.TenantId, leadId, LeadInventoryKinds.Box, box.Room, Trim(type, 160), box.Quantity, BoxCbm(type), false, null, Trim(box.Contents, 1000), attachmentId));
        }
        await repository.Save(ct);
        return await Build(leadId, ct);
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
            .Select(x => new LeadInventoryLineModel(x.Id, x.Kind, x.Room, x.Name, x.Quantity, x.UnitCbm, Math.Round(x.TotalCbm, 3), x.Fragile, x.Handling, x.Notes, x.SourceAttachmentId, ImageMark: x.ImageKey is null ? null : PictureMark.Parse(x.ImageMark),
                CustomerStatus: x.CustomerStatus, CustomerNote: x.CustomerNote, CustomerDecidedAtUtc: x.CustomerDecidedAtUtc)).ToList();
        return new(leadId, models, Math.Round(lines.Sum(x => x.TotalCbm), 3),
            lines.Where(x => x.Kind == LeadInventoryKinds.Item).Sum(x => x.Quantity), lines.Where(x => x.Kind == LeadInventoryKinds.Box).Sum(x => x.Quantity),
            lines.Where(x => x.Fragile).Sum(x => x.Quantity),
            ConfirmedCbm: Math.Round(lines.Sum(x => x.ConfirmedCbm), 3),
            NotNeededLines: lines.Count(x => x.CustomerStatus == LeadInventoryCustomerStatuses.NotNeeded),
            PendingLines: lines.Count(x => x.CustomerStatus == LeadInventoryCustomerStatuses.Pending),
            LastCustomerReplyAtUtc: lines.Max(x => x.CustomerDecidedAtUtc));
    }
}
