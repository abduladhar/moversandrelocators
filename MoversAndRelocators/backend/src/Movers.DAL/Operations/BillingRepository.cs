using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Operations;
using Movers.Services.Billing;
namespace Movers.DAL.Operations;
public sealed class BillingRepository(MoversDbContext db):IBillingRepository {
 public async Task<IReadOnlyList<BillingRecord>> List(string kind,CancellationToken ct)=>await db.Set<BillingRecord>().Where(x=>x.Kind==kind).OrderByDescending(x=>x.SerialNo).ToListAsync(ct);
 public Task<BillingRecord?> Get(Guid id,CancellationToken ct)=>db.Set<BillingRecord>().SingleOrDefaultAsync(x=>x.Id==id,ct);
 public Task<BillingRecord?> Request(string kind,Guid requestId,CancellationToken ct)=>db.Set<BillingRecord>().SingleOrDefaultAsync(x=>x.Kind==kind&&x.RequestId==requestId,ct);
 public Task<bool> CashIsPosted(Guid id,CancellationToken ct)=>db.Set<BillingRecord>().AnyAsync(x=>x.Kind=="CASHPOST"&&x.Number==id.ToString("N"),ct);
 public async Task<bool> OwnsJournal(Guid id,CancellationToken ct) {
  if(await db.Set<BillingRecord>().AnyAsync(x=>x.JournalId==id,ct))return true;
  var original=await db.Set<JournalEntry>().Where(x=>x.Id==id).Select(x=>x.ReversesId).SingleOrDefaultAsync(ct);
  return original.HasValue&&await db.Set<BillingRecord>().AnyAsync(x=>x.JournalId==original,ct);
 }
 public async Task<IReadOnlyList<Source>> Sources(CancellationToken ct) {
  // Each operation says who its customer is, so a new invoice or charge from it can start with that customer selected.
  var result=(await db.Pickups.AsNoTracking().ToListAsync(ct)).Select(x=>new Source("PICKUP",x.Id,x.PickupNumber+" · "+x.CustomerName,null,x.CustomerName)).ToList();
  result.AddRange((await db.Set<TransportJob>().AsNoTracking().ToListAsync(ct)).Select(x=>new Source("JOB",x.Id,x.JobNumber)));
  result.AddRange((await db.Set<WarehouseReceipt>().AsNoTracking().ToListAsync(ct)).Select(x=>{var customer=ReceiptCustomer(x.SnapshotJson);return new Source("WAREHOUSE",x.Id,x.ReceiptNumber,customer.Code,customer.Name);}));
  result.AddRange((await db.Set<Movers.Domain.Packing.PackingJob>().AsNoTracking().ToListAsync(ct)).Select(x=>new Source("PACKING",x.Id,x.JobNumber+" · "+x.CustomerName,null,x.CustomerName)));
  // A delivery's customer is on its delivery notes; it is suggested only when they all name the same customer.
  var noteCustomers=(await db.Set<Movers.Domain.Delivery.DeliveryNote>().AsNoTracking().Select(n=>new{n.DeliveryJobId,n.CustomerName}).ToListAsync(ct))
   .GroupBy(n=>n.DeliveryJobId).ToDictionary(g=>g.Key,g=>g.Select(n=>n.CustomerName.Trim()).Where(n=>n.Length>0).Distinct(StringComparer.OrdinalIgnoreCase).ToList());
  result.AddRange((await db.Set<Movers.Domain.Delivery.DeliveryJob>().AsNoTracking().ToListAsync(ct)).Select(x=>
   new Source("DELIVERY",x.Id,x.DeliveryNumber,null,noteCustomers.GetValueOrDefault(x.Id) is [var only]?only:null)));
  return result;
 }

 private static (string? Code,string? Name) ReceiptCustomer(string json){
  try{var snapshot=System.Text.Json.JsonSerializer.Deserialize<Movers.Services.Operations.ReceiptSnapshot>(json);return (snapshot?.CustomerCode,snapshot?.CustomerName);}
  catch(System.Text.Json.JsonException){return (null,null);}
 }
}

