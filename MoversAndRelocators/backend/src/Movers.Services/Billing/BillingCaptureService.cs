using Movers.Services.Currencies;
using System.Text.Json;
using Movers.Services.Operations;
namespace Movers.Services.Billing;
public sealed partial class BillingService {
 public async Task<Guid> CreateMappedCharge(NewMappedCharge c,CancellationToken ct) {
  c=c with{IncomeAccount=c.IncomeAccount??"4300",ExpenseAccount=c.ExpenseAccount??"5600"};
  var code=await numbers.Next("CHM",ct);
  return await unit.Transaction(async()=>{
   var accounts=await Accounts(ct);
   if(c.DefaultRate<0||c.DefaultRate>1000000000||decimal.Round(c.DefaultRate,4)!=c.DefaultRate)throw new InvalidOperationException("Enter a valid default amount.");
   if(c.IncomeAccount is not null&&!accounts.Any(a=>a.Code==c.IncomeAccount&&a.IsActive&&a.Type=="Revenue")||c.ExpenseAccount is not null&&!accounts.Any(a=>a.Code==c.ExpenseAccount&&a.IsActive&&a.Type=="Expense"))throw new InvalidOperationException("Select valid account mappings.");
   var master=new Movers.Domain.Quotations.ChargeMaster(tenant.TenantId,code,Text(c.Name,160,"Charge name"),Text(c.Unit,30,"Unit"),c.DefaultRate,0,null);
   quotationMasters.AddCharge(master);
   var mapping=new ChargeMapping(master.Id,c.IncomeAccount,c.ExpenseAccount);
   Add("CHARGEMAP",master.Id.ToString("N"),Guid.NewGuid(),mapping,mapping);await unit.Save(ct);return master.Id;
  },ct);
 }
 public async Task<int> EnsureDefaultCharges(CancellationToken ct) {
  var existing=await quotationMasters.ListChargesAsync(ct);
  if(existing.Any(x=>x.IsActive))return 0;
  await CreateMappedCharge(new("General service","service",0,"4300","5600"),ct);
  return 1;
 }
 public async Task<IReadOnlyList<MappedCharge>> MappedCharges(CancellationToken ct) {
  var mappings=(await repository.List("CHARGEMAP",ct)).Select(Read<ChargeMapping>).ToDictionary(x=>x.ChargeMasterId);
  return (await quotationMasters.ListChargesAsync(ct)).Select(x=>{mappings.TryGetValue(x.Id,out var m);return new MappedCharge(x.Id,x.Code,x.Name,x.DefaultRate,x.IsActive,m is null?"4300":m.IncomeAccount,m is null?"5600":m.ExpenseAccount);}).ToList();
 }
 public Task<ChargeMapping> MapCharge(ChargeMapping c,CancellationToken ct)=>unit.Transaction(async()=>{
  if(await quotationMasters.GetChargeAsync(c.ChargeMasterId,false,ct) is null)throw new KeyNotFoundException();
  var accounts=await Accounts(ct);
  if(c.IncomeAccount is not null&&!accounts.Any(a=>a.Code==c.IncomeAccount&&a.Type=="Revenue"&&a.IsActive))throw new InvalidOperationException("Choose an active revenue account.");
  if(c.ExpenseAccount is not null&&!accounts.Any(a=>a.Code==c.ExpenseAccount&&a.Type=="Expense"&&a.IsActive))throw new InvalidOperationException("Choose an active expense account.");
  var key=c.ChargeMasterId.ToString("N");var row=(await repository.List("CHARGEMAP",ct)).SingleOrDefault(x=>x.Number==key);
  if(row is null)Add("CHARGEMAP",key,Guid.NewGuid(),c,c);else Write(row,c);
  await unit.Save(ct);return c;
 },ct);
 public async Task<IReadOnlyList<BillingView<Charge>>> CaptureBatch(ChargeBatch c,CancellationToken ct) {
  async Task<IReadOnlyList<BillingView<Charge>>> Result(Movers.Domain.Operations.BillingRecord r) {var ids=Read<Guid[]>(r);return (await Charges(ct)).Where(x=>ids.Contains(x.Id)).ToList();}
  var prior=await Retry("CHARGEBATCH",c.RequestId,c,ct);if(prior is not null)return await Result(prior);
  if(c.Lines is null||c.Lines.Count is <1 or >100)throw new InvalidOperationException("Add 1 to 100 charge lines.");
  var reserved=new List<string>();foreach(var line in c.Lines)reserved.Add(await numbers.Next("CHG",ct));
  return await unit.Transaction(async()=>{
   var retry=await Retry("CHARGEBATCH",c.RequestId,c,ct);if(retry is not null)return await Result(retry);
   var source=(await Sources(ct)).SingleOrDefault(x=>x.Kind==c.SourceKind&&x.Id==c.SourceId)??throw new InvalidOperationException("Select a valid source.");
   if(c.Direction is not ("INCOME" or "EXPENSE"))throw new InvalidOperationException("Choose customer charges or vendor charges.");
   var party=(await masters.List(c.Direction=="INCOME"?"customer":"vendor",ct)).SingleOrDefault(x=>x.Code==c.PartyCode&&x.IsActive)??throw new InvalidOperationException("Select an active customer/vendor.");
   var fx=await currencies.Resolve(c.Currency,DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime),c.ExchangeRate,ct);
   var mapped=await MappedCharges(ct);var accounts=await Accounts(ct);var result=new List<BillingView<Charge>>();
   for(var i=0;i<c.Lines.Count;i++){
    var l=PriceLine(c.Lines[i],fx);
    var master=mapped.SingleOrDefault(x=>x.Id==l.ChargeMasterId&&x.IsActive)??throw new InvalidOperationException("Select an active charge.");
    var account=c.Direction=="INCOME"?master.IncomeAccount:master.ExpenseAccount;
    if(!accounts.Any(x=>x.Code==account&&x.IsActive&&x.Type==(c.Direction=="INCOME"?"Revenue":"Expense")))throw new InvalidOperationException("Map an active account in the charge master for "+master.Name+".");
    var row=Add("CHARGE",reserved[i],Guid.NewGuid(),l,new Charge(c.SourceKind,c.SourceId,source.Label,c.Direction,party.Code,party.Name,Text(l.Description??master.Name,500,"Description"),account!,Currency(c.Currency),l.Amount,Fx:fx,BaseAmount:CurrencyService.ToBase(l.Amount,fx),Quantity:l.Quantity,UnitPrice:l.UnitPrice));
    result.Add(View<Charge>(row));
   }
   Add("CHARGEBATCH",c.RequestId.ToString("N"),c.RequestId,c,result.Select(x=>x.Id).ToArray());
   await unit.Save(ct);return (IReadOnlyList<BillingView<Charge>>)result;
  },ct);
 }
 public async Task<IReadOnlyList<CashView>> CashQueue(CancellationToken ct) {
  var posted=(await repository.List("CASHPOST",ct)).ToDictionary(x=>Read<CashPosting>(x).CaptureId);
  var list=new List<CashView>();
  void Append(Guid id,string number,CashData data) {posted.TryGetValue(id,out var p);list.Add(new(id,number,Hash(data),p is null?data:Read<CashPosting>(p).Snapshot,p is not null,p is null?null:Read<CashPosting>(p).Number,p?.JournalId));}
  foreach(var r in await repository.List("CASH",ct))Append(r.Id,r.Number,Read<CashData>(r));
  var pickups=(await unit.Pickups(ct)).ToDictionary(x=>x.Id);
  foreach(var p in await unit.LegacyTransactions(ct)){
   if(!pickups.TryGetValue(p.PickupId,out var pickup))continue;
   var fx=await currencies.Snapshot(p.Id,ct);var currency=fx?.Currency??await unit.QuotationCurrency(pickup.QuotationId,ct)??(await currencies.Settings(ct)).DefaultCurrency;
   Append(p.Id,p.TransactionNumber,new("PICKUP",p.PickupId,pickup.PickupNumber,p.Type=="INCOME"?"RECEIPT":"EXPENSE_PAID",null,pickup.CustomerName,p.Amount,currency,DateOnly.FromDateTime(p.CreatedAtUtc.UtcDateTime),p.TransactionNumber,null,p.Category+" · "+p.Notes,Fx:fx,BaseAmount:fx is null?null:CurrencyService.ToBase(p.Amount,fx)));
  }
  // Packing job income/expense: same flow as pickup transactions, source PACKING.
  var packingJobs=(await unit.PackingJobs(ct)).ToDictionary(x=>x.Id);
  foreach(var p in await unit.PackingTransactions(ct)){
   if(!packingJobs.TryGetValue(p.PackingJobId,out var job))continue;
   var fx=await currencies.Snapshot(p.Id,ct);var currency=fx?.Currency??(await currencies.Settings(ct)).DefaultCurrency;
   Append(p.Id,p.TransactionNumber,new("PACKING",p.PackingJobId,job.JobNumber+" · "+job.CustomerName,p.Type=="INCOME"?"RECEIPT":"EXPENSE_PAID",null,job.CustomerName,p.Amount,currency,DateOnly.FromDateTime(p.CreatedAtUtc.UtcDateTime),p.TransactionNumber,null,p.Category+" · "+p.Notes,Fx:fx,BaseAmount:fx is null?null:CurrencyService.ToBase(p.Amount,fx)));
  }
  // Delivery money: collections from a customer on the run, and expenses paid on the road (source DELIVERY).
  var deliveries=(await unit.DeliveryJobs(ct)).ToDictionary(x=>x.Id);var deliveryCustomers=await unit.DeliveryNoteCustomers(ct);
  foreach(var p in await unit.DeliveryTransactions(ct)){
   if(!deliveries.TryGetValue(p.DeliveryJobId,out var run))continue;
   var fx=await currencies.Snapshot(p.Id,ct);var currency=fx?.Currency??(await currencies.Settings(ct)).DefaultCurrency;
   var customer=p.DeliveryNoteId is { } noteId?deliveryCustomers.GetValueOrDefault(noteId)??"":"";
   Append(p.Id,p.TransactionNumber,new("DELIVERY",p.DeliveryJobId,run.DeliveryNumber+(customer==""?"":" · "+customer),p.Type=="INCOME"?"RECEIPT":"EXPENSE_PAID",null,customer,p.Amount,currency,DateOnly.FromDateTime(p.CreatedAtUtc.UtcDateTime),p.TransactionNumber,null,p.Category+" · "+p.Notes,Fx:fx,BaseAmount:fx is null?null:CurrencyService.ToBase(p.Amount,fx)));
  }
  foreach(var p in await unit.CrewExpenses(ct)){
   if(!pickups.TryGetValue(p.PickupId,out var pickup))continue;
   var fx=await currencies.Snapshot(p.Id,ct);
   Append(p.Id,"Expense #"+p.SerialNo,new("PICKUP",p.PickupId,pickup.PickupNumber,"EXPENSE_PAID",null,"",p.Amount,p.Currency,DateOnly.FromDateTime(p.IncurredAtUtc.UtcDateTime),"Expense #"+p.SerialNo,null,p.Category+" · "+p.Notes,Fx:fx,BaseAmount:fx is null?null:CurrencyService.ToBase(p.Amount,fx)));
  }
  return list;
 }
 public async Task<BillingView<CashData>> CaptureCash(CashCapture c,CancellationToken ct) {
  var prior=await Retry("CASH",c.RequestId,c,ct);if(prior is not null)return View<CashData>(prior);
  var number=await numbers.Next(c.Type=="RECEIPT"?"RCV":"EPD",ct);
  return await unit.Transaction(async()=>{
   var retry=await Retry("CASH",c.RequestId,c,ct);if(retry is not null)return View<CashData>(retry);
   if(c.Type is not ("RECEIPT" or "EXPENSE_PAID"))throw new InvalidOperationException("Choose customer receipt or expense paid.");
   Date(c.Date);var fx=await currencies.Resolve(c.Currency,c.Date,c.ExchangeRate,ct);CurrencyService.Amount(c.Amount,fx);
   var source=(await Sources(ct)).SingleOrDefault(x=>x.Kind==c.SourceKind&&x.Id==c.SourceId)??throw new InvalidOperationException("Select a source record.");
   var party=(await masters.List(c.Type=="RECEIPT"?"customer":"vendor",ct)).SingleOrDefault(x=>x.Code==c.PartyCode&&x.IsActive)??throw new InvalidOperationException("Select an active customer/vendor.");
   if(c.Type=="EXPENSE_PAID"&&!(await MappedCharges(ct)).Any(x=>x.Id==c.ChargeMasterId&&x.IsActive&&x.ExpenseAccount is not null))throw new InvalidOperationException("Select a charge with an expense account mapping.");
   if(c.Notes?.Length>2000)throw new InvalidOperationException("Keep notes within 2000 characters.");
   var r=Add("CASH",number,c.RequestId,c,new CashData(c.SourceKind,c.SourceId,source.Label,c.Type,party.Code,party.Name,c.Amount,Currency(c.Currency),c.Date,Text(c.Reference,120,"Reference"),c.ChargeMasterId,c.Notes,Fx:fx,BaseAmount:CurrencyService.ToBase(c.Amount,fx)));
   await unit.Save(ct);return View<CashData>(r);
  },ct);
 }
 public async Task<bool> PostCash(Guid id,CashPostInput c,CancellationToken ct) {
  var prior=await Retry("CASHPOST",c.RequestId,c,ct);
  if(prior is not null){if(Read<CashPosting>(prior).CaptureId!=id)throw new OperationConflictException("Request belongs to another capture.");return true;}
  var number=await numbers.Next("CPOST",ct);
  return await unit.Transaction(async()=>{
   var retry=await Retry("CASHPOST",c.RequestId,c,ct);if(retry is not null){if(Read<CashPosting>(retry).CaptureId!=id)throw new OperationConflictException("Request belongs to another capture.");return true;}
   var capture=(await CashQueue(ct)).SingleOrDefault(x=>x.Id==id)??throw new KeyNotFoundException();
   if(capture.Posted||capture.Version!=c.ExpectedVersion)throw new OperationConflictException("Already posted or changed. Refresh the posting queue.");
   var d=capture.Details;
   var fx=d.Fx??await currencies.Resolve(d.Currency,d.Date,c.ExchangeRate,ct);
   if(d.Fx is not null&&c.ExchangeRate.HasValue&&c.ExchangeRate!=d.Fx.UsdPerUnit)throw new InvalidOperationException("Use the saved exchange rate for this capture.");
   d=d with{Fx=fx,BaseAmount=d.BaseAmount??CurrencyService.ToBase(d.Amount,fx)};
   Date(c.Date);if(c.Date<d.Date)throw new InvalidOperationException("Posting cannot precede the receipt/expense date.");
   var account=(await Accounts(ct)).SingleOrDefault(x=>x.Code==c.AccountCode&&x.IsActive&&x.IsCashBank)??throw new InvalidOperationException("Select an active cash/bank account.");
   var party=(await masters.List(d.Type=="RECEIPT"?"customer":"vendor",ct)).SingleOrDefault(x=>x.Code==c.PartyCode&&x.IsActive)??throw new InvalidOperationException("Select the customer/vendor for this capture.");
   if(d.PartyCode is not null&&d.PartyCode!=party.Code)throw new InvalidOperationException("The party must match the captured payment.");
   var allocations=c.Allocations??[];var receipt=d.Type=="RECEIPT";string counter;
   if(allocations.Count>0) {
    if(allocations.Count>100||allocations.Select(a=>a.DocumentId).Distinct().Count()!=allocations.Count||allocations.Sum(a=>a.PaymentAmount??a.Amount)!=d.Amount)throw new InvalidOperationException("Allocate the exact captured amount across different documents.");
    var documents=await Documents(ct);
    foreach(var a in allocations) {
     Money(a.Amount);var row=await Require(a.DocumentId,"DOCUMENT",ct);Check(row,a.Version);
     var doc=documents.Single(x=>x.Id==a.DocumentId);
     if(!doc.JournalId.HasValue||doc.Details.Voided||doc.Details.PartyCode!=party.Code||doc.Details.Type!=(receipt?"INVOICE":"BILL")||doc.Balance<a.Amount||doc.Details.Date>c.Date)throw new InvalidOperationException("Allocation does not match the party, currency, date or outstanding amount.");
     row.Version=Guid.NewGuid();
    }
    allocations=await ValueAllocations(allocations,documents,fx,ct);
    counter=receipt?"1100":"2000";
   }else if(receipt)counter="2100"; // Cash collected before invoicing remains a customer advance.
   else {
    var m=(await MappedCharges(ct)).SingleOrDefault(x=>x.Id==(d.ChargeMasterId??c.ChargeMasterId)&&x.IsActive);
    counter=m?.ExpenseAccount??throw new InvalidOperationException("Select an expense charge with an account mapping.");
    if(!(await Accounts(ct)).Any(a=>a.Code==counter&&a.Type=="Expense"&&a.IsActive))throw new InvalidOperationException("The mapped expense account is inactive.");
   }
   var journal=Post(number,d.Currency,c.Date,receipt?[new(account.Code,d.Amount,0),new(counter,0,d.Amount)]:[new(counter,d.Amount,0),new(account.Code,0,d.Amount)]);
      if(allocations.Count>0)await SaveSettlementBase(journal,receipt,account.Code,d.BaseAmount!.Value,allocations,await Documents(ct),ct);
   else await currencies.SaveBaseJournal(journal,receipt?[new(account.Code,d.BaseAmount!.Value,0),new(counter,0,d.BaseAmount.Value)]:[new(counter,d.BaseAmount!.Value,0),new(account.Code,0,d.BaseAmount.Value)],ct);
   Guid? voucherId=null;
   if(allocations.Count>0){
    var v=Add("VOUCHER",number,Guid.NewGuid(),c,new Voucher(receipt?"RECEIPT":"PAYMENT",party.Code,party.Name,d.Currency,c.Date,account.Code,d.Reference,d.Notes,d.Amount,allocations,Fx:fx,BaseAmount:d.BaseAmount));v.JournalId=journal;voucherId=v.Id;
   }
   var post=Add("CASHPOST",id.ToString("N"),c.RequestId,c,new CashPosting(id,d with{PartyCode=party.Code,PartyName=party.Name},number,voucherId));post.JournalId=journal;
   await unit.Save(ct);return true;
  },ct);
 }
}










