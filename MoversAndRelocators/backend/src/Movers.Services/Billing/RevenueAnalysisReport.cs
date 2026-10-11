using Movers.Services.Operations;
namespace Movers.Services.Billing;
public record RevenueAnalysisEntry(Guid JournalId,DateOnly Date,string Reference,string Description,bool IsReversal,string TransactionCurrency,decimal TransactionDebit,decimal TransactionCredit,decimal Debit,decimal Credit,decimal Amount);
public sealed partial class BillingService {
 public async Task<object> RevenueAnalysis(DateOnly from,DateOnly to,string currency,string? accountCode,CancellationToken ct){
  if(from==default||to==default||from>to)throw new InvalidOperationException("Select a valid reporting period.");
  var accounts=(await Accounts(ct)).Where(a=>a.Type=="Revenue").ToList();
  if(!string.IsNullOrWhiteSpace(accountCode)&&!accounts.Any(a=>a.Code==accountCode))throw new InvalidOperationException("Select an revenue account.");
  var selected=accounts.Where(a=>string.IsNullOrWhiteSpace(accountCode)||a.Code==accountCode).ToDictionary(a=>a.Code);
  var report=await currencies.ReportCurrency(currency,to,ct);var code=report.Code;
  var native=await unit.JournalLines(ct);var entries=selected.Keys.ToDictionary(k=>k,k=>new List<RevenueAnalysisEntry>());
  foreach(var j in (await unit.Journals(ct)).Where(j=>j.PostingDate>=from&&j.PostingDate<=to&&(report.Converted||j.Currency==code)).OrderBy(j=>j.PostingDate).ThenBy(j=>j.PostedAtUtc).ThenBy(j=>j.Id)){
   var original=native.Where(l=>l.JournalId==j.Id&&selected.ContainsKey(l.AccountCode)).ToList();
   if(original.Count==0)continue;
   var lines=report.Converted?await currencies.ReportLines(j.Id,report,ct):original.Select(l=>new JournalLineInput(l.AccountCode,l.Debit,l.Credit)).ToList();
   foreach(var group in lines.Where(l=>selected.ContainsKey(l.AccountCode)).GroupBy(l=>l.AccountCode)){
    var dr=group.Sum(l=>l.Debit);var cr=group.Sum(l=>l.Credit);if(dr==0&&cr==0)continue;
    entries[group.Key].Add(new(j.Id,j.PostingDate,j.Reference,j.Description,j.ReversesId.HasValue,j.Currency,original.Where(l=>l.AccountCode==group.Key).Sum(l=>l.Debit),original.Where(l=>l.AccountCode==group.Key).Sum(l=>l.Credit),dr,cr,cr-dr));
   }
  }
  var rows=selected.Values.OrderBy(a=>a.Code).Where(a=>entries[a.Code].Count>0).Select(a=>new{a.Code,a.Name,a.IsActive,count=entries[a.Code].Count,debit=entries[a.Code].Sum(e=>e.Debit),credit=entries[a.Code].Sum(e=>e.Credit),amount=entries[a.Code].Sum(e=>e.Amount),entries=entries[a.Code]}).ToList();
  return new{from,to,currency=code,mode=currency,accountCode,rows,totals=new{debit=rows.Sum(r=>r.debit),credit=rows.Sum(r=>r.credit),amount=rows.Sum(r=>r.amount)}};
 }
}

