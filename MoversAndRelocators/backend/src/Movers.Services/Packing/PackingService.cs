using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Movers.Domain.Employees;
using Movers.Domain.Packing;
using Movers.Domain.Pickups;
using Movers.Domain.Quotations;
using Movers.Domain.Sales;
using Movers.Domain.Surveys;
using Movers.Services.Billing;
using Movers.Services.Currencies;
using Movers.Services.Masters;
using Movers.Services.Numbering;
using Movers.Services.Security;
using Movers.Services.Tenancy;

namespace Movers.Services.Packing;

public sealed record SavePackingJobCommand(string CustomerName, string Phone, string? Email, string Address, DateTimeOffset ScheduledAtUtc, string? Notes, Guid? PickupId = null, Guid? QuotationId = null, Guid? SalesLeadId = null);
public sealed record PackingCrewInput(Guid EmployeeId, string Role);
public sealed record PackingBoxItemInput(string ItemName, int Quantity, string? Notes, Guid? HouseholdItemId);
public sealed record PackingBoxMaterialInput(Guid MaterialId, decimal Quantity);
/// <param name="Materials">Materials actually used per box; null keeps the box type recipe.</param>
public sealed record SavePackingBoxCommand(Guid BoxTypeId, string? RoomName, bool IsFragile, string? Notes, IReadOnlyList<PackingBoxItemInput> Items, int Copies = 1, IReadOnlyList<PackingBoxMaterialInput>? Materials = null);
public sealed record PackingMaterialInput(Guid MaterialId, decimal Quantity, decimal? UnitCost);
public sealed record AddPackingTransactionCommand(string Type, string Category, decimal Amount, string PaymentMethod, string? Notes, string? Currency, decimal? ExchangeRate);

public sealed record PackingJobModel(int SerialNo, Guid Id, string JobNumber, string Status, Guid? PickupId, string? PickupNumber, Guid? QuotationId, string? QuotationNumber, Guid? SalesLeadId, string? LeadNumber,
    string CustomerName, string Phone, string? Email, string Address, DateTimeOffset ScheduledAtUtc, string? Notes, DateTimeOffset? StartedAtUtc, DateTimeOffset? CompletedAtUtc, DateTimeOffset CreatedAtUtc, int BoxCount, int LabelsPending, DateTimeOffset? ScheduleConfirmedAtUtc,
    bool IsPaused, long WorkingSeconds, long PausedSeconds);
public sealed record PackingCrewModel(Guid EmployeeId, string EmployeeName, string Role);
public sealed record PackingBoxItemModel(string ItemName, int Quantity, string? Notes, Guid? HouseholdItemId);
public sealed record PackingBoxMaterialModel(Guid MaterialId, string MaterialName, string Unit, decimal Quantity);
public sealed record PackingBoxModel(int SerialNo, Guid Id, Guid BoxTypeId, string BoxTypeName, string TrackingNumber, string? RoomName, bool IsFragile, string? Notes, IReadOnlyList<PackingBoxItemModel> Items, DateTimeOffset? LabelPrintedAtUtc, int LabelPrintCount,
    bool CustomMaterials, IReadOnlyList<PackingBoxMaterialModel> Materials);
public sealed record PackingMaterialModel(Guid MaterialId, string MaterialName, string Unit, decimal Quantity, decimal UnitCost, decimal TotalCost, bool IsBoxRecipe);
public sealed record PackingTransactionModel(int SerialNo, Guid Id, string TransactionNumber, string Type, string Category, decimal Amount, string PaymentMethod, string? Notes, DateTimeOffset CreatedAtUtc, string? Currency, decimal? BaseAmount);
public sealed record PackingCurrencyTotal(string Currency, decimal Income, decimal Expense);
/// <summary>Accounting view of the job: material cost (posted as Dr 5100 Material expense / Cr 1300 Packing material stock when the job completes) and cash totals.</summary>
public sealed record PackingAccountingModel(string BaseCurrency, decimal MaterialCost, bool MaterialPosted, string? MaterialJournalReference, decimal IncomeBase, decimal ExpenseBase, IReadOnlyList<PackingCurrencyTotal> Totals);
/// <summary>An active customer link (the token itself is never stored or returned again).</summary>
public sealed record PackingLinkStatus(string Purpose, DateTimeOffset ExpiresAtUtc, DateTimeOffset CreatedAtUtc);
/// <summary>Customer confirmation state. ItemsResponseCurrent is false when boxes changed after the customer responded.</summary>
public sealed record PackingCustomerModel(IReadOnlyList<PackingLinkStatus> Links, DateTimeOffset? ScheduleConfirmedAtUtc, decimal? Latitude, decimal? Longitude, string? LocationNotes, DateTimeOffset? LocationSharedAtUtc,
    string? ItemsResponse, string? ItemsResponderName, string? ItemsResponseNotes, DateTimeOffset? ItemsRespondedAtUtc, bool ItemsResponseCurrent);
public sealed record PackingTimeEventModel(string Type, DateTimeOffset OccurredAtUtc, string? Reason, string RecordedBy);
/// <summary>Packing clock: working time excludes pauses; crew time = working time × crew members.</summary>
public sealed record PackingClockModel(bool IsPaused, long WorkingSeconds, long PausedSeconds, int CrewCount, long CrewSeconds, IReadOnlyList<PackingTimeEventModel> Events);
public sealed record PackingJobDetailModel(PackingJobModel Job, IReadOnlyList<PackingCrewModel> Crew, IReadOnlyList<PackingBoxModel> Boxes, IReadOnlyList<PackingMaterialModel> Materials, IReadOnlyList<PackingTransactionModel> Transactions, PackingAccountingModel Accounting, PackingCustomerModel Customer, PackingClockModel Clock);
public sealed record PackingJobHoursModel(Guid Id, string JobNumber, string CustomerName, string Status, bool IsPaused, DateTimeOffset? StartedAtUtc, DateTimeOffset? CompletedAtUtc, long WorkingSeconds, long PausedSeconds, int CrewCount, long CrewSeconds);
public sealed record PackingEmployeeHoursModel(Guid EmployeeId, string EmployeeName, int Jobs, long Seconds);
/// <summary>Working hours of packing jobs started in a date range, per job and per crew member.</summary>
public sealed record PackingWorkingHoursModel(DateOnly From, DateOnly To, IReadOnlyList<PackingJobHoursModel> Jobs, IReadOnlyList<PackingEmployeeHoursModel> Employees, long WorkingSeconds, long CrewSeconds);

public sealed record PackingLinkModel(string Purpose, string Token, DateTimeOffset ExpiresAtUtc);
public sealed record PublicPackingBox(string TrackingNumber, string BoxTypeName, string? RoomName, bool IsFragile, IReadOnlyList<PackingBoxItemModel> Items);
/// <summary>What the customer sees on a link. Boxes are only included on the packed-items link; ItemsHash identifies the exact list.</summary>
public sealed record PublicPackingJobModel(string Purpose, string TenantName, string JobNumber, string Status, string CustomerName, string Address,
    DateTimeOffset ScheduledAtUtc, DateTimeOffset? ScheduleConfirmedAtUtc, decimal? Latitude, decimal? Longitude, string? LocationNotes, DateTimeOffset? LocationSharedAtUtc, DateTimeOffset ExpiresAtUtc,
    IReadOnlyList<PublicPackingBox> Boxes, string? ItemsHash, string? ItemsResponse, string? ItemsResponderName, string? ItemsResponseNotes, DateTimeOffset? ItemsRespondedAtUtc, bool ItemsResponseCurrent);
