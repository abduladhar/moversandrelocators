namespace Movers.Services.Billing;
public sealed partial class BillingService {
 public async Task<object> OutstandingCustomers(DateOnly date,string currency,string? customerCode,CancellationToken ct){
  var aging=await ReceivableAging(date,currency,customerCode,ct);
  var rows=aging.Rows.GroupBy(r=>new{r.CustomerCode,r.Currency})
   .OrderBy(g=>g.First().CustomerName).ThenBy(g=>g.Key.Currency)
   .Select(g=>new{customerCode=g.Key.CustomerCode,customerName=g.First().CustomerName,currency=g.Key.Currency,invoiceCount=g.Count(),current=g.Sum(r=>r.Current),overdue=g.Sum(r=>r.Outstanding-r.Current),outstanding=g.Sum(r=>r.Outstanding),oldestDueDate=g.Min(r=>r.DueDate),invoices=g.OrderBy(r=>r.DueDate).ThenBy(r=>r.Number).ToList()}).ToList();
  return new{date,mode=currency,customerCode,rows,totals=rows.GroupBy(r=>r.currency).Select(g=>new{currency=g.Key,customerCount=g.Count(),invoiceCount=g.Sum(r=>r.invoiceCount),current=g.Sum(r=>r.current),overdue=g.Sum(r=>r.overdue),outstanding=g.Sum(r=>r.outstanding)})};
 }
}
