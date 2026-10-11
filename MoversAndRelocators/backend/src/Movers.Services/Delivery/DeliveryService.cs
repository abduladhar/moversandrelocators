using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Movers.Domain.Delivery;
using Movers.Domain.Employees;
using Movers.Domain.Operations;
using Movers.Domain.Pickups;
using Movers.Domain.Surveys;
using Movers.Services.Currencies;
using Movers.Services.Masters;
using Movers.Services.Numbering;
using Movers.Services.Operations;
using Movers.Services.Security;
using Movers.Services.Surveys;
using Movers.Services.Tenancy;

namespace Movers.Services.Delivery;

public sealed record SaveDeliveryCommand(DateTimeOffset ScheduledAtUtc, int DurationMinutes, string? Notes);
public sealed record DeliveryJobBoxInput(Guid JobId, Guid BoxId);
public sealed record LoadDeliveryCommand(IReadOnlyList<Guid>? WarehouseBoxIds, IReadOnlyList<DeliveryJobBoxInput>? JobBoxes);
public sealed record DeliveryCrewInput(Guid EmployeeId, string Role);
public sealed record SaveDeliveryCrewCommand(IReadOnlyList<DeliveryCrewInput> Crew, Guid? DriverEmployeeId, Guid? VehicleId);
public sealed record SetDeliveryItemCommand(string Status, string? ReceivedBy, string? Notes);
public sealed record UpdateDeliveryNoteCommand(string? ContactName, string? Phone, string? Address);
public sealed record SignDeliveryNoteCommand(string SignerName, string SignaturePng, string? Remarks, IReadOnlyList<Guid> DeliveredItemIds);
public sealed record AddDeliveryTransactionCommand(string Type, string Category, decimal Amount, string PaymentMethod, string? Notes, string? Currency, decimal? ExchangeRate, Guid? DeliveryNoteId);

public sealed record DeliveryJobModel(int SerialNo, Guid Id, string DeliveryNumber, string Status, DateTimeOffset ScheduledAtUtc, int DurationMinutes, string? Notes,
    Guid? VehicleId, string? VehicleName, Guid? DriverEmployeeId, string? DriverName, DateTimeOffset? StartedAtUtc, DateTimeOffset? CompletedAtUtc, bool IsPaused, decimal? DistanceKm,
    DateTimeOffset CreatedAtUtc, int ItemCount, int DeliveredCount, int ReturnedCount, int NoteCount, int SignedCount, IReadOnlyList<string> Customers);
public sealed record DeliveryCrewModel(Guid EmployeeId, string EmployeeName, string Role);
public sealed record DeliveryItemModel(int SerialNo, Guid Id, Guid DeliveryNoteId, Guid BoxId, string Source, Guid? TransportJobId, string TrackingNumber, string Description, string Contents,
    string Location, string Reference, string Status, DateTimeOffset LoadedAtUtc, string LoadedBy, DateTimeOffset? StatusAtUtc, string? ReceivedBy, string? Notes);
public sealed record DeliverySignedItem(string TrackingNumber, string Description, string Status, string? ReceivedBy);
public sealed record DeliveryNoteModel(Guid Id, string NoteNumber, string CustomerName, string? ContactName, string? Phone, string? Address, IReadOnlyList<DeliveryItemModel> Items,
    bool IsSigned, string? SignerName, string? SignaturePng, string? Remarks, DateTimeOffset? SignedAtUtc, string? SignedBy, IReadOnlyList<DeliverySignedItem> SignedItems, decimal Collected, DeliveryCustomerModel Customer);
/// <summary>An active customer link (the token itself is never stored or returned again).</summary>
public sealed record DeliveryLinkStatus(string Purpose, DateTimeOffset ExpiresAtUtc, DateTimeOffset CreatedAtUtc);
/// <summary>Customer responses on a note. DateResponseCurrent is false once the run was rescheduled after the customer answered.</summary>
public sealed record DeliveryCustomerModel(IReadOnlyList<DeliveryLinkStatus> Links, string? DateResponse, DateTimeOffset? PreferredAtUtc, DateTimeOffset? DateRespondedAtUtc, bool DateResponseCurrent,
    decimal? Latitude, decimal? Longitude, string? LocationNotes, DateTimeOffset? LocationSharedAtUtc);
public sealed record DeliveryLinkModel(string Purpose, string Token, DateTimeOffset ExpiresAtUtc);
/// <summary>What the customer sees on a link: their own note only, never other customers on the same run.</summary>
public sealed record PublicDeliveryNoteModel(string Purpose, string TenantName, string DeliveryNumber, string NoteNumber, string Status, bool IsClosed, string CustomerName, string? Address, DateTimeOffset ScheduledAtUtc, int PackageCount,
    string? DateResponse, DateTimeOffset? PreferredAtUtc, DateTimeOffset? DateRespondedAtUtc, bool DateResponseCurrent, decimal? Latitude, decimal? Longitude, string? LocationNotes, DateTimeOffset? LocationSharedAtUtc, DateTimeOffset ExpiresAtUtc);
public sealed record RespondDeliveryDateCommand(bool Confirmed, DateTimeOffset? PreferredAtUtc);
public sealed record ShareDeliveryLocationCommand(decimal? Latitude, decimal? Longitude, string? Address, string? Notes);
public sealed record DeliveryTransactionModel(int SerialNo, Guid Id, string TransactionNumber, string Type, string Category, decimal Amount, string PaymentMethod, string? Notes, DateTimeOffset CreatedAtUtc,
    string? Currency, decimal? BaseAmount, Guid? DeliveryNoteId, string? CustomerName);
public sealed record DeliveryCurrencyTotal(string Currency, decimal Income, decimal Expense);
public sealed record DeliveryAccountingModel(string BaseCurrency, decimal IncomeBase, decimal ExpenseBase, IReadOnlyList<DeliveryCurrencyTotal> Totals);
public sealed record DeliveryTimeEventModel(string Type, DateTimeOffset OccurredAtUtc, string? Reason, string RecordedBy);
public sealed record DeliveryClockModel(long ActiveSeconds, long PausedSeconds, IReadOnlyList<DeliveryTimeEventModel> Events);
public sealed record DeliveryDetailModel(DeliveryJobModel Job, IReadOnlyList<DeliveryCrewModel> Crew, IReadOnlyList<DeliveryNoteModel> Notes, IReadOnlyList<DeliveryTransactionModel> Transactions,
    DeliveryAccountingModel Accounting, DeliveryClockModel Clock);

