using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Delivery;
using Movers.Domain.Packing;
using Movers.Domain.Quotations;
using Movers.Domain.Surveys;
using Movers.Services.Dashboards;
using Movers.Services.Security;

namespace Movers.DAL.Dashboards;

/// <summary>
/// Counts for the Sales & planning and Operations dashboards, for the whole company (not one person). Each query
/// reads a small projection and does the date work in memory, in the user's time zone (SQLite cannot compare
/// DateTimeOffset values in SQL). A section is left out (null) when the user lacks that module's permission.
/// </summary>
public sealed class DashboardQuery(MoversDbContext db, IUserContext user) : IDashboardQuery
{
    private const int TopItems = 8;

    public async Task<SalesDashboard> SalesAsync(DashboardClock clock, CancellationToken t)
    {
        SalesKpis? leads = null; DashboardSeries? perWeek = null; IReadOnlyList<DashboardCount>? byStatus = null, bySource = null; IReadOnlyList<DashboardItem>? recent = null;
        if (user.HasPermission(SecurityPermissions.SalesView))
        {
            var statuses = await db.LeadStatuses.AsNoTracking().ToListAsync(t);
            var rows = await db.SalesLeads.AsNoTracking().Where(x => x.IsActive)
                .Select(x => new { x.Id, x.LeadNumber, x.CustomerName, x.Source, x.StatusId, x.CreatedAtUtc }).ToListAsync(t);
            var closed = statuses.Where(s => s.IsClosed).Select(s => s.Id).ToHashSet();
            var month = clock.MonthStart; var lastMonth = month.AddMonths(-1);
            var followUps = await (from f in db.LeadFollowUps.AsNoTracking()
                                   join l in db.SalesLeads.AsNoTracking() on f.SalesLeadId equals l.Id
                                   join s in db.FollowUpStatuses.AsNoTracking() on f.StatusId equals s.Id
                                   where l.IsActive
                                   select new { f.NextFollowUpAtUtc, f.ScheduledAtUtc, s.IsCompleted }).ToListAsync(t);
            var openDue = followUps.Where(f => f.NextFollowUpAtUtc.HasValue || !f.IsCompleted).Select(f => f.NextFollowUpAtUtc ?? f.ScheduledAtUtc).ToList();
            leads = new(rows.Count(x => clock.Local(x.CreatedAtUtc) >= month),
                rows.Count(x => clock.Local(x.CreatedAtUtc) is var d && d >= lastMonth && d < month),
                rows.Count(x => !closed.Contains(x.StatusId)),
                openDue.Count(d => d >= clock.NowUtc && d < clock.TomorrowStartUtc), openDue.Count(d => d < clock.NowUtc));
            // The last 12 weeks, Monday to Sunday, the current week last.
            var thisWeek = clock.Today.AddDays(-(((int)clock.Today.DayOfWeek + 6) % 7));
            perWeek = new(["leads"], Enumerable.Range(0, 12).Select(i => thisWeek.AddDays(-7 * (11 - i)))
                .Select(w => new DashboardPoint(w, [rows.Count(x => clock.Local(x.CreatedAtUtc) is var d && d >= w && d < w.AddDays(7))])).ToList());
            byStatus = statuses.Where(s => s.IsActive || rows.Any(x => x.StatusId == s.Id)).OrderBy(s => s.DisplayOrder)
                .Select(s => new DashboardCount(s.Name, rows.Count(x => x.StatusId == s.Id), s.Code, s.Color)).Where(x => x.Count > 0).ToList();
            var since = clock.Today.AddDays(-90);
            bySource = Top(rows.Where(x => clock.Local(x.CreatedAtUtc) >= since).GroupBy(x => string.IsNullOrWhiteSpace(x.Source) ? "" : x.Source.Trim(), StringComparer.OrdinalIgnoreCase)
                .Select(g => new DashboardCount(g.Key, g.Count(), g.Key == "" ? "NONE" : null)), 5);
            var statusNames = statuses.ToDictionary(s => s.Id, s => s.Name);
            recent = rows.OrderByDescending(x => x.CreatedAtUtc).Take(6)
                .Select(x => new DashboardItem("LEAD", x.Id, x.LeadNumber, x.CustomerName, x.CreatedAtUtc, statusNames.GetValueOrDefault(x.StatusId), Detail: x.Source)).ToList();
        }

        SurveyKpis? surveys = null; IReadOnlyList<DashboardItem>? upcoming = null;
        if (user.HasPermission(SecurityPermissions.SurveysManage))
        {
            var rows = await (from s in db.Surveys.AsNoTracking()
                              join e in db.Employees.AsNoTracking() on s.AssignedEmployeeId equals e.Id into es
                              from e in es.DefaultIfEmpty()
                              select new { s.Id, s.SurveyNumber, s.CustomerName, s.Address, s.Status, s.ScheduledAtUtc, s.EndedAtUtc, Surveyor = e == null ? null : e.FirstName + " " + e.LastName }).ToListAsync(t);
            var weekEnd = clock.Utc(clock.Today.AddDays(7));
            var open = rows.Where(x => x.Status != SurveyStatuses.Completed).ToList();
            surveys = new(open.Count(x => x.ScheduledAtUtc >= clock.TodayStartUtc && x.ScheduledAtUtc < weekEnd), rows.Count(x => x.Status == SurveyStatuses.InProgress),
                rows.Count(x => x.Status == SurveyStatuses.Completed && x.EndedAtUtc is { } end && clock.Local(end) >= clock.MonthStart),
                open.Count(x => x.ScheduledAtUtc < clock.TodayStartUtc && x.Status != SurveyStatuses.InProgress));
            upcoming = open.Where(x => x.ScheduledAtUtc >= clock.TodayStartUtc && x.ScheduledAtUtc < weekEnd).OrderBy(x => x.ScheduledAtUtc).Take(TopItems)
                .Select(x => new DashboardItem("SURVEY", x.Id, x.SurveyNumber, x.CustomerName, x.ScheduledAtUtc, x.Status, x.Surveyor?.Trim(), x.Address)).ToList();
        }

        QuotationKpis? quotes = null; IReadOnlyList<DashboardCount>? outcomes = null;
        if (user.HasPermission(SecurityPermissions.QuotesManage))
        {
            var rows = await db.Quotations.AsNoTracking().Select(x => new { x.Status, x.SentAtUtc, x.RespondedAtUtc, x.CreatedAtUtc, x.Currency, x.GrandTotal }).ToListAsync(t);
            var month = clock.MonthStart; var since = clock.Today.AddDays(-90);
            bool InMonth(DateTimeOffset? at) => at is { } a && clock.Local(a) >= month;
            var decided = rows.Where(x => x.Status is QuotationStatuses.Accepted or QuotationStatuses.Rejected && x.RespondedAtUtc is { } r && clock.Local(r) >= since).ToList();
            var acceptedMonth = rows.Where(x => x.Status == QuotationStatuses.Accepted && InMonth(x.RespondedAtUtc)).ToList();
            quotes = new(rows.Count(x => InMonth(x.SentAtUtc)), acceptedMonth.Count, rows.Count(x => x.Status is QuotationStatuses.Sent or QuotationStatuses.RequoteRequested),
                decided.Count, decided.Count(x => x.Status == QuotationStatuses.Accepted),
                acceptedMonth.GroupBy(x => x.Currency).Select(g => new DashboardMoney(g.Key, g.Sum(x => x.GrandTotal))).OrderByDescending(x => x.Amount).ToList());
            var order = new[] { QuotationStatuses.Draft, QuotationStatuses.Sent, QuotationStatuses.RequoteRequested, QuotationStatuses.Accepted, QuotationStatuses.Rejected };
            outcomes = rows.Where(x => clock.Local(x.CreatedAtUtc) >= since).GroupBy(x => x.Status)
                .OrderBy(g => Array.IndexOf(order, g.Key) is var i && i < 0 ? 99 : i).Select(g => new DashboardCount(g.Key, g.Count(), g.Key)).ToList();
        }
        return new(leads, perWeek, byStatus, bySource, recent, surveys, upcoming, quotes, outcomes);
    }

