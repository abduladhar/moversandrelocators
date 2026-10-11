using Movers.Services.Operations;
namespace Movers.Services.Billing;
public sealed partial class BillingService {
 public async Task<object> JournalRegister(DateOnly from,DateOnly to,string currency,string status,CancellationToken ct){
  if(from==default||to==default||from>to)throw new InvalidOperationException("Select a valid reporting period.");
  if(status is not ("ALL" or "ORIGINAL" or "REVERSAL"))throw new InvalidOperationException("Select a valid entry type.");
  var report=await currencies.ReportCurrency(currency,to,ct);var baseMode=report.Converted;var code=report.Code;
  var all=await unit.Journals(ct);var native=await unit.JournalLines(ct);var accounts=(await Accounts(ct)).ToDictionary(a=>a.Code);
  var selected=all.Where(j=>j.PostingDate>=from&&j.PostingDate<=to&&(baseMode||j.Currency==code)&&(status=="ALL"||j.ReversesId.HasValue==(status=="REVERSAL"))).OrderBy(j=>j.PostingDate).ThenBy(j=>j.PostedAtUtc).ThenBy(j=>j.Id);
  var names=await unit.UserNames(selected.Select(j=>j.PostedBy).Distinct().ToList(),ct);
  var rows=new List<object>();decimal debit=0,credit=0;
  foreach(var j in selected){
   var values=baseMode?await currencies.ReportLines(j.Id,report,ct):native.Where(l=>l.JournalId==j.Id).Select(l=>new JournalLineInput(l.AccountCode,l.Debit,l.Credit)).ToList();
   var lines=values.Select((l,i)=>new{lineNumber=i+1,l.AccountCode,accountName=accounts.GetValueOrDefault(l.AccountCode)?.Name??l.AccountCode,l.Debit,l.Credit}).ToList();
   var dr=lines.Sum(l=>l.Debit);var cr=lines.Sum(l=>l.Credit);debit+=dr;credit+=cr;
   rows.Add(new{journalId=j.Id,date=j.PostingDate,j.Reference,j.Description,transactionCurrency=j.Currency,j.PostedBy,postedByName=names.GetValueOrDefault(j.PostedBy,"Unknown user"),j.PostedAtUtc,isReversal=j.ReversesId.HasValue,reversesId=j.ReversesId,reversesReference=all.SingleOrDefault(x=>x.Id==j.ReversesId)?.Reference,reversedBy=all.Where(x=>x.ReversesId==j.Id).Select(x=>x.Reference).ToList(),debit=dr,credit=cr,lines});
  }
  return new{from,to,currency=code,mode=report.Mode,status,rows,totals=new{debit,credit,count=rows.Count}};
 }
}
