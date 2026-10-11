using Movers.Domain.Operations;
using Movers.Services.Currencies;
using Movers.Services.Operations;
namespace Movers.Services.Billing;

/// <summary>Packing material consumed by an operation, posted to the ledger in the base currency.</summary>
public record MaterialPosting(string SourceKind, Guid SourceId, string SourceLabel, string Reference, string Currency, DateOnly Date, decimal Amount, bool Reversed = false, Guid? ReversalJournalId = null);

public sealed partial class BillingService
{
    private const string MaterialPostKind = "MATERIALPOST";
    public const string MaterialExpenseAccount = "5100", MaterialStockAccount = "1300";

    /// <summary>
    /// Dr 5100 Material expense / Cr 1300 Packing material stock for the material cost of an operation. Saved with the
    /// caller's unit of work (no SaveChanges here), so it commits atomically with the status change that triggered it.
    /// Zero cost posts nothing.
    /// </summary>
    public async Task PostMaterialConsumption(string sourceKind, Guid sourceId, string label, string reference, decimal amount, DateOnly date, CancellationToken ct)
    {
        amount = Math.Round(amount, 2, MidpointRounding.AwayFromZero);
        if (amount <= 0) return;
        var baseCurrency = (await currencies.Settings(ct)).BaseCurrency ?? throw new InvalidOperationException("Set the accounting base currency before posting material costs.");
        var lines = new List<JournalLineInput> { new(MaterialExpenseAccount, amount, 0), new(MaterialStockAccount, 0, amount) };
        // Journal references are unique per tenant; a job completed again after a reopen gets the next sequence.
        var sequence = (await repository.List(MaterialPostKind, ct)).Count(x => Read<MaterialPosting>(x).SourceId == sourceId) + 1;
        var journalReference = "MAT-" + reference + "-" + sequence;
        var journal = Post(journalReference, baseCurrency, date, lines);
        await currencies.SaveBaseJournal(journal, lines, ct);
        var record = Add(MaterialPostKind, sourceId.ToString("N") + "-" + sequence, Guid.NewGuid(), new { sourceKind, sourceId, amount, date },
            new MaterialPosting(sourceKind, sourceId, label, journalReference, baseCurrency, date, amount));
        record.JournalId = journal;
    }

    /// <summary>Reverses the operation's open material posting (e.g. when a completed job is reopened).</summary>
    public async Task ReverseMaterialConsumption(string sourceKind, Guid sourceId, DateOnly date, CancellationToken ct)
    {
        foreach (var record in await repository.List(MaterialPostKind, ct))
        {
            var p = Read<MaterialPosting>(record);
            if (p.SourceId != sourceId || p.SourceKind != sourceKind || p.Reversed || record.JournalId is null) continue;
            var lines = new List<JournalLineInput> { new(MaterialStockAccount, p.Amount, 0), new(MaterialExpenseAccount, 0, p.Amount) };
            var reversal = Post("REV-" + p.Reference, p.Currency, date < p.Date ? p.Date : date, lines, record.JournalId);
            await currencies.SaveBaseJournal(reversal, lines, ct);
            record.Payload = System.Text.Json.JsonSerializer.Serialize(p with { Reversed = true, ReversalJournalId = reversal });
            record.Version = Guid.NewGuid();
        }
    }

    /// <summary>Reference of the operation's current (unreversed) material posting, or null.</summary>
    public async Task<string?> MaterialConsumption(string sourceKind, Guid sourceId, CancellationToken ct) =>
        (await repository.List(MaterialPostKind, ct)).Select(x => Read<MaterialPosting>(x)).LastOrDefault(p => p.SourceId == sourceId && p.SourceKind == sourceKind && !p.Reversed)?.Reference;

    private async Task<IReadOnlyList<(BillingRecord Record, MaterialPosting Posting)>> MaterialPostings(CancellationToken ct) =>
        (await repository.List(MaterialPostKind, ct)).Select(x => (x, Read<MaterialPosting>(x))).ToList();
}
