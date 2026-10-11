using Movers.Services.Currencies;
using Movers.Services.Operations;
namespace Movers.Services.Billing;
public sealed partial class BillingService {
 public async Task<object> CustomerStatement(DateOnly from,DateOnly to,string currency,string customerCode,CancellationToken ct){
  if(from==default||to==default||from>to)throw new InvalidOperationException("Select a valid statement period.");
  var customer=(await masters.List("customer",ct)).SingleOrDefault(c=>c.Code==customerCode)??throw new InvalidOperationException("Select a customer.");
  var settings=await currencies.Settings(ct);var converted=currency is "BASE" or "CUSTOMER" or "DEFAULT";
  var target=currency=="BASE"?settings.BaseCurrency!:currency=="DEFAULT"?settings.DefaultCurrency:currency=="CUSTOMER"?customer.Currency??settings.DefaultCurrency:(await currencies.Require(currency,ct)).Code;
  var definition=await currencies.Require(target,ct);
  var rate=currency is "CUSTOMER" or "DEFAULT"?(await currencies.Resolve(target,to,null,ct)).UsdPerUnit:1m;
  var sources=new Dictionary<Guid,(string Type,string Number,string? Reference)>();
  foreach(var d in await Documents(ct))if(d.JournalId.HasValue&&d.Details.Type=="INVOICE"&&d.Details.PartyCode==customerCode)sources[d.JournalId.Value]=("Invoice",d.Number,d.Details.Reference);
  foreach(var v in await Vouchers(ct))if(v.JournalId.HasValue&&v.Details.Type=="RECEIPT"&&v.Details.PartyCode==customerCode)sources[v.JournalId.Value]=("Receipt",v.Number,v.Details.Reference);
  foreach(var m in await Memos(ct))if(m.JournalId.HasValue&&m.Details.DocumentType=="INVOICE"&&m.Details.PartyCode==customerCode)sources[m.JournalId.Value]=(m.Details.Type=="CREDIT_MEMO"?"Credit memo":"Debit memo",m.Number,m.Details.DocumentNumber);
  foreach(var r in await repository.List("CASHPOST",ct)){
   var p=Read<CashPosting>(r);
   if(r.JournalId.HasValue&&p.VoucherId is null&&p.Snapshot.Type=="RECEIPT"&&p.Snapshot.PartyCode==customerCode)sources[r.JournalId.Value]=("Customer advance",p.Number,p.Snapshot.Reference);
  }
  var journals=(await unit.Journals(ct)).Where(j=>j.PostingDate<=to&&(converted||j.Currency==target)).OrderBy(j=>j.PostingDate).ThenBy(j=>j.PostedAtUtc).ThenBy(j=>j.Id);
  var native=await unit.JournalLines(ct);decimal opening=0,running=0,debit=0,credit=0;var rows=new List<object>();
  foreach(var j in journals){
   var original=j.ReversesId??j.Id;if(!sources.TryGetValue(original,out var source))continue;
   var originalLines=native.Where(l=>l.JournalId==j.Id&&l.AccountCode is "1100" or "2100").ToList();
   var lines=converted?(await currencies.BaseLines(j.Id,ct)).Where(l=>l.AccountCode is "1100" or "2100").ToList():originalLines.Select(l=>new JournalLineInput(l.AccountCode,l.Debit,l.Credit)).ToList();
   if(lines.Count==0)continue;
   var dr=CurrencyService.Round(lines.Sum(l=>l.Debit)/rate,definition.DecimalPlaces);var cr=CurrencyService.Round(lines.Sum(l=>l.Credit)/rate,definition.DecimalPlaces);
   running+=dr-cr;if(j.PostingDate<from){opening=running;continue;}debit+=dr;credit+=cr;
   rows.Add(new{journalId=j.Id,date=j.PostingDate,type=j.ReversesId.HasValue?"Reversal · "+source.Type:source.Type,number=j.Reference,originalNumber=source.Number,reference=source.Reference,transactionCurrency=j.Currency,transactionDebit=originalLines.Sum(l=>l.Debit),transactionCredit=originalLines.Sum(l=>l.Credit),debit=dr,credit=cr,balance=running,isReversal=j.ReversesId.HasValue,controlAccounts=lines.Select(l=>l.AccountCode).Distinct().ToList()});
  }
  return new{from,to,currency=target,mode=currency,customer=new{customer.Code,customer.Name,customer.Address},conversionDate=currency is "CUSTOMER" or "DEFAULT"?(DateOnly?)to:null,opening,debit,credit,closing=running,rows};
 }
}