public sealed record ConfirmPackingScheduleCommand(DateTimeOffset ScheduledAtUtc);
public sealed record SharePackingLocationCommand(decimal Latitude, decimal Longitude, string? Address, string? Notes);
public sealed record RespondPackingItemsCommand(string Name, bool Confirmed, string? Notes, string SnapshotHash);

public sealed record PackingRecipeLine(Guid MaterialId, string MaterialName, string Unit, decimal Quantity);
public sealed record PackingBoxTypeOption(Guid Id, string Code, string Name, decimal CapacityCbm, IReadOnlyList<PackingRecipeLine> Recipe);
public sealed record PackingMaterialOption(Guid Id, string Code, string Name, string Unit, decimal CurrentUnitCost);
public sealed record PackingEmployeeOption(Guid Id, string Name);
public sealed record PackingChoice(string Code, string Name);
public sealed record PackingMastersModel(IReadOnlyList<PackingBoxTypeOption> BoxTypes, IReadOnlyList<PackingMaterialOption> Materials, IReadOnlyList<PackingEmployeeOption> Employees,
    IReadOnlyList<PackingChoice> CrewRoles, IReadOnlyList<PackingChoice> PaymentMethods, IReadOnlyList<PackingChoice> IncomeCategories, IReadOnlyList<PackingChoice> ExpenseCategories);
public sealed record PackingSourceOption(string Kind, Guid Id, string Number, string CustomerName, string Phone, string? Email, string Address, Guid? QuotationId, Guid? SalesLeadId);

public interface IPackingRepository
{
    Task<IReadOnlyList<PackingJob>> Jobs(CancellationToken t);
    Task<PackingJob?> Job(Guid id, bool track, CancellationToken t);
    Task<(PackingJobLink Link, PackingJob Job, Movers.Domain.Tenants.Tenant Tenant)?> SharedJob(string tokenHash, CancellationToken t);
    Task<IReadOnlyList<PackingJobLink>> Links(Guid jobId, bool track, CancellationToken t);
    Task<IReadOnlyList<PackingJobTimeEvent>> TimeEvents(IReadOnlyCollection<Guid> jobIds, CancellationToken t);
    Task<IReadOnlyList<PackingJobCrew>> CrewOf(IReadOnlyCollection<Guid> jobIds, CancellationToken t);
    Task<IReadOnlyList<PackingJobCrew>> Crew(Guid jobId, CancellationToken t);
    Task<IReadOnlyList<PackingJobBox>> Boxes(Guid jobId, bool track, CancellationToken t);
    Task<IReadOnlyList<PackingJobBoxItem>> BoxItems(IReadOnlyCollection<Guid> boxIds, bool track, CancellationToken t);
    Task<IReadOnlyList<PackingJobBoxMaterial>> BoxMaterials(IReadOnlyCollection<Guid> boxIds, bool track, CancellationToken t);
    Task<IReadOnlyList<PackingJobMaterial>> Materials(Guid jobId, bool track, CancellationToken t);
    Task<IReadOnlyList<PackingJobTransaction>> Transactions(Guid jobId, CancellationToken t);
    Task<IReadOnlyDictionary<Guid, int>> BoxCounts(CancellationToken t);
    Task<IReadOnlyDictionary<Guid, int>> PendingLabels(CancellationToken t);
    Task<IReadOnlyList<Employee>> ActiveEmployees(CancellationToken t);
    Task<IReadOnlyList<BoxType>> ActiveBoxTypes(CancellationToken t);
    Task<IReadOnlyList<BoxTypeMaterial>> Recipes(CancellationToken t);
    Task<IReadOnlyList<PackingMaterial>> ActiveMaterials(CancellationToken t);
    Task<IReadOnlyList<Pickup>> Pickups(CancellationToken t);
    Task<IReadOnlyList<Quotation>> Quotations(CancellationToken t);
    Task<SalesLead?> Lead(Guid id, CancellationToken t);
    Task<IReadOnlyDictionary<Guid, string>> EmployeeNames(CancellationToken t);
    void Add(object entity);
    void Remove(object entity);
    Task Save(CancellationToken t);
}

/// <summary>
/// Packing jobs: crew, labelled boxes with items, packing materials (box recipes derived automatically plus extras),
/// income and expenses (to the accountant's cash queue as source PACKING), and the material-consumption journal.
/// </summary>
public sealed class PackingService(IPackingRepository r, BusinessMasterService masters, BillingService billing, CurrencyService currencies, IRecordNumbers numbers, ITenantContext tenant, IUserContext user, TimeProvider clock, Movers.Services.Crew.ICrewRepository crewRepo)
{
    public const string SourceKind = "PACKING";

    /* ---------- lookups ---------- */
    public async Task<PackingMastersModel> Masters(CancellationToken t)
    {
        var materials = await r.ActiveMaterials(t);
        var byId = materials.ToDictionary(x => x.Id);
        var recipes = (await r.Recipes(t)).ToLookup(x => x.BoxTypeId);
        async Task<IReadOnlyList<PackingChoice>> Choice(string kind) => (await masters.List(kind, t)).Where(x => x.IsActive).Select(x => new PackingChoice(x.Code, x.Name)).ToList();
        return new(
            (await r.ActiveBoxTypes(t)).Select(b => new PackingBoxTypeOption(b.Id, b.Code, b.Name, b.CapacityCbm,
                recipes[b.Id].Where(x => byId.ContainsKey(x.MaterialId)).Select(x => new PackingRecipeLine(x.MaterialId, byId[x.MaterialId].Name, byId[x.MaterialId].Unit, x.Quantity)).ToList())).ToList(),
            materials.Select(m => new PackingMaterialOption(m.Id, m.Code, m.Name, m.Unit, m.CurrentUnitCost)).ToList(),
            (await r.ActiveEmployees(t)).Select(e => new PackingEmployeeOption(e.Id, e.FullName)).OrderBy(e => e.Name).ToList(),
            await Choice("crew-role"), await Choice("payment-method"), await Choice("payment-purpose"), await Choice("expense-category"));
    }

    /// <summary>Pickups and quotations a packing job can be started from (customer details are copied).</summary>
    public async Task<IReadOnlyList<PackingSourceOption>> Sources(CancellationToken t)
    {
        var list = (await r.Pickups(t)).OrderByDescending(x => x.SerialNo).Select(p => new PackingSourceOption("PICKUP", p.Id, p.PickupNumber, p.CustomerName, p.Phone, p.Email, p.Address, p.QuotationId, p.SalesLeadId)).ToList();
        list.AddRange((await r.Quotations(t)).OrderByDescending(x => x.SerialNo).Select(q => new PackingSourceOption("QUOTATION", q.Id, q.QuotationNumber, q.CustomerName, q.Phone, q.Email, q.Origin, q.Id, q.SalesLeadId)));
        return list;
    }

