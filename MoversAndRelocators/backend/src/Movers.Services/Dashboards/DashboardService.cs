using System.Text.Json;
using Movers.Services.Billing;
using Movers.Services.Delivery;
using Movers.Services.Security;

namespace Movers.Services.Dashboards;

/// <summary>
/// The three module dashboards. Sales & planning and Operations come from <see cref="IDashboardQuery"/>; Finance is
/// read from the accounting reports themselves (receivable / payable aging, invoice, receipt and bill registers,
/// all in the base currency), so every figure on it matches the report a user can open.
/// </summary>
public sealed class DashboardService(IDashboardQuery query, BillingService billing, DeliveryService delivery, IUserContext user, TimeProvider clock)
{
    private const int Months = 6;

    public Task<SalesDashboard> SalesAsync(int timezoneOffsetMinutes, CancellationToken t) => query.SalesAsync(Clock(timezoneOffsetMinutes), t);

    public async Task<OperationsDashboard> OperationsAsync(int timezoneOffsetMinutes, CancellationToken t)
    {
        var result = await query.OperationsAsync(Clock(timezoneOffsetMinutes), t);
        if (!user.HasPermission(SecurityPermissions.DeliveryManage)) return result;
        // Boxes in the warehouse that can go on a delivery: the same list the delivery screen loads from.
        var available = await delivery.Available(t);
        return result with { Kpis = result.Kpis with { BoxesInWarehouse = available.Warehouse.Count + available.Jobs.Count } };
    }

    public async Task<FinanceDashboard> FinanceAsync(int timezoneOffsetMinutes, CancellationToken t)
    {
        if (!user.HasPermission(SecurityPermissions.BillingView)) throw new UnauthorizedAccessException();
        var c = Clock(timezoneOffsetMinutes);
        try
        {
            var today = c.Today; var month = c.MonthStart; var from = month.AddMonths(-(Months - 1));
            var ar = await billing.ReceivableAging(today, "BASE", null, t);
            var ap = await billing.PayableAging(today, "BASE", null, t);
            var currency = ar.Totals.FirstOrDefault()?.Currency ?? ap.Totals.FirstOrDefault()?.Currency;
            var arTotal = ar.Totals.FirstOrDefault(); var apTotal = ap.Totals.FirstOrDefault();
            var invoices = Rows(await billing.InvoiceRegister(from, today, "BASE", "ALL", null, t)).Where(r => Text(r, "status") is not ("DRAFT" or "VOIDED")).ToList();
            var receipts = Rows(await billing.ReceiptRegister(from, today, "BASE", "POSTED", null, t)).ToList();
            var bills = Rows(await billing.BillRegister(month, today, "BASE", "ALL", null, t)).Where(r => Text(r, "status") is not ("DRAFT" or "VOIDED")).ToList();
            currency ??= invoices.Select(r => Text(r, "currency")).FirstOrDefault(x => x is not null);
            decimal Sum(IEnumerable<JsonElement> rows, DateOnly start, DateOnly end) => rows.Where(r => Date(r) is { } d && d >= start && d < end).Sum(r => Number(r, "amount"));
            var drafts = (await billing.DocumentList(t)).Count(d => d.Details.Type == "INVOICE" && !d.Details.Voided && d.JournalId is null);
            var kpis = new FinanceKpis(arTotal?.Outstanding ?? 0, (arTotal?.Outstanding ?? 0) - (arTotal?.Current ?? 0), apTotal?.Outstanding ?? 0, (apTotal?.Outstanding ?? 0) - (apTotal?.Current ?? 0),
                Sum(invoices, month, today.AddDays(1)), Sum(receipts, month, today.AddDays(1)), Sum(bills, month, today.AddDays(1)), drafts, ar.Rows.Count(r => r.DaysOverdue > 0 && r.Outstanding > 0));
            IReadOnlyList<DashboardMoney> Buckets(decimal current, decimal d30, decimal d60, decimal d90, decimal d120, decimal over120) =>
                [new("CURRENT", current), new("1_30", d30), new("31_60", d60), new("61_90", d90), new("91_120", d120), new("OVER_120", over120)];
            var arBuckets = arTotal is null ? Buckets(0, 0, 0, 0, 0, 0) : Buckets(arTotal.Current, arTotal.Days1To30, arTotal.Days31To60, arTotal.Days61To90, arTotal.Days91To120, arTotal.DaysOver120);
            var apBuckets = apTotal is null ? Buckets(0, 0, 0, 0, 0, 0) : Buckets(apTotal.Current, apTotal.Days1To30, apTotal.Days31To60, apTotal.Days61To90, apTotal.Days91To120, apTotal.DaysOver120);
            var monthly = new DashboardSeries(["invoiced", "collected"], Enumerable.Range(0, Months).Select(i => from.AddMonths(i))
                .Select(m => new DashboardPoint(m, [Sum(invoices, m, m.AddMonths(1)), Sum(receipts, m, m.AddMonths(1))])).ToList());
            var debtors = ar.Rows.Where(r => r.Outstanding > 0).GroupBy(r => r.CustomerCode)
                .Select(g => new FinanceDebtor(g.Key, g.First().CustomerName, g.Sum(r => r.Outstanding), g.Sum(r => r.Outstanding - r.Current), g.Count()))
                .OrderByDescending(x => x.Outstanding).Take(5).ToList();
            var counts = new List<DashboardCount> { new("CURRENT", ar.Rows.Count(r => r.Outstanding > 0 && r.DaysOverdue <= 0)), new("OVERDUE", ar.Rows.Count(r => r.Outstanding > 0 && r.DaysOverdue > 0)) };
            return new(currency, null, kpis, counts, arBuckets, apBuckets, monthly, debtors);
        }
        catch (InvalidOperationException e)
        {
            // Typically: no base currency or exchange rates set up yet. The dashboard says so instead of failing.
            return new(null, e.Message, null, null, null, null, null, null);
        }
    }

    private DashboardClock Clock(int timezoneOffsetMinutes) => DashboardClock.From(clock.GetUtcNow(), timezoneOffsetMinutes);
    /// <summary>The "rows" of a register report (an anonymous object), read through JSON.</summary>
    private static IEnumerable<JsonElement> Rows(object report)
    {
        var json = JsonSerializer.SerializeToElement(report, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        return json.TryGetProperty("rows", out var rows) && rows.ValueKind == JsonValueKind.Array ? rows.EnumerateArray().ToList() : [];
    }
    private static string? Text(JsonElement row, string name) => row.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
    private static decimal Number(JsonElement row, string name) => row.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDecimal() : 0;
    private static DateOnly? Date(JsonElement row) => Text(row, "date") is { } s && DateOnly.TryParse(s, out var d) ? d : null;
}
