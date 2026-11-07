using Movers.Services.Currencies;
namespace Movers.Services.Billing;

/// <summary>One posted journal line in the base currency (journal reversals are included as their own lines).</summary>
public record AssistantLedgerLine(DateOnly Date, string Reference, string Description, string AccountCode, string AccountName, string AccountType, bool CashBank,
    decimal Debit, decimal Credit, bool Reversal, string Currency);

/// <summary>Money recorded on an operation (crew income/expenses, survey and pickup expenses, captured cash), as in the cash-posting queue.</summary>
public record AssistantOperationMoney(string Number, string SourceKind, string SourceLabel, string Type, string? PartyName, string? Category, string? Notes,
    DateOnly Date, string Currency, decimal Amount, decimal? BaseAmount, string BaseCurrency, string? PaidBy, bool Posted, string? PostingNumber);

/// <summary>Read-only feeds for the management assistant. They reuse the cash queue and the base-currency journal lines the reports use.</summary>
public sealed partial class BillingService {
 public async Task<IReadOnlyList<AssistantLedgerLine>> AssistantLedger(CancellationToken ct) {
  var settings=await currencies.Settings(ct);var code=settings.BaseCurrency??throw new InvalidOperationException("Set the base currency first.");
  var accounts=(await Accounts(ct)).ToDictionary(a=>a.Code);var rows=new List<AssistantLedgerLine>();
  foreach(var j in (await unit.Journals(ct)).OrderBy(j=>j.PostingDate).ThenBy(j=>j.PostedAtUtc))
   foreach(var l in await currencies.BaseLines(j.Id,ct)){
    if(l.Debit==0&&l.Credit==0)continue;
    var a=accounts.GetValueOrDefault(l.AccountCode);
    rows.Add(new(j.PostingDate,j.Reference,j.Description,l.AccountCode,a?.Name??l.AccountCode,a?.Type??"",a?.IsCashBank??false,l.Debit,l.Credit,j.ReversesId.HasValue,code));
   }
  return rows;
 }

 public async Task<IReadOnlyList<AssistantOperationMoney>> AssistantOperationMoneyRows(CancellationToken ct) {
  var settings=await currencies.Settings(ct);var baseCode=settings.BaseCurrency??"";
  var payers=await unit.ExpensePayers(ct);var employees=(await unit.Employees(ct)).ToDictionary(x=>x.Id,x=>x.FullName);
  return (await CashQueue(ct)).Select(x=>{
   var d=x.Details;
   // Operation records keep "category · notes" in Notes; captured cash (RCV/EPD numbers) has free notes.
   var parts=(d.Notes??"").Split(" · ",2);var operation=!(x.Number.StartsWith("RCV")||x.Number.StartsWith("EPD"));
   var category=operation&&parts[0].Trim()!=""?parts[0].Trim():null;var notes=operation?(parts.Length>1?parts[1].Trim():null):d.Notes;
   var baseAmount=d.BaseAmount??(d.Fx is { } fx?CurrencyService.ToBase(d.Amount,fx):d.Currency==baseCode?d.Amount:null);
   var paidBy=payers.TryGetValue(x.Id,out var employee)?employees.GetValueOrDefault(employee):null;
   return new AssistantOperationMoney(x.Number,d.SourceKind,d.SourceLabel,d.Type=="RECEIPT"?"INCOME":"EXPENSE",string.IsNullOrWhiteSpace(d.PartyName)?null:d.PartyName,category,
    string.IsNullOrWhiteSpace(notes)?null:notes,d.Date,d.Currency,d.Amount,baseAmount,baseCode,paidBy,x.Posted,x.PostingNumber);
  }).ToList();
 }
}
