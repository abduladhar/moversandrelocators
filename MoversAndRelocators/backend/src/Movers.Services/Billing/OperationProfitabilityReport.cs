using Movers.Services.Currencies;
namespace Movers.Services.Billing;
public record OperationProfitEntry(string SourceKind,Guid SourceId,string SourceLabel,Guid JournalId,DateOnly Date,string Reference,string Description,string TransactionCurrency,decimal TransactionAmount,decimal Revenue,decimal Expense,bool IsReversal);
public sealed partial class BillingService {
 public async Task<object> OperationProfitability(DateOnly from,DateOnly to,string currency,string sourceKind,Guid? sourceId,CancellationToken ct){
  if(from==default||to==default||from>to)throw new InvalidOperationException("Select a valid reporting period.");
  if(!new[]{"ALL","PICKUP","PACKING","DELIVERY","WAREHOUSE","JOB"}.Contains(sourceKind))throw new InvalidOperationException("Select an operation type.");
  if(sourceId.HasValue&&!(await Sources(ct)).Any(s=>s.Id==sourceId&&(sourceKind=="ALL"||s.Kind==sourceKind)))throw new InvalidOperationException("Select a valid operation.");
  var report=await currencies.ReportCurrency(currency,to,ct);var code=report.Code;
  var journals=await unit.Journals(ct);var rows=new List<OperationProfitEntry>();
  decimal Translate(decimal value)=>report.Translation is null?value:CurrencyService.FromBase(value,report.Translation);
  void Add(Guid? journalId,string kind,Guid id,string label,string description,string txn,decimal amount,decimal? baseAmount,bool income){
   if(!journalId.HasValue||!new[]{"PICKUP","PACKING","DELIVERY","WAREHOUSE","JOB"}.Contains(kind)||(sourceKind!="ALL"&&kind!=sourceKind)||(sourceId.HasValue&&id!=sourceId)||(!report.Converted&&txn!=code))return;
   foreach(var j in journals.Where(j=>(j.Id==journalId||j.ReversesId==journalId)&&j.PostingDate>=from&&j.PostingDate<=to)){
    var sign=j.ReversesId.HasValue?-1:1;
    var value=(report.Converted?Translate(baseAmount??throw new InvalidOperationException("Historical operation exchange value is missing.")):amount)*sign;
    rows.Add(new(kind,id,label,j.Id,j.PostingDate,j.Reference,description,txn,amount*sign,income?value:0,income?0:value,j.ReversesId.HasValue));
   }
  }
  var documents=await Documents(ct);var charges=(await Charges(ct)).ToDictionary(c=>c.Id);
  foreach(var doc in documents.Where(d=>d.JournalId.HasValue))
   foreach(var line in doc.Details.Lines){
    charges.TryGetValue(line.ChargeId,out var charge);
    Add(doc.JournalId,line.SourceKind,line.SourceId,line.SourceLabel,line.Description,doc.Details.Currency,line.Amount,charge?.Details.BaseAmount,doc.Details.Type=="INVOICE");
   }
  foreach(var memo in await Memos(ct)){
   var m=memo.Details;var line=documents.SingleOrDefault(d=>d.Id==m.DocumentId)?.Details.Lines.SingleOrDefault(l=>l.ChargeId==m.ChargeId);
   if(line is null){if(memo.JournalId.HasValue)throw new InvalidOperationException("A posted memo has no original operation charge.");continue;}
   var sign=m.Type=="CREDIT_MEMO"?-1:1;
   Add(memo.JournalId,line.SourceKind,line.SourceId,line.SourceLabel,m.Reason,m.Currency,m.Amount*sign,m.BaseAmount*sign,m.DocumentType=="INVOICE");
  }
  foreach(var record in await repository.List("CASHPOST",ct)){
   var p=Read<CashPosting>(record);var d=p.Snapshot;
   if(p.VoucherId is null&&d.Type=="EXPENSE_PAID")Add(record.JournalId,d.SourceKind,d.SourceId,d.SourceLabel,d.Notes??d.Reference,d.Currency,d.Amount,d.BaseAmount,false);
  }
  // Material consumed (posted when a packing job completes; its reversal nets through ReversesId).
  foreach(var (record,p) in await MaterialPostings(ct))Add(record.JournalId,p.SourceKind,p.SourceId,p.SourceLabel,"Packing materials used",p.Currency,p.Amount,p.Amount,false);
  var groups=rows.GroupBy(r=>new{r.SourceKind,r.SourceId}).OrderBy(g=>g.Key.SourceKind).ThenBy(g=>g.First().SourceLabel)
   .Select(g=>{var revenue=g.Sum(r=>r.Revenue);var expense=g.Sum(r=>r.Expense);return new{g.Key.SourceKind,g.Key.SourceId,sourceLabel=g.First().SourceLabel,revenue,expense,profit=revenue-expense,marginPercent=revenue>0?(decimal?)((revenue-expense)/revenue*100):null,entries=g.OrderBy(r=>r.Date).ThenBy(r=>r.Reference).ToList()};}).ToList();
  var totalRevenue=rows.Sum(r=>r.Revenue);var totalExpense=rows.Sum(r=>r.Expense);
  var sourceLabel=sourceId.HasValue?(await Sources(ct)).FirstOrDefault(s=>s.Id==sourceId)?.Label:null;
  return new{from,to,currency=code,mode=currency,sourceKind,sourceId,sourceLabel,rows=groups,totals=new{revenue=totalRevenue,expense=totalExpense,profit=totalRevenue-totalExpense,marginPercent=totalRevenue>0?(decimal?)((totalRevenue-totalExpense)/totalRevenue*100):null}};
 }
}
