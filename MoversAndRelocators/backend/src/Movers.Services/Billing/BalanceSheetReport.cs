using Movers.Services.Operations;
namespace Movers.Services.Billing;
public sealed partial class BillingService {
 public async Task<object> BalanceSheetReport(DateOnly date,string currency,CancellationToken ct){
  if(date==default)throw new InvalidOperationException("Select an as-of date.");
  var report=await currencies.ReportCurrency(currency,date,ct);var baseMode=report.Converted;var code=report.Code;
  var accounts=await Accounts(ct);var values=accounts.ToDictionary(a=>a.Code,a=>0m);
  var native=await unit.JournalLines(ct);
  foreach(var j in (await unit.Journals(ct)).Where(j=>j.PostingDate<=date&&(baseMode||j.Currency==code))){
   var lines=baseMode?await currencies.ReportLines(j.Id,report,ct):native.Where(l=>l.JournalId==j.Id).Select(l=>new JournalLineInput(l.AccountCode,l.Debit,l.Credit)).ToList();
   foreach(var l in lines){
    if(!values.ContainsKey(l.AccountCode))throw new InvalidOperationException("A posted account is missing from the chart of accounts: "+l.AccountCode);
    values[l.AccountCode]+=l.Debit-l.Credit;
   }
  }
  var rows=accounts.Where(a=>a.Type is "Asset" or "Liability" or "Equity").Select(a=>new{a.Code,a.Name,a.Type,amount=a.Type=="Asset"?values[a.Code]:-values[a.Code]}).Where(r=>r.amount!=0).ToList();
  // Unclosed profit/loss balances belong in equity, without duplicating amounts already closed to equity.
  var earnings=-accounts.Where(a=>a.Type is "Revenue" or "Expense").Sum(a=>values[a.Code]);
  var assets=rows.Where(r=>r.Type=="Asset").Sum(r=>r.amount);var liabilities=rows.Where(r=>r.Type=="Liability").Sum(r=>r.amount);var recordedEquity=rows.Where(r=>r.Type=="Equity").Sum(r=>r.amount);
  var equity=recordedEquity+earnings;var difference=assets-liabilities-equity;
  return new{date,currency=code,mode=report.Mode,rows,assets,liabilities,recordedEquity,accumulatedEarnings=earnings,equity,liabilitiesAndEquity=liabilities+equity,difference,isBalanced=difference==0};
 }
}
