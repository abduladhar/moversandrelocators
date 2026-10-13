using Movers.Services.Currencies;
namespace Movers.Services.Billing;

public record EmployeeExpenseEntry(Guid ExpenseId, string Number, DateOnly Date, string SourceKind, Guid SourceId, string SourceLabel, string Description,
    string TransactionCurrency, decimal TransactionAmount, decimal? Amount, bool Posted, string? PostingNumber);

/// <summary>
/// Report 27 — Employee expenses: what each employee paid on surveys, pickups, packing and deliveries in a period,
/// whether or not the accountant has posted it yet. The employee is the "Paid by" on the expense.
/// </summary>
public sealed partial class BillingService {
 public static readonly string[] EmployeeExpenseSources = ["SURVEY", "PICKUP", "PACKING", "DELIVERY"];

 public async Task<object> EmployeeExpenses(DateOnly from, DateOnly to, string currency, Guid? employeeId, string sourceKind, string status, CancellationToken ct) {
  if (from == default || to == default || from > to) throw new InvalidOperationException("Select a valid reporting period.");
  if (sourceKind != "ALL" && !EmployeeExpenseSources.Contains(sourceKind)) throw new InvalidOperationException("Select a module.");
  if (status is not ("ALL" or "POSTED" or "PENDING")) throw new InvalidOperationException("Select a posting status.");
  var report = await currencies.ReportCurrency(currency, to, ct); var code = report.Code;
  var payers = await unit.ExpensePayers(ct);
  var employees = (await unit.Employees(ct)).ToDictionary(x => x.Id);
  decimal? Value(CashData d) {
   if (!report.Converted) return d.Currency == code ? d.Amount : null;
   var baseAmount = d.BaseAmount ?? (d.Fx is { } fx ? CurrencyService.ToBase(d.Amount, fx) : null);
   return baseAmount is null ? null : report.Translation is null ? baseAmount : CurrencyService.FromBase(baseAmount.Value, report.Translation);
  }
  var entries = (await CashQueue(ct))
   .Where(x => x.Details.Type == "EXPENSE_PAID" && EmployeeExpenseSources.Contains(x.Details.SourceKind) && payers.ContainsKey(x.Id))
   .Where(x => x.Details.Date >= from && x.Details.Date <= to)
   .Where(x => sourceKind == "ALL" || x.Details.SourceKind == sourceKind)
   .Where(x => status == "ALL" || (status == "POSTED") == x.Posted)
   .Where(x => employeeId is null || payers[x.Id] == employeeId)
   // In a single-currency report, other currencies are left out (as in the other accounting reports).
   .Where(x => report.Converted || x.Details.Currency == code)
   .Select(x => (Payer: payers[x.Id], Entry: new EmployeeExpenseEntry(x.Id, x.Number, x.Details.Date, x.Details.SourceKind, x.Details.SourceId, x.Details.SourceLabel,
     x.Details.Notes ?? x.Details.Reference, x.Details.Currency, x.Details.Amount, Value(x.Details), x.Posted, x.PostingNumber)))
   .ToList();
  var rows = entries.GroupBy(x => x.Payer).Select(g => {
   employees.TryGetValue(g.Key, out var e);
   var list = g.Select(x => x.Entry).OrderBy(x => x.Date).ThenBy(x => x.Number).ToList();
   decimal Sum(bool? posted) => list.Where(x => posted is null || x.Posted == posted).Sum(x => x.Amount ?? 0);
   return new { employeeId = g.Key, employeeNumber = e?.EmployeeNumber, employeeName = e?.FullName ?? "Unknown employee", count = list.Count,
    total = Sum(null), posted = Sum(true), pending = Sum(false),
    bySource = EmployeeExpenseSources.Select(s => new { sourceKind = s, amount = list.Where(x => x.SourceKind == s).Sum(x => x.Amount ?? 0) }).Where(x => x.amount != 0).ToList(),
    entries = list };
  }).OrderBy(x => x.employeeName).ToList();
  var all = entries.Select(x => x.Entry).ToList();
  return new { from, to, currency = code, mode = currency, employeeId, employeeName = employeeId is { } id && employees.TryGetValue(id, out var one) ? one.FullName : null,
   sourceKind, status, rows,
   missingValues = all.Count(x => x.Amount is null),
   totals = new { count = all.Count, total = all.Sum(x => x.Amount ?? 0), posted = all.Where(x => x.Posted).Sum(x => x.Amount ?? 0), pending = all.Where(x => !x.Posted).Sum(x => x.Amount ?? 0) },
   employees = employees.Values.Where(x => x.IsActive || payers.Values.Contains(x.Id)).OrderBy(x => x.FullName).Select(x => new { id = x.Id, name = x.FullName, number = x.EmployeeNumber }).ToList() };
 }
}
