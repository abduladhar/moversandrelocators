using Movers.Services.Currencies;
namespace Movers.Services.Billing;
public record ExposureDocument(Guid Id,string Number,string Type,string Party,string Currency,decimal ForeignBalance,decimal CarryingBase,decimal? RevaluedBase,decimal? GainLoss);
public sealed partial class BillingService {
 public async Task<object> CurrencyExposure(DateOnly from,DateOnly to,string currency,CancellationToken ct){
  if(from==default||to==default||from>to)throw new InvalidOperationException("Select a valid reporting period.");
  var settings=await currencies.Settings(ct);var baseCode=settings.BaseCurrency!;
  var precision=(await currencies.Require(baseCode,ct)).DecimalPlaces;
  if(currency!="ALL")await currencies.Require(currency,ct);
  var ar=await ReceivableAging(to,"BASE",null,ct);var ap=await PayableAging(to,"BASE",null,ct);
  var docs=new List<ExposureDocument>();var warnings=new List<string>();
  var rates=new Dictionary<string,decimal?>();
  async Task Add(Guid id,string number,string type,string party,string code,decimal native,decimal carrying){
   if(code==baseCode||(currency!="ALL"&&currency!=code))return;
   if(!rates.ContainsKey(code)){try{rates[code]=(await currencies.Resolve(code,to,null,ct)).UsdPerUnit;}catch(InvalidOperationException e){rates[code]=null;warnings.Add(code+": "+e.Message);}}
   decimal? revalued=rates[code].HasValue?CurrencyService.Round(native*rates[code]!.Value,precision):null;
   docs.Add(new(id,number,type,party,code,native,carrying,revalued,revalued.HasValue?(revalued-carrying)*(type=="INVOICE"?1:-1):null));
  }
  foreach(var r in ar.Rows)await Add(r.Id,r.Number,"INVOICE",r.CustomerName,r.TransactionCurrency,r.TransactionOutstanding,r.Outstanding);
  foreach(var r in ap.Rows)await Add(r.Id,r.Number,"BILL",r.VendorName,r.TransactionCurrency,r.TransactionOutstanding,r.Outstanding);
  var rows=docs.GroupBy(d=>d.Currency).OrderBy(g=>g.Key).Select(g=>new{currency=g.Key,rate=rates[g.Key],receivable=g.Where(d=>d.Type=="INVOICE").Sum(d=>d.ForeignBalance),payable=g.Where(d=>d.Type=="BILL").Sum(d=>d.ForeignBalance),netExposure=g.Sum(d=>(d.Type=="INVOICE"?1:-1)*d.ForeignBalance),carryingBase=g.Sum(d=>(d.Type=="INVOICE"?1:-1)*d.CarryingBase),revaluedBase=rates[g.Key].HasValue?(decimal?)g.Sum(d=>(d.Type=="INVOICE"?1:-1)*d.RevaluedBase!.Value):null,gainLoss=rates[g.Key].HasValue?(decimal?)g.Sum(d=>d.GainLoss!.Value):null,documents=g.ToList()}).ToList();
  var posted=new List<object>();decimal gain=0,loss=0;
  foreach(var j in (await unit.Journals(ct)).Where(j=>j.PostingDate>=from&&j.PostingDate<=to&&(currency=="ALL"||j.Currency==currency)).OrderBy(j=>j.PostingDate).ThenBy(j=>j.PostedAtUtc)){
   var lines=(await currencies.BaseLines(j.Id,ct)).Where(l=>l.AccountCode is "4200-FX" or "5500").ToList();
   if(lines.Count==0)continue;
   var g=lines.Where(l=>l.AccountCode=="4200-FX").Sum(l=>l.Credit-l.Debit);var l=lines.Where(l=>l.AccountCode=="5500").Sum(l=>l.Debit-l.Credit);
   gain+=g;loss+=l;posted.Add(new{id=j.Id,date=j.PostingDate,reference=j.Reference,description=j.Description,transactionCurrency=j.Currency,isReversal=j.ReversesId.HasValue,gain=g,loss=l,net=g-l});
  }
  return new{from,to,baseCurrency=baseCode,currency,rows,posted,warnings,totals=new{carryingBase=rows.Sum(r=>r.carryingBase),revaluedBase=warnings.Count==0?(decimal?)rows.Sum(r=>r.revaluedBase!.Value):null,unrealizedGainLoss=warnings.Count==0?(decimal?)rows.Sum(r=>r.gainLoss!.Value):null,postedGain=gain,postedLoss=loss,postedNet=gain-loss}};
 }
}
