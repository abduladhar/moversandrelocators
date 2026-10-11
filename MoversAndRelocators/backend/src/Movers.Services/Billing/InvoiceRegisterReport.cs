using Movers.Services.Currencies;
namespace Movers.Services.Billing;
public sealed partial class BillingService {
 public async Task<object> InvoiceRegister(DateOnly from,DateOnly to,string currency,string status,string? customerCode,CancellationToken ct){
  if(from==default||to==default||from>to)throw new InvalidOperationException("Select a valid invoice date range.");
  if(!new[]{"ALL","DRAFT","UNPAID","PART_PAID","SETTLED","VOIDED"}.Contains(status))throw new InvalidOperationException("Select a valid status.");
  var customers=await masters.List("customer",ct);
  if(!string.IsNullOrWhiteSpace(customerCode)&&!customers.Any(c=>c.Code==customerCode))throw new InvalidOperationException("Select a valid customer.");
  var settings=await currencies.Settings(ct);
  if(currency is not ("BASE" or "CUSTOMER" or "DEFAULT"))await currencies.Require(currency,ct);
  var vouchers=(await Vouchers(ct)).Where(v=>v.JournalId.HasValue&&!v.Details.Voided&&v.Details.Type=="RECEIPT").ToList();
  var memos=(await Memos(ct)).Where(m=>m.JournalId.HasValue&&!m.Details.Voided&&m.Details.DocumentType=="INVOICE").ToList();
  async Task<decimal> Control(Guid id)=>(await currencies.BaseLines(id,ct)).Where(l=>l.AccountCode=="1100").Sum(l=>l.Debit-l.Credit);
  var rows=new List<object>();var totals=new Dictionary<(string Currency,string Status),decimal[]>();
  foreach(var doc in (await Documents(ct)).OrderBy(d=>d.Details.Date).ThenBy(d=>d.Number)){
   var d=doc.Details;
   if(d.Type!="INVOICE"||d.Date<from||d.Date>to||(!string.IsNullOrWhiteSpace(customerCode)&&d.PartyCode!=customerCode))continue;
   if(currency is not ("BASE" or "CUSTOMER" or "DEFAULT")&&d.Currency!=currency)continue;
   var state=d.Voided?"VOIDED":!doc.JournalId.HasValue?"DRAFT":doc.Balance<=0?"SETTLED":doc.Paid>0?"PART_PAID":"UNPAID";
   if(status!="ALL"&&status!=state)continue;
   var adjustment=memos.Where(m=>m.Details.DocumentId==doc.Id).ToList();
   var nativeAdjustment=adjustment.Sum(m=>(m.Details.Type=="CREDIT_MEMO"?-1:1)*m.Details.Amount);
   var party=customers.SingleOrDefault(c=>c.Code==d.PartyCode);
   var target=currency=="BASE"?settings.BaseCurrency!:currency=="DEFAULT"?settings.DefaultCurrency:currency=="CUSTOMER"?party?.Currency??settings.DefaultCurrency:currency;
   var definition=await currencies.Require(target,ct);
   decimal amount=d.Amount,paid=doc.Paid,adjusted=nativeAdjustment;
   if(currency is "BASE" or "CUSTOMER" or "DEFAULT"){
    amount=doc.JournalId.HasValue?await Control(doc.JournalId.Value):d.BaseAmount??throw new InvalidOperationException("Saved invoice exchange value is missing.");
    paid=0;adjusted=0;
    foreach(var a in vouchers.SelectMany(v=>v.Details.Allocations).Where(a=>a.DocumentId==doc.Id))paid+=a.BaseAmount??throw new InvalidOperationException("Historical allocation exchange value is missing.");
    foreach(var m in adjustment)adjusted+=await Control(m.JournalId!.Value);
    var rate=currency is "CUSTOMER" or "DEFAULT"?(await currencies.Resolve(target,to,null,ct)).UsdPerUnit:1m;
    amount/=rate;paid/=rate;adjusted/=rate;
   }
   amount=CurrencyService.Round(amount,definition.DecimalPlaces);paid=CurrencyService.Round(paid,definition.DecimalPlaces);adjusted=CurrencyService.Round(adjusted,definition.DecimalPlaces);
   var balance=d.Voided||!doc.JournalId.HasValue?0:amount+adjusted-paid;
   var key=(target,state);if(!totals.TryGetValue(key,out var sum)){sum=new decimal[4];totals[key]=sum;}sum[0]+=amount;sum[1]+=adjusted;sum[2]+=paid;sum[3]+=balance;
   rows.Add(new{id=doc.Id,number=doc.Number,customerCode=d.PartyCode,customerName=party?.Name??d.PartyName,date=d.Date,dueDate=d.DueDate,reference=d.Reference,status=state,currency=target,amount,adjustment=adjusted,paid,balance,transactionCurrency=d.Currency,transactionAmount=d.Amount,transactionBalance=d.Voided||!doc.JournalId.HasValue?0:doc.Balance,lines=d.Lines,notes=d.Notes,voidReason=d.VoidReason});
  }
  return new{from,to,mode=currency,status,customerCode,rows,totals=totals.Select(t=>new{currency=t.Key.Currency,status=t.Key.Status,amount=t.Value[0],adjustment=t.Value[1],paid=t.Value[2],balance=t.Value[3]})};
 }
}
