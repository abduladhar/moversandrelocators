using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Movers.Domain.Operations;
using Movers.Services.Masters;
using Movers.Services.Numbering;
using Movers.Services.Security;
using Movers.Services.Tenancy;
namespace Movers.Services.Operations;
public sealed record JobDetails(string Mode, string OriginPort, string DestinationPort, string? OriginAgentCode = null, string? DestinationAgentCode = null,
    string? Carrier = null, string? FlightNumber = null, string? AirWaybill = null, string? VesselName = null, string? VoyageNumber = null,
    string? BillOfLading = null, string? ContainerNumber = null, string? SealNumber = null, string? TruckNumber = null, string? TrailerNumber = null,
    string? DriverName = null, string? DriverPhone = null, string? RoadReference = null, DateTimeOffset? EstimatedDeparture = null, DateTimeOffset? EstimatedArrival = null,
    string? Notes = null, string? OriginAgentName = null, string? DestinationAgentName = null);
public sealed record CreateJob(Guid RequestId, JobDetails Details);
public sealed record EditJob(Guid ExpectedVersion, JobDetails Details);
public sealed record LoadJob(Guid ExpectedVersion, IReadOnlyList<Guid> BoxIds, string LoadedBy);
public sealed record JobStep(Guid ExpectedVersion);
public sealed record JobCargoSnapshot(WarehouseStock Box, WarehouseShipping? Shipping);
public sealed record JobCargoModel(Guid Id, Guid BoxId, bool IsActive, DateTimeOffset LoadedAtUtc, string LoadedBy, DateTimeOffset? UnloadedAtUtc, string? UnloadedBy, JobCargoSnapshot Details);
public sealed record JobModel(Guid Id, string JobNumber, string Status, Guid Version, DateTimeOffset CreatedAtUtc, DateTimeOffset? DepartedAtUtc, DateTimeOffset? ArrivedAtUtc, JobDetails Details, IReadOnlyList<JobCargoModel> Cargo);
public interface IJobRepository {
    Task<IReadOnlyList<TransportJob>> List(CancellationToken ct);
    Task<TransportJob?> Get(Guid id, CancellationToken ct);
    Task<TransportJob?> Request(Guid id, CancellationToken ct);
    Task<IReadOnlyList<JobCargo>> Cargo(Guid jobId, CancellationToken ct);
    Task<IReadOnlyList<Guid>> ActiveBoxIds(CancellationToken ct);
    Task<Guid?> PickupId(Guid boxId, CancellationToken ct);
}
public sealed class JobService(IJobRepository repository, IOperationsRepository unit, WarehouseService warehouse, BusinessMasterService masters,
    IRecordNumbers numbers, ITenantContext tenant, IUserContext user, TimeProvider clock) {
    public async Task<IReadOnlyList<JobModel>> List(CancellationToken ct) {
        var result = new List<JobModel>(); foreach (var job in await repository.List(ct)) result.Add(await Map(job, ct)); return result;
    }
    public async Task<JobModel> Get(Guid id, CancellationToken ct) => await Map(await Require(id, ct), ct);
    public async Task<JobModel> Create(CreateJob c, CancellationToken ct) {
        if (c.RequestId == Guid.Empty) throw new InvalidOperationException("Request ID is required.");
        var hash = Hash(c); var prior = await repository.Request(c.RequestId, ct);
        if (prior is not null) { if (prior.RequestHash != hash) throw new OperationConflictException("Request ID already used with different job details."); return await Map(prior, ct); }
        var details = await Validate(c.Details, null, ct);
        var number = await numbers.Next("JOB", ct);
        return await unit.Transaction(async () => {
            var existing = await repository.Request(c.RequestId, ct);
            if (existing is not null) { if (existing.RequestHash != hash) throw new OperationConflictException("Request ID already used."); return await Map(existing, ct); }
            var job = new TransportJob(tenant.TenantId) { JobNumber = number, RequestId = c.RequestId, RequestHash = hash, DetailsJson = JsonSerializer.Serialize(details), CreatedAtUtc = clock.GetUtcNow() };
            unit.Add(job); await unit.Save(ct); return await Map(job, ct);
        }, ct);
    }
    public Task<JobModel> Edit(Guid id, EditJob c, CancellationToken ct) => unit.Transaction(async () => {
        var job = await Require(id, ct); Check(job, c.ExpectedVersion); Editable(job);
        job.DetailsJson = JsonSerializer.Serialize(await Validate(c.Details, Details(job), ct)); job.Version = Guid.NewGuid();
        await unit.Save(ct); return await Map(job, ct);
    }, ct);
    public Task<JobModel> Load(Guid id, LoadJob c, CancellationToken ct) => unit.Transaction(async () => {
        var job = await Require(id, ct); Check(job, c.ExpectedVersion); Editable(job); Required(c.LoadedBy, 160, "Loaded by");
        if (c.BoxIds is null || c.BoxIds.Count is < 1 or > 200 || c.BoxIds.Distinct().Count() != c.BoxIds.Count) throw new InvalidOperationException("Select 1 to 200 different warehouse boxes.");
        var stock = (await warehouse.Stock(ct)).ToDictionary(x => x.Id);
        if (c.BoxIds.Any(id => !stock.ContainsKey(id))) throw new OperationConflictException("A selected box is no longer available in the warehouse. Refresh and select available boxes.");
        var receipts = await warehouse.Receipts(ct);
        foreach (var boxId in c.BoxIds) {
            var box = stock[boxId]; var pickupId = box.Source == "PICKUP" ? await repository.PickupId(boxId, ct) : null;
            if (box.Source == "PICKUP" && pickupId is null) throw new InvalidOperationException("Pickup box no longer exists.");
            var shipping = receipts.FirstOrDefault(x => x.Details.Boxes.Any(b => b.Id == boxId))?.Details.Shipping;
            unit.Add(new JobCargo(tenant.TenantId) { JobId = job.Id, BoxId = boxId, PickupId = pickupId, LoadedAtUtc = clock.GetUtcNow(), LoadedBy = c.LoadedBy.Trim(), SnapshotJson = JsonSerializer.Serialize(new JobCargoSnapshot(box, shipping)) });
            if (pickupId.HasValue) unit.Add(new PackageHandover(tenant.TenantId) { PickupId = pickupId.Value, PackageId = boxId, Status = "IN_TRANSIT", Location = job.JobNumber,
                ReceivedBy = c.LoadedBy.Trim(), Notes = "Loaded from warehouse onto job", RequestId = Guid.NewGuid(), RecordedAtUtc = clock.GetUtcNow(), ActorId = Actor() });
        }
        job.Status = "LOADING"; job.Version = Guid.NewGuid(); await unit.Save(ct); return await Map(job, ct);
    }, ct);
    public Task<JobModel> Unload(Guid id, Guid cargoId, JobStep c, CancellationToken ct) => unit.Transaction(async () => {
        var job = await Require(id, ct); Check(job, c.ExpectedVersion); Editable(job);
        var all = await repository.Cargo(id, ct);
        var cargo = all.SingleOrDefault(x => x.Id == cargoId && x.IsActive) ?? throw new KeyNotFoundException();
        var snapshot = JsonSerializer.Deserialize<JobCargoSnapshot>(cargo.SnapshotJson)!;
        cargo.IsActive = false; cargo.UnloadedAtUtc = clock.GetUtcNow(); cargo.UnloadedBy = user.Email ?? "Staff";
        if (cargo.PickupId.HasValue) unit.Add(new PackageHandover(tenant.TenantId) { PickupId = cargo.PickupId.Value, PackageId = cargo.BoxId, Status = "WAREHOUSE", WarehouseId = snapshot.Box.WarehouseId,
            Location = snapshot.Box.Location, ReceivedBy = cargo.UnloadedBy, Notes = $"Returned from {job.JobNumber} before departure", RequestId = Guid.NewGuid(), RecordedAtUtc = clock.GetUtcNow(), ActorId = Actor() });
        job.Status = all.Any(x => x.IsActive) ? "LOADING" : "DRAFT"; job.Version = Guid.NewGuid();
        await unit.Save(ct); return await Map(job, ct);
    }, ct);
    public Task<JobModel> Step(Guid id, string action, JobStep c, CancellationToken ct) => unit.Transaction(async () => {
        var job = await Require(id, ct); Check(job, c.ExpectedVersion);
        if (action == "depart") {
            Editable(job); var details = Details(job);
            if (!(await repository.Cargo(id, ct)).Any(x => x.IsActive)) throw new InvalidOperationException("Load at least one warehouse box before departure.");
            if (details.Mode == "AIR") { Required(details.Carrier, 160, "Airline"); Required(details.FlightNumber, 160, "Flight number"); }
            if (details.Mode == "OCEAN") { Required(details.VesselName, 160, "Vessel name"); Required(details.VoyageNumber, 160, "Voyage number"); }
            if (details.Mode == "ROAD") { Required(details.TruckNumber, 160, "Truck registration"); Required(details.DriverName, 160, "Driver name"); }
            job.Status = "IN_TRANSIT"; job.DepartedAtUtc = clock.GetUtcNow();
        } else if (action == "arrive") {
            if (job.Status != "IN_TRANSIT") throw new InvalidOperationException("Only a departed job can arrive at the destination port.");
            job.Status = "ARRIVED"; job.ArrivedAtUtc = clock.GetUtcNow();
            // The job arriving is the cargo arriving. Without a handover per box the packages stay IN_TRANSIT
            // against the job number, and the tracking list disagrees with the job.
            var arrival = Details(job); var arrivedBy = user.Email ?? "Staff";
            foreach (var cargo in (await repository.Cargo(id, ct)).Where(x => x.IsActive && x.PickupId.HasValue))
                unit.Add(new PackageHandover(tenant.TenantId) {
                    PickupId = cargo.PickupId!.Value, PackageId = cargo.BoxId, Status = "ARRIVED",
                    Location = arrival.DestinationPort, ReceivedBy = arrivedBy, Notes = $"Arrived at destination on {job.JobNumber}",
                    RequestId = Guid.NewGuid(), RecordedAtUtc = clock.GetUtcNow(), ActorId = Actor() });
        } else if (action == "cancel") {
            Editable(job); if ((await repository.Cargo(id, ct)).Any(x => x.IsActive)) throw new InvalidOperationException("Return all loaded boxes to the warehouse before cancelling."); job.Status = "CANCELLED";
        } else throw new InvalidOperationException("Unknown job action.");
        job.Version = Guid.NewGuid(); await unit.Save(ct); return await Map(job, ct);
    }, ct);
    private async Task<JobDetails> Validate(JobDetails c, JobDetails? previous, CancellationToken ct) {
        Required(c.Mode, 10, "Transport mode"); Required(c.OriginPort, 160, "Origin port / terminal"); Required(c.DestinationPort, 160, "Destination port / terminal");
        var mode = c.Mode.Trim().ToUpperInvariant(); if (mode is not ("AIR" or "OCEAN" or "ROAD")) throw new InvalidOperationException("Choose Air, Ocean or Road.");
        if (c.OriginPort.Trim().Equals(c.DestinationPort.Trim(), StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Origin and destination must be different.");
        foreach (var value in new[] { c.Carrier, c.FlightNumber, c.AirWaybill, c.VesselName, c.VoyageNumber, c.BillOfLading, c.ContainerNumber, c.SealNumber, c.TruckNumber, c.TrailerNumber, c.DriverName, c.RoadReference }) if (value?.Length > 160) throw new InvalidOperationException("Transport details must be 160 characters or fewer per field.");
        if (c.DriverPhone?.Length > 40 || c.Notes?.Length > 2000) throw new InvalidOperationException("Phone or notes exceed the allowed length.");
        if (c.EstimatedDeparture.HasValue && c.EstimatedArrival < c.EstimatedDeparture) throw new InvalidOperationException("Estimated arrival must follow estimated departure.");
        var agents = await masters.List("vendor", ct);
        string? Agent(string? code, string? oldCode, string? oldName) {
            if (string.IsNullOrWhiteSpace(code)) return null;
            if (code == oldCode) return oldName;
            return agents.SingleOrDefault(x => x.Code == code && x.IsActive && x.IsAgent)?.Name ?? throw new InvalidOperationException("Select an active vendor marked as an agent, or leave the agent blank.");
        }
        return c with { Mode = mode, OriginPort = c.OriginPort.Trim(), DestinationPort = c.DestinationPort.Trim(), OriginAgentCode = string.IsNullOrWhiteSpace(c.OriginAgentCode) ? null : c.OriginAgentCode,
            DestinationAgentCode = string.IsNullOrWhiteSpace(c.DestinationAgentCode) ? null : c.DestinationAgentCode,
            OriginAgentName = Agent(c.OriginAgentCode, previous?.OriginAgentCode, previous?.OriginAgentName), DestinationAgentName = Agent(c.DestinationAgentCode, previous?.DestinationAgentCode, previous?.DestinationAgentName),
            FlightNumber = mode == "AIR" ? c.FlightNumber : null, AirWaybill = mode == "AIR" ? c.AirWaybill : null,
            VesselName = mode == "OCEAN" ? c.VesselName : null, VoyageNumber = mode == "OCEAN" ? c.VoyageNumber : null, BillOfLading = mode == "OCEAN" ? c.BillOfLading : null, ContainerNumber = mode == "OCEAN" ? c.ContainerNumber : null, SealNumber = mode == "OCEAN" ? c.SealNumber : null,
            TruckNumber = mode == "ROAD" ? c.TruckNumber : null, TrailerNumber = mode == "ROAD" ? c.TrailerNumber : null, DriverName = mode == "ROAD" ? c.DriverName : null, DriverPhone = mode == "ROAD" ? c.DriverPhone : null, RoadReference = mode == "ROAD" ? c.RoadReference : null };
    }
    private async Task<TransportJob> Require(Guid id, CancellationToken ct) => await repository.Get(id, ct) ?? throw new KeyNotFoundException();
    private async Task<JobModel> Map(TransportJob job, CancellationToken ct) => new(job.Id, job.JobNumber, job.Status, job.Version, job.CreatedAtUtc, job.DepartedAtUtc, job.ArrivedAtUtc, Details(job),
        (await repository.Cargo(job.Id, ct)).Select(x => new JobCargoModel(x.Id, x.BoxId, x.IsActive, x.LoadedAtUtc, x.LoadedBy, x.UnloadedAtUtc, x.UnloadedBy, JsonSerializer.Deserialize<JobCargoSnapshot>(x.SnapshotJson)!)).ToList());
    private static JobDetails Details(TransportJob job) => JsonSerializer.Deserialize<JobDetails>(job.DetailsJson)!;
    private static void Check(TransportJob job, Guid version) { if (job.Version != version) throw new OperationConflictException("This job changed. Refresh before continuing."); }
    private static void Editable(TransportJob job) { if (job.Status is not ("DRAFT" or "LOADING")) throw new InvalidOperationException("Only jobs that have not departed can be edited or have boxes loaded or returned."); }
    private Guid Actor() => user.UserId ?? throw new InvalidOperationException("Sign in.");
    private static void Required(string? value, int max, string field) { if (string.IsNullOrWhiteSpace(value) || value.Trim().Length > max) throw new InvalidOperationException($"{field} is required and must be at most {max} characters."); }
    private static string Hash<T>(T value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value))));
}
