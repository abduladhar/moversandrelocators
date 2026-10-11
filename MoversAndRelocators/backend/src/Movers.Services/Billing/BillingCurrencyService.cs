using Movers.Services.Currencies;
using Movers.Services.Operations;
namespace Movers.Services.Billing;
public sealed partial class BillingService {
 private async Task SaveSettlementBase(Guid journal,bool receipt,string account,decimal cashBase,IReadOnlyList<Allocation> allocations,IReadOnlyList<DocumentView> documents,CancellationToken ct) {
  decimal control=0;
  foreach(var a in allocations) {
   var d=documents.Single(x=>x.Id==a.DocumentId);
   if(d.Details.BaseAmount is null)throw new InvalidOperationException("This historical invoice/bill has no saved base-currency value. Enter an opening document with an exchange rate before settling it.");
   control+=a.BaseAmount??CurrencyService.Round(d.Details.BaseAmount.Value*a.Amount/d.Details.Amount,(await currencies.Require((await currencies.Settings(ct)).BaseCurrency!,ct)).DecimalPlaces);
  }
  var lines=new List<JournalLineInput>{new(account,receipt?cashBase:0,receipt?0:cashBase),new(receipt?"1100":"2000",receipt?0:control,receipt?control:0)};
  var delta=lines.Sum(x=>x.Debit-x.Credit);
  if(delta!=0)lines.Add(new(delta>0?"4200-FX":"5500",delta<0?-delta:0,delta>0?delta:0));
  await currencies.SaveBaseJournal(journal,lines,ct);
 }
 private async Task<IReadOnlyList<Allocation>> ValueAllocations(IReadOnlyList<Allocation> allocations,IReadOnlyList<DocumentView> documents,FxSnapshot paymentFx,CancellationToken ct) {
  var previous=(await Vouchers(ct)).Where(x=>x.JournalId.HasValue&&!x.Details.Voided).SelectMany(x=>x.Details.Allocations).ToList();
  var result=new List<Allocation>();
  foreach(var a in allocations) {
   var doc=documents.Single(x=>x.Id==a.DocumentId);
   CurrencyService.Amount(a.Amount,new FxSnapshot(doc.Details.Currency,1,doc.Details.Date,(await currencies.Require(doc.Details.Currency,ct)).DecimalPlaces));
   if(doc.Details.Currency!=paymentFx.Currency&&a.PaymentAmount is null)throw new InvalidOperationException("Enter the settlement amount in the payment currency for each foreign-currency invoice/bill.");
   var paid=a.PaymentAmount??a.Amount;CurrencyService.Amount(paid,paymentFx);
   if(doc.Details.Currency==paymentFx.Currency&&paid!=a.Amount)throw new InvalidOperationException("Same-currency settlement amounts must equal the allocation.");
   if(doc.Details.BaseAmount is null)throw new InvalidOperationException("Historical document has no base-currency value. Recapture with an exchange rate.");
   var baseAmount=a.Amount==doc.Balance?doc.Details.BaseAmount.Value+await MemoAdjustment(doc.Id,true,ct)-previous.Where(x=>x.DocumentId==a.DocumentId).Sum(x=>x.BaseAmount??0):CurrencyService.Round(doc.Details.BaseAmount.Value*a.Amount/doc.Details.Amount,paymentFx.BaseDecimalPlaces);
   result.Add(a with{PaymentAmount=paid,BaseAmount=baseAmount});
  }
  return result;
 }
 public async Task<object> CurrencyReport(string mode,DateOnly date,string? sourceKind,Guid? sourceId,CancellationToken ct) {
  if(mode is not ("BASE" or "USD" or "PARTY" or "TRANSACTION"))throw new InvalidOperationException("Choose BASE, PARTY or TRANSACTION.");
  if(date==default)throw new InvalidOperationException("Select a report conversion date.");
  var customers=await masters.List("customer",ct);var vendors=await masters.List("vendor",ct);
  var settings=await currencies.Settings(ct);
  var rows=new List<object>();var documents=await Documents(ct);
  async Task AddRow(string number,string type,string code,string name,string currency,decimal amount,decimal? baseAmount,DateOnly recordDate,decimal? balance=null) {
   var party=(type is "INVOICE" or "RECEIPT"||type.StartsWith("INVOICE_")?customers:vendors).SingleOrDefault(x=>x.Code==code);
   var target=mode=="BASE"?settings.BaseCurrency!:mode=="USD"?"USD":mode=="PARTY"?party?.Currency??settings.DefaultCurrency:currency;
   decimal? converted=null;decimal? convertedBalance=null;string? warning=null;
   if(target==currency){converted=amount;convertedBalance=balance;}
   else if(baseAmount is null)warning="Historical record: no saved base-currency value.";
   else {
    try {var fx=await currencies.Resolve(target,date,null,ct);converted=CurrencyService.Round(baseAmount.Value/fx.UsdPerUnit,fx.DecimalPlaces);if(balance.HasValue)convertedBalance=CurrencyService.Round((baseAmount.Value*balance.Value/amount)/fx.UsdPerUnit,fx.DecimalPlaces);}
    catch(InvalidOperationException e){warning=e.Message;}
   }
   var partyCurrency=party?.Currency??settings.DefaultCurrency;
   decimal? partyAmount=null,partyBalance=null;string? partyWarning=null;
   if(party is null)partyWarning="No linked customer/vendor master.";
   else if(partyCurrency==currency){partyAmount=amount;partyBalance=balance;}
   else if(baseAmount is null)partyWarning="Historical record: no saved base-currency value.";
   else {
    try {var partyFx=await currencies.Resolve(partyCurrency,date,null,ct);partyAmount=CurrencyService.Round(baseAmount.Value/partyFx.UsdPerUnit,partyFx.DecimalPlaces);if(balance.HasValue)partyBalance=amount==0?0:CurrencyService.Round(baseAmount.Value*balance.Value/amount/partyFx.UsdPerUnit,partyFx.DecimalPlaces);}
    catch(InvalidOperationException e){partyWarning=e.Message;}
   }
   rows.Add(new{partyCurrency,partyAmount,partyBalance,partyWarning,number,type,partyCode=code,partyName=name,date=recordDate,transactionCurrency=currency,transactionAmount=amount,baseCurrency=settings.BaseCurrency,baseAmount,reportCurrency=target,reportAmount=converted,balance=convertedBalance,warning});
  }
  bool Scoped(Document d)=>!sourceId.HasValue||d.Lines.Any(x=>x.SourceId==sourceId&&x.SourceKind==sourceKind);
  foreach(var d in documents.Where(x=>x.JournalId.HasValue&&!x.Details.Voided&&Scoped(x.Details)))await AddRow(d.Number,d.Details.Type,d.Details.PartyCode,d.Details.PartyName,d.Details.Currency,d.Details.Amount,d.Details.BaseAmount,d.Details.Date,d.Balance);
  var ids=documents.Where(x=>Scoped(x.Details)).Select(x=>x.Id).ToHashSet();
  foreach(var v in (await Vouchers(ct)).Where(x=>x.JournalId.HasValue&&!x.Details.Voided&&(!sourceId.HasValue||x.Details.Allocations.Any(a=>ids.Contains(a.DocumentId)))))await AddRow(v.Number,v.Details.Type,v.Details.PartyCode,v.Details.PartyName,v.Details.Currency,v.Details.Amount,v.Details.BaseAmount,v.Details.Date);
  foreach(var m in (await Memos(ct)).Where(x=>x.JournalId.HasValue&&!x.Details.Voided&&ids.Contains(x.Details.DocumentId))){
   var d=m.Details;var sign=d.Type=="CREDIT_MEMO"?-1:1;
   await AddRow(m.Number,d.DocumentType+"_"+d.Type,d.PartyCode,d.PartyName,d.Currency,sign*d.Amount,sign*d.BaseAmount,d.Date);
  }
  foreach(var cash in (await CashQueue(ct)).Where(x=>x.Posted&&(!sourceId.HasValue||x.Details.SourceKind==sourceKind&&x.Details.SourceId==sourceId))) {
   var posting=(await repository.List("CASHPOST",ct)).Select(Read<CashPosting>).Single(x=>x.CaptureId==cash.Id);
   if(posting.VoucherId is null)await AddRow(cash.PostingNumber!,cash.Details.Type,cash.Details.PartyCode??"",cash.Details.PartyName,cash.Details.Currency,cash.Details.Amount,cash.Details.BaseAmount,cash.Details.Date);
  }
  return new{mode,conversionDate=date,baseCurrency=settings.BaseCurrency,rows};
 }
 public async Task<IReadOnlyList<AccountBalance>> BaseTrialBalance(CancellationToken ct) {
  var lines=new List<JournalLineInput>();
  foreach(var j in await unit.Journals(ct))lines.AddRange(await currencies.BaseLines(j.Id,ct));
  return (await Accounts(ct)).Select(a=>{var debit=lines.Where(x=>x.AccountCode==a.Code).Sum(x=>x.Debit);var credit=lines.Where(x=>x.AccountCode==a.Code).Sum(x=>x.Credit);return new AccountBalance(a.Code,a.Name,debit,credit,debit-credit);}).ToList();
 }
}