/// <summary>What the delivery list needs of a note, without loading signature images.</summary>
public sealed record DeliveryNoteSummary(Guid DeliveryJobId, int SerialNo, string CustomerName, bool IsSigned);
public sealed record DeliveryChoice(string Code, string Name);
public sealed record DeliveryEmployeeOption(Guid Id, string Name);
public sealed record DeliveryVehicleOption(Guid Id, string RegistrationNumber, string Name, string? DriverName, string? DriverPhone);
public sealed record DeliveryMastersModel(IReadOnlyList<DeliveryEmployeeOption> Employees, IReadOnlyList<DeliveryVehicleOption> Vehicles, IReadOnlyList<DeliveryChoice> CrewRoles,
    IReadOnlyList<DeliveryChoice> PaymentMethods, IReadOnlyList<DeliveryChoice> IncomeCategories, IReadOnlyList<DeliveryChoice> ExpenseCategories);
/// <summary>A box on a transport job that can go out for delivery (the job has departed or arrived).</summary>
public sealed record DeliveryJobBox(Guid JobId, string JobNumber, string JobStatus, string Destination, WarehouseStock Box, WarehouseShipping? Shipping);
/// <summary>Packages that can be loaded: warehouse stock (boxes on a job are never listed here) and boxes on departed/arrived jobs.</summary>
public sealed record DeliveryAvailableModel(IReadOnlyList<WarehouseStock> Warehouse, IReadOnlyList<DeliveryJobBox> Jobs);

public interface IDeliveryRepository
{
    Task<IReadOnlyList<DeliveryJob>> Jobs(CancellationToken t);
    Task<DeliveryJob?> Job(Guid id, bool track, CancellationToken t);
    Task<IReadOnlyList<DeliveryJobCrew>> Crew(Guid jobId, bool track, CancellationToken t);
    Task<IReadOnlyList<DeliveryNote>> Notes(Guid jobId, bool track, CancellationToken t);
    Task<IReadOnlyList<DeliveryItem>> Items(Guid jobId, bool track, CancellationToken t);
    Task<IReadOnlyList<DeliveryItem>> AllItems(CancellationToken t);
    Task<IReadOnlyList<DeliveryNoteSummary>> NoteSummaries(CancellationToken t);
    Task<IReadOnlyList<DeliveryJobTransaction>> Transactions(Guid jobId, CancellationToken t);
    Task<IReadOnlyList<DeliveryJobTimeEvent>> TimeEvents(Guid jobId, CancellationToken t);
    /// <summary>Boxes held by a delivery: loaded or delivered on a live run, or delivered on a completed one.</summary>
    Task<IReadOnlyList<Guid>> HeldBoxIds(CancellationToken t);
    Task<IReadOnlyList<DeliveryNoteLink>> Links(Guid jobId, bool track, CancellationToken t);
    Task<(DeliveryNoteLink Link, DeliveryNote Note, DeliveryJob Job, Movers.Domain.Tenants.Tenant Tenant)?> SharedNote(string tokenHash, CancellationToken t);
    Task<IReadOnlyList<Employee>> ActiveEmployees(CancellationToken t);
    Task<IReadOnlyList<Vehicle>> Vehicles(CancellationToken t);
    Task<IReadOnlyDictionary<Guid, string>> EmployeeNames(CancellationToken t);
    void Add(object entity);
    void Remove(object entity);
    Task Save(CancellationToken t);
}