    public async Task<OperationsDashboard> OperationsAsync(DashboardClock clock, CancellationToken t)
    {
        var jobs = new List<(string Kind, Guid Id, string Number, string Customer, DateTimeOffset At, string Status, string StatusLabel, bool Open, bool Active, string? Person, string? Detail)>();
        var modules = new List<string>();
        IReadOnlyList<DashboardCount>? pickupStatus = null, packingStatus = null, deliveryStatus = null;
        var window = clock.Utc(clock.Today.AddDays(-30));

        if (user.HasPermission(SecurityPermissions.OperationsManage))
        {
            modules.Add("PICKUP");
            var statuses = await db.PickupStatuses.AsNoTracking().ToListAsync(t);
            var done = statuses.ToDictionary(s => s.Id, s => s.IsCompleted);
            var rows = await db.Pickups.AsNoTracking().Select(x => new { x.Id, x.PickupNumber, x.CustomerName, x.Address, x.ScheduledAtUtc, x.StatusId, x.StartedAtUtc, x.EndedAtUtc }).ToListAsync(t);
            var names = statuses.ToDictionary(s => s.Id, s => s.Name);
            foreach (var x in rows)
            {
                var open = !done.GetValueOrDefault(x.StatusId);
                jobs.Add(("PICKUP", x.Id, x.PickupNumber, x.CustomerName, x.ScheduledAtUtc, names.GetValueOrDefault(x.StatusId) ?? "", names.GetValueOrDefault(x.StatusId) ?? "", open,
                    open && x.StartedAtUtc is not null && x.EndedAtUtc is null, null, x.Address));
            }
            pickupStatus = statuses.OrderBy(s => s.DisplayOrder).Select(s => new DashboardCount(s.Name, rows.Count(x => x.StatusId == s.Id && (x.ScheduledAtUtc >= window || !done.GetValueOrDefault(x.StatusId))), s.Code, s.Color))
                .Where(x => x.Count > 0).ToList();
        }
        if (user.HasPermission(SecurityPermissions.PackingManage))
        {
            modules.Add("PACKING");
            var rows = await db.Set<PackingJob>().AsNoTracking().Select(x => new { x.Id, x.JobNumber, x.CustomerName, x.Address, x.ScheduledAtUtc, x.Status }).ToListAsync(t);
            foreach (var x in rows.Where(x => x.Status != PackingJobStatuses.Cancelled))
                jobs.Add(("PACKING", x.Id, x.JobNumber, x.CustomerName, x.ScheduledAtUtc, x.Status, x.Status, x.Status is PackingJobStatuses.Planned or PackingJobStatuses.InProgress,
                    x.Status == PackingJobStatuses.InProgress, null, x.Address));
            packingStatus = ByStatus(rows.Where(x => x.ScheduledAtUtc >= window || x.Status is PackingJobStatuses.Planned or PackingJobStatuses.InProgress).Select(x => x.Status),
                [PackingJobStatuses.Planned, PackingJobStatuses.InProgress, PackingJobStatuses.Completed, PackingJobStatuses.Cancelled]);
        }
        if (user.HasPermission(SecurityPermissions.DeliveryManage))
        {
            modules.Add("DELIVERY");
            var rows = await (from d in db.Set<DeliveryJob>().AsNoTracking()
                              join e in db.Employees.AsNoTracking() on d.DriverEmployeeId equals e.Id into es
                              from e in es.DefaultIfEmpty()
                              select new { d.Id, d.DeliveryNumber, d.ScheduledAtUtc, d.Status, d.Notes, Driver = e == null ? null : e.FirstName + " " + e.LastName }).ToListAsync(t);
            foreach (var x in rows.Where(x => x.Status != DeliveryStatuses.Cancelled))
                jobs.Add(("DELIVERY", x.Id, x.DeliveryNumber, "", x.ScheduledAtUtc, x.Status, x.Status, x.Status is DeliveryStatuses.Planned or DeliveryStatuses.OutForDelivery,
                    x.Status == DeliveryStatuses.OutForDelivery, x.Driver?.Trim(), x.Notes));
            deliveryStatus = ByStatus(rows.Where(x => x.ScheduledAtUtc >= window || x.Status is DeliveryStatuses.Planned or DeliveryStatuses.OutForDelivery).Select(x => x.Status),
                [DeliveryStatuses.Planned, DeliveryStatuses.OutForDelivery, DeliveryStatuses.Completed, DeliveryStatuses.Cancelled]);
        }

        bool Today((string Kind, Guid Id, string Number, string Customer, DateTimeOffset At, string Status, string StatusLabel, bool Open, bool Active, string? Person, string? Detail) j) => j.At >= clock.TodayStartUtc && j.At < clock.TomorrowStartUtc;
        var overdue = jobs.Where(j => j.Open && !j.Active && j.At < clock.TodayStartUtc).ToList();
        var kpis = new OperationsKpis(jobs.Count(j => j.Kind == "PICKUP" && Today(j)), jobs.Count(j => j.Kind == "PACKING" && Today(j)), jobs.Count(j => j.Kind == "DELIVERY" && Today(j)),
            jobs.Count(j => j.Active), overdue.Count, null);
        var kinds = new[] { "PICKUP", "PACKING", "DELIVERY" }.Where(modules.Contains).ToList();
        var next = new DashboardSeries(kinds, Enumerable.Range(0, 14).Select(i => clock.Today.AddDays(i))
            .Select(day => new DashboardPoint(day, kinds.Select(k => (decimal)jobs.Count(j => j.Kind == k && clock.Local(j.At) == day)).ToList())).ToList());
        DashboardItem Item((string Kind, Guid Id, string Number, string Customer, DateTimeOffset At, string Status, string StatusLabel, bool Open, bool Active, string? Person, string? Detail) j) =>
            new(j.Kind, j.Id, j.Number, j.Customer, j.At, j.StatusLabel, j.Person, j.Detail);
        return new(kpis, next, jobs.Where(Today).OrderBy(j => j.At).Select(Item).ToList(), overdue.OrderBy(j => j.At).Take(TopItems).Select(Item).ToList(),
            pickupStatus, packingStatus, deliveryStatus, modules);
    }

    private static List<DashboardCount> ByStatus(IEnumerable<string> statuses, string[] order) =>
        statuses.GroupBy(s => s).OrderBy(g => Array.IndexOf(order, g.Key) is var i && i < 0 ? 99 : i).Select(g => new DashboardCount(g.Key, g.Count(), g.Key)).ToList();

    /// <summary>The biggest <paramref name="keep"/> entries, the rest folded into one "Other" entry (code OTHER).</summary>
    private static List<DashboardCount> Top(IEnumerable<DashboardCount> rows, int keep)
    {
        var ordered = rows.OrderByDescending(x => x.Count).ToList();
        if (ordered.Count <= keep + 1) return ordered;
        return [.. ordered.Take(keep), new DashboardCount("", ordered.Skip(keep).Sum(x => x.Count), "OTHER")];
    }
}
