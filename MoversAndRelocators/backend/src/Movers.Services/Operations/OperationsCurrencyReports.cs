using Movers.Services.Currencies;
namespace Movers.Services.Operations;
public sealed partial class OperationsService {
 public async Task<IReadOnlyList<CostRow>> Costs(CancellationToken ct,string mode="TRANSACTION",DateOnly? date=null) {
  if(mode is not ("TRANSACTION" or "BASE" or "USD" or "PARTY"))throw new InvalidOperationException("Choose a report currency.");
  var settings=await currencies.Settings(ct);var systemCurrency=settings.BaseCurrency!;var defaultCurrency=settings.DefaultCurrency;
  var reportDate=date??DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
  var labour=await repository.Labour(ct);var materials=await repository.Materials(ct);var allocations=await repository.Allocations(ct);
  var expenses=await repository.Expenses(ct);var legacy=await repository.LegacyTransactions(ct);var crew=await repository.CrewExpenses(ct);var trips=(await repository.Trips(ct)).ToDictionary(x=>x.Id);
  var parties=await masters.List("customer",ct);var result=new List<CostRow>();
  foreach(var pickup in await repository.Pickups(ct)) {
   var legacyCurrency=await repository.QuotationCurrency(pickup.QuotationId,ct)??defaultCurrency;
   var partyMatches=parties.Where(x=>x.Name==pickup.CustomerName&&x.Phone==pickup.Phone).ToList();
   if(mode=="PARTY"&&partyMatches.Count!=1)throw new InvalidOperationException($"Select a unique customer master matching the name and phone for {pickup.PickupNumber} before reporting in customer currency.");
   var target=mode=="BASE"?systemCurrency:mode=="USD"?"USD":mode=="PARTY"?partyMatches[0].Currency??(await currencies.Settings(ct)).DefaultCurrency:null;
   var groups=new Dictionary<string,decimal[]>();
   async Task Add(Guid id,string currency,decimal amount,int bucket,decimal hours=0) {
    var snapshot=await currencies.Snapshot(id,ct);currency=snapshot?.Currency??currency;
    var output=target??currency;
    if(!groups.TryGetValue(output,out var values)){values=new decimal[10];groups[output]=values;}
    if(amount!=0&&target is not null&&target!=currency) {
      if(snapshot is null&&currency!=systemCurrency)throw new InvalidOperationException($"Historical costs for {pickup.PickupNumber} have no saved exchange rate. Use transaction-currency reporting until historical rates are recorded.");
      var targetFx=await currencies.Resolve(target,reportDate,null,ct);
      amount=CurrencyService.Round(amount*(snapshot?.UsdPerUnit??1)/targetFx.UsdPerUnit,targetFx.DecimalPlaces);
    }
    values[bucket]+=amount;values[9]+=hours;
   }
   foreach(var x in labour.Where(x=>x.PickupId==pickup.Id))await Add(x.Id,x.Currency,x.Cost,1,x.RegularHours+x.OvertimeHours);
   foreach(var x in materials.Where(x=>x.PickupId==pickup.Id))await Add(x.Id,legacyCurrency,x.TotalCost,2);
   foreach(var x in allocations.Where(x=>x.PickupId==pickup.Id)){await Add(x.TripId,trips[x.TripId].Currency,x.FuelCost,3);await Add(x.TripId,trips[x.TripId].Currency,x.OtherCost,4);}
   foreach(var x in expenses.Where(x=>x.PickupId==pickup.Id))await Add(x.Id,x.Currency,x.Amount,x.Category is "HIRED_TRANSPORT" or "VENDOR_SERVICE"?5:6);
   foreach(var x in crew.Where(x=>x.PickupId==pickup.Id))await Add(x.Id,x.Currency,x.Amount,x.Category=="FUEL"?3:x.Category is "TAXI" or "METRO" or "BUS" or "TOLL" or "PARKING"?4:6);
   foreach(var x in legacy.Where(x=>x.PickupId==pickup.Id))await Add(x.Id,legacyCurrency,x.Amount,x.Type=="INCOME"?0:7);
   if(groups.Count==0)groups[target??legacyCurrency]=new decimal[10];
   foreach(var (currency,v) in groups){var total=v.Skip(1).Take(7).Sum();result.Add(new(pickup.Id,pickup.PickupNumber,pickup.CustomerName,currency,v[0],v[9],v[1],v[2],v[3],v[4],v[5],v[6],v[7],total,v[0]-total));}
  }
  return result;
 }
}