    /* ---------- jobs ---------- */
    public async Task<IReadOnlyList<PackingJobModel>> List(CancellationToken t)
    {
        var refs = await References(t); var counts = await r.BoxCounts(t); var pending = await r.PendingLabels(t);
        var jobs = await r.Jobs(t); var now = clock.GetUtcNow();
        var events = (await r.TimeEvents(jobs.Select(x => x.Id).ToList(), t)).ToLookup(x => x.PackingJobId);
        return jobs.OrderByDescending(x => x.SerialNo).Select(x => Model(x, refs, counts.GetValueOrDefault(x.Id), pending.GetValueOrDefault(x.Id), null, Durations(x, events[x.Id].ToList(), now))).ToList();
    }

    public async Task<PackingJobDetailModel?> Get(Guid id, CancellationToken t) { var x = await r.Job(id, false, t); return x is null ? null : await Detail(x, t); }

    public async Task<PackingJobDetailModel> Create(SavePackingJobCommand c, CancellationToken t)
    {
        Validate(c);
        var refs = await References(t);
        if (c.PickupId.HasValue && !refs.Pickups.ContainsKey(c.PickupId.Value)) throw new InvalidOperationException("Pickup was not found.");
        if (c.QuotationId.HasValue && !refs.Quotations.ContainsKey(c.QuotationId.Value)) throw new InvalidOperationException("Quotation was not found.");
        if (c.SalesLeadId.HasValue && await r.Lead(c.SalesLeadId.Value, t) is null) throw new InvalidOperationException("Sales lead was not found.");
        var job = new PackingJob(tenant.TenantId, await numbers.Next("PK", t), c.PickupId, c.QuotationId, c.SalesLeadId, c.CustomerName, c.Phone, c.Email, c.Address, c.ScheduledAtUtc, c.Notes);
        r.Add(job); await r.Save(t);
        return await Detail(job, t);
    }

    public async Task<PackingJobDetailModel?> Update(Guid id, SavePackingJobCommand c, CancellationToken t)
    {
        Validate(c);
        var job = await r.Job(id, true, t); if (job is null) return null;
        if (job.Status == PackingJobStatuses.Cancelled) throw new InvalidOperationException("Reopen the cancelled job before editing it.");
        job.Update(c.CustomerName, c.Phone, c.Email, c.Address, c.ScheduledAtUtc, c.Notes);
        await r.Save(t); return await Detail(job, t);
    }

    /// <summary>Moves the job through PLANNED → IN_PROGRESS → COMPLETED (or CANCELLED). Completing posts the material
    /// consumption journal; moving a completed job back reverses it, so the ledger always matches the materials used.</summary>
    /// <summary>
    /// Changes the status and records the matching packing clock step: start, complete, cancel or reopen.
    /// Completing posts the material cost; reopening a completed job reverses it.
    /// </summary>
    /// <param name="at">When the step happened (defaults to now; never in the future or before the previous step).</param>
    public async Task<PackingJobDetailModel?> SetStatus(Guid id, string status, CancellationToken t, DateTimeOffset? at = null)
    {
        status = (status ?? "").Trim().ToUpperInvariant();
        if (!PackingJobStatuses.All.Contains(status)) throw new InvalidOperationException("Choose a valid packing status.");
        var job = await r.Job(id, true, t); if (job is null) return null;
        if (job.Status == status) return await Detail(job, t);
        if (status == PackingJobStatuses.Planned && job.StartedAtUtc is not null) throw new InvalidOperationException("Packing has started; it cannot go back to planned.");
        var now = clock.GetUtcNow(); var today = DateOnly.FromDateTime(now.UtcDateTime);
        var stepAt = await StepTime(job, at, t);
        if (status == PackingJobStatuses.Completed)
        {
            if ((await r.Boxes(id, false, t)).Count == 0) throw new InvalidOperationException("Pack at least one box before completing the job.");
            var cost = (await r.Materials(id, false, t)).Sum(x => x.TotalCost);
            await billing.PostMaterialConsumption(SourceKind, job.Id, job.JobNumber + " · " + job.CustomerName, job.JobNumber, cost, today, t);
        }
        else if (job.Status == PackingJobStatuses.Completed) await billing.ReverseMaterialConsumption(SourceKind, job.Id, today, t);
        var step = status switch
        {
            PackingJobStatuses.InProgress => job.StartedAtUtc is null ? PackingTimeEventTypes.Started : PackingTimeEventTypes.Reopened,
            PackingJobStatuses.Completed => PackingTimeEventTypes.Completed,
            PackingJobStatuses.Cancelled => PackingTimeEventTypes.Cancelled,
            _ => null
        };
        // Cancelling or completing a job that never started records no clock step.
        if (step is not null && (job.StartedAtUtc is not null || step == PackingTimeEventTypes.Started))
            r.Add(new PackingJobTimeEvent(tenant.TenantId, id, step, stepAt, null, RecordedBy()));
        job.SetStatus(status, stepAt);
        await r.Save(t); return await Detail(job, t);
    }

    /* ---------- packing clock ---------- */
    public async Task<PackingJobDetailModel?> Start(Guid id, DateTimeOffset? at, CancellationToken t)
    {
        var job = await r.Job(id, false, t); if (job is null) return null;
        if (job.Status != PackingJobStatuses.Planned) throw new InvalidOperationException("Packing has already started.");
        return await SetStatus(id, PackingJobStatuses.InProgress, t, at);
    }

    public async Task<PackingJobDetailModel?> Pause(Guid id, string? reason, DateTimeOffset? at, CancellationToken t)
    {
        if (string.IsNullOrWhiteSpace(reason)) throw new InvalidOperationException("Enter why packing is paused.");
        if (reason.Length > 500) throw new InvalidOperationException("Keep the reason under 500 characters.");
        var job = await r.Job(id, true, t); if (job is null) return null;
        var stepAt = await StepTime(job, at, t);
        job.Pause();
        r.Add(new PackingJobTimeEvent(tenant.TenantId, id, PackingTimeEventTypes.Paused, stepAt, reason, RecordedBy()));
        await r.Save(t); return await Detail(job, t);
    }

    public async Task<PackingJobDetailModel?> Resume(Guid id, DateTimeOffset? at, CancellationToken t)
    {
        var job = await r.Job(id, true, t); if (job is null) return null;
        var stepAt = await StepTime(job, at, t);
        job.Resume();
        r.Add(new PackingJobTimeEvent(tenant.TenantId, id, PackingTimeEventTypes.Resumed, stepAt, null, RecordedBy()));
        await r.Save(t); return await Detail(job, t);
    }

    public Task<PackingJobDetailModel?> Complete(Guid id, DateTimeOffset? at, CancellationToken t) => SetStatus(id, PackingJobStatuses.Completed, t, at);

