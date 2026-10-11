using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Movers.Domain.Operations;
using Movers.Domain.Tenants;
using Movers.Services.Pickups;
using Movers.Services.Security;
using Movers.Services.Tenancy;
namespace Movers.Services.Operations;

public sealed record SharePacking(int ValidDays, string LeftBehindNotes);
public sealed record PackingResponse(string Name, bool Confirmed, string? Notes, string SnapshotHash);
public sealed record PackingSnapshot(string PickupNumber, string CustomerName, string Address,
    IReadOnlyList<PackingSnapshotPackage> Packages, string LeftBehindNotes);
public sealed record PackingSnapshotPackage(Guid Id, string TrackingNumber, string BoxTypeName,
    IReadOnlyList<PickupPackageItemModel> Items);
public sealed record PublicPacking(PackingSnapshot Snapshot, string SnapshotHash, string Response,
    string? ResponderName, string? ResponseNotes, DateTimeOffset? RespondedAtUtc, DateTimeOffset ExpiresAtUtc);
public sealed record SharedPacking(string Token, DateTimeOffset ExpiresAtUtc);
public sealed record HandoverInput(Guid RequestId, Guid PackageId, string ExpectedStatus, string Status,
    string Location, string ReceivedBy, string? Notes, Guid? WarehouseId = null);
public sealed record ClaimInput(Guid PickupId, Guid? PackageId, string Category, string Description, string Owner);
public sealed record ResolveClaim(Guid Version, string Resolution);
public sealed record PackageLocation(Guid Id, string TrackingNumber, string Status, string Location,
    string ReceivedBy, DateTimeOffset? UpdatedAtUtc);
public sealed record ShipmentView(Guid PickupId, string PickupNumber, string CustomerName,
    IReadOnlyList<PackageLocation> Packages, IReadOnlyList<PackageHandover> History, IReadOnlyList<ShipmentClaim> Claims,
    bool PackingConfirmed, bool AllPackagesDelivered);
public interface IShipmentRepository
{
    Task<PackingConfirmation?> Confirmation(Guid pickupId, CancellationToken ct);
    Task<(PackingConfirmation Confirmation, Tenant Tenant)?> Resolve(string tokenHash, CancellationToken ct);
    Task<IReadOnlyList<PackageHandover>> History(Guid pickupId, CancellationToken ct);
    Task<IReadOnlyList<ShipmentClaim>> Claims(Guid pickupId, CancellationToken ct);
    Task<ShipmentClaim?> Claim(Guid id, CancellationToken ct);
}
public interface IShipmentService
{
    Task<ShipmentView> Get(Guid pickupId, CancellationToken ct);
    Task<SharedPacking> Share(Guid pickupId, SharePacking command, CancellationToken ct);
    Task Revoke(Guid pickupId, CancellationToken ct);
    Task<PublicPacking> Public(string token, CancellationToken ct);
    Task<PublicPacking> Respond(string token, PackingResponse command, CancellationToken ct);
    Task<ShipmentView> Handover(Guid pickupId, HandoverInput command, CancellationToken ct);
    Task<ShipmentClaim> Claim(ClaimInput command, CancellationToken ct);
    Task<ShipmentClaim> ResolveClaim(Guid id, ResolveClaim command, CancellationToken ct);
}