/// <summary>
/// Delivery runs: load packages from the warehouse or from transport jobs, one delivery note per customer, crew, driver
/// and vehicle, item-by-item delivery, customer signature per note, trip clock with distance, and money collected or spent
/// (to the accountant's cash queue as source DELIVERY). Package custody is kept in step through PackageHandover rows.
/// </summary>
public sealed class DeliveryService(IDeliveryRepository r, WarehouseService warehouse, IJobRepository jobs, BusinessMasterService masters, CurrencyService currencies,
    IRecordNumbers numbers, ITenantContext tenant, IUserContext user, TimeProvider clock, Movers.Services.Crew.ICrewRepository crewRepo)
{
    public const string SourceKind = "DELIVERY";
    public const int MaxSignatureLength = 400_000;
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    /* ---------- lookups ---------- */
    public async Task<DeliveryMastersModel> Masters(CancellationToken t)
    {
        async Task<IReadOnlyList<DeliveryChoice>> Choice(string kind) => (await masters.List(kind, t)).Where(x => x.IsActive).Select(x => new DeliveryChoice(x.Code, x.Name)).ToList();
        return new((await r.ActiveEmployees(t)).Select(e => new DeliveryEmployeeOption(e.Id, e.FullName)).OrderBy(e => e.Name).ToList(),
            (await r.Vehicles(t)).Where(v => v.IsActive).OrderBy(v => v.RegistrationNumber).Select(v => new DeliveryVehicleOption(v.Id, v.RegistrationNumber, v.Name, v.DriverName, v.DriverPhone)).ToList(),
            await Choice("crew-role"), await Choice("payment-method"), await Choice("payment-purpose"), await Choice("expense-category"));
    }

    public async Task<DeliveryAvailableModel> Available(CancellationToken t)
    {
        var held = (await r.HeldBoxIds(t)).ToHashSet();
        var list = new List<DeliveryJobBox>();
        foreach (var job in (await jobs.List(t)).Where(j => j.Status is "IN_TRANSIT" or "ARRIVED"))
        {
            var destination = JsonSerializer.Deserialize<JobDetails>(job.DetailsJson)?.DestinationPort ?? "";
            foreach (var cargo in (await jobs.Cargo(job.Id, t)).Where(c => c.IsActive && !held.Contains(c.BoxId)))
            {
                var snapshot = JsonSerializer.Deserialize<JobCargoSnapshot>(cargo.SnapshotJson)!;
                list.Add(new(job.Id, job.JobNumber, job.Status, destination, snapshot.Box, snapshot.Shipping));
            }
        }
        // Warehouse stock already leaves out boxes on jobs or deliveries.
        return new(await warehouse.Stock(t), list);
    }

    /* ---------- deliveries ---------- */
    public async Task<IReadOnlyList<DeliveryJobModel>> List(CancellationToken t)
    {
        var items = (await r.AllItems(t)).ToLookup(x => x.DeliveryJobId);
        var notes = (await r.NoteSummaries(t)).ToLookup(x => x.DeliveryJobId);
        var names = await r.EmployeeNames(t); var vehicles = (await r.Vehicles(t)).ToDictionary(x => x.Id);
        return (await r.Jobs(t)).OrderByDescending(x => x.SerialNo).Select(x => Model(x, items[x.Id].ToList(), notes[x.Id].ToList(), names, vehicles)).ToList();
    }

    public async Task<DeliveryDetailModel?> Get(Guid id, CancellationToken t) { var x = await r.Job(id, false, t); return x is null ? null : await Detail(x, t); }

    public async Task<DeliveryDetailModel> Create(SaveDeliveryCommand c, CancellationToken t)
    {
        Validate(c);
        var job = new DeliveryJob(tenant.TenantId, await numbers.Next("DL", t), c.ScheduledAtUtc, c.DurationMinutes, c.Notes);
        r.Add(job); await r.Save(t); return await Detail(job, t);
    }

    public async Task<DeliveryDetailModel?> Update(Guid id, SaveDeliveryCommand c, CancellationToken t)
    {
        Validate(c);
        var job = await Editable(id, t); if (job is null) return null;
        job.Update(c.ScheduledAtUtc, c.DurationMinutes, c.Notes);
        await CheckCrewClashes(job, (await r.Crew(id, false, t)).Select(x => (Guid?)x.EmployeeId).Append(job.DriverEmployeeId), t);
        await r.Save(t); return await Detail(job, t);
    }

    /* ---------- loading ---------- */
    /// <summary>
    /// Loads packages from warehouse stock or from departed/arrived transport jobs. A box on a job is not in warehouse stock,
    /// so it can only be loaded through its job. Each customer gets (or reuses) an unsigned delivery note.
    /// </summary>
    public async Task<DeliveryDetailModel?> Load(Guid id, LoadDeliveryCommand c, CancellationToken t)
    {
        var job = await Editable(id, t); if (job is null) return null;
        if (job.Status != DeliveryStatuses.Planned) throw new InvalidOperationException("Packages can only be loaded before the delivery leaves.");
        var warehouseIds = c.WarehouseBoxIds ?? []; var jobBoxes = c.JobBoxes ?? [];
        var all = warehouseIds.Concat(jobBoxes.Select(x => x.BoxId)).ToList();
        if (all.Count is < 1 or > 200 || all.Distinct().Count() != all.Count) throw new InvalidOperationException("Select 1 to 200 different packages.");

        var stock = (await warehouse.Stock(t)).ToDictionary(x => x.Id);
        if (warehouseIds.Any(b => !stock.ContainsKey(b)))
            throw new OperationConflictException("A selected package is no longer in the warehouse. Packages loaded onto a job can only be added from that job. Refresh and try again.");
        var available = (await Available(t)).Jobs.ToDictionary(x => (x.JobId, x.Box.Id));
        if (jobBoxes.Any(b => !available.ContainsKey((b.JobId, b.BoxId))))
            throw new OperationConflictException("A selected job package is not available. The job must have departed or arrived, and the package must not be on another delivery.");

        var receipts = await warehouse.Receipts(t);
        var notes = (await r.Notes(id, true, t)).ToList();
        var now = clock.GetUtcNow(); var by = RecordedBy();
        async Task<DeliveryNote> NoteFor(string customer, WarehouseShipping? shipping, ReceiptSnapshot? receipt)
        {
            var note = notes.FirstOrDefault(n => !n.IsSigned && n.CustomerName.Equals(customer.Trim(), StringComparison.OrdinalIgnoreCase));
            if (note is not null) return note;
            note = new DeliveryNote(tenant.TenantId, id, await numbers.Next("DN", t), customer, shipping?.Consignee?.Name,
                shipping?.Consignee?.Phone ?? receipt?.Phone, shipping?.DropAddress ?? shipping?.Consignee?.Address ?? receipt?.Address);
            r.Add(note); notes.Add(note); return note;
        }
        ReceiptSnapshot? ReceiptOf(Guid boxId) => receipts.FirstOrDefault(x => x.Details.Boxes.Any(b => b.Id == boxId))?.Details;

        foreach (var boxId in warehouseIds)
        {
            var box = stock[boxId]; var receipt = ReceiptOf(boxId);
            var pickupId = box.Source == "PICKUP" ? await jobs.PickupId(boxId, t) ?? throw new InvalidOperationException("Pickup box no longer exists.") : (Guid?)null;
            var note = await NoteFor(box.CustomerName, receipt?.Shipping, receipt);
            r.Add(new DeliveryItem(tenant.TenantId, id, note.Id, boxId, DeliverySources.Warehouse, null, pickupId, box.TrackingNumber, box.Description, box.Contents, box.WarehouseId, box.Location, box.Reference, now, by));
            // Leaving the warehouse: same custody step as loading onto a transport job.
            if (pickupId.HasValue) Handover(pickupId.Value, boxId, "IN_TRANSIT", job.DeliveryNumber, by, "Loaded from warehouse for delivery", null, now);
        }
        foreach (var x in jobBoxes)
        {
            var a = available[(x.JobId, x.BoxId)];
            var note = await NoteFor(a.Box.CustomerName, a.Shipping, ReceiptOf(x.BoxId));
            var pickupId = a.Box.Source == "PICKUP" ? await jobs.PickupId(x.BoxId, t) : null;
            r.Add(new DeliveryItem(tenant.TenantId, id, note.Id, x.BoxId, DeliverySources.Job, x.JobId, pickupId, a.Box.TrackingNumber, a.Box.Description, a.Box.Contents, a.Box.WarehouseId, a.JobNumber, a.JobNumber, now, by));
        }
        job.Touch(); await r.Save(t); return await Detail(job, t);
    }

    /// <summary>Takes a package off a delivery that has not left yet; a warehouse box goes back to its warehouse location.</summary>
    public async Task<DeliveryDetailModel?> Unload(Guid id, Guid itemId, CancellationToken t)
    {
        var job = await Editable(id, t); if (job is null) return null;
        if (job.Status != DeliveryStatuses.Planned) throw new InvalidOperationException("Once the delivery has left, mark the package as not delivered instead.");
        var items = await r.Items(id, true, t);
        var item = items.SingleOrDefault(x => x.Id == itemId) ?? throw new KeyNotFoundException();
        if (item.Source == DeliverySources.Warehouse && item.PickupId.HasValue) Handover(item.PickupId.Value, item.BoxId, "WAREHOUSE", item.Location, RecordedBy(), "Taken off delivery " + job.DeliveryNumber, item.WarehouseId, clock.GetUtcNow());
        r.Remove(item);
        // A customer note with nothing left on it (and no money recorded against it) is removed too.
        if (!items.Any(x => x.DeliveryNoteId == item.DeliveryNoteId && x.Id != itemId) && !(await r.Transactions(id, t)).Any(x => x.DeliveryNoteId == item.DeliveryNoteId))
        {
            var note = (await r.Notes(id, true, t)).SingleOrDefault(x => x.Id == item.DeliveryNoteId);
            if (note is not null && !note.IsSigned) { foreach (var l in (await r.Links(id, true, t)).Where(l => l.DeliveryNoteId == note.Id)) r.Remove(l); r.Remove(note); }
        }
        job.Touch(); await r.Save(t); return await Detail(job, t);
    }

    /* ---------- delivery of each package ---------- */
    public async Task<DeliveryDetailModel?> SetItemStatus(Guid id, Guid itemId, SetDeliveryItemCommand c, CancellationToken t)
    {
        var status = (c.Status ?? "").Trim().ToUpperInvariant();
        if (!DeliveryItemStatuses.All.Contains(status)) throw new InvalidOperationException("Choose delivered, not delivered or loaded.");
        if (c.ReceivedBy?.Length > 160 || c.Notes?.Length > 500) throw new InvalidOperationException("Received by or notes are too long.");
        var job = await Editable(id, t); if (job is null) return null;
        if (job.Status != DeliveryStatuses.OutForDelivery) throw new InvalidOperationException("Start the delivery before marking packages delivered.");
        var item = (await r.Items(id, true, t)).SingleOrDefault(x => x.Id == itemId) ?? throw new KeyNotFoundException();
        var note = (await r.Notes(id, false, t)).Single(x => x.Id == item.DeliveryNoteId);
        if (note.IsSigned) throw new InvalidOperationException("Delivery note " + note.NoteNumber + " is signed; its packages can no longer change.");
        item.SetStatus(status, c.ReceivedBy, c.Notes, clock.GetUtcNow(), RecordedBy());
        job.Touch(); await r.Save(t); return await Detail(job, t);
    }

    /* ---------- delivery notes ---------- */
    public async Task<DeliveryDetailModel?> UpdateNote(Guid id, Guid noteId, UpdateDeliveryNoteCommand c, CancellationToken t)
    {
        if (c.ContactName?.Length > 160 || c.Phone?.Length > 40 || c.Address?.Length > 500) throw new InvalidOperationException("Receiver, phone or address is too long.");
        var job = await Editable(id, t); if (job is null) return null;
        var note = (await r.Notes(id, true, t)).SingleOrDefault(x => x.Id == noteId) ?? throw new KeyNotFoundException();
        if (note.IsSigned) throw new InvalidOperationException("A signed delivery note cannot change.");
        note.UpdateContact(c.ContactName, c.Phone, c.Address);
        job.Touch(); await r.Save(t); return await Detail(job, t);
    }

    /// <summary>
    /// The customer signs the delivery note. The listed packages are marked delivered (received by the signer); the
    /// signature is stored with the exact package list it covers, and the note's packages are then locked.
    /// </summary>
    public async Task<DeliveryDetailModel?> Sign(Guid id, Guid noteId, SignDeliveryNoteCommand c, CancellationToken t)
    {
        if (string.IsNullOrWhiteSpace(c.SignerName) || c.SignerName.Length > 160) throw new InvalidOperationException("Enter who is signing.");
        if (c.Remarks?.Length > 1000) throw new InvalidOperationException("Keep remarks under 1,000 characters.");
        if (string.IsNullOrEmpty(c.SignaturePng) || !c.SignaturePng.StartsWith("data:image/png;base64,", StringComparison.Ordinal) || c.SignaturePng.Length > MaxSignatureLength)
            throw new InvalidOperationException("Capture the customer's signature.");
        var job = await Editable(id, t); if (job is null) return null;
        if (job.Status != DeliveryStatuses.OutForDelivery) throw new InvalidOperationException("Start the delivery before taking the customer's signature.");
        var note = (await r.Notes(id, true, t)).SingleOrDefault(x => x.Id == noteId) ?? throw new KeyNotFoundException();
        if (note.IsSigned) throw new InvalidOperationException("This delivery note is already signed.");
        var items = (await r.Items(id, true, t)).Where(x => x.DeliveryNoteId == noteId).OrderBy(x => x.SerialNo).ToList();
        var wanted = (c.DeliveredItemIds ?? []).ToHashSet();
        if (wanted.Any(w => items.All(i => i.Id != w))) throw new InvalidOperationException("A selected package is not on this delivery note.");
        var now = clock.GetUtcNow(); var by = RecordedBy();
        foreach (var item in items.Where(i => wanted.Contains(i.Id) && i.Status != DeliveryItemStatuses.Delivered))
            item.SetStatus(DeliveryItemStatuses.Delivered, c.SignerName, item.Notes, now, by);
        if (!items.Any(i => i.Status == DeliveryItemStatuses.Delivered)) throw new InvalidOperationException("Select at least one package the customer received.");
        var signed = items.Select(i => new DeliverySignedItem(i.TrackingNumber, i.Description, i.Status, i.ReceivedBy)).ToList();
        note.Sign(c.SignerName, c.SignaturePng, c.Remarks, JsonSerializer.Serialize(signed, Web), now, by);
        job.Touch(); await r.Save(t); return await Detail(job, t);
    }

    /* ---------- crew, driver, vehicle ---------- */
    public async Task<DeliveryDetailModel?> SaveCrew(Guid id, SaveDeliveryCrewCommand c, CancellationToken t)
    {
        var job = await Editable(id, t); if (job is null) return null;
        var crew = c.Crew ?? [];
        var employees = (await r.ActiveEmployees(t)).Select(x => x.Id).ToHashSet();
        if (crew.Any(x => !employees.Contains(x.EmployeeId)) || c.DriverEmployeeId is { } d && !employees.Contains(d)) throw new InvalidOperationException("Assigned employee was not found or is inactive.");
        if (crew.GroupBy(x => x.EmployeeId).Any(g => g.Count() > 1)) throw new InvalidOperationException("Assign each employee once.");
        if (crew.Any(x => string.IsNullOrWhiteSpace(x.Role) || x.Role.Length > 80)) throw new InvalidOperationException("Give every crew member a role.");
        if (c.VehicleId is { } v && !(await r.Vehicles(t)).Any(x => x.Id == v && x.IsActive)) throw new InvalidOperationException("Select an active vehicle.");
        await CheckCrewClashes(job, crew.Select(x => (Guid?)x.EmployeeId).Append(c.DriverEmployeeId), t);

        foreach (var x in await r.Crew(id, true, t)) r.Remove(x);
        foreach (var x in crew)
        {
            var membership = (await crewRepo.OpenMembershipsForEmployeeAsync(x.EmployeeId, t)).OrderByDescending(m => m.JoinedAtUtc).FirstOrDefault();
            var team = membership is null ? null : await crewRepo.TeamAsync(membership.TeamId, false, t);
            r.Add(new DeliveryJobCrew(tenant.TenantId, id, x.EmployeeId, x.Role, team?.Id, team?.Name, clock.GetUtcNow()));
        }
        job.Assign(c.VehicleId, c.DriverEmployeeId);
        await r.Save(t); return await Detail(job, t);
    }

    private async Task CheckCrewClashes(DeliveryJob job, IEnumerable<Guid?> people, CancellationToken t)
    {
        var ids = people.Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();
        if (ids.Count == 0) return;
        var clashes = Movers.Services.Crew.ScheduleConflicts.Find(ids, job.ScheduledAtUtc, job.ScheduledAtUtc.AddMinutes(job.DurationMinutes), SourceKind, job.Id,
            await crewRepo.BookingsAsync(t), (await crewRepo.EmployeesAsync(t)).ToDictionary(e => e.Id, e => e.FirstName + " " + e.LastName));
        if (clashes.Count > 0) throw new InvalidOperationException(Movers.Services.Crew.ScheduleConflicts.Describe(clashes));
    }

    /* ---------- trip ---------- */
    public async Task<DeliveryDetailModel?> Start(Guid id, DateTimeOffset? at, CancellationToken t)
    {
        var job = await Editable(id, t); if (job is null) return null;
        if (job.Status != DeliveryStatuses.Planned) throw new InvalidOperationException("The delivery has already left.");
        if ((await r.Items(id, false, t)).Count == 0) throw new InvalidOperationException("Load at least one package before the delivery leaves.");
        var stepAt = TripClock.StepTime(at, null, true, clock.GetUtcNow());
        job.Start(stepAt); AddEvent(id, SurveyTimeEventTypes.Started, stepAt, null);
        await r.Save(t); return await Detail(job, t);
    }

    public async Task<DeliveryDetailModel?> Pause(Guid id, string? reason, DateTimeOffset? at, CancellationToken t)
    {
        if (string.IsNullOrWhiteSpace(reason) || reason.Length > 500) throw new InvalidOperationException("Enter why the delivery is paused.");
        var job = await Editable(id, t); if (job is null) return null;
        var stepAt = await NextStep(job, at, t); job.Pause(); AddEvent(id, SurveyTimeEventTypes.Paused, stepAt, reason);
        await r.Save(t); return await Detail(job, t);
    }

    public async Task<DeliveryDetailModel?> Resume(Guid id, DateTimeOffset? at, CancellationToken t)
    {
        var job = await Editable(id, t); if (job is null) return null;
        var stepAt = await NextStep(job, at, t); job.Resume(); AddEvent(id, SurveyTimeEventTypes.Resumed, stepAt, null);
        await r.Save(t); return await Detail(job, t);
    }

    /// <summary>
    /// Ends the run with the distance covered. Every package must be marked delivered or not delivered. Delivered pickup
    /// boxes get a DELIVERED handover; undelivered warehouse boxes return to their warehouse location (job boxes stay with the job).
    /// </summary>
    public async Task<DeliveryDetailModel?> Complete(Guid id, DateTimeOffset? at, decimal? distanceKm, CancellationToken t)
    {
        var job = await Editable(id, t); if (job is null) return null;
        if (job.Status != DeliveryStatuses.OutForDelivery) throw new InvalidOperationException("Start the delivery before completing it.");
        var items = await r.Items(id, false, t);
        var open = items.Count(x => x.Status == DeliveryItemStatuses.Loaded);
        if (open > 0) throw new InvalidOperationException($"Mark every package delivered or not delivered first ({open} still loaded).");
        var stepAt = await NextStep(job, at, t);
        var notes = (await r.Notes(id, false, t)).ToDictionary(x => x.Id); var by = RecordedBy();
        foreach (var item in items.Where(x => x.PickupId.HasValue))
        {
            if (item.Status == DeliveryItemStatuses.Delivered)
            {
                var note = notes[item.DeliveryNoteId];
                Handover(item.PickupId!.Value, item.BoxId, "DELIVERED", Trim(note.Address ?? note.CustomerName, 500), Trim(item.ReceivedBy ?? note.SignerName ?? note.CustomerName, 160),
                    "Delivered on " + job.DeliveryNumber + " · " + note.NoteNumber, null, item.StatusAtUtc ?? stepAt);
            }
            else if (item.Source == DeliverySources.Warehouse)
                Handover(item.PickupId!.Value, item.BoxId, "WAREHOUSE", item.Location, by, "Not delivered on " + job.DeliveryNumber + "; returned to the warehouse", item.WarehouseId, stepAt);
        }
        job.Complete(stepAt, distanceKm); AddEvent(id, SurveyTimeEventTypes.Completed, stepAt, null);
        await r.Save(t); return await Detail(job, t);
    }

    public async Task<DeliveryDetailModel?> RecordDistance(Guid id, decimal? distanceKm, CancellationToken t)
    {
        var job = await r.Job(id, true, t); if (job is null) return null;
        if (job.Status == DeliveryStatuses.Cancelled) throw new InvalidOperationException("This delivery is cancelled.");
        job.RecordDistance(distanceKm); await r.Save(t); return await Detail(job, t);
    }

    /// <summary>Cancels a run on which nothing was delivered; warehouse boxes go back to their locations.</summary>
    public async Task<DeliveryDetailModel?> Cancel(Guid id, CancellationToken t)
    {
        var job = await Editable(id, t); if (job is null) return null;
        var items = await r.Items(id, true, t);
        if (items.Any(x => x.Status == DeliveryItemStatuses.Delivered) || (await r.Notes(id, false, t)).Any(n => n.IsSigned))
            throw new InvalidOperationException("Packages have been delivered on this run. Complete it instead, marking undelivered packages as not delivered.");
        var now = clock.GetUtcNow(); var by = RecordedBy();
        foreach (var item in items)
        {
            if (item.Source == DeliverySources.Warehouse && item.PickupId.HasValue) Handover(item.PickupId.Value, item.BoxId, "WAREHOUSE", item.Location, by, "Delivery " + job.DeliveryNumber + " cancelled", item.WarehouseId, now);
            item.SetStatus(DeliveryItemStatuses.Returned, null, item.Notes, now, by);
        }
        job.Cancel(); await r.Save(t); return await Detail(job, t);
    }

    /* ---------- money ---------- */
    public async Task<DeliveryDetailModel?> AddTransaction(Guid id, AddDeliveryTransactionCommand c, CancellationToken t)
    {
        var job = await r.Job(id, true, t); if (job is null) return null;
        if (job.Status == DeliveryStatuses.Cancelled) throw new InvalidOperationException("This delivery is cancelled.");
        var type = (c.Type ?? "").Trim().ToUpperInvariant();
        if (c.Amount <= 0 || type is not ("INCOME" or "EXPENSE")) throw new InvalidOperationException("Enter a valid collection or expense.");
        if (string.IsNullOrWhiteSpace(c.Category) || c.Category.Length > 120) throw new InvalidOperationException("Choose a category.");
        if (string.IsNullOrWhiteSpace(c.PaymentMethod) || c.PaymentMethod.Length > 40) throw new InvalidOperationException("Choose a payment method.");
        if (c.Notes?.Length > 500) throw new InvalidOperationException("Keep notes under 500 characters.");
        if (type == "EXPENSE") await masters.EnsureActive("expense-category", c.Category, t);
        if (c.DeliveryNoteId is { } noteId && (await r.Notes(id, false, t)).All(n => n.Id != noteId)) throw new InvalidOperationException("Select a customer on this delivery.");
        var fx = await currencies.Resolve(c.Currency ?? (await currencies.Settings(t)).DefaultCurrency, DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime), c.ExchangeRate, t);
        CurrencyService.Amount(c.Amount, fx);
        var x = new DeliveryJobTransaction(tenant.TenantId, id, type == "INCOME" ? c.DeliveryNoteId : null, await numbers.Next("DLT", t), type, c.Category, c.Amount, c.PaymentMethod, c.Notes);
        await currencies.SaveSnapshot(x.Id, fx, t);
        r.Add(x); job.Touch(); await r.Save(t); return await Detail(job, t);
    }

    /* ---------- customer links (per delivery note and purpose) ---------- */
    /// <summary>Creates a customer's link for one purpose (confirm date, share location), replacing the previous one. Only the token's SHA-256 is stored.</summary>
    public async Task<DeliveryLinkModel?> CreateLink(Guid id, Guid noteId, string purpose, int days, CancellationToken t)
    {
        purpose = Purpose(purpose);
        if (days is < 1 or > 30) throw new InvalidOperationException("Link validity must be 1 to 30 days.");
        var job = await Editable(id, t); if (job is null) return null;
        var note = (await r.Notes(id, false, t)).SingleOrDefault(x => x.Id == noteId) ?? throw new KeyNotFoundException();
        if (note.IsSigned) throw new InvalidOperationException("This customer has already signed for their delivery.");
        foreach (var old in (await r.Links(id, true, t)).Where(x => x.DeliveryNoteId == noteId && x.Purpose == purpose)) r.Remove(old);
        var raw = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
        var expires = clock.GetUtcNow().AddDays(days);
        r.Add(new DeliveryNoteLink(tenant.TenantId, id, noteId, purpose, Sha256(raw), expires));
        job.Touch(); await r.Save(t);
        return new(purpose, raw, expires);
    }

    public async Task<DeliveryDetailModel?> RevokeLink(Guid id, Guid noteId, string purpose, CancellationToken t)
    {
        purpose = Purpose(purpose);
        var job = await r.Job(id, true, t); if (job is null) return null;
        foreach (var old in (await r.Links(id, true, t)).Where(x => x.DeliveryNoteId == noteId && x.Purpose == purpose)) r.Remove(old);
        job.Touch(); await r.Save(t); return await Detail(job, t);
    }

    public async Task<PublicDeliveryNoteModel?> Shared(string token, CancellationToken t)
    {
        var s = await SharedNote(token, null, false, t);
        return s is null ? null : await PublicModel(s, t);
    }

    /// <summary>Date link: the customer confirms the delivery time, or asks for another one. A run serves several customers,
    /// so a request does not move the run; the office sees it and reschedules or moves the customer.</summary>
    public async Task<PublicDeliveryNoteModel?> RespondDate(string token, RespondDeliveryDateCommand c, CancellationToken t)
    {
        var s = await SharedNote(token, DeliveryLinkPurposes.Schedule, true, t); if (s is null) return null;
        var now = clock.GetUtcNow();
        if (Closed(s.Job, s.Note)) throw new InvalidOperationException("This delivery is closed. Please contact us to make changes.");
        if (!c.Confirmed && (c.PreferredAtUtc is not { } preferred || preferred < now.AddHours(-1) || preferred > now.AddYears(1)))
            throw new InvalidOperationException("Choose a delivery date and time from now on.");
        s.Note.RespondDate(c.Confirmed, c.PreferredAtUtc, s.Job.ScheduledAtUtc, now);
        await r.Save(t); return await PublicModel(s, t);
    }

    /// <summary>Location link: the customer corrects the delivery address and adds directions, sharing the GPS position when they can (optional).</summary>
    public async Task<PublicDeliveryNoteModel?> ShareLocation(string token, ShareDeliveryLocationCommand c, CancellationToken t)
    {
        var s = await SharedNote(token, DeliveryLinkPurposes.Location, true, t); if (s is null) return null;
        if (Closed(s.Job, s.Note)) throw new InvalidOperationException("This delivery is closed. Please contact us to make changes.");
        if (c.Latitude.HasValue != c.Longitude.HasValue) throw new InvalidOperationException("The shared location is not valid.");
        if (c.Latitude is { } lat && c.Longitude is { } lon && (lat is < -90 or > 90 || lon is < -180 or > 180 || (lat == 0 && lon == 0))) throw new InvalidOperationException("The shared location is not valid.");
        if (!c.Latitude.HasValue && string.IsNullOrWhiteSpace(c.Address)) throw new InvalidOperationException("Enter the delivery address, or use your current location.");
        if (c.Address?.Length > 500 || c.Notes?.Length > 500) throw new InvalidOperationException("Address or directions are too long.");
        s.Note.ShareLocation(c.Latitude is { } la ? Math.Round(la, 6) : null, c.Longitude is { } lo ? Math.Round(lo, 6) : null, c.Address, c.Notes, clock.GetUtcNow());
        await r.Save(t); return await PublicModel(s, t);
    }

    private static string Purpose(string? purpose)
    {
        var p = (purpose ?? "").Trim().ToUpperInvariant();
        return DeliveryLinkPurposes.All.Contains(p) ? p : throw new InvalidOperationException("Choose a valid link type.");
    }

    private static bool Closed(DeliveryJob job, DeliveryNote note) => job.IsLocked || note.IsSigned;
    /// <summary>A date response applies only to the delivery time it answered.</summary>
    private static bool DateCurrent(DeliveryNote note, DeliveryJob job) => note.DateResponse is not null && note.DateRespondedForUtc == job.ScheduledAtUtc;

    private sealed record SharedLink(DeliveryNoteLink Link, DeliveryNote Note, DeliveryJob Job, string TenantName);
    /// <summary>Resolves a live link; with <paramref name="purpose"/>, the link must be for that purpose.</summary>
    private async Task<SharedLink?> SharedNote(string token, string? purpose, bool track, CancellationToken t)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 100) return null;
        var found = await r.SharedNote(Sha256(token), t);
        if (found is null || found.Value.Link.ExpiresAtUtc < clock.GetUtcNow()) return null;
        if (purpose is not null && found.Value.Link.Purpose != purpose) throw new InvalidOperationException("This link cannot be used for that.");
        if (!tenant.IsResolved) tenant.SetTenant(found.Value.Tenant);
        var note = track ? (await r.Notes(found.Value.Job.Id, true, t)).SingleOrDefault(x => x.Id == found.Value.Note.Id) : found.Value.Note;
        return note is null ? null : new(found.Value.Link, note, found.Value.Job, found.Value.Tenant.Name);
    }

    private async Task<PublicDeliveryNoteModel> PublicModel(SharedLink s, CancellationToken t)
    {
        var packages = (await r.Items(s.Job.Id, false, t)).Count(i => i.DeliveryNoteId == s.Note.Id);
        return new(s.Link.Purpose, s.TenantName, s.Job.DeliveryNumber, s.Note.NoteNumber, s.Job.Status, Closed(s.Job, s.Note), s.Note.CustomerName, s.Note.Address, s.Job.ScheduledAtUtc, packages,
            s.Note.DateResponse, s.Note.PreferredAtUtc, s.Note.DateRespondedAtUtc, DateCurrent(s.Note, s.Job), s.Note.Latitude, s.Note.Longitude, s.Note.LocationNotes, s.Note.LocationSharedAtUtc, s.Link.ExpiresAtUtc);
    }

    private static string Sha256(string x) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(x))).ToLowerInvariant();

    /* ---------- helpers ---------- */
    private static void Validate(SaveDeliveryCommand c)
    {
        if (c.ScheduledAtUtc == default) throw new InvalidOperationException("Choose the delivery date and time.");
        if (c.Notes?.Length > 2000) throw new InvalidOperationException("Keep notes under 2,000 characters.");
    }

    private async Task<DeliveryJob?> Editable(Guid id, CancellationToken t)
    {
        var job = await r.Job(id, true, t);
        if (job?.IsLocked == true) throw new InvalidOperationException("This delivery is " + job.Status.ToLowerInvariant() + " and can no longer change.");
        return job;
    }

    private async Task<DateTimeOffset> NextStep(DeliveryJob job, DateTimeOffset? at, CancellationToken t) =>
        TripClock.StepTime(at, (await r.TimeEvents(job.Id, t)).LastOrDefault()?.OccurredAtUtc ?? job.StartedAtUtc, false, clock.GetUtcNow());

    private void AddEvent(Guid jobId, string type, DateTimeOffset at, string? reason) => r.Add(new DeliveryJobTimeEvent(tenant.TenantId, jobId, type, at, reason, RecordedBy()));

    private void Handover(Guid pickupId, Guid boxId, string status, string location, string receivedBy, string notes, Guid? warehouseId, DateTimeOffset at) =>
        r.Add(new PackageHandover(tenant.TenantId) { PickupId = pickupId, PackageId = boxId, Status = status, Location = Trim(location, 500), ReceivedBy = Trim(receivedBy, 160), Notes = notes,
            WarehouseId = warehouseId, RequestId = Guid.NewGuid(), RecordedAtUtc = at, ActorId = user.UserId ?? throw new InvalidOperationException("Sign in.") });

    private static string Trim(string value, int max) => value.Length <= max ? value : value[..max];
    private string RecordedBy() => string.IsNullOrWhiteSpace(user.Email) ? "Staff" : user.Email;

    private static DeliveryJobModel Model(DeliveryJob x, IReadOnlyList<DeliveryItem> items, IReadOnlyList<DeliveryNoteSummary> notes, IReadOnlyDictionary<Guid, string> names, IReadOnlyDictionary<Guid, Vehicle> vehicles) =>
        new(x.SerialNo, x.Id, x.DeliveryNumber, x.Status, x.ScheduledAtUtc, x.DurationMinutes, x.Notes,
            x.VehicleId, x.VehicleId is { } v && vehicles.TryGetValue(v, out var vehicle) ? vehicle.RegistrationNumber + " · " + vehicle.Name : null,
            x.DriverEmployeeId, x.DriverEmployeeId is { } d ? names.GetValueOrDefault(d) : null, x.StartedAtUtc, x.CompletedAtUtc, x.IsPaused, x.DistanceKm, x.CreatedAtUtc,
            items.Count, items.Count(i => i.Status == DeliveryItemStatuses.Delivered), items.Count(i => i.Status == DeliveryItemStatuses.Returned),
            notes.Count, notes.Count(n => n.IsSigned), notes.OrderBy(n => n.SerialNo).Select(n => n.CustomerName).Distinct().ToList());

    private async Task<DeliveryDetailModel> Detail(DeliveryJob job, CancellationToken t)
    {
        var names = await r.EmployeeNames(t);
        var crew = (await r.Crew(job.Id, false, t)).OrderBy(x => x.SerialNo).Select(c => new DeliveryCrewModel(c.EmployeeId, names.GetValueOrDefault(c.EmployeeId, "Unknown"), c.Role)).ToList();
        var items = await r.Items(job.Id, false, t); var notes = await r.Notes(job.Id, false, t);
        var transactions = new List<DeliveryTransactionModel>();
        foreach (var x in await r.Transactions(job.Id, t))
        {
            var fx = await currencies.Snapshot(x.Id, t);
            transactions.Add(new(x.SerialNo, x.Id, x.TransactionNumber, x.Type, x.Category, x.Amount, x.PaymentMethod, x.Notes, x.CreatedAtUtc, fx?.Currency, fx is null ? null : CurrencyService.ToBase(x.Amount, fx),
                x.DeliveryNoteId, notes.SingleOrDefault(n => n.Id == x.DeliveryNoteId)?.CustomerName));
        }
        var now = clock.GetUtcNow(); var links = (await r.Links(job.Id, false, t)).Where(l => l.ExpiresAtUtc > now).ToList();
        var noteModels = notes.OrderBy(n => n.SerialNo).Select(n => new DeliveryNoteModel(n.Id, n.NoteNumber, n.CustomerName, n.ContactName, n.Phone, n.Address,
            items.Where(i => i.DeliveryNoteId == n.Id).OrderBy(i => i.SerialNo).Select(i => new DeliveryItemModel(i.SerialNo, i.Id, i.DeliveryNoteId, i.BoxId, i.Source, i.TransportJobId, i.TrackingNumber, i.Description, i.Contents,
                i.Location, i.Reference, i.Status, i.LoadedAtUtc, i.LoadedBy, i.StatusAtUtc, i.ReceivedBy, i.Notes)).ToList(),
            n.IsSigned, n.SignerName, n.SignaturePng, n.Remarks, n.SignedAtUtc, n.SignedBy,
            n.SignedItemsJson is null ? [] : JsonSerializer.Deserialize<List<DeliverySignedItem>>(n.SignedItemsJson, Web) ?? [],
            transactions.Where(x => x.Type == "INCOME" && x.DeliveryNoteId == n.Id).Sum(x => x.BaseAmount ?? 0),
            new DeliveryCustomerModel(links.Where(l => l.DeliveryNoteId == n.Id).Select(l => new DeliveryLinkStatus(l.Purpose, l.ExpiresAtUtc, l.CreatedAtUtc)).ToList(),
                n.DateResponse, n.PreferredAtUtc, n.DateRespondedAtUtc, DateCurrent(n, job), n.Latitude, n.Longitude, n.LocationNotes, n.LocationSharedAtUtc))).ToList();
        var settings = await currencies.Settings(t);
        var accounting = new DeliveryAccountingModel(settings.BaseCurrency ?? "USD",
            transactions.Where(x => x.Type == "INCOME").Sum(x => x.BaseAmount ?? 0), transactions.Where(x => x.Type == "EXPENSE").Sum(x => x.BaseAmount ?? 0),
            transactions.GroupBy(x => x.Currency ?? "").Select(g => new DeliveryCurrencyTotal(g.Key, g.Where(x => x.Type == "INCOME").Sum(x => x.Amount), g.Where(x => x.Type == "EXPENSE").Sum(x => x.Amount))).ToList());
        var events = await r.TimeEvents(job.Id, t);
        var (active, paused) = TripClock.Durations(job.StartedAtUtc, job.CompletedAtUtc, events.Select(e => new TripClock.Step(e.Type, e.OccurredAtUtc)).ToList(), clock.GetUtcNow());
        return new(Model(job, items, notes.Select(n => new DeliveryNoteSummary(n.DeliveryJobId, n.SerialNo, n.CustomerName, n.IsSigned)).ToList(), names, (await r.Vehicles(t)).ToDictionary(x => x.Id)), crew, noteModels, transactions, accounting,
            new(active, paused, events.Select(e => new DeliveryTimeEventModel(e.Type, e.OccurredAtUtc, e.Reason, e.RecordedBy)).ToList()));
    }
}