    /// <summary>Working hours of jobs started between the dates (inclusive), per job and per crew member (each member is credited the job's working time).</summary>
    public async Task<PackingWorkingHoursModel> WorkingHours(DateOnly from, DateOnly to, CancellationToken t)
    {
        if (to < from) throw new InvalidOperationException("The end date must be on or after the start date.");
        if (to.DayNumber - from.DayNumber > 366) throw new InvalidOperationException("Choose a period of up to one year.");
        var jobs = (await r.Jobs(t)).Where(x => x.StartedAtUtc is { } s && DateOnly.FromDateTime(s.UtcDateTime) >= from && DateOnly.FromDateTime(s.UtcDateTime) <= to).OrderBy(x => x.StartedAtUtc).ToList();
        var ids = jobs.Select(x => x.Id).ToList(); var now = clock.GetUtcNow();
        var events = (await r.TimeEvents(ids, t)).ToLookup(x => x.PackingJobId);
        var crew = (await r.CrewOf(ids, t)).ToLookup(x => x.PackingJobId);
        var names = await r.EmployeeNames(t);
        var rows = jobs.Select(x =>
        {
            var (working, paused) = Durations(x, events[x.Id].ToList(), now); var members = crew[x.Id].Count();
            return new PackingJobHoursModel(x.Id, x.JobNumber, x.CustomerName, x.Status, x.IsPaused, x.StartedAtUtc, x.CompletedAtUtc, working, paused, members, working * members);
        }).ToList();
        var byId = rows.ToDictionary(x => x.Id);
        var employees = ids.SelectMany(id => crew[id]).GroupBy(c => c.EmployeeId)
            .Select(g => new PackingEmployeeHoursModel(g.Key, names.GetValueOrDefault(g.Key, "Unknown"), g.Select(c => c.PackingJobId).Distinct().Count(), g.Select(c => c.PackingJobId).Distinct().Sum(j => byId[j].WorkingSeconds)))
            .OrderByDescending(x => x.Seconds).ThenBy(x => x.EmployeeName).ToList();
        return new(from, to, rows, employees, rows.Sum(x => x.WorkingSeconds), rows.Sum(x => x.CrewSeconds));
    }

    /// <summary>
    /// Working and paused seconds from the clock steps. Working time runs from STARTED/RESUMED/REOPENED until
    /// PAUSED/COMPLETED/CANCELLED; an open interval runs to now. Jobs started before the clock existed use their start/end stamps.
    /// </summary>
    public static (long Working, long Paused) Durations(PackingJob job, IReadOnlyList<PackingJobTimeEvent> events, DateTimeOffset now)
    {
        var steps = events.Select(e => (e.Type, e.OccurredAtUtc)).ToList();
        if (job.StartedAtUtc is { } started && !steps.Any(x => x.Type == PackingTimeEventTypes.Started))
        {
            var noSteps = steps.Count == 0;
            steps.Insert(0, (PackingTimeEventTypes.Started, started));
            if (noSteps && job.CompletedAtUtc is { } done) steps.Add((PackingTimeEventTypes.Completed, done));
            else if (noSteps && job.Status == PackingJobStatuses.Cancelled) steps.Add((PackingTimeEventTypes.Cancelled, job.UpdatedAtUtc));
        }
        DateTimeOffset? running = null, pausedAt = null; var working = TimeSpan.Zero; var paused = TimeSpan.Zero;
        foreach (var (type, at) in steps)
        {
            switch (type)
            {
                case PackingTimeEventTypes.Started or PackingTimeEventTypes.Resumed or PackingTimeEventTypes.Reopened:
                    if (pausedAt is not null) { paused += at - pausedAt.Value; pausedAt = null; }
                    running ??= at; break;
                case PackingTimeEventTypes.Paused:
                    if (running is not null) { working += at - running.Value; running = null; }
                    pausedAt ??= at; break;
                default:
                    if (running is not null) { working += at - running.Value; running = null; }
                    if (pausedAt is not null) { paused += at - pausedAt.Value; pausedAt = null; }
                    break;
            }
        }
        if (running is not null) working += now - running.Value;
        if (pausedAt is not null) paused += now - pausedAt.Value;
        return ((long)Math.Max(0, working.TotalSeconds), (long)Math.Max(0, paused.TotalSeconds));
    }

    /// <summary>Time for a new clock step: now by default, never in the future, never before the previous step.</summary>
    private async Task<DateTimeOffset> StepTime(PackingJob job, DateTimeOffset? requested, CancellationToken t)
    {
        var now = clock.GetUtcNow(); var at = requested ?? now;
        if (at > now.AddMinutes(5)) throw new InvalidOperationException("A packing step cannot be recorded in the future.");
        var previous = (await r.TimeEvents([job.Id], t)).LastOrDefault()?.OccurredAtUtc ?? job.StartedAtUtc;
        if (previous is not null && at < previous) throw new InvalidOperationException("Each step must be recorded after the previous one (" + previous.Value.ToString("u") + ").");
        return at;
    }

    private string RecordedBy() => string.IsNullOrWhiteSpace(user.Email) ? "Staff" : user.Email;

    /* ---------- crew ---------- */
    public async Task<PackingJobDetailModel?> SaveCrew(Guid id, IReadOnlyList<PackingCrewInput> crew, CancellationToken t)
    {
        var job = await Editable(id, t); if (job is null) return null;
        var employees = (await r.ActiveEmployees(t)).Select(x => x.Id).ToHashSet();
        if (crew.Any(x => !employees.Contains(x.EmployeeId))) throw new InvalidOperationException("Assigned employee was not found or is inactive.");
        if (crew.GroupBy(x => x.EmployeeId).Any(g => g.Count() > 1)) throw new InvalidOperationException("Assign each employee once.");
        if (crew.Any(x => string.IsNullOrWhiteSpace(x.Role) || x.Role.Length > 80)) throw new InvalidOperationException("Give every crew member a role.");
        // A crew member cannot be on two jobs whose windows overlap.
        var clashes = Movers.Services.Crew.ScheduleConflicts.Find(
            crew.Select(x => x.EmployeeId).Distinct().ToList(),
            job.ScheduledAtUtc, job.ScheduledAtUtc.AddMinutes(job.DurationMinutes), "PACKING", job.Id,
            await crewRepo.BookingsAsync(t),
            (await crewRepo.EmployeesAsync(t)).ToDictionary(e => e.Id, e => e.FirstName + " " + e.LastName));
        if (clashes.Count > 0) throw new InvalidOperationException(Movers.Services.Crew.ScheduleConflicts.Describe(clashes));

        foreach (var x in await r.Crew(id, t)) r.Remove(x);
        // The team is frozen onto the row as it stands now. Moving someone to another team later must not
        // change which team is on record for this job, nor whose responsibility it was.
        foreach (var x in crew)
        {
            var open = await crewRepo.OpenMembershipsForEmployeeAsync(x.EmployeeId, t);
            var membership = open.OrderByDescending(m => m.JoinedAtUtc).FirstOrDefault();
            var team = membership is null ? null : await crewRepo.TeamAsync(membership.TeamId, false, t);
            r.Add(new PackingJobCrew(tenant.TenantId, id, x.EmployeeId, x.Role, team?.Id, team?.Name, clock.GetUtcNow()));
        }
        job.Touch(); await r.Save(t); return await Detail(job, t);
    }