public sealed class ShipmentService(IShipmentRepository repository, IOperationsRepository unit, IJobRepository jobs,
    IPickupService pickups, IPickupRepository packaging, ITenantContext tenant, IUserContext user, TimeProvider clock) : IShipmentService
{
    public async Task<ShipmentView> Get(Guid pickupId, CancellationToken ct)
    {
        var detail = await pickups.Get(pickupId, ct) ?? throw new KeyNotFoundException();
        var history = await repository.History(pickupId, ct);
        var packages = detail.Packages.Select(p =>
        {
            var last = history.LastOrDefault(h => h.PackageId == p.Id);
            return new PackageLocation(p.Id, p.TrackingNumber, last?.Status ?? "PACKED",
                last?.Location ?? detail.Pickup.Address, last?.ReceivedBy ?? "", last?.RecordedAtUtc);
        }).ToList();
        var confirmation = await repository.Confirmation(pickupId, ct);
        return new(pickupId, detail.Pickup.PickupNumber, detail.Pickup.CustomerName, packages, history,
            await repository.Claims(pickupId, ct), confirmation?.Response == "CONFIRMED",
            packages.Count > 0 && packages.All(p => p.Status == "DELIVERED"));
    }
    public Task<SharedPacking> Share(Guid pickupId, SharePacking c, CancellationToken ct) => unit.Transaction(async () =>
    {
        if (c.ValidDays is < 1 or > 30) throw new InvalidOperationException("Link validity must be 1 to 30 days.");
        var detail = await pickups.Get(pickupId, ct) ?? throw new KeyNotFoundException();
        if (detail.Packages.Count == 0) throw new InvalidOperationException("Create and check packages before sharing.");
        var pickup = await packaging.Pickup(pickupId, true, ct) ?? throw new KeyNotFoundException();
        pickup.SetPackagesLocked(true);
        var previous = await repository.Confirmation(pickupId, ct);
        if (previous?.Response == "CONFIRMED") throw new InvalidOperationException("Packing has already been confirmed.");
        var snapshot = new PackingSnapshot(detail.Pickup.PickupNumber, detail.Pickup.CustomerName, detail.Pickup.Address,
            detail.Packages.Select(p => new PackingSnapshotPackage(p.Id, p.TrackingNumber, p.BoxTypeName, p.Items)).ToList(),
            Required(c.LeftBehindNotes, 2000));
        var json = JsonSerializer.Serialize(snapshot);
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var confirmation = previous ?? new PackingConfirmation(tenant.TenantId) { PickupId = pickupId };
        confirmation.SnapshotJson = json; confirmation.SnapshotHash = Hash(json); confirmation.TokenHash = Hash(token);
        confirmation.ExpiresAtUtc = clock.GetUtcNow().AddDays(c.ValidDays); confirmation.RevokedAtUtc = null;
        confirmation.Response = "PENDING"; confirmation.ResponderName = null; confirmation.ResponseNotes = null;
        confirmation.RespondedAtUtc = null; confirmation.Version = Guid.NewGuid();
        if (previous is null) unit.Add(confirmation);
        await unit.Save(ct); return new SharedPacking(token, confirmation.ExpiresAtUtc);
    }, ct);
    public async Task Revoke(Guid pickupId, CancellationToken ct) => await unit.Transaction(async () =>
    {
        var confirmation = await repository.Confirmation(pickupId, ct) ?? throw new KeyNotFoundException();
        if (confirmation.Response != "CONFIRMED" && (await repository.History(pickupId, ct)).Count == 0)
        {
            var pickup = await packaging.Pickup(pickupId, true, ct) ?? throw new KeyNotFoundException();
            pickup.SetPackagesLocked(false);
        }
        confirmation.RevokedAtUtc = clock.GetUtcNow(); confirmation.Version = Guid.NewGuid(); await unit.Save(ct); return true;
    }, ct);
    public async Task<PublicPacking> Public(string token, CancellationToken ct)
    {
        var confirmation = await Resolve(token, ct);
        return View(confirmation);
    }
    public Task<PublicPacking> Respond(string token, PackingResponse c, CancellationToken ct) => unit.Transaction(async () =>
    {
        var confirmation = await Resolve(token, ct);
        if (confirmation.SnapshotHash != c.SnapshotHash) throw new OperationConflictException("The packing list changed. Open the latest link.");
        var name = Required(c.Name, 160);
        var notes = c.Confirmed ? Optional(c.Notes, 2000) : Required(c.Notes, 2000);
        var response = c.Confirmed ? "CONFIRMED" : "DISPUTED";
        if (confirmation.Response != "PENDING")
        {
            if (confirmation.Response == response && confirmation.ResponderName == name && confirmation.ResponseNotes == notes) return View(confirmation);
            throw new OperationConflictException("A response is already recorded. Contact the move coordinator to resolve changes.");
        }
        confirmation.Response = response; confirmation.ResponderName = name; confirmation.ResponseNotes = notes;
        confirmation.RespondedAtUtc = clock.GetUtcNow(); confirmation.Version = Guid.NewGuid();
        await unit.Save(ct); return View(confirmation);
    }, ct);
    public Task<ShipmentView> Handover(Guid pickupId, HandoverInput c, CancellationToken ct) => unit.Transaction(async () =>
    {
        if (c.RequestId == Guid.Empty) throw new InvalidOperationException("A request ID is required.");
        var shipment = await Get(pickupId, ct);
        var package = shipment.Packages.SingleOrDefault(p => p.Id == c.PackageId) ?? throw new InvalidOperationException("Scan a package belonging to this move.");
        var existing = shipment.History.SingleOrDefault(h => h.RequestId == c.RequestId);
        if (existing is not null)
        {
            if (existing.PackageId != c.PackageId || existing.Status != c.Status || existing.Location != c.Location.Trim() ||
                existing.ReceivedBy != c.ReceivedBy.Trim() || existing.Notes != (c.Notes?.Trim() ?? ""))
                throw new OperationConflictException("This request ID has already been used.");
            return shipment;
        }
        if ((await jobs.ActiveBoxIds(ct)).Contains(c.PackageId)) throw new OperationConflictException("This box is assigned to a job or delivery. Manage its movement there.");
        if (package.Status != c.ExpectedStatus) throw new OperationConflictException("The package has moved. Refresh its location.");
        // Custody moves on the crew's and the warehouse's record, not the customer's confirmation.
        string[] allowed = package.Status switch
        {
            "PACKED" => ["WAREHOUSE", "IN_TRANSIT"],
            "WAREHOUSE" => ["IN_TRANSIT"],
            "IN_TRANSIT" => ["WAREHOUSE", "ARRIVED", "DELIVERED"],
            // Arrived at the destination port: it still has to be stored or delivered from there.
            "ARRIVED" => ["WAREHOUSE", "DELIVERED"],
            _ => []
        };
        if (!allowed.Contains(c.Status)) throw new InvalidOperationException("This package transition is not allowed.");
        unit.Add(new PackageHandover(tenant.TenantId)
        {
            PickupId = pickupId, PackageId = c.PackageId, Status = c.Status,
            Location = Required(c.Location, 500), ReceivedBy = Required(c.ReceivedBy, 160), Notes = Optional(c.Notes, 2000),
            RequestId = c.RequestId, RecordedAtUtc = clock.GetUtcNow(), ActorId = user.UserId ?? throw new InvalidOperationException("Sign in."),
            WarehouseId = c.Status == "WAREHOUSE" ? c.WarehouseId : null
        });
        await unit.Save(ct); return await Get(pickupId, ct);
    }, ct);
    public Task<ShipmentClaim> Claim(ClaimInput c, CancellationToken ct) => unit.Transaction(async () =>
    {
        var shipment = await Get(c.PickupId, ct);
        if (c.PackageId.HasValue && !shipment.Packages.Any(x => x.Id == c.PackageId)) throw new InvalidOperationException("Package does not belong to this move.");
        if (!new[] { "MISSING", "DAMAGED", "LEFT_BEHIND", "LATE", "OTHER" }.Contains(c.Category)) throw new InvalidOperationException("Choose a claim type.");
        var claim = new ShipmentClaim(tenant.TenantId) { PickupId = c.PickupId, PackageId = c.PackageId, Category = c.Category,
            Description = Required(c.Description, 2000), Owner = Required(c.Owner, 160), CreatedAtUtc = clock.GetUtcNow() };
        unit.Add(claim); await unit.Save(ct); return claim;
    }, ct);
    public Task<ShipmentClaim> ResolveClaim(Guid id, ResolveClaim c, CancellationToken ct) => unit.Transaction(async () =>
    {
        var claim = await repository.Claim(id, ct) ?? throw new KeyNotFoundException();
        if (claim.Version != c.Version) throw new OperationConflictException("Claim changed. Refresh.");
        if (claim.Status == "RESOLVED") throw new InvalidOperationException("Claim is already resolved.");
        claim.Resolution = Required(c.Resolution, 2000); claim.Status = "RESOLVED";
        claim.ResolvedAtUtc = clock.GetUtcNow(); claim.Version = Guid.NewGuid(); await unit.Save(ct); return claim;
    }, ct);
    private async Task<PackingConfirmation> Resolve(string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 200) throw new KeyNotFoundException();
        var resolved = await repository.Resolve(Hash(token), ct) ?? throw new KeyNotFoundException();
        var c = resolved.Confirmation;
        if (c.RevokedAtUtc.HasValue || c.ExpiresAtUtc <= clock.GetUtcNow()) throw new KeyNotFoundException();
        if (!tenant.IsResolved) tenant.SetTenant(resolved.Tenant);
        if (tenant.TenantId != resolved.Tenant.Id) throw new KeyNotFoundException();
        return c;
    }
    private static PublicPacking View(PackingConfirmation c) => new(JsonSerializer.Deserialize<PackingSnapshot>(c.SnapshotJson)!,
        c.SnapshotHash, c.Response, c.ResponderName, c.ResponseNotes, c.RespondedAtUtc, c.ExpiresAtUtc);
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private static string Required(string? value, int max) { var text = Optional(value, max); if (text.Length == 0) throw new InvalidOperationException("Complete all required fields."); return text; }
    private static string Optional(string? value, int max) { var text = value?.Trim() ?? ""; if (text.Length > max) throw new InvalidOperationException($"Text is limited to {max} characters."); return text; }
}

