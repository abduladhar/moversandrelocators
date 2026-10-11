using Movers.Services.Currencies;
namespace Movers.Services.Billing;
public record ReceivableAgingRow(Guid Id,string Number,string CustomerCode,string CustomerName,DateOnly InvoiceDate,DateOnly DueDate,int DaysOverdue,string TransactionCurrency,decimal TransactionOutstanding,string Currency,decimal Outstanding,decimal Current,decimal Days1To30,decimal Days31To60,decimal Days61To90,decimal DaysOver90);
public record ReceivableAgingTotal(string Currency,decimal Current,decimal Days1To30,decimal Days31To60,decimal Days61To90,decimal DaysOver90,decimal Outstanding);
public record ReceivableAgingResult(DateOnly Date,string Mode,string? CustomerCode,IReadOnlyList<ReceivableAgingRow> Rows,IEnumerable<ReceivableAgingTotal> Totals);
public sealed partial class BillingService {
 public async Task<ReceivableAgingResult> ReceivableAging(DateOnly date,string currency,string? customerCode,CancellationToken ct){
  if(date==default)throw new InvalidOperationException("Select an as-of date.");
  var customers=await masters.List("customer",ct);
  if(!string.IsNullOrWhiteSpace(customerCode)&&!customers.Any(c=>c.Code==customerCode))throw new InvalidOperationException("Select a valid customer.");
  var settings=await currencies.Settings(ct);
  var journals=await unit.Journals(ct);
  bool Active(Guid? id)=>id.HasValue&&journals.Any(j=>j.Id==id&&j.PostingDate<=date)&&!journals.Any(j=>j.ReversesId==id&&j.PostingDate<=date);
  async Task<decimal> BaseControl(Guid id)=>(await currencies.BaseLines(id,ct)).Where(l=>l.AccountCode=="1100").Sum(l=>l.Debit-l.Credit);
  var vouchers=(await Vouchers(ct)).Where(v=>v.Details.Type=="RECEIPT"&&Active(v.JournalId)).ToList();
  var memos=(await Memos(ct)).Where(m=>m.Details.DocumentType=="INVOICE"&&Active(m.JournalId)).ToList();
  var rows=new List<ReceivableAgingRow>();var totals=new Dictionary<string,decimal[]>();
  foreach(var doc in await Documents(ct)){
   var d=doc.Details;
   if(d.Type!="INVOICE"||!Active(doc.JournalId)||(!string.IsNullOrWhiteSpace(customerCode)&&d.PartyCode!=customerCode))continue;
   if(currency is not ("BASE" or "CUSTOMER" or "DEFAULT")&&d.Currency!=currency)continue;
   var allocations=vouchers.SelectMany(v=>v.Details.Allocations).Where(a=>a.DocumentId==doc.Id).ToList();
   var adjustments=memos.Where(m=>m.Details.DocumentId==doc.Id).ToList();
   var outstanding=d.Amount-allocations.Sum(a=>a.Amount)+adjustments.Sum(m=>(m.Details.Type=="CREDIT_MEMO"?-1:1)*m.Details.Amount);
   if(outstanding==0)continue;
   var party=customers.SingleOrDefault(c=>c.Code==d.PartyCode);
   var target=currency=="BASE"?settings.BaseCurrency!:currency=="DEFAULT"?settings.DefaultCurrency:currency=="CUSTOMER"?party?.Currency??settings.DefaultCurrency:currency;
   var definition=await currencies.Require(target,ct);decimal amount=outstanding;
   if(currency is "BASE" or "CUSTOMER" or "DEFAULT"){
    amount=await BaseControl(doc.JournalId!.Value);
    foreach(var a in allocations)amount-=a.BaseAmount??throw new InvalidOperationException("Historical allocation exchange value is missing.");
    foreach(var m in adjustments)amount+=await BaseControl(m.JournalId!.Value);
    if(currency is "CUSTOMER" or "DEFAULT")amount/=(await currencies.Resolve(target,date,null,ct)).UsdPerUnit;
   }
   amount=CurrencyService.Round(amount,definition.DecimalPlaces);
   var days=Math.Max(0,date.DayNumber-d.DueDate.DayNumber);
   var bucket=days==0?0:days<=30?1:days<=60?2:days<=90?3:4;
   var buckets=new decimal[5];buckets[bucket]=amount;
   if(!totals.TryGetValue(target,out var sum)){sum=new decimal[5];totals[target]=sum;}
   sum[bucket]+=amount;
   rows.Add(new(doc.Id,doc.Number,d.PartyCode,party?.Name??d.PartyName,d.Date,d.DueDate,days,d.Currency,outstanding,target,amount,buckets[0],buckets[1],buckets[2],buckets[3],buckets[4]));
  }
  if(currency is not ("BASE" or "CUSTOMER" or "DEFAULT"))await currencies.Require(currency,ct);
  return new(date,currency,customerCode,rows,totals.Select(t=>new ReceivableAgingTotal(t.Key,t.Value[0],t.Value[1],t.Value[2],t.Value[3],t.Value[4],t.Value.Sum())));
 }
}

