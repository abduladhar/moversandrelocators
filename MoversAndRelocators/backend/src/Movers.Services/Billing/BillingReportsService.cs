using Movers.Services.Operations;
namespace Movers.Services.Billing;
public sealed partial class BillingService {
 public async Task<object> TrialBalanceReport(DateOnly from,DateOnly to,string currency,CancellationToken ct){
  if(from==default||to==default||from>to)throw new InvalidOperationException("Select a valid reporting period.");
  var report=await currencies.ReportCurrency(currency,to,ct);var baseMode=report.Converted;var code=report.Code;
  var journals=(await unit.Journals(ct)).Where(j=>j.PostingDate<=to&&(baseMode||j.Currency==code)).ToList();
  var native=await unit.JournalLines(ct);
  var values=new List<(string Account,decimal Debit,decimal Credit,bool Opening)>();
  foreach(var journal in journals){
   var lines=baseMode?await currencies.ReportLines(journal.Id,report,ct):native.Where(l=>l.JournalId==journal.Id).Select(l=>new JournalLineInput(l.AccountCode,l.Debit,l.Credit)).ToList();
   values.AddRange(lines.Select(l=>(l.AccountCode,l.Debit,l.Credit,journal.PostingDate<from)));
  }
  var accounts=await Accounts(ct);
  var rows=accounts.Select(a=>{
   var opening=values.Where(v=>v.Account==a.Code&&v.Opening).Sum(v=>v.Debit-v.Credit);
   var debit=values.Where(v=>v.Account==a.Code&&!v.Opening).Sum(v=>v.Debit);
   var credit=values.Where(v=>v.Account==a.Code&&!v.Opening).Sum(v=>v.Credit);
   var closing=opening+debit-credit;
   return new{a.Code,a.Name,a.Type,openingDebit=Math.Max(opening,0),openingCredit=Math.Max(-opening,0),debit,credit,closingDebit=Math.Max(closing,0),closingCredit=Math.Max(-closing,0)};
  }).ToList();
  return new{from,to,currency=code,mode=report.Mode,rows,totals=new{openingDebit=rows.Sum(r=>r.openingDebit),openingCredit=rows.Sum(r=>r.openingCredit),debit=rows.Sum(r=>r.debit),credit=rows.Sum(r=>r.credit),closingDebit=rows.Sum(r=>r.closingDebit),closingCredit=rows.Sum(r=>r.closingCredit)}};
 }
}
