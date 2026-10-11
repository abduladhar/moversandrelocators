namespace Movers.Services.Billing;
public sealed partial class BillingService {
 public async Task<object> OutstandingVendors(DateOnly date,string currency,string? vendorCode,CancellationToken ct){
  var aging=await PayableAging(date,currency,vendorCode,ct);
  var rows=aging.Rows.GroupBy(r=>new{r.VendorCode,r.Currency})
   .OrderBy(g=>g.First().VendorName).ThenBy(g=>g.Key.Currency)
   .Select(g=>new{vendorCode=g.Key.VendorCode,vendorName=g.First().VendorName,currency=g.Key.Currency,billCount=g.Count(),current=g.Sum(r=>r.Current),overdue=g.Sum(r=>r.Outstanding-r.Current),outstanding=g.Sum(r=>r.Outstanding),oldestDueDate=g.Min(r=>r.DueDate),bills=g.OrderBy(r=>r.DueDate).ThenBy(r=>r.Number).ToList()}).ToList();
  return new{date,mode=currency,vendorCode,rows,totals=rows.GroupBy(r=>r.currency).Select(g=>new{currency=g.Key,vendorCount=g.Count(),billCount=g.Sum(r=>r.billCount),current=g.Sum(r=>r.current),overdue=g.Sum(r=>r.overdue),outstanding=g.Sum(r=>r.outstanding)})};
 }
}

