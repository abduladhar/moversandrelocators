using Movers.Services.Currencies;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Movers.Domain.Operations;
using Movers.Services.Masters;
using Movers.Services.Numbering;
using Movers.Services.Operations;
using Movers.Services.Security;
using Movers.Services.Tenancy;
namespace Movers.Services.Billing;
public sealed partial class BillingService(IBillingRepository repository, IOperationsRepository unit, BusinessMasterService masters, IRecordNumbers numbers, ITenantContext tenant, IUserContext user, TimeProvider clock, Movers.Services.Quotations.IQuotationRepository quotationMasters, CurrencyService currencies) {
 public static T Read<T>(BillingRecord r) => JsonSerializer.Deserialize<T>(r.Payload)!;
 private static BillingView<T> View<T>(BillingRecord r) => new(r.Id,r.Number,r.Version,r.JournalId,Read<T>(r));
 private static string Hash(object value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value))));
 private static void Write(BillingRecord r, object value) { r.Payload=JsonSerializer.Serialize(value); r.Version=Guid.NewGuid(); }
 private BillingRecord Add(string kind,string number,Guid requestId,object input,object value) {
  var r=new BillingRecord(tenant.TenantId){Kind=kind,Number=number,RequestId=requestId,RequestHash=Hash(input),Payload=JsonSerializer.Serialize(value)}; unit.Add(r); return r;
 }
 private async Task<BillingRecord?> Retry(string kind,Guid requestId,object input,CancellationToken ct) {
  if(requestId==Guid.Empty) throw new InvalidOperationException("Request ID is required.");
  var r=await repository.Request(kind,requestId,ct);
  if(r is not null && r.RequestHash!=Hash(input)) throw new OperationConflictException("This request was already used with different details.");
  return r;
 }
 private async Task<BillingRecord> Require(Guid id,string kind,CancellationToken ct) {
  var r=await repository.Get(id,ct); return r?.Kind==kind?r:throw new KeyNotFoundException();
 }
 private static void Check(BillingRecord r,Guid version) { if(r.Version!=version) throw new OperationConflictException("This record changed. Refresh and retry."); }
 private static string Text(string? value,int max,string label) => !string.IsNullOrWhiteSpace(value)&&value.Trim().Length<=max?value.Trim():throw new InvalidOperationException(label+" is required (maximum "+max+" characters).");
 private static string Currency(string value) { var c=Text(value,3,"Currency").ToUpperInvariant();return c.Length==3&&c.All(x=>x is >= 'A' and <= 'Z')?c:throw new InvalidOperationException("Use a three-letter currency."); }
 private static void Money(decimal value) { if(value<=0||value>1000000000||decimal.Round(value,4)!=value)throw new InvalidOperationException("Amounts must be positive, at most 1,000,000,000 and have up to four decimals."); }
 private void Date(DateOnly value) { if(value==default||value>DateOnly.FromDateTime(clock.GetUtcNow().AddHours(14).DateTime))throw new InvalidOperationException("Choose a valid posting date no later than today."); }
 public async Task<IReadOnlyList<Account>> Accounts(CancellationToken ct) {
  var all=OperationsService.Accounts.Select(x=>new Account(x.Code,x.Name,x.Kind,true,x.Code=="1000")).ToDictionary(x=>x.Code);
  foreach(var r in await repository.List("ACCOUNT",ct)) { var a=Read<Account>(r); all[a.Code]=a; }
  return all.Values.OrderBy(x=>x.Code).ToList();
 }
 public Task<Account> SaveAccount(Account c,CancellationToken ct) => unit.Transaction(async()=>{
  var code=Text(c.Code,40,"Account code").ToUpperInvariant();
  if(!code.All(x=>char.IsAsciiLetterOrDigit(x)||x=='-'))throw new InvalidOperationException("Use letters, digits or hyphens in account codes.");
  if(OperationsService.Accounts.Any(x=>x.Code==code))throw new InvalidOperationException("Built-in control accounts cannot be changed.");
  if(!new[]{"Asset","Liability","Equity","Revenue","Expense"}.Contains(c.Type)||c.IsCashBank&&c.Type!="Asset")throw new InvalidOperationException("Choose a valid account type; cash/bank accounts must be assets.");
  var a=c with{Code=code,Name=Text(c.Name,120,"Account name")};
  var existing=(await repository.List("ACCOUNT",ct)).SingleOrDefault(x=>x.Number==code);
  if(existing is null)Add("ACCOUNT",code,Guid.NewGuid(),a,a);
  else {var old=Read<Account>(existing); if(old.Type!=a.Type||old.IsCashBank!=a.IsCashBank)throw new InvalidOperationException("An account's type cannot be changed. Create a new account instead.");Write(existing,a);}
  await unit.Save(ct);return a;
 },ct);
 public Task<IReadOnlyList<Source>> Sources(CancellationToken ct)=>repository.Sources(ct);
 public async Task<object> Choices(CancellationToken ct)=>new{chargeMasters=await MappedCharges(ct),accounts=await Accounts(ct),sources=await Sources(ct),customers=await masters.List("customer",ct),vendors=await masters.List("vendor",ct)};
 public async Task<IReadOnlyList<BillingView<Charge>>> Charges(CancellationToken ct)=>(await repository.List("CHARGE",ct)).Select(View<Charge>).ToList();
 public async Task<IReadOnlyList<BillingView<Voucher>>> Vouchers(CancellationToken ct)=>(await repository.List("VOUCHER",ct)).Select(View<Voucher>).ToList();
 public async Task<IReadOnlyList<DocumentView>> Documents(CancellationToken ct) {
  var vouchers=await Vouchers(ct);var memos=await Memos(ct);return (await repository.List("DOCUMENT",ct)).Select(r=>{
   var d=Read<Document>(r);var paid=vouchers.Where(v=>v.JournalId.HasValue&&!v.Details.Voided).SelectMany(v=>v.Details.Allocations).Where(a=>a.DocumentId==r.Id).Sum(a=>a.Amount);
   return new DocumentView(r.Id,r.Number,r.Version,r.JournalId,d,paid,d.Voided?0:d.Amount-paid+memos.Where(m=>m.JournalId.HasValue&&!m.Details.Voided&&m.Details.DocumentId==r.Id).Sum(m=>(m.Details.Type=="CREDIT_MEMO"?-1:1)*m.Details.Amount));
  }).ToList();
 }
 public async Task<BillingView<Charge>> Capture(ChargeInput c,CancellationToken ct) {
  var prior=await Retry("CHARGE",c.RequestId,c,ct);if(prior is not null)return View<Charge>(prior);
  var number=await numbers.Next("CHG",ct);
  return await unit.Transaction(async()=>{
   var retry=await Retry("CHARGE",c.RequestId,c,ct);if(retry is not null)return View<Charge>(retry);
   var source=(await Sources(ct)).SingleOrDefault(x=>x.Kind==c.SourceKind&&x.Id==c.SourceId)??throw new InvalidOperationException("Select a pickup, job or warehouse receipt in this workspace.");
   if(c.Direction is not ("INCOME" or "EXPENSE"))throw new InvalidOperationException("Choose income or expense.");
   var party=(await masters.List(c.Direction=="INCOME"?"customer":"vendor",ct)).SingleOrDefault(x=>x.Code==c.PartyCode&&x.IsActive)??throw new InvalidOperationException("Select an active customer or vendor.");
   var account=(await Accounts(ct)).SingleOrDefault(x=>x.Code==c.AccountCode&&x.IsActive);
   if(account?.Type!=(c.Direction=="INCOME"?"Revenue":"Expense"))throw new InvalidOperationException("Map income to a revenue account and expenses to an expense account.");
   var fx=await currencies.Resolve(c.Currency,DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime),c.ExchangeRate,ct); CurrencyService.Amount(c.Amount,fx);
   var row=Add("CHARGE",number,c.RequestId,c,new Charge(c.SourceKind,c.SourceId,source.Label,c.Direction,party.Code,party.Name,Text(c.Description,500,"Description"),c.AccountCode,Currency(c.Currency),c.Amount,Fx:fx,BaseAmount:CurrencyService.ToBase(c.Amount,fx)));
   await unit.Save(ct);return View<Charge>(row);
  },ct);
 }
 public Task<bool> CancelCharge(Guid id,Selection c,CancellationToken ct)=>unit.Transaction(async()=>{
  var r=await Require(id,"CHARGE",ct);Check(r,c.Version);var d=Read<Charge>(r);
  if(d.DocumentId.HasValue)throw new InvalidOperationException("Void the unpaid document before cancelling its charge.");
  Write(r,d with{Cancelled=true});await unit.Save(ct);return true;
 },ct);
 public async Task<BillingView<Document>> Issue(IssueInput c,CancellationToken ct) {
  var prior=await Retry("DOCUMENT",c.RequestId,c,ct);if(prior is not null)return View<Document>(prior);
  if(c.Charges is null||c.Charges.Count is <1 or >100||c.Charges.Select(x=>x.Id).Distinct().Count()!=c.Charges.Count)throw new InvalidOperationException("Select 1 to 100 different charges.");
  var first=Read<Charge>(await Require(c.Charges[0].Id,"CHARGE",ct));
  var number=await numbers.Next(first.Direction=="INCOME"?"INV":"BILL",ct);
  return await unit.Transaction(async()=>{
   var retry=await Retry("DOCUMENT",c.RequestId,c,ct);if(retry is not null)return View<Document>(retry);
   Date(c.Date);if(c.DueDate<c.Date)throw new InvalidOperationException("Due date cannot precede the document date.");
   if(c.Reference?.Length>120||c.Notes?.Length>2000)throw new InvalidOperationException("Reference or notes exceed the allowed length.");
   var rows=new List<BillingRecord>();var lines=new List<DocumentLine>();var accounts=await Accounts(ct);
   foreach(var selected in c.Charges) {
    var r=await Require(selected.Id,"CHARGE",ct);Check(r,selected.Version);var d=Read<Charge>(r);
    if(d.Cancelled||d.DocumentId.HasValue)throw new OperationConflictException("A selected charge is cancelled or already invoiced/billed.");
    if(d.Direction!=first.Direction||d.PartyCode!=first.PartyCode||d.Currency!=first.Currency)throw new InvalidOperationException("Select charges for the same customer/vendor, direction and currency.");
    if(!accounts.Any(a=>a.Code==d.AccountCode&&a.IsActive&&a.Type==(d.Direction=="INCOME"?"Revenue":"Expense")))throw new InvalidOperationException("A mapped account is inactive.");
    rows.Add(r);lines.Add(new(r.Id,d.SourceKind,d.SourceId,d.SourceLabel,d.Description,d.AccountCode,d.Amount,d.Quantity,d.UnitPrice));
   }
   var party=(await masters.List(first.Direction=="INCOME"?"customer":"vendor",ct)).SingleOrDefault(x=>x.Code==first.PartyCode&&x.IsActive)??throw new InvalidOperationException("The customer/vendor is inactive.");
   var chargeValues=rows.Select(Read<Charge>).ToList();
   var baseTotal=chargeValues.All(x=>x.BaseAmount.HasValue)?chargeValues.Sum(x=>x.BaseAmount!.Value):(decimal?)null;
   if(baseTotal is null)throw new InvalidOperationException("These historical charges have no exchange-rate snapshot. Cancel and recapture them with an exchange rate before issuing.");
   var doc=new Document(first.Direction=="INCOME"?"INVOICE":"BILL",party.Code,party.Name,party.Address,first.Currency,c.Date,c.DueDate,c.Reference,c.Notes,lines.Sum(x=>x.Amount),lines,BaseAmount:baseTotal);
   Money(doc.Amount);
   var row=Add("DOCUMENT",number,c.RequestId,c,doc);
   foreach(var r in rows)Write(r,Read<Charge>(r) with{DocumentId=row.Id});
   await unit.Save(ct);return View<Document>(row);
  },ct);
 }
 public async Task<IReadOnlyList<BillingView<Voucher>>> Pay(PaymentInput c,CancellationToken ct) {
  var prior=await Retry("BATCH",c.RequestId,c,ct);if(prior is not null)return await Batch(prior,ct);
  if(c.Type is not ("RECEIPT" or "PAYMENT")||c.Groups is null||c.Groups.Count is <1 or >50)throw new InvalidOperationException("Choose a payment type and 1 to 50 party groups.");
  if(c.Type=="RECEIPT"&&c.Groups.Count!=1)throw new InvalidOperationException("A receipt must belong to one customer.");
  if(c.Groups.Select(x=>x.PartyCode).Distinct().Count()!=c.Groups.Count)throw new InvalidOperationException("Use one voucher group per vendor.");
  var numbersReserved=new List<string>();foreach(var group in c.Groups)numbersReserved.Add(await numbers.Next(c.Type=="RECEIPT"?"RCPT":"PAY",ct));
  return await unit.Transaction(async()=>{
   var retry=await Retry("BATCH",c.RequestId,c,ct);if(retry is not null)return await Batch(retry,ct);
   Date(c.Date);var currency=Currency(c.Currency);var fx=await currencies.Resolve(currency,c.Date,c.ExchangeRate,ct);if(c.Notes?.Length>2000)throw new InvalidOperationException("Notes must be at most 2000 characters.");
   if(!(await Accounts(ct)).Any(a=>a.Code==c.AccountCode&&a.IsActive&&a.IsCashBank))throw new InvalidOperationException("Select an active cash or bank account.");
   var documents=await Documents(ct);var result=new List<BillingView<Voucher>>();var used=new HashSet<Guid>();
   for(var i=0;i<c.Groups.Count;i++) {
    var g=c.Groups[i];Text(g.Reference,120,"Voucher reference");
    if(g.Allocations is null||g.Allocations.Count is <1 or >100)throw new InvalidOperationException("Allocate each voucher to 1 to 100 invoices or bills.");
    string? name=null;
    foreach(var a in g.Allocations) {
     Money(a.Amount);if(!used.Add(a.DocumentId))throw new InvalidOperationException("Do not allocate the same document twice.");
     var r=await Require(a.DocumentId,"DOCUMENT",ct);Check(r,a.Version);
     var d=documents.Single(x=>x.Id==a.DocumentId);
     if(!d.JournalId.HasValue||d.Details.Voided||d.Details.Type!=(c.Type=="RECEIPT"?"INVOICE":"BILL")||d.Details.PartyCode!=g.PartyCode)throw new InvalidOperationException("Each allocation must match the voucher party and type.");
     if(a.Amount>d.Balance)throw new OperationConflictException("Payment exceeds the outstanding balance. Refresh.");
     if(c.Date<d.Details.Date)throw new InvalidOperationException("Payment date cannot precede the invoice or bill date.");
     name=d.Details.PartyName;r.Version=Guid.NewGuid();
    }
    var valued=await ValueAllocations(g.Allocations,documents,fx,ct);
    var total=valued.Sum(a=>a.PaymentAmount!.Value);CurrencyService.Amount(total,fx);
    var v=new Voucher(c.Type,g.PartyCode,name!,currency,c.Date,c.AccountCode,g.Reference.Trim(),c.Notes,total,valued,Fx:fx,BaseAmount:CurrencyService.ToBase(total,fx));
    var row=Add("VOUCHER",numbersReserved[i],Guid.NewGuid(),c,v);
    result.Add(View<Voucher>(row));
   }
   Add("BATCH",c.RequestId.ToString("N"),c.RequestId,c,result.Select(x=>x.Id).ToArray());
   await unit.Save(ct);return (IReadOnlyList<BillingView<Voucher>>)result;
  },ct);
 }
 private async Task<IReadOnlyList<BillingView<Voucher>>> Batch(BillingRecord r,CancellationToken ct) {
  var ids=Read<Guid[]>(r);return (await Vouchers(ct)).Where(x=>ids.Contains(x.Id)).ToList();
 }
 public Task<bool> Void(Guid id,string expectedKind,VoidInput c,CancellationToken ct)=>unit.Transaction(async()=>{
  var r=await Require(id,expectedKind,ct);Check(r,c.Version);Date(c.Date);var reason=Text(c.Reason,500,"Reversal reason");
  if(r.Kind=="DOCUMENT") {
   if(!user.HasPermission(SecurityPermissions.BillingIssue))throw new UnauthorizedAccessException();
   var d=Read<Document>(r);if(d.Voided)throw new InvalidOperationException("Already voided.");
   if((await Documents(ct)).Single(x=>x.Id==id).Paid!=0)throw new InvalidOperationException("Reverse its payment vouchers before voiding this document.");
   if((await Memos(ct)).Any(m=>m.Details.DocumentId==id&&m.JournalId.HasValue&&!m.Details.Voided))throw new InvalidOperationException("Reverse posted memos before voiding the original document.");
   if(c.Date<d.Date)throw new InvalidOperationException("Reversal cannot precede the document.");
   foreach(var l in d.Lines){var charge=await Require(l.ChargeId,"CHARGE",ct);Write(charge,Read<Charge>(charge) with{DocumentId=null});}
   Write(r,d with{Voided=true,VoidReason=reason});
  } else if(r.Kind=="VOUCHER") {
   if(!user.HasPermission(SecurityPermissions.BillingPay))throw new UnauthorizedAccessException();
   var v=Read<Voucher>(r);if(v.Voided)throw new InvalidOperationException("Already reversed.");
   if(c.Date<v.Date)throw new InvalidOperationException("Reversal cannot precede the voucher.");
   foreach(var a in v.Allocations){var doc=await Require(a.DocumentId,"DOCUMENT",ct);doc.Version=Guid.NewGuid();}
   Write(r,v with{Voided=true,VoidReason=reason});
  } else throw new InvalidOperationException("Only invoices, bills and vouchers can be reversed.");
  if(!r.JournalId.HasValue){await unit.Save(ct);return true;}
  var original=(await unit.Journals(ct)).Single(x=>x.Id==r.JournalId);
  var lines=(await unit.JournalLines(ct)).Where(x=>x.JournalId==r.JournalId).Select(x=>new JournalLineInput(x.AccountCode,x.Credit,x.Debit)).ToList();
  var reversal=Post("REV-"+r.Number,original.Currency,c.Date,lines,r.JournalId);
  if(original.Currency==(await currencies.Settings(ct)).BaseCurrency||(await repository.List("FXJOURNAL",ct)).Any(x=>x.Number==original.Id.ToString("N"))) {
   var originalBase=await currencies.BaseLines(original.Id,ct);
   await currencies.SaveBaseJournal(reversal,originalBase.Select(x=>new JournalLineInput(x.AccountCode,x.Credit,x.Debit)).ToList(),ct);
  }
  await unit.Save(ct);return true;
 },ct);
 private Guid Post(string reference,string currency,DateOnly date,IReadOnlyList<JournalLineInput> lines,Guid? reverses=null) {
  if(lines.Sum(x=>x.Debit)!=lines.Sum(x=>x.Credit))throw new InvalidOperationException("Unbalanced posting.");
  var j=new JournalEntry(tenant.TenantId){Reference=reference,Description=reference,Currency=currency,PostingDate=date,ReversesId=reverses,RequestId=Guid.NewGuid(),PostedBy=user.UserId??throw new InvalidOperationException("Sign in."),PostedAtUtc=clock.GetUtcNow()};
  unit.Add(j);foreach(var l in lines)unit.Add(new JournalLine(tenant.TenantId){JournalId=j.Id,AccountCode=l.AccountCode,Debit=l.Debit,Credit=l.Credit});return j.Id;
 }
}












