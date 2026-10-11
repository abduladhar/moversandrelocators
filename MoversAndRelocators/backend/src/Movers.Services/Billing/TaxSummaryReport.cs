namespace Movers.Services.Billing;
public sealed partial class BillingService {
 public Task<object> TaxSummary(DateOnly from,DateOnly to,string currency,CancellationToken ct)
  =>GeneralLedgerReport(from,to,currency,"2200",ct);
}
