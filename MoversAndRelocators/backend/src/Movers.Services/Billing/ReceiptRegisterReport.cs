using Movers.Services.Currencies;
namespace Movers.Services.Billing;
public sealed partial class BillingService {
 public async Task<object> ReceiptRegister(DateOnly from,DateOnly to,string currency,string status,string? customerCode,CancellationToken ct){
  if(from==default||to==default||from>to)throw new InvalidOperationException("Select a valid receipt date range.");
  if(!new[]{"ALL","DRAFT","POSTED","VOIDED"}.Contains(status))throw new InvalidOperationException("Select a valid status.");
  var customers=await masters.List("customer",ct);var settings=await currencies.Settings(ct);
  if(!string.IsNullOrWhiteSpace(customerCode)&&!customers.Any(c=>c.Code==customerCode))throw new InvalidOperationException("Select a valid customer.");
  if(currency is not ("BASE" or "CUSTOMER" or "DEFAULT"))await currencies.Require(currency,ct);
  var documents=(await Documents(ct)).ToDictionary(d=>d.Id);
  var journals=await unit.Journals(ct);var accounts=await Accounts(ct);
  var rows=new List<object>();var totals=new Dictionary<(string Currency,string Status),decimal[]>();
  async Task Append(Guid id,string number,DateOnly date,string? partyCode,string partyName,string txn,decimal amount,decimal? baseAmount,string state,string reference,string? accountCode,string? notes,IReadOnlyList<Allocation> allocations,Guid? journalId){
   if(date<from||date>to||(!string.IsNullOrWhiteSpace(customerCode)&&partyCode!=customerCode)||(status!="ALL"&&state!=status))return;
   if(currency is not ("BASE" or "CUSTOMER" or "DEFAULT")&&txn!=currency)return;
   var target=currency=="BASE"?settings.BaseCurrency!:currency=="DEFAULT"?settings.DefaultCurrency:currency=="CUSTOMER"?(customers.SingleOrDefault(c=>c.Code==partyCode)?.Currency??settings.DefaultCurrency):txn;
   var definition=await currencies.Require(target,ct);
   decimal value=amount;
   if(currency is "BASE" or "CUSTOMER" or "DEFAULT"){
    value=baseAmount??throw new InvalidOperationException("Saved receipt exchange value is missing.");
    if(currency is "CUSTOMER" or "DEFAULT")value/=(await currencies.Resolve(target,to,null,ct)).UsdPerUnit;
   }
   value=CurrencyService.Round(value,definition.DecimalPlaces);
   var allocated=allocations.Sum(a=>a.PaymentAmount??a.Amount);var unallocated=amount-allocated;
   var key=(target,state);if(!totals.TryGetValue(key,out var sum)){sum=new decimal[2];totals[key]=sum;}sum[0]++;sum[1]+=value;
   rows.Add(new{id,number,date,customerCode=partyCode,customerName=partyName,status=state,reference,accountCode,accountName=accounts.SingleOrDefault(a=>a.Code==accountCode)?.Name,notes,transactionCurrency=txn,transactionAmount=amount,allocated,unallocated,currency=target,amount=value,journalId,allocations=allocations.Select(a=>new{documentId=a.DocumentId,number=documents.GetValueOrDefault(a.DocumentId)?.Number??a.DocumentId.ToString(),currency=documents.GetValueOrDefault(a.DocumentId)?.Details.Currency,amount=a.Amount,paymentAmount=a.PaymentAmount??a.Amount})});
  }
  var receipts=(await Vouchers(ct)).Where(v=>v.Details.Type=="RECEIPT").ToList();
  foreach(var v in receipts){var d=v.Details;await Append(v.Id,v.Number,d.Date,d.PartyCode,d.PartyName,d.Currency,d.Amount,d.BaseAmount,d.Voided?"VOIDED":v.JournalId.HasValue?"POSTED":"DRAFT",d.Reference,d.AccountCode,d.Notes,d.Allocations,v.JournalId);}
  var linked=receipts.Where(v=>v.JournalId.HasValue).Select(v=>v.JournalId!.Value).ToHashSet();
  foreach(var c in await CashQueue(ct)){
   var d=c.Details;if(d.Type!="RECEIPT"||(c.JournalId.HasValue&&linked.Contains(c.JournalId.Value)))continue;
   var reversed=c.JournalId.HasValue&&journals.Any(j=>j.ReversesId==c.JournalId);
   var cashAccount=c.JournalId.HasValue?(await currencies.BaseLines(c.JournalId.Value,ct)).FirstOrDefault(l=>accounts.Any(a=>a.Code==l.AccountCode&&a.IsCashBank))?.AccountCode:null;
   await Append(c.Id,c.PostingNumber??c.Number,d.Date,d.PartyCode,d.PartyName,d.Currency,d.Amount,d.BaseAmount,reversed?"VOIDED":c.Posted?"POSTED":"DRAFT",d.Reference,cashAccount,d.Notes,[],c.JournalId);
  }
  return new{from,to,mode=currency,status,customerCode,rows,totals=totals.Select(t=>new{currency=t.Key.Currency,status=t.Key.Status,count=t.Value[0],amount=t.Value[1]})};
 }
}
