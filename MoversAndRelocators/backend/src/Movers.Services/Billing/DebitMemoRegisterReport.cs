using Movers.Services.Currencies;
namespace Movers.Services.Billing;
public sealed partial class BillingService {
 public async Task<object> DebitMemoRegister(DateOnly from,DateOnly to,string currency,string status,string partyType,string? partyCode,CancellationToken ct){
  if(from==default||to==default||from>to)throw new InvalidOperationException("Select a valid memo date range.");
  if(!new[]{"ALL","DRAFT","POSTED","VOIDED"}.Contains(status)||!new[]{"ALL","CUSTOMER","VENDOR"}.Contains(partyType))throw new InvalidOperationException("Select a valid status and party type.");
  var customers=await masters.List("customer",ct);var vendors=await masters.List("vendor",ct);
  if(!string.IsNullOrWhiteSpace(partyCode)&&(partyType=="ALL"||!(partyType=="CUSTOMER"?customers:vendors).Any(p=>p.Code==partyCode)))throw new InvalidOperationException("Select a party type and valid party.");
  var settings=await currencies.Settings(ct);
  if(currency is not ("BASE" or "PARTY" or "DEFAULT"))await currencies.Require(currency,ct);
  var documents=(await Documents(ct)).ToDictionary(d=>d.Id);var journals=await unit.Journals(ct);
  var rows=new List<object>();var totals=new Dictionary<(string Currency,string Type,string Status),decimal[]>();
  foreach(var m in (await Memos(ct)).OrderBy(m=>m.Details.Date).ThenBy(m=>m.Number)){
   var d=m.Details;var type=d.DocumentType=="INVOICE"?"CUSTOMER":"VENDOR";
   var state=d.Voided?"VOIDED":m.JournalId.HasValue?"POSTED":"DRAFT";
   if(d.Type!="DEBIT_MEMO"||d.Date<from||d.Date>to||(status!="ALL"&&state!=status)||(partyType!="ALL"&&partyType!=type)||(!string.IsNullOrWhiteSpace(partyCode)&&d.PartyCode!=partyCode))continue;
   if(currency is not ("BASE" or "PARTY" or "DEFAULT")&&d.Currency!=currency)continue;
   var party=(type=="CUSTOMER"?customers:vendors).SingleOrDefault(p=>p.Code==d.PartyCode);
   var target=currency=="BASE"?settings.BaseCurrency!:currency=="DEFAULT"?settings.DefaultCurrency:currency=="PARTY"?party?.Currency??settings.DefaultCurrency:currency;
   var definition=await currencies.Require(target,ct);decimal amount=d.Amount;
   if(currency is "BASE" or "PARTY" or "DEFAULT"){amount=d.BaseAmount;if(currency is "PARTY" or "DEFAULT")amount/=(await currencies.Resolve(target,to,null,ct)).UsdPerUnit;}
   amount=CurrencyService.Round(amount,definition.DecimalPlaces);
   var key=(target,type,state);if(!totals.TryGetValue(key,out var sum)){sum=new decimal[2];totals[key]=sum;}sum[0]++;sum[1]+=amount;
   var document=documents.GetValueOrDefault(d.DocumentId);
   var reversal=journals.FirstOrDefault(j=>j.ReversesId==m.JournalId&&m.JournalId.HasValue);
   rows.Add(new{id=m.Id,number=m.Number,date=d.Date,partyType=type,partyCode=d.PartyCode,partyName=party?.Name??d.PartyName,status=state,documentType=d.DocumentType,documentNumber=d.DocumentNumber,documentReference=document?.Details.Reference,chargeDescription=document?.Details.Lines.SingleOrDefault(l=>l.ChargeId==d.ChargeId)?.Description,accountCode=d.AccountCode,reason=d.Reason,transactionCurrency=d.Currency,transactionAmount=d.Amount,currency=target,amount,journalId=m.JournalId,reversalNumber=reversal?.Reference,reversalDate=reversal?.PostingDate});
  }
  return new{from,to,mode=currency,status,partyType,partyCode,rows,totals=totals.Select(t=>new{currency=t.Key.Currency,partyType=t.Key.Type,status=t.Key.Status,count=t.Value[0],amount=t.Value[1]})};
 }
}

