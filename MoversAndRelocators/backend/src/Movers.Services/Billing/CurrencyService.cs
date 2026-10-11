using System.Text.Json;
using Movers.Domain.Operations;
using Movers.Services.Billing;
using Movers.Services.Operations;
using Movers.Services.Tenancy;
namespace Movers.Services.Currencies;

public record CurrencyDefinition(string Code,string Name,int DecimalPlaces=2,bool IsActive=true);
public record ExchangeRate(string Currency,DateOnly Date,decimal UsdPerUnit,DateOnly? EndDate = null,string BaseCurrency = "USD",bool IsSample = false);
public record ExchangeRatePeriod(DateOnly StartDate,DateOnly EndDate,IReadOnlyList<PeriodCurrencyRate> Rates);
public record PeriodCurrencyRate(string Currency,decimal UsdPerUnit);
public record CurrencySettings(string DefaultCurrency="AED",string? BaseCurrency=null);
public record FxSnapshot(string Currency,decimal UsdPerUnit,DateOnly Date,int DecimalPlaces,string BaseCurrency="USD",int BaseDecimalPlaces=2);
public record ReportCurrency(string Code,string Mode,FxSnapshot? Translation){public bool Converted=>Mode!="TRANSACTION";}
public record BaseJournal(Guid JournalId,IReadOnlyList<JournalLineInput> Lines,string BaseCurrency="USD");
public sealed class CurrencyService(IBillingRepository repository,IOperationsRepository unit,ITenantContext tenant) {
 public static decimal Round(decimal n,int digits=2)=>decimal.Round(n,digits,MidpointRounding.AwayFromZero);
 public static string Code(string? c) {c=c?.Trim().ToUpperInvariant();return c is {Length:3}&&c.All(x=>x is >= 'A' and <= 'Z')?c:throw new InvalidOperationException("Select a three-letter currency code.");}
 private static T Read<T>(BillingRecord r)=>JsonSerializer.Deserialize<T>(r.Payload)!;
 private async Task Put(string kind,string key,object value,CancellationToken ct) {
  var r=(await repository.List(kind,ct)).SingleOrDefault(x=>x.Number==key);
  if(r is null){r=new BillingRecord(tenant.TenantId){Kind=kind,Number=key,RequestId=Guid.NewGuid()};unit.Add(r);}
  r.Payload=JsonSerializer.Serialize(value);r.Version=Guid.NewGuid();
 }
 public async Task<IReadOnlyList<CurrencyDefinition>> Currencies(CancellationToken ct) {
  CurrencyDefinition[] defaults=[new("USD","US dollar"),new("AED","UAE dirham"),new("INR","Indian rupee"),new("EUR","Euro"),new("GBP","Pound sterling"),new("SAR","Saudi riyal"),new("QAR","Qatari riyal"),new("OMR","Omani rial",3),new("BHD","Bahraini dinar",3),new("KWD","Kuwaiti dinar",3),new("JPY","Japanese yen",0),new("KRW","South Korean won",0),new("CAD","Canadian dollar"),new("AUD","Australian dollar"),new("SGD","Singapore dollar"),new("CHF","Swiss franc"),new("CNY","Chinese yuan")];
  var all=defaults.ToDictionary(x=>x.Code);
  foreach(var r in await repository.List("CURRENCY",ct)){var c=Read<CurrencyDefinition>(r);all[c.Code]=c;}
  return all.Values.OrderBy(x=>x.Code).ToList();
 }
 public async Task<CurrencySettings> Settings(CancellationToken ct) {
  var value=(await repository.List("FXSETTINGS",ct)).Select(Read<CurrencySettings>).FirstOrDefault()??new();
  return value with{BaseCurrency=value.BaseCurrency??"USD"};
 }
 public async Task<bool> BaseLocked(CancellationToken ct) {
  foreach(var kind in new[]{"FXSNAPSHOT","FXJOURNAL","CHARGE","CASH","DOCUMENT","VOUCHER","CASHPOST"})
   if((await repository.List(kind,ct)).Count>0)return true;
  return (await unit.Journals(ct)).Count>0;
 }
 public static decimal ToBase(decimal amount,FxSnapshot fx)=>Round(amount*fx.UsdPerUnit,fx.BaseDecimalPlaces);
 public async Task<object> Choices(CancellationToken ct)=>new{baseCurrency=(await Settings(ct)).BaseCurrency,baseCurrencyLocked=await BaseLocked(ct),settings=await Settings(ct),currencies=await Currencies(ct),rates=await Rates(ct)};
 public async Task<IReadOnlyList<ExchangeRate>> Rates(CancellationToken ct) {
  var settings=await Settings(ct);
  return (await repository.List("FXRATE",ct)).Select(Read<ExchangeRate>).Where(x=>x.BaseCurrency==settings.BaseCurrency).OrderByDescending(x=>x.Date).ThenBy(x=>x.Currency).ToList();
 }
 public async Task<CurrencyDefinition> Require(string currency,CancellationToken ct)=>(await Currencies(ct)).SingleOrDefault(x=>x.Code==Code(currency)&&x.IsActive)??throw new InvalidOperationException("Select an active currency from Currency master.");
 public Task<CurrencyDefinition> SaveCurrency(CurrencyDefinition c,CancellationToken ct)=>unit.Transaction(async()=>{
  c=c with{Code=Code(c.Code),Name=c.Name?.Trim()??""};
  if(c.Name.Length is <1 or >100||c.DecimalPlaces is <0 or >4)throw new InvalidOperationException("Enter a currency name and 0 to 4 decimal places.");
  if(c.Code==(await Settings(ct)).BaseCurrency&&!c.IsActive)throw new InvalidOperationException("The system accounting currency must stay active.");
  var old=(await Currencies(ct)).SingleOrDefault(x=>x.Code==c.Code);
  if(old is not null&&old.DecimalPlaces!=c.DecimalPlaces)throw new InvalidOperationException("Decimal places cannot change for an existing currency.");
  if(!c.IsActive&&(await Settings(ct)).DefaultCurrency==c.Code)throw new InvalidOperationException("Change the location default before deactivating this currency.");
  await Put("CURRENCY",c.Code,c,ct);await unit.Save(ct);return c;
 },ct);
 public Task<CurrencySettings> SaveSettings(CurrencySettings c,CancellationToken ct)=>unit.Transaction(async()=>{
    var old=await Settings(ct);
  var baseCode=(await Require(c.BaseCurrency??old.BaseCurrency!,ct)).Code;
  if(baseCode!=old.BaseCurrency&&await BaseLocked(ct))throw new InvalidOperationException("The accounting currency cannot change after financial records exist. A controlled accounting migration is required to preserve historical values.");
  c=c with{DefaultCurrency=(await Require(c.DefaultCurrency,ct)).Code,BaseCurrency=baseCode};
  await Put("FXSETTINGS","LOCATION",c,ct);await unit.Save(ct);return c;
 },ct);
 public Task<ExchangeRate> SaveRate(ExchangeRate c,CancellationToken ct)=>unit.Transaction(async()=>{
  c=c with{Currency=(await Require(c.Currency,ct)).Code,BaseCurrency=(await Settings(ct)).BaseCurrency!};ValidateRate(c.Currency,c.UsdPerUnit,c.BaseCurrency);
  ValidatePeriod(c.Date,c.EndDate);
  CheckOverlap(c,await Rates(ct));
  await Put("FXRATE",RateKey(c),c,ct);await unit.Save(ct);return c;
 },ct);
 private static void ValidatePeriod(DateOnly start,DateOnly? end) {
  if(start==default||end.HasValue&&end<start)throw new InvalidOperationException("Select a valid start date and an end date on or after it.");
 }
 private static void CheckOverlap(ExchangeRate candidate,IReadOnlyList<ExchangeRate> rates) {
  foreach(var old in rates.Where(x=>x.Currency==candidate.Currency&&x.Date!=candidate.Date)) {
   // Legacy open-ended rates can be superseded by a later period. Their later start still cannot interrupt a new period.
   if(old.Date>candidate.Date&&old.Date<=(candidate.EndDate??DateOnly.MaxValue)
      ||old.EndDate.HasValue&&old.Date<candidate.Date&&old.EndDate>=candidate.Date)
    throw new InvalidOperationException($"The {candidate.Currency} period overlaps an existing rate. Choose a non-overlapping period.");
  }
 }
 public Task<IReadOnlyList<ExchangeRate>> SavePeriod(ExchangeRatePeriod input,CancellationToken ct)=>unit.Transaction(async()=>{
  ValidatePeriod(input.StartDate,input.EndDate);
  var active=(await Currencies(ct)).Where(x=>x.IsActive).Select(x=>x.Code).ToHashSet();
  if(input.Rates is null||input.Rates.Count!=active.Count)throw new InvalidOperationException("Enter a rate for every active currency, including the system currency.");
  var codes=input.Rates.Select(x=>Code(x.Currency)).ToArray();
  if(codes.Distinct().Count()!=codes.Length||!active.SetEquals(codes))throw new InvalidOperationException("Currency list changed or contains duplicates. Refresh and enter every active currency.");
  var existing=await Rates(ct);
  var baseCode=(await Settings(ct)).BaseCurrency!;
  var rows=input.Rates.Select(x=>new ExchangeRate(Code(x.Currency),input.StartDate,x.UsdPerUnit,input.EndDate,baseCode)).ToList();
  foreach(var rate in rows){ValidateRate(rate.Currency,rate.UsdPerUnit,baseCode);CheckOverlap(rate,existing);}
  foreach(var rate in rows)await Put("FXRATE",RateKey(rate),rate,ct);
  await unit.Save(ct);return (IReadOnlyList<ExchangeRate>)rows;
 },ct);
 public Task<IReadOnlyList<ExchangeRate>> SeedSampleRates(DateOnly start,CancellationToken ct)=>unit.Transaction(async()=>{
  // Illustrative testing values only; never replace an existing currency schedule.
  var sample=new Dictionary<string,decimal>{{"USD",1m},{"AED",.25m},{"INR",.012m},{"EUR",1.1m},{"GBP",1.3m},{"SAR",.26m},{"QAR",.27m},{"OMR",2.6m},{"BHD",2.65m},{"KWD",3.25m},{"JPY",.007m},{"KRW",.00075m},{"CAD",.74m},{"AUD",.66m},{"SGD",.75m},{"CHF",1.12m},{"CNY",.14m}};
  var settings=await Settings(ct);var baseCode=settings.BaseCurrency!;
  if(!sample.TryGetValue(baseCode,out var baseValue))throw new InvalidOperationException("No sample value for the configured accounting currency.");
  var existing=await Rates(ct);var added=new List<ExchangeRate>();
  foreach(var currency in (await Currencies(ct)).Where(x=>x.IsActive)){
   if(existing.Any(x=>x.Currency==currency.Code))continue;
   if(!sample.TryGetValue(currency.Code,out var value))continue;
   var rate=new ExchangeRate(currency.Code,start,Round(value/baseValue,12),start.AddDays(364),baseCode,true);
   ValidateRate(rate.Currency,rate.UsdPerUnit,baseCode);
   await Put("FXRATE",RateKey(rate),rate,ct);added.Add(rate);
  }
  await unit.Save(ct);return (IReadOnlyList<ExchangeRate>)added;
 },ct);
 private static string RateKey(ExchangeRate r)=>(r.BaseCurrency=="USD"?"":r.BaseCurrency+"-")+r.Currency+"-"+r.Date.ToString("yyyyMMdd");
 public static void ValidateRate(string currency,decimal rate,string baseCurrency="USD") {
  if(rate<=0||rate>1000000||Round(rate,12)!=rate)throw new InvalidOperationException("Exchange rate must be positive, at most 1,000,000 and have at most 12 decimal places.");
  if(currency==baseCurrency&&rate!=1)throw new InvalidOperationException("The system currency exchange rate must be 1.");
 }
 public async Task<FxSnapshot> Resolve(string currency,DateOnly date,decimal? overrideRate,CancellationToken ct) {
  var c=await Require(currency,ct);var baseCurrency=await Require((await Settings(ct)).BaseCurrency!,ct);
  var effective=(await Rates(ct)).FirstOrDefault(x=>x.Currency==c.Code&&x.Date<=date);
  var rate=overrideRate??(c.Code==baseCurrency.Code?(decimal?)1:effective is not null&&(!effective.EndDate.HasValue||effective.EndDate>=date)?effective.UsdPerUnit:null)
    ??throw new InvalidOperationException($"No {c.Code} exchange rate valid on {date:yyyy-MM-dd}. Add a rate or enter a transaction rate.");
  ValidateRate(c.Code,rate,baseCurrency.Code);return new(c.Code,rate,date,c.DecimalPlaces,baseCurrency.Code,baseCurrency.DecimalPlaces);
 }
 public static void Amount(decimal amount,FxSnapshot fx,bool allowZero=false) {
  if(amount<(allowZero?0:0.00000001m)||amount>1000000000||Round(amount,fx.DecimalPlaces)!=amount)throw new InvalidOperationException($"{fx.Currency} amounts must be {(allowZero?"non-negative":"positive")}, at most 1,000,000,000, with at most {fx.DecimalPlaces} decimal places.");
 }
 public async Task SaveSnapshot(Guid id,FxSnapshot fx,CancellationToken ct)=>await Put("FXSNAPSHOT",id.ToString("N"),fx,ct);
 public async Task<FxSnapshot?> Snapshot(Guid id,CancellationToken ct)=>(await repository.List("FXSNAPSHOT",ct)).Where(x=>x.Number==id.ToString("N")).Select(Read<FxSnapshot>).SingleOrDefault();
 public async Task SaveBaseJournal(Guid id,IReadOnlyList<JournalLineInput> lines,CancellationToken ct) {
  if(lines.Sum(x=>x.Debit)!=lines.Sum(x=>x.Credit))throw new InvalidOperationException("Unbalanced base-currency posting.");
  await Put("FXJOURNAL",id.ToString("N"),new BaseJournal(id,lines,(await Settings(ct)).BaseCurrency!),ct);
 }
 public async Task<IReadOnlyList<JournalLineInput>> BaseLines(Guid id,CancellationToken ct) {
  var saved=(await repository.List("FXJOURNAL",ct)).Where(x=>x.Number==id.ToString("N")).Select(Read<BaseJournal>).SingleOrDefault();
  if(saved is not null)return saved.Lines;
  var journal=(await unit.Journals(ct)).Single(x=>x.Id==id);
  if(journal.Currency!=(await Settings(ct)).BaseCurrency)throw new InvalidOperationException($"Historical entry {journal.Reference} has no saved base-currency rate. Its original-currency report remains available.");
  return (await unit.JournalLines(ct)).Where(x=>x.JournalId==id).Select(x=>new JournalLineInput(x.AccountCode,x.Debit,x.Credit)).ToList();
 }
 // Report currency: BASE = saved accounting values; DEFAULT = those values translated to the default transaction currency at the report-date rate; otherwise a transaction-currency filter.
 public async Task<ReportCurrency> ReportCurrency(string currency,DateOnly date,CancellationToken ct) {
  var settings=await Settings(ct);
  if(currency=="BASE")return new(settings.BaseCurrency!,"BASE",null);
  if(currency=="DEFAULT"){var fx=await Resolve(settings.DefaultCurrency,date,null,ct);return new(fx.Currency,"DEFAULT",fx.Currency==fx.BaseCurrency?null:fx);}
  return new((await Require(currency,ct)).Code,"TRANSACTION",null);
 }
 public async Task<IReadOnlyList<JournalLineInput>> ReportLines(Guid id,ReportCurrency report,CancellationToken ct) {
  var lines=await BaseLines(id,ct);
  return report.Translation is null?lines:FromBaseLines(lines,report.Translation);
 }
 public static decimal FromBase(decimal amount,FxSnapshot fx)=>Round(amount/fx.UsdPerUnit,fx.DecimalPlaces);
 public static IReadOnlyList<JournalLineInput> FromBaseLines(IReadOnlyList<JournalLineInput> lines,FxSnapshot fx) {
  var converted=lines.Select(x=>new JournalLineInput(x.AccountCode,FromBase(x.Debit,fx),FromBase(x.Credit,fx))).ToList();
  var difference=converted.Sum(x=>x.Debit-x.Credit);
  if(difference!=0)converted.Add(new("5500",difference<0?-difference:0,difference>0?difference:0));
  return converted;
 }
 public static IReadOnlyList<JournalLineInput> ConvertLines(IReadOnlyList<JournalLineInput> lines,FxSnapshot fx) {
  var converted=lines.Select(x=>new JournalLineInput(x.AccountCode,ToBase(x.Debit,fx),ToBase(x.Credit,fx))).ToList();
  var difference=converted.Sum(x=>x.Debit-x.Credit);
  if(difference!=0)converted.Add(new("5500",difference<0?-difference:0,difference>0?difference:0));
  return converted;
 }
}