    /* ---------- boxes ---------- */
    /// <summary>Adds one box, or several identical boxes (Copies), each with its own tracking number.</summary>
    public async Task<PackingJobDetailModel?> AddBox(Guid id, SavePackingBoxCommand c, CancellationToken t)
    {
        var job = await Editable(id, t); if (job is null) return null;
        await ValidateBox(c, t);
        if (c.Copies is < 1 or > 50) throw new InvalidOperationException("Add between 1 and 50 boxes at a time.");
        var boxes = (await r.Boxes(id, false, t)).ToList();
        var custom = await CustomMaterials(boxes, t);
        for (var i = 0; i < c.Copies; i++)
        {
            var box = new PackingJobBox(tenant.TenantId, id, c.BoxTypeId, await numbers.Next("PKB", t));
            box.Update(c.BoxTypeId, c.RoomName, c.IsFragile, c.Notes);
            r.Add(box); boxes.Add(box);
            foreach (var item in c.Items) r.Add(new PackingJobBoxItem(tenant.TenantId, box.Id, item.ItemName, item.Quantity, item.Notes, item.HouseholdItemId));
            SetBoxMaterials(box, c.Materials, custom);
        }
        await RecomputeRecipes(id, boxes, custom, t);
        if (job.Status == PackingJobStatuses.Planned)
        {
            var now = clock.GetUtcNow();
            r.Add(new PackingJobTimeEvent(tenant.TenantId, id, PackingTimeEventTypes.Started, now, "Started when the first box was packed", RecordedBy()));
            job.SetStatus(PackingJobStatuses.InProgress, now);
        }
        else job.Touch();
        await r.Save(t); return await Detail(job, t);
    }

    public async Task<PackingJobDetailModel?> UpdateBox(Guid id, Guid boxId, SavePackingBoxCommand c, CancellationToken t)
    {
        var job = await Editable(id, t); if (job is null) return null;
        await ValidateBox(c, t);
        var boxes = await r.Boxes(id, true, t);
        var box = boxes.SingleOrDefault(x => x.Id == boxId) ?? throw new KeyNotFoundException();
        box.Update(c.BoxTypeId, c.RoomName, c.IsFragile, c.Notes);
        foreach (var x in await r.BoxItems([boxId], true, t)) r.Remove(x);
        foreach (var item in c.Items) r.Add(new PackingJobBoxItem(tenant.TenantId, box.Id, item.ItemName, item.Quantity, item.Notes, item.HouseholdItemId));
        var custom = await CustomMaterials(boxes, t);
        foreach (var x in await r.BoxMaterials([boxId], true, t)) r.Remove(x);
        SetBoxMaterials(box, c.Materials, custom);
        await RecomputeRecipes(id, boxes, custom, t);
        job.Touch(); await r.Save(t); return await Detail(job, t);
    }

    public async Task<PackingJobDetailModel?> DeleteBox(Guid id, Guid boxId, CancellationToken t)
    {
        var job = await Editable(id, t); if (job is null) return null;
        var boxes = await r.Boxes(id, true, t);
        var box = boxes.SingleOrDefault(x => x.Id == boxId) ?? throw new KeyNotFoundException();
        foreach (var x in await r.BoxItems([boxId], true, t)) r.Remove(x);
        foreach (var x in await r.BoxMaterials([boxId], true, t)) r.Remove(x);
        r.Remove(box);
        var remaining = boxes.Where(x => x.Id != boxId).ToList();
        await RecomputeRecipes(id, remaining, await CustomMaterials(remaining, t), t);
        job.Touch(); await r.Save(t); return await Detail(job, t);
    }

    /// <summary>Records that labels were printed for these boxes (so the crew can see which boxes still need one).</summary>
    public async Task<PackingJobDetailModel?> LabelsPrinted(Guid id, IReadOnlyList<Guid> boxIds, CancellationToken t)
    {
        var job = await r.Job(id, true, t); if (job is null) return null;
        var wanted = boxIds.ToHashSet(); var now = clock.GetUtcNow();
        foreach (var box in (await r.Boxes(id, true, t)).Where(x => wanted.Contains(x.Id))) box.LabelPrinted(now);
        await r.Save(t); return await Detail(job, t);
    }

    /* ---------- materials ---------- */
    /// <summary>Replaces the extra (non-recipe) materials. Recipe materials always follow the packed boxes.</summary>
    public async Task<PackingJobDetailModel?> SaveMaterials(Guid id, IReadOnlyList<PackingMaterialInput> extras, CancellationToken t)
    {
        var job = await Editable(id, t); if (job is null) return null;
        var active = (await r.ActiveMaterials(t)).ToDictionary(x => x.Id);
        foreach (var m in extras)
        {
            if (!active.ContainsKey(m.MaterialId)) throw new InvalidOperationException("Select an active packing material.");
            if (m.Quantity is <= 0 or > 100000) throw new InvalidOperationException("Material quantity must be between 0 and 100,000.");
            if (m.UnitCost is < 0) throw new InvalidOperationException("Unit cost cannot be negative.");
        }
        foreach (var x in (await r.Materials(id, true, t)).Where(x => !x.IsBoxRecipe)) r.Remove(x);
        foreach (var m in extras) r.Add(new PackingJobMaterial(tenant.TenantId, id, m.MaterialId, m.Quantity, m.UnitCost ?? active[m.MaterialId].CurrentUnitCost, false));
        job.Touch(); await r.Save(t); return await Detail(job, t);
    }

