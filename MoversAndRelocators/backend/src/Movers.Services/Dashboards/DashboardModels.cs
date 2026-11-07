namespace Movers.Services.Dashboards;

/// <summary>One bar of a ranked list or one slice of a breakdown. Code: the status/source code when there is one; Color: the master's colour.</summary>
public sealed record DashboardCount(string Label, int Count, string? Code = null, string? Color = null);
/// <summary>One period (a week or a day) of a time series. Values: one number per series, in the order of Series.</summary>
public sealed record DashboardPoint(DateOnly Start, IReadOnlyList<decimal> Values);
public sealed record DashboardSeries(IReadOnlyList<string> Series, IReadOnlyList<DashboardPoint> Points);
/// <summary>A row of a "next up" list: Kind (LEAD, SURVEY, PICKUP, PACKING, DELIVERY…), its number, customer, time, status and person.</summary>
public sealed record DashboardItem(string Kind, Guid Id, string Number, string Customer, DateTimeOffset AtUtc, string? Status = null, string? Person = null, string? Detail = null);
public sealed record DashboardMoney(string Currency, decimal Amount);

// ---------- Sales & planning
public sealed record SalesKpis(int NewLeadsThisMonth, int NewLeadsLastMonth, int OpenLeads, int FollowUpsDueToday, int FollowUpsOverdue);
public sealed record SurveyKpis(int ScheduledNext7Days, int InProgress, int CompletedThisMonth, int Overdue);
public sealed record QuotationKpis(int SentThisMonth, int AcceptedThisMonth, int AwaitingAnswer, int Decided90Days, int Accepted90Days, IReadOnlyList<DashboardMoney> AcceptedValueThisMonth);
public sealed record SalesDashboard(
    SalesKpis? Leads, DashboardSeries? LeadsPerWeek, IReadOnlyList<DashboardCount>? LeadsByStatus, IReadOnlyList<DashboardCount>? LeadsBySource, IReadOnlyList<DashboardItem>? RecentLeads,
    SurveyKpis? Surveys, IReadOnlyList<DashboardItem>? UpcomingSurveys,
    QuotationKpis? Quotations, IReadOnlyList<DashboardCount>? QuotationOutcomes);

// ---------- Operations
public sealed record OperationsKpis(int PickupsToday, int PackingToday, int DeliveriesToday, int InProgress, int Overdue, int? BoxesInWarehouse);
public sealed record OperationsDashboard(OperationsKpis Kpis, DashboardSeries Next14Days, IReadOnlyList<DashboardItem> Today, IReadOnlyList<DashboardItem> OverdueJobs,
    IReadOnlyList<DashboardCount>? PickupsByStatus, IReadOnlyList<DashboardCount>? PackingByStatus, IReadOnlyList<DashboardCount>? DeliveriesByStatus, IReadOnlyList<string> Modules);

// ---------- Finance (all amounts in the base currency)
public sealed record FinanceKpis(decimal ReceivablesOutstanding, decimal ReceivablesOverdue, decimal PayablesOutstanding, decimal PayablesOverdue,
    decimal InvoicedThisMonth, decimal CollectedThisMonth, decimal BilledThisMonth, int DraftInvoices, int OverdueInvoices);
public sealed record FinanceDebtor(string Code, string Name, decimal Outstanding, decimal Overdue, int Invoices);
public sealed record FinanceDashboard(string? BaseCurrency, string? Problem, FinanceKpis? Kpis, IReadOnlyList<DashboardCount>? AgingCounts, IReadOnlyList<DashboardMoney>? ReceivableAging,
    IReadOnlyList<DashboardMoney>? PayableAging, DashboardSeries? Monthly, IReadOnlyList<FinanceDebtor>? TopDebtors);

/// <summary>Raw counts for the Sales & planning and Operations dashboards (DAL). Each section is null when the user may not see it.</summary>
public interface IDashboardQuery
{
    Task<SalesDashboard> SalesAsync(DashboardClock clock, CancellationToken t);
    Task<OperationsDashboard> OperationsAsync(DashboardClock clock, CancellationToken t);
}

/// <summary>"Now" in the user's time zone: today's and this month's limits in UTC.</summary>
public sealed record DashboardClock(DateTimeOffset NowUtc, TimeSpan Offset)
{
    public DateTimeOffset LocalNow => NowUtc.ToOffset(Offset);
    public DateOnly Today => DateOnly.FromDateTime(LocalNow.Date);
    public DateTimeOffset Utc(DateOnly day) => new DateTimeOffset(day.ToDateTime(TimeOnly.MinValue), Offset).ToUniversalTime();
    public DateTimeOffset TodayStartUtc => Utc(Today);
    public DateTimeOffset TomorrowStartUtc => Utc(Today.AddDays(1));
    public DateOnly MonthStart => new(Today.Year, Today.Month, 1);
    public DateOnly Local(DateTimeOffset utc) => DateOnly.FromDateTime(utc.ToOffset(Offset).Date);
    public static DashboardClock From(DateTimeOffset nowUtc, int timezoneOffsetMinutes) => new(nowUtc, TimeSpan.FromMinutes(-Math.Clamp(timezoneOffsetMinutes, -840, 840)));
}
