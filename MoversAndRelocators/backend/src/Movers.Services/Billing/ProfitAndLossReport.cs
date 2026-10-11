using Movers.Services.Operations;
namespace Movers.Services.Billing;
public sealed partial class BillingService {
 public async Task<object> ProfitAndLossReport(DateOnly from,DateOnly to,string currency,CancellationToken ct){
  if(from==default||to==default||from>to)throw new InvalidOperationException("Select a valid reporting period.");
  var report=await currencies.ReportCurrency(currency,to,ct);var baseMode=report.Converted;var code=report.Code;
  var accounts=(await Accounts(ct)).Where(a=>a.Type is "Revenue" or "Expense").ToList();
  var totals=accounts.ToDictionary(a=>a.Code,a=>(Debit:0m,Credit:0m));
  var journals=(await unit.Journals(ct)).Where(j=>j.PostingDate>=from&&j.PostingDate<=to&&(baseMode||j.Currency==code)).ToList();
  var native=await unit.JournalLines(ct);
  foreach(var j in journals){
   var lines=baseMode?await currencies.ReportLines(j.Id,report,ct):native.Where(l=>l.JournalId==j.Id).Select(l=>new JournalLineInput(l.AccountCode,l.Debit,l.Credit)).ToList();
   foreach(var l in lines)if(totals.TryGetValue(l.AccountCode,out var old))totals[l.AccountCode]=(old.Debit+l.Debit,old.Credit+l.Credit);
  }
  var rows=accounts.Select(a=>{var t=totals[a.Code];return new{a.Code,a.Name,a.Type,debit=t.Debit,credit=t.Credit,amount=a.Type=="Revenue"?t.Credit-t.Debit:t.Debit-t.Credit};}).Where(a=>a.debit!=0||a.credit!=0).ToList();
  var revenue=rows.Where(r=>r.Type=="Revenue").Sum(r=>r.amount);var expenses=rows.Where(r=>r.Type=="Expense").Sum(r=>r.amount);
  return new{from,to,currency=code,mode=report.Mode,rows,revenue,expenses,netProfit=revenue-expenses};
 }
}
