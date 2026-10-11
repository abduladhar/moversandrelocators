using Movers.Services.Currencies;
using Movers.Services.Operations;
namespace Movers.Services.Billing;
public sealed partial class BillingService {
 public async Task<object> VendorStatement(DateOnly from,DateOnly to,string currency,string vendorCode,CancellationToken ct){
  if(from==default||to==default||from>to)throw new InvalidOperationException("Select a valid statement period.");
  var vendor=(await masters.List("vendor",ct)).SingleOrDefault(c=>c.Code==vendorCode)??throw new InvalidOperationException("Select a vendor.");
  var settings=await currencies.Settings(ct);var converted=currency is "BASE" or "VENDOR" or "DEFAULT";
  var target=currency=="BASE"?settings.BaseCurrency!:currency=="DEFAULT"?settings.DefaultCurrency:currency=="VENDOR"?vendor.Currency??settings.DefaultCurrency:(await currencies.Require(currency,ct)).Code;
  var definition=await currencies.Require(target,ct);
  var rate=currency is "VENDOR" or "DEFAULT"?(await currencies.Resolve(target,to,null,ct)).UsdPerUnit:1m;
  var sources=new Dictionary<Guid,(string Type,string Number,string? Reference)>();
  foreach(var d in await Documents(ct))if(d.JournalId.HasValue&&d.Details.Type=="BILL"&&d.Details.PartyCode==vendorCode)sources[d.JournalId.Value]=("Bill",d.Number,d.Details.Reference);
  foreach(var v in await Vouchers(ct))if(v.JournalId.HasValue&&v.Details.Type=="PAYMENT"&&v.Details.PartyCode==vendorCode)sources[v.JournalId.Value]=("Payment",v.Number,v.Details.Reference);
  foreach(var m in await Memos(ct))if(m.JournalId.HasValue&&m.Details.DocumentType=="BILL"&&m.Details.PartyCode==vendorCode)sources[m.JournalId.Value]=(m.Details.Type=="CREDIT_MEMO"?"Credit memo":"Debit memo",m.Number,m.Details.DocumentNumber);
  var journals=(await unit.Journals(ct)).Where(j=>j.PostingDate<=to&&(converted||j.Currency==target)).OrderBy(j=>j.PostingDate).ThenBy(j=>j.PostedAtUtc).ThenBy(j=>j.Id);
  var native=await unit.JournalLines(ct);decimal opening=0,running=0,debit=0,credit=0;var rows=new List<object>();
  foreach(var j in journals){
   var original=j.ReversesId??j.Id;if(!sources.TryGetValue(original,out var source))continue;
   var originalLines=native.Where(l=>l.JournalId==j.Id&&l.AccountCode == "2000").ToList();
   var lines=converted?(await currencies.BaseLines(j.Id,ct)).Where(l=>l.AccountCode == "2000").ToList():originalLines.Select(l=>new JournalLineInput(l.AccountCode,l.Debit,l.Credit)).ToList();
   if(lines.Count==0)continue;
   var dr=CurrencyService.Round(lines.Sum(l=>l.Debit)/rate,definition.DecimalPlaces);var cr=CurrencyService.Round(lines.Sum(l=>l.Credit)/rate,definition.DecimalPlaces);
   running+=cr-dr;if(j.PostingDate<from){opening=running;continue;}debit+=dr;credit+=cr;
   rows.Add(new{journalId=j.Id,date=j.PostingDate,type=j.ReversesId.HasValue?"Reversal · "+source.Type:source.Type,number=j.Reference,originalNumber=source.Number,reference=source.Reference,transactionCurrency=j.Currency,transactionDebit=originalLines.Sum(l=>l.Debit),transactionCredit=originalLines.Sum(l=>l.Credit),debit=dr,credit=cr,balance=running,isReversal=j.ReversesId.HasValue,controlAccounts=lines.Select(l=>l.AccountCode).Distinct().ToList()});
  }
  return new{from,to,currency=target,mode=currency,vendor=new{vendor.Code,vendor.Name,vendor.Address},conversionDate=currency is "VENDOR" or "DEFAULT"?(DateOnly?)to:null,opening,debit,credit,closing=running,rows};
 }
}