    /* ---------- income / expense ---------- */
    public async Task<PackingJobDetailModel?> AddTransaction(Guid id, AddPackingTransactionCommand c, CancellationToken t)
    {
        var job = await r.Job(id, true, t); if (job is null) return null;
        if (job.Status == PackingJobStatuses.Cancelled) throw new InvalidOperationException("Reopen the cancelled job before recording money.");
        var type = (c.Type ?? "").Trim().ToUpperInvariant();
        if (c.Amount <= 0 || type is not ("INCOME" or "EXPENSE")) throw new InvalidOperationException("Enter a valid income or expense.");
        if (string.IsNullOrWhiteSpace(c.Category) || c.Category.Length > 120) throw new InvalidOperationException("Choose a category.");
        if (string.IsNullOrWhiteSpace(c.PaymentMethod) || c.PaymentMethod.Length > 40) throw new InvalidOperationException("Choose a payment method.");
        if (type == "EXPENSE") await masters.EnsureActive("expense-category", c.Category, t);
        var fx = await currencies.Resolve(c.Currency ?? (await currencies.Settings(t)).DefaultCurrency, DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime), c.ExchangeRate, t);
        CurrencyService.Amount(c.Amount, fx);
        var x = new PackingJobTransaction(tenant.TenantId, id, await numbers.Next("PKT", t), type, c.Category, c.Amount, c.PaymentMethod, c.Notes);
        await currencies.SaveSnapshot(x.Id, fx, t);
        r.Add(x); job.Touch(); await r.Save(t); return await Detail(job, t);
    }

    /* ---------- customer confirmation links (one per purpose) ---------- */
    /// <summary>Creates the customer link for one purpose, replacing the previous link for it. Only the token's SHA-256 is stored.</summary>
    public async Task<PackingLinkModel?> CreateLink(Guid id, string purpose, int days, CancellationToken t)
    {
        purpose = Purpose(purpose);
        if (days is < 1 or > 30) throw new InvalidOperationException("Link validity must be 1 to 30 days.");
        var job = await r.Job(id, true, t); if (job is null) return null;
        if (job.Status == PackingJobStatuses.Cancelled) throw new InvalidOperationException("Reopen the cancelled job before sharing it.");
        if (purpose != PackingLinkPurposes.Items && job.IsLocked) throw new InvalidOperationException("This packing job is completed.");
        if (purpose == PackingLinkPurposes.Items && (await r.Boxes(id, false, t)).Count == 0) throw new InvalidOperationException("Pack at least one box before asking the customer to confirm the items.");
        foreach (var old in (await r.Links(id, true, t)).Where(x => x.Purpose == purpose)) r.Remove(old);
        var raw = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
        var expires = clock.GetUtcNow().AddDays(days);
        r.Add(new PackingJobLink(tenant.TenantId, id, purpose, Sha256(raw), expires));
        job.Touch(); await r.Save(t);
        return new(purpose, raw, expires);
    }

    public async Task<PackingJobDetailModel?> RevokeLink(Guid id, string purpose, CancellationToken t)
    {
        purpose = Purpose(purpose);
        var job = await r.Job(id, true, t); if (job is null) return null;
        foreach (var old in (await r.Links(id, true, t)).Where(x => x.Purpose == purpose)) r.Remove(old);
        job.Touch(); await r.Save(t); return await Detail(job, t);
    }

    public async Task<PublicPackingJobModel?> Shared(string token, CancellationToken t)
    {
        var s = await SharedJob(token, null, false, t);
        return s is null ? null : await PublicModel(s.Value.Job, s.Value.Link, s.Value.TenantName, t);
    }

    /// <summary>Date link: the customer confirms the packing date and time, or picks another.</summary>
    public async Task<PublicPackingJobModel?> ConfirmSchedule(string token, ConfirmPackingScheduleCommand c, CancellationToken t)
    {
        var s = await SharedJob(token, PackingLinkPurposes.Schedule, true, t); if (s is null) return null;
        var job = s.Value.Job; var now = clock.GetUtcNow();
        if (job.IsLocked) throw new InvalidOperationException("This packing job is closed. Please contact us to make changes.");
        if (c.ScheduledAtUtc < now.AddHours(-1) || c.ScheduledAtUtc > now.AddYears(1)) throw new InvalidOperationException("Choose a packing date and time from now on.");
        job.ConfirmSchedule(c.ScheduledAtUtc, now);
        await r.Save(t); return await PublicModel(job, s.Value.Link, s.Value.TenantName, t);
    }

    /// <summary>Location link: the customer shares the GPS position of the packing address, optionally correcting the address and adding directions.</summary>
    public async Task<PublicPackingJobModel?> ShareLocation(string token, SharePackingLocationCommand c, CancellationToken t)
    {
        var s = await SharedJob(token, PackingLinkPurposes.Location, true, t); if (s is null) return null;
        var job = s.Value.Job;
        if (job.IsLocked) throw new InvalidOperationException("This packing job is closed. Please contact us to make changes.");
        if (c.Latitude is < -90 or > 90 || c.Longitude is < -180 or > 180 || (c.Latitude == 0 && c.Longitude == 0)) throw new InvalidOperationException("The shared location is not valid.");
        if (c.Address?.Length > 500 || c.Notes?.Length > 500) throw new InvalidOperationException("Address or directions are too long.");
        job.ShareLocation(Math.Round(c.Latitude, 6), Math.Round(c.Longitude, 6), c.Address, c.Notes, clock.GetUtcNow());
        await r.Save(t); return await PublicModel(job, s.Value.Link, s.Value.TenantName, t);
    }

    /// <summary>Items link: the customer confirms the packed boxes and items, or requests corrections, for the exact list identified by SnapshotHash.</summary>
    public async Task<PublicPackingJobModel?> RespondItems(string token, RespondPackingItemsCommand c, CancellationToken t)
    {
        var s = await SharedJob(token, PackingLinkPurposes.Items, true, t); if (s is null) return null;
        var job = s.Value.Job;
        if (job.Status == PackingJobStatuses.Cancelled) throw new InvalidOperationException("This packing job was cancelled.");
        if (string.IsNullOrWhiteSpace(c.Name) || c.Name.Length > 160) throw new InvalidOperationException("Enter your full name.");
        if (!c.Confirmed && string.IsNullOrWhiteSpace(c.Notes)) throw new InvalidOperationException("Describe the corrections needed.");
        if (c.Notes?.Length > 2000) throw new InvalidOperationException("Comments are too long.");
        var snap = await Snapshot(job.Id, t);
        if (snap.Boxes.Count == 0) throw new InvalidOperationException("Nothing has been packed yet.");
        if (c.SnapshotHash != snap.Hash) throw new InvalidOperationException("The packing list changed while you were reviewing it. Reload the page to see the latest list.");
        if (job.ItemsSnapshotHash == snap.Hash) throw new InvalidOperationException("Your response to this packing list is already recorded.");
        job.RespondItems(c.Confirmed, c.Name, c.Notes, snap.Hash, snap.Json, clock.GetUtcNow());
        await r.Save(t); return await PublicModel(job, s.Value.Link, s.Value.TenantName, t);
    }

    private static string Purpose(string? purpose)
    {
        var p = (purpose ?? "").Trim().ToUpperInvariant();
        return PackingLinkPurposes.All.Contains(p) ? p : throw new InvalidOperationException("Choose a valid link type.");
    }

    /// <summary>Resolves a live link; with <paramref name="purpose"/>, the link must be for that purpose.</summary>
    private async Task<(PackingJob Job, PackingJobLink Link, string TenantName)?> SharedJob(string token, string? purpose, bool track, CancellationToken t)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 100) return null;
        var found = await r.SharedJob(Sha256(token), t);
        if (found is null || found.Value.Link.ExpiresAtUtc < clock.GetUtcNow()) return null;
        if (purpose is not null && found.Value.Link.Purpose != purpose) throw new InvalidOperationException("This link cannot be used for that.");
        if (!tenant.IsResolved) tenant.SetTenant(found.Value.Tenant);
        var job = track ? await r.Job(found.Value.Job.Id, true, t) : found.Value.Job;
        return job is null ? null : (job, found.Value.Link, found.Value.Tenant.Name);
    }

    private async Task<PublicPackingJobModel> PublicModel(PackingJob job, PackingJobLink link, string tenantName, CancellationToken t)
    {
        var items = link.Purpose == PackingLinkPurposes.Items;
        var snap = items ? await Snapshot(job.Id, t) : default;
        return new(link.Purpose, tenantName, job.JobNumber, job.Status, job.CustomerName, job.Address, job.ScheduledAtUtc, job.ScheduleConfirmedAtUtc,
            job.Latitude, job.Longitude, job.LocationNotes, job.LocationSharedAtUtc, link.ExpiresAtUtc,
            items ? snap.Boxes : [], items ? snap.Hash : null, items ? job.ItemsResponse : null, items ? job.ItemsResponderName : null, items ? job.ItemsResponseNotes : null,
            items ? job.ItemsRespondedAtUtc : null, items && job.ItemsSnapshotHash == snap.Hash);
    }

    /// <summary>
    /// The packing list as the customer sees it. The hash covers only stable data (tracking number, box type id, room,
    /// fragile, items) so renaming or deactivating a box type does not invalidate a confirmation.
    /// </summary>
    private async Task<(IReadOnlyList<PublicPackingBox> Boxes, string Hash, string Json)> Snapshot(Guid jobId, CancellationToken t)
    {
        var boxes = (await r.Boxes(jobId, false, t)).OrderBy(b => b.SerialNo).ToList();
        var items = (await r.BoxItems(boxes.Select(b => b.Id).ToList(), false, t)).ToLookup(x => x.PackingJobBoxId);
        var types = (await r.ActiveBoxTypes(t)).ToDictionary(x => x.Id, x => x.Name);
        List<PackingBoxItemModel> Items(Guid boxId) => items[boxId].OrderBy(i => i.SerialNo).Select(i => new PackingBoxItemModel(i.ItemName, i.Quantity, i.Notes, i.HouseholdItemId)).ToList();
        var list = boxes.Select(b => new PublicPackingBox(b.TrackingNumber, types.GetValueOrDefault(b.BoxTypeId, "Box"), b.RoomName, b.IsFragile, Items(b.Id))).ToList();
        var canonical = JsonSerializer.Serialize(boxes.Select(b => new { b.TrackingNumber, b.BoxTypeId, b.RoomName, b.IsFragile, Items = Items(b.Id).Select(i => new { i.ItemName, i.Quantity, i.Notes }) }));
        return (list, Sha256(canonical), JsonSerializer.Serialize(list));
    }

    private static string Sha256(string x) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(x))).ToLowerInvariant();

    /* ---------- internals ---------- */
    private static void Validate(SavePackingJobCommand c)
    {
        if (string.IsNullOrWhiteSpace(c.CustomerName) || c.CustomerName.Length > 160) throw new InvalidOperationException("Enter the customer name.");
        if (string.IsNullOrWhiteSpace(c.Phone) || c.Phone.Length > 40) throw new InvalidOperationException("Enter the customer phone.");
        if (string.IsNullOrWhiteSpace(c.Address) || c.Address.Length > 500) throw new InvalidOperationException("Enter the packing address.");
        if (c.Email?.Length > 254 || c.Notes?.Length > 2000) throw new InvalidOperationException("Email or notes are too long.");
    }

    private async Task ValidateBox(SavePackingBoxCommand c, CancellationToken t)
    {
        if (!(await r.ActiveBoxTypes(t)).Any(x => x.Id == c.BoxTypeId)) throw new InvalidOperationException("Select an active box type.");
        if (c.RoomName?.Length > 120 || c.Notes?.Length > 500) throw new InvalidOperationException("Room or notes are too long.");
        if (c.Items.Count > 200 || c.Items.Any(i => string.IsNullOrWhiteSpace(i.ItemName) || i.ItemName.Length > 160 || i.Quantity is < 1 or > 10000 || i.Notes?.Length > 500))
            throw new InvalidOperationException("Every item needs a name and a quantity between 1 and 10,000.");
        if (c.Materials is { } used)
        {
            var active = (await r.ActiveMaterials(t)).Select(x => x.Id).ToHashSet();
            if (used.Count > 50 || used.Any(m => !active.Contains(m.MaterialId))) throw new InvalidOperationException("Select active packing materials.");
            if (used.Any(m => m.Quantity is <= 0 or > 100000)) throw new InvalidOperationException("Material quantity must be between 0 and 100,000.");
            if (used.GroupBy(m => m.MaterialId).Any(g => g.Count() > 1)) throw new InvalidOperationException("List each material once per box.");
        }
    }

    private async Task<PackingJob?> Editable(Guid id, CancellationToken t)
    {
        var job = await r.Job(id, true, t);
        if (job?.IsLocked == true) throw new InvalidOperationException("This packing job is " + job.Status.ToLowerInvariant() + ". Reopen it to change crew, boxes or materials.");
        return job;
    }

    /// <summary>Materials recorded per box for boxes with CustomMaterials, keyed by box id.</summary>
    private async Task<Dictionary<Guid, List<(Guid MaterialId, decimal Quantity)>>> CustomMaterials(IReadOnlyList<PackingJobBox> boxes, CancellationToken t)
    {
        var ids = boxes.Where(b => b.CustomMaterials).Select(b => b.Id).ToList();
        return (await r.BoxMaterials(ids, false, t)).GroupBy(x => x.PackingJobBoxId).ToDictionary(g => g.Key, g => g.Select(x => (x.MaterialId, x.Quantity)).ToList());
    }

    /// <summary>Stores the materials used for a box (null = follow the box type recipe) and reflects it in the in-memory map.</summary>
    private void SetBoxMaterials(PackingJobBox box, IReadOnlyList<PackingBoxMaterialInput>? used, Dictionary<Guid, List<(Guid MaterialId, decimal Quantity)>> custom)
    {
        box.SetCustomMaterials(used is not null);
        custom.Remove(box.Id);
        if (used is null) return;
        foreach (var m in used) r.Add(new PackingJobBoxMaterial(tenant.TenantId, box.Id, m.MaterialId, m.Quantity));
        custom[box.Id] = used.Select(m => (m.MaterialId, m.Quantity)).ToList();
    }

    /// <summary>
    /// Box materials: per box, the materials the crew recorded (CustomMaterials) or else the box type recipe, summed by
    /// material at its current cost. Stored as IsBoxRecipe rows so extras stay separate.
    /// </summary>
    /// <param name="boxes">The job's boxes as they will be after this change (including unsaved new ones).</param>
    /// <param name="custom">Recorded materials for custom boxes, including unsaved changes.</param>
    private async Task RecomputeRecipes(Guid jobId, IReadOnlyList<PackingJobBox> boxes, IReadOnlyDictionary<Guid, List<(Guid MaterialId, decimal Quantity)>> custom, CancellationToken t)
    {
        foreach (var x in (await r.Materials(jobId, true, t)).Where(x => x.IsBoxRecipe)) r.Remove(x);
        var recipes = (await r.Recipes(t)).ToLookup(x => x.BoxTypeId);
        var used = boxes.SelectMany(b => b.CustomMaterials ? custom.GetValueOrDefault(b.Id) ?? [] : recipes[b.BoxTypeId].Select(x => (x.MaterialId, x.Quantity)));
        var materials = (await r.ActiveMaterials(t)).ToDictionary(x => x.Id);
        foreach (var g in used.GroupBy(x => x.MaterialId))
        {
            if (!materials.TryGetValue(g.Key, out var m)) continue;
            var quantity = g.Sum(x => x.Quantity);
            if (quantity > 0) r.Add(new PackingJobMaterial(tenant.TenantId, jobId, g.Key, quantity, m.CurrentUnitCost, true));
        }
    }

    private sealed record Refs(IReadOnlyDictionary<Guid, Pickup> Pickups, IReadOnlyDictionary<Guid, Quotation> Quotations);
    private async Task<Refs> References(CancellationToken t) => new((await r.Pickups(t)).ToDictionary(x => x.Id), (await r.Quotations(t)).ToDictionary(x => x.Id));

    private static PackingJobModel Model(PackingJob x, Refs refs, int boxes, int pending, string? leadNumber = null, (long Working, long Paused) time = default) => new(x.SerialNo, x.Id, x.JobNumber, x.Status,
        x.PickupId, x.PickupId is { } p && refs.Pickups.TryGetValue(p, out var pickup) ? pickup.PickupNumber : null,
        x.QuotationId, x.QuotationId is { } q && refs.Quotations.TryGetValue(q, out var quote) ? quote.QuotationNumber : null,
        x.SalesLeadId, leadNumber, x.CustomerName, x.Phone, x.Email, x.Address, x.ScheduledAtUtc, x.Notes, x.StartedAtUtc, x.CompletedAtUtc, x.CreatedAtUtc, boxes, pending, x.ScheduleConfirmedAtUtc,
        x.IsPaused, time.Working, time.Paused);

    private async Task<PackingJobDetailModel> Detail(PackingJob job, CancellationToken t)
    {
        var names = await r.EmployeeNames(t);
        var crew = (await r.Crew(job.Id, t)).Select(c => new PackingCrewModel(c.EmployeeId, names.GetValueOrDefault(c.EmployeeId, "Unknown"), c.Role)).ToList();
        var boxTypes = (await r.ActiveBoxTypes(t)).ToDictionary(x => x.Id, x => x.Name);
        var boxes = await r.Boxes(job.Id, false, t);
        var items = (await r.BoxItems(boxes.Select(b => b.Id).ToList(), false, t)).ToLookup(x => x.PackingJobBoxId);
        var materialMaster = (await r.ActiveMaterials(t)).ToDictionary(x => x.Id);
        var recipes = (await r.Recipes(t)).ToLookup(x => x.BoxTypeId);
        var recorded = (await r.BoxMaterials(boxes.Where(b => b.CustomMaterials).Select(b => b.Id).ToList(), false, t)).ToLookup(x => x.PackingJobBoxId);
        PackingBoxMaterialModel Line(Guid materialId, decimal quantity) => new(materialId, materialMaster.GetValueOrDefault(materialId)?.Name ?? "Material", materialMaster.GetValueOrDefault(materialId)?.Unit ?? "", quantity);
        var boxModels = boxes.OrderBy(b => b.SerialNo).Select(b => new PackingBoxModel(b.SerialNo, b.Id, b.BoxTypeId, boxTypes.GetValueOrDefault(b.BoxTypeId, "Box"), b.TrackingNumber, b.RoomName, b.IsFragile, b.Notes,
            items[b.Id].OrderBy(i => i.SerialNo).Select(i => new PackingBoxItemModel(i.ItemName, i.Quantity, i.Notes, i.HouseholdItemId)).ToList(), b.LabelPrintedAtUtc, b.LabelPrintCount, b.CustomMaterials,
            (b.CustomMaterials ? recorded[b.Id].OrderBy(x => x.SerialNo).Select(x => Line(x.MaterialId, x.Quantity)) : recipes[b.BoxTypeId].Where(x => materialMaster.ContainsKey(x.MaterialId)).Select(x => Line(x.MaterialId, x.Quantity))).ToList())).ToList();
        var materials = (await r.Materials(job.Id, false, t)).Select(m => new PackingMaterialModel(m.MaterialId, materialMaster.GetValueOrDefault(m.MaterialId)?.Name ?? "Material", materialMaster.GetValueOrDefault(m.MaterialId)?.Unit ?? "", m.Quantity, m.UnitCost, Math.Round(m.TotalCost, 2), m.IsBoxRecipe))
            .OrderBy(m => m.IsBoxRecipe ? 0 : 1).ThenBy(m => m.MaterialName).ToList();
        var transactions = new List<PackingTransactionModel>();
        foreach (var x in await r.Transactions(job.Id, t))
        {
            var fx = await currencies.Snapshot(x.Id, t);
            transactions.Add(new(x.SerialNo, x.Id, x.TransactionNumber, x.Type, x.Category, x.Amount, x.PaymentMethod, x.Notes, x.CreatedAtUtc, fx?.Currency, fx is null ? null : CurrencyService.ToBase(x.Amount, fx)));
        }
        var settings = await currencies.Settings(t);
        var posting = await billing.MaterialConsumption(SourceKind, job.Id, t);
        var accounting = new PackingAccountingModel(settings.BaseCurrency ?? "USD", Math.Round(materials.Sum(m => m.TotalCost), 2), posting is not null, posting,
            transactions.Where(x => x.Type == "INCOME").Sum(x => x.BaseAmount ?? 0), transactions.Where(x => x.Type == "EXPENSE").Sum(x => x.BaseAmount ?? 0),
            transactions.GroupBy(x => x.Currency ?? "").Select(g => new PackingCurrencyTotal(g.Key, g.Where(x => x.Type == "INCOME").Sum(x => x.Amount), g.Where(x => x.Type == "EXPENSE").Sum(x => x.Amount))).ToList());
        var lead = job.SalesLeadId.HasValue ? await r.Lead(job.SalesLeadId.Value, t) : null;
        var now = clock.GetUtcNow();
        var links = (await r.Links(job.Id, false, t)).Where(x => x.ExpiresAtUtc > now).Select(x => new PackingLinkStatus(x.Purpose, x.ExpiresAtUtc, x.CreatedAtUtc)).ToList();
        var current = job.ItemsSnapshotHash is not null && job.ItemsSnapshotHash == (await Snapshot(job.Id, t)).Hash;
        var customer = new PackingCustomerModel(links, job.ScheduleConfirmedAtUtc, job.Latitude, job.Longitude, job.LocationNotes, job.LocationSharedAtUtc,
            job.ItemsResponse, job.ItemsResponderName, job.ItemsResponseNotes, job.ItemsRespondedAtUtc, current);
        var timeEvents = await r.TimeEvents([job.Id], t);
        var time = Durations(job, timeEvents, now);
        var clockModel = new PackingClockModel(job.IsPaused, time.Working, time.Paused, crew.Count, time.Working * crew.Count,
            timeEvents.Select(e => new PackingTimeEventModel(e.Type, e.OccurredAtUtc, e.Reason, e.RecordedBy)).ToList());
        return new(Model(job, await References(t), boxModels.Count, boxModels.Count(b => b.LabelPrintedAtUtc is null), lead?.LeadNumber, time), crew, boxModels, materials, transactions, accounting, customer, clockModel);
    }
}
