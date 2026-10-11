using Movers.Services.Currencies;
namespace Movers.Services.Billing;
public record CustomerAdvanceRow(Guid Id,string Number,string CustomerCode,string CustomerName,DateOnly Date,string? Reference,string Source,string TransactionCurrency,decimal TransactionAmount,string Currency,decimal Amount);
public sealed partial class BillingService {
 public async Task<object> CustomerAdvances(DateOnly date,string currency,string? customerCode,CancellationToken ct){
  if(date==default)throw new InvalidOperationException("Select an as-of date.");
  var customers=await masters.List("customer",ct);
  if(!string.IsNullOrWhiteSpace(customerCode)&&!customers.Any(c=>c.Code==customerCode))throw new InvalidOperationException("Select a valid customer.");
  var settings=await currencies.Settings(ct);
  if(currency is not ("BASE" or "CUSTOMER" or "DEFAULT"))await currencies.Require(currency,ct);
  var journals=await unit.Journals(ct);var native=await unit.JournalLines(ct);
  var rows=new List<CustomerAdvanceRow>();
  foreach(var record in await repository.List("CASHPOST",ct)){
   var p=Read<CashPosting>(record);var d=p.Snapshot;
   if(!record.JournalId.HasValue||p.VoucherId.HasValue||d.Type!="RECEIPT"||(!string.IsNullOrWhiteSpace(customerCode)&&d.PartyCode!=customerCode))continue;
   var journal=journals.SingleOrDefault(j=>j.Id==record.JournalId);
   if(journal is null||journal.PostingDate>date||journals.Any(j=>j.ReversesId==journal.Id&&j.PostingDate<=date))continue;
   if(currency is not ("BASE" or "CUSTOMER" or "DEFAULT")&&d.Currency!=currency)continue;
   var amount=native.Where(l=>l.JournalId==journal.Id&&l.AccountCode=="2100").Sum(l=>l.Credit-l.Debit);
   if(amount==0)continue;
   var party=customers.SingleOrDefault(c=>c.Code==d.PartyCode);
   var target=currency=="BASE"?settings.BaseCurrency!:currency=="DEFAULT"?settings.DefaultCurrency:currency=="CUSTOMER"?party?.Currency??settings.DefaultCurrency:d.Currency;
   var definition=await currencies.Require(target,ct);var value=amount;
   if(currency is "BASE" or "CUSTOMER" or "DEFAULT"){
    value=(await currencies.BaseLines(journal.Id,ct)).Where(l=>l.AccountCode=="2100").Sum(l=>l.Credit-l.Debit);
    if(currency is "CUSTOMER" or "DEFAULT")value/=(await currencies.Resolve(target,date,null,ct)).UsdPerUnit;
   }
   rows.Add(new(record.Id,p.Number,d.PartyCode??"",party?.Name??d.PartyName,journal.PostingDate,d.Reference,d.SourceLabel,d.Currency,amount,target,CurrencyService.Round(value,definition.DecimalPlaces)));
  }
  return new{date,mode=currency,customerCode,rows=rows.OrderBy(r=>r.CustomerName).ThenBy(r=>r.Date).ThenBy(r=>r.Number),customers=rows.GroupBy(r=>new{r.CustomerCode,r.CustomerName,r.Currency}).Select(g=>new{g.Key.CustomerCode,g.Key.CustomerName,g.Key.Currency,count=g.Count(),amount=g.Sum(r=>r.Amount)}),totals=rows.GroupBy(r=>r.Currency).Select(g=>new{currency=g.Key,count=g.Count(),amount=g.Sum(r=>r.Amount)})};
 }
}
