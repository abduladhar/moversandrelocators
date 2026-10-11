using Movers.Services.Operations;
namespace Movers.Services.Billing;
public record CashFlowMapping(string AccountCode,string Category);
public sealed partial class BillingService {
 private static readonly string[] FlowCategories=["Operating","Investing","Financing","Exchange","Unclassified"];
 private static string DefaultFlow(Account a)=>a.Code is "4200-FX" or "5500"?"Exchange":a.Type is "Revenue" or "Expense"||a.Code is "1100" or "1200" or "1300" or "2000" or "2100" or "2200"?"Operating":"Unclassified";
 public async Task<object> CashFlowMappings(CancellationToken ct){
  var mappings=(await repository.List("CASHFLOWMAP",ct)).Select(Read<CashFlowMapping>).ToDictionary(m=>m.AccountCode);
  return (await Accounts(ct)).Where(a=>!a.IsCashBank).Select(a=>new{a.Code,a.Name,a.Type,category=mappings.TryGetValue(a.Code,out var m)?m.Category:DefaultFlow(a)});
 }
 public Task<CashFlowMapping> SaveCashFlowMapping(CashFlowMapping c,CancellationToken ct)=>unit.Transaction(async()=>{
  if(!FlowCategories.Contains(c.Category)||(await Accounts(ct)).All(a=>a.Code!=c.AccountCode||a.IsCashBank))throw new InvalidOperationException("Select a non-cash account and a valid cash-flow category.");
  var row=(await repository.List("CASHFLOWMAP",ct)).SingleOrDefault(r=>r.Number==c.AccountCode);
  if(row is null)Add("CASHFLOWMAP",c.AccountCode,Guid.NewGuid(),c,c);else Write(row,c);
  await unit.Save(ct);return c;
 },ct);
 public async Task<object> CashFlowReport(DateOnly from,DateOnly to,string currency,CancellationToken ct){
  if(from==default||to==default||from>to)throw new InvalidOperationException("Select a valid reporting period.");
  var report=await currencies.ReportCurrency(currency,to,ct);var baseMode=report.Converted;var code=report.Code;
  var accounts=(await Accounts(ct)).ToDictionary(a=>a.Code);var cashCodes=accounts.Values.Where(a=>a.IsCashBank).Select(a=>a.Code).ToHashSet();
  var mappings=(await repository.List("CASHFLOWMAP",ct)).Select(Read<CashFlowMapping>).ToDictionary(m=>m.AccountCode);
  var native=await unit.JournalLines(ct);var totals=FlowCategories.ToDictionary(c=>c,c=>0m);
  decimal opening=0,closing=0;var rows=new List<object>();int unresolved=0;
  foreach(var j in (await unit.Journals(ct)).Where(j=>j.PostingDate<=to&&(baseMode||j.Currency==code)).OrderBy(j=>j.PostingDate).ThenBy(j=>j.PostedAtUtc).ThenBy(j=>j.Id)){
   // Skip non-cash journals before resolving historical conversion snapshots.
   if(!native.Any(l=>l.JournalId==j.Id&&cashCodes.Contains(l.AccountCode)))continue;
   var lines=baseMode?await currencies.ReportLines(j.Id,report,ct):native.Where(l=>l.JournalId==j.Id).Select(l=>new JournalLineInput(l.AccountCode,l.Debit,l.Credit)).ToList();
   var cash=lines.Where(l=>cashCodes.Contains(l.AccountCode)).ToList();var movement=cash.Sum(l=>l.Debit-l.Credit);
   closing+=movement;if(j.PostingDate<from){opening+=movement;continue;}
   var counterpart=lines.Where(l=>!cashCodes.Contains(l.AccountCode)&&(l.Debit!=0||l.Credit!=0)).Select(l=>l.AccountCode).Distinct().ToList();
   var classes=counterpart.Select(a=>mappings.TryGetValue(a,out var m)?m.Category:accounts.TryGetValue(a,out var ac)?DefaultFlow(ac):"Unclassified").Distinct().ToList();
   // Settlement FX differences belong with their operating cash receipt/payment.
   if(classes.Contains("Operating")&&classes.All(c=>c is "Operating" or "Exchange"))classes=["Operating"];
   var category=counterpart.Count==0?"Transfer":classes.Count==1?classes[0]:"Unclassified";
   if(category=="Transfer"&&movement!=0)category="Unclassified";
   if(category=="Unclassified")unresolved++;
   if(category!="Transfer")totals[category]+=movement;
   rows.Add(new{journalId=j.Id,date=j.PostingDate,j.Reference,transactionCurrency=j.Currency,category,counterpartAccounts=counterpart.Select(a=>a+" · "+accounts.GetValueOrDefault(a)?.Name).ToList(),cashAccounts=cash.Select(l=>l.AccountCode).Distinct().ToList(),inflow=category=="Transfer"?0:Math.Max(movement,0),outflow=category=="Transfer"?0:Math.Max(-movement,0),net=movement,isReversal=j.ReversesId.HasValue,warning=category=="Unclassified"?"Review account mappings or split a journal spanning different cash-flow activities.":null});
  }
  var net=totals.Values.Sum();
  return new{from,to,currency=code,mode=report.Mode,opening,closing,netMovement=net,difference=closing-opening-net,isReconciled=closing-opening==net,unclassifiedCount=unresolved,classificationComplete=unresolved==0,categories=totals.Select(t=>new{category=t.Key,net=t.Value}),rows};
 }
}
