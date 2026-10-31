namespace Movers.Services.Billing;
public sealed partial class BillingService {
 /// <summary>Outstanding by days past the due date: 0–30 (includes not yet due), 31–60, 61–90, 91–120 and over 120.</summary>
 internal static readonly (string Key,int From,int To)[] OutstandingBuckets=[("days0To30",0,30),("days31To60",31,60),("days61To90",61,90),("days91To120",91,120),("daysOver120",121,int.MaxValue)];
 internal static Dictionary<string,decimal> AgeBuckets<T>(IEnumerable<T> rows,Func<T,int> days,Func<T,decimal> amount)=>
  OutstandingBuckets.ToDictionary(b=>b.Key,b=>rows.Where(r=>days(r)>=b.From&&days(r)<=b.To).Sum(amount));
 internal static Dictionary<string,decimal> SumBuckets(IEnumerable<Dictionary<string,decimal>> agings)=>
  OutstandingBuckets.ToDictionary(b=>b.Key,b=>agings.Sum(a=>a[b.Key]));
 public async Task<object> OutstandingCustomers(DateOnly date,string currency,string? customerCode,CancellationToken ct){
  var aging=await ReceivableAging(date,currency,customerCode,ct);
  var rows=aging.Rows.GroupBy(r=>new{r.CustomerCode,r.Currency})
   .OrderBy(g=>g.First().CustomerName).ThenBy(g=>g.Key.Currency)
   .Select(g=>new{customerCode=g.Key.CustomerCode,customerName=g.First().CustomerName,currency=g.Key.Currency,invoiceCount=g.Count(),current=g.Sum(r=>r.Current),overdue=g.Sum(r=>r.Outstanding-r.Current),outstanding=g.Sum(r=>r.Outstanding),aging=AgeBuckets(g,r=>r.DaysOverdue,r=>r.Outstanding),oldestDueDate=g.Min(r=>r.DueDate),invoices=g.OrderBy(r=>r.DueDate).ThenBy(r=>r.Number).ToList()}).ToList();
  return new{date,mode=currency,customerCode,rows,totals=rows.GroupBy(r=>r.currency).Select(g=>new{currency=g.Key,customerCount=g.Count(),invoiceCount=g.Sum(r=>r.invoiceCount),current=g.Sum(r=>r.current),overdue=g.Sum(r=>r.overdue),outstanding=g.Sum(r=>r.outstanding),aging=SumBuckets(g.Select(r=>r.aging))})};
 }
}
