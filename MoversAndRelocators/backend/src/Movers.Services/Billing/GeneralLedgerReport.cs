using Movers.Services.Operations;
namespace Movers.Services.Billing;
public sealed partial class BillingService {
 public async Task<object> CashBookReport(DateOnly from,DateOnly to,string currency,string accountCode,CancellationToken ct){
  if(!(await Accounts(ct)).Any(a=>a.Code==accountCode&&a.IsCashBank))throw new InvalidOperationException("Select a cash or bank account.");
  return await GeneralLedgerReport(from,to,currency,accountCode,ct);
 }
 public async Task<object> GeneralLedgerReport(DateOnly from,DateOnly to,string currency,string accountCode,CancellationToken ct){
  if(from==default||to==default||from>to)throw new InvalidOperationException("Select a valid reporting period.");
  var accounts=await Accounts(ct);var account=accounts.SingleOrDefault(a=>a.Code==accountCode)??throw new InvalidOperationException("Select an account.");
  var report=await currencies.ReportCurrency(currency,to,ct);var baseMode=report.Converted;var code=report.Code;
  var journals=(await unit.Journals(ct)).Where(j=>j.PostingDate<=to&&(baseMode||j.Currency==code)).OrderBy(j=>j.PostingDate).ThenBy(j=>j.PostedAtUtc).ThenBy(j=>j.Id).ToList();
  var native=await unit.JournalLines(ct);decimal opening=0,running=0,debit=0,credit=0;var rows=new List<object>();
  foreach(var j in journals){
   if(!native.Any(l=>l.JournalId==j.Id&&l.AccountCode==accountCode))continue;
   var lines=baseMode?await currencies.ReportLines(j.Id,report,ct):native.Where(l=>l.JournalId==j.Id).Select(l=>new JournalLineInput(l.AccountCode,l.Debit,l.Credit)).ToList();
   var matching=lines.Where(l=>l.AccountCode==accountCode).ToList();if(matching.Count==0)continue;
   var dr=matching.Sum(l=>l.Debit);var cr=matching.Sum(l=>l.Credit);
   running+=dr-cr;
   if(j.PostingDate<from){opening=running;continue;}
   debit+=dr;credit+=cr;
   var originalLines=native.Where(l=>l.JournalId==j.Id&&(l.Debit!=0||l.Credit!=0)).ToList();
   var isTransfer=originalLines.Select(l=>l.AccountCode).Distinct().Count()>1&&originalLines.All(l=>accounts.Any(a=>a.Code==l.AccountCode&&a.IsCashBank));
   rows.Add(new{isTransfer,counterpartAccounts=originalLines.Where(l=>l.AccountCode!=accountCode).Select(l=>l.AccountCode+" · "+accounts.SingleOrDefault(a=>a.Code==l.AccountCode)?.Name).Distinct().ToList(),journalId=j.Id,date=j.PostingDate,j.Reference,j.Description,transactionCurrency=j.Currency,debit=dr,credit=cr,balance=running,isReversal=j.ReversesId.HasValue,reversesId=j.ReversesId});
  }
  return new{from,to,currency=code,mode=report.Mode,account,opening,debit,credit,closing=running,rows};
 }
}

