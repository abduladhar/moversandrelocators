using Movers.Domain.Packing;
using Movers.Domain.Pickups;
using Movers.Services.Security;
using Movers.Services.Tenancy;

namespace Movers.Services.Pickups;

public interface IPickupCollectionService
{
    Task<PickupCollectionModel?> GetAsync(Guid pickupId, CancellationToken t);
    Task<IReadOnlyList<SelectablePackingJobModel>> SelectableJobsAsync(Guid pickupId, string? search, CancellationToken t);
    Task<PickupCollectionModel?> AddJobsAsync(Guid pickupId, AddPackingJobsCommand c, CancellationToken t);
    Task<PickupCollectionModel?> RemoveJobAsync(Guid pickupId, Guid packingJobId, CancellationToken t);
    Task<PickupCollectionModel?> SetBoxStatusAsync(Guid pickupId, SetBoxStatusCommand c, CancellationToken t);
    Task<PickupCollectionModel?> SetConditionAsync(Guid pickupId, SetBoxConditionCommand c, CancellationToken t);
    Task<PickupCollectionModel?> AddManualBoxAsync(Guid pickupId, AddManualBoxCommand c, CancellationToken t);
    Task<PickupCollectionModel?> ScanAsync(Guid pickupId, ScanBoxCommand c, CancellationToken t);
    Task<PickupCollectionModel?> BulkAsync(Guid pickupId, BulkBoxStatusCommand c, CancellationToken t);
    Task<IReadOnlyList<CollectionEventModel>> HistoryAsync(Guid pickupId, string? source, Guid? boxId, CancellationToken t);
    Task<PickupCollectionModel?> ApproveAsync(Guid pickupId, ApproveCollectionCommand c, CancellationToken t);
    Task<PickupCollectionModel?> ReopenAsync(Guid pickupId, ReopenCollectionCommand c, CancellationToken t);
}

/// <summary>Collecting a pickup: which packing jobs it covers, what happened to every expected box, and the
/// warehouse approval that closes it.</summary>
public sealed class PickupCollectionService(IPickupCollectionRepository repo, ITenantContext tenant, IUserContext user, TimeProvider clock, Movers.Services.Numbering.IRecordNumbers numbers) : IPickupCollectionService
{
    private string Actor() => string.IsNullOrWhiteSpace(user.Email) ? "Staff" : user.Email;
    private bool CanReopen() => user.HasPermission(SecurityPermissions.PickupCollectionReopen);

    public async Task<PickupCollectionModel?> GetAsync(Guid pickupId, CancellationToken t)
    {
        if (await repo.PickupAsync(pickupId, t) is not { } p) return null;
        // Boxes packed at the pickup are expected too, whether or not a packing job was ever added, so the
        // crew can record and collect them from the same checklist.
        if (!(await repo.LatestApprovalAsync(pickupId, track: false, t) is { } a && !a.IsOpen))
        {
            var known = (await repo.PicksAsync(pickupId, track: false, t)).Select(x => (x.Source, x.BoxId)).ToHashSet();
            if (await SyncOwnPackagesAsync(pickupId, known, t)) await repo.Save(t);
        }
        return await BuildAsync(p, t);
    }

    /// <summary>Adds a box straight onto the collection - for goods the customer packed themselves. It creates
    /// the package one row at a time, unlike saving the packing list, which replaces every row.</summary>
    public async Task<PickupCollectionModel?> AddManualBoxAsync(Guid pickupId, AddManualBoxCommand c, CancellationToken t)
    {
        if (await repo.PickupAsync(pickupId, t) is not { } pickup) return null;
        await GuardOpenAsync(pickupId, t);
        if (pickup.PackagesLocked) throw new InvalidOperationException("Packing is shared or confirmed, so boxes cannot be added.");
        if (await repo.BoxTypeAsync(c.BoxTypeId, t) is null) throw new InvalidOperationException("Select an active box type.");
        var copies = c.Copies <= 0 ? 1 : Math.Min(c.Copies, 50);

        var now = clock.GetUtcNow();
        for (var i = 0; i < copies; i++)
        {
            var package = new PickupPackage(tenant.TenantId, pickupId, c.BoxTypeId, await numbers.Next("PKG", t), c.Notes, c.RoomName, c.IsFragile);
            repo.Add(package);
            repo.Add(new PickupBoxPick(tenant.TenantId, pickupId, PickupBoxSources.Pickup, package.Id, package.TrackingNumber, null, now, Actor()));
        }
        await repo.Save(t);
        return await BuildAsync(pickup, t);
    }

    public async Task<PickupCollectionModel?> SetConditionAsync(Guid pickupId, SetBoxConditionCommand c, CancellationToken t)
    {
        if (await repo.PickupAsync(pickupId, t) is not { } pickup) return null;
        await GuardOpenAsync(pickupId, t);
        if (!PickupBoxSources.IsValid(c.Source)) throw new InvalidOperationException("Unknown box source.");
        if (!PickupBoxConditions.IsValid(c.Condition)) throw new InvalidOperationException("Unknown condition.");
        if (await repo.PickAsync(pickupId, c.Source, c.BoxId, track: true, t) is not { } pick) throw new InvalidOperationException("That box is not expected on this pickup.");
        if (c.Condition == PickupBoxConditions.Damaged && string.IsNullOrWhiteSpace(c.Notes))
            throw new InvalidOperationException("Describe the damage before marking the box damaged.");
        pick.SetCondition(c.Condition, c.Notes, clock.GetUtcNow(), Actor());
        // Condition belongs in the same trail as the picking, so one history answers what was found and when.
        repo.Add(new PickupBoxPickEvent(tenant.TenantId, pickupId, pick.Source, pick.BoxId, pick.TrackingNumber, pick.Status, pick.Status,
            "COND:" + c.Condition, clock.GetUtcNow(), Actor(), c.Notes));
        await repo.Save(t);
        return await BuildAsync(pickup, t);
    }

    public async Task<IReadOnlyList<SelectablePackingJobModel>> SelectableJobsAsync(Guid pickupId, string? search, CancellationToken t)
    {
        var jobs = await repo.SelectableJobsAsync(pickupId, search, t);
        if (jobs.Count == 0) return [];
        var boxes = await repo.JobBoxesAsync(jobs.Select(x => x.Id).ToList(), t);
        var elsewhere = await repo.PicksForBoxesElsewhereAsync(pickupId, boxes.Select(b => b.Id).ToList(), t);
        var taken = elsewhere.Where(x => x.Status is PickupBoxStatuses.Picked or PickupBoxStatuses.Pending).Select(x => x.BoxId).ToHashSet();
        return jobs.Select(j =>
        {
            var mine = boxes.Where(b => b.PackingJobId == j.Id).ToList();
            var gone = mine.Count(b => taken.Contains(b.Id));
            return new SelectablePackingJobModel(j.Id, j.JobNumber, j.Status, j.CustomerName, j.Address, j.ScheduledAtUtc, mine.Count, gone, mine.Count - gone);
        }).ToList();
    }

    public async Task<PickupCollectionModel?> AddJobsAsync(Guid pickupId, AddPackingJobsCommand c, CancellationToken t)
    {
        if (await repo.PickupAsync(pickupId, t) is not { } pickup) return null;
        await GuardOpenAsync(pickupId, t);
        var existing = (await repo.LinksAsync(pickupId, t)).Select(x => x.PackingJobId).ToHashSet();
        var picks = await repo.PicksAsync(pickupId, track: false, t);
        var known = picks.Select(x => (x.Source, x.BoxId)).ToHashSet();
        var now = clock.GetUtcNow();

        foreach (var jobId in c.PackingJobIds.Distinct())
        {
            if (existing.Contains(jobId)) continue;
            if (await repo.PackingJobAsync(jobId, t) is not { } job) throw new InvalidOperationException("Packing job not found.");
            repo.Add(new PickupPackingJob(tenant.TenantId, pickupId, job.Id, now, Actor()));

            // Every box becomes an expected row straight away, so the crew sees the full count before touching anything.
            foreach (var box in await repo.JobBoxesAsync(job.Id, t))
            {
                if (!known.Add((PickupBoxSources.Packing, box.Id))) continue;
                repo.Add(new PickupBoxPick(tenant.TenantId, pickupId, PickupBoxSources.Packing, box.Id, box.TrackingNumber, job.Id, now, Actor()));
            }
        }

        await SyncOwnPackagesAsync(pickupId, known, t);
        await repo.Save(t);
        return await BuildAsync(pickup, t);
    }

    public async Task<PickupCollectionModel?> RemoveJobAsync(Guid pickupId, Guid packingJobId, CancellationToken t)
    {
        if (await repo.PickupAsync(pickupId, t) is not { } pickup) return null;
        await GuardOpenAsync(pickupId, t);
        if (await repo.LinkAsync(pickupId, packingJobId, track: true, t) is not { } link) return await BuildAsync(pickup, t);

        var picks = await repo.PicksAsync(pickupId, track: true, t);
        var mine = picks.Where(x => x.PackingJobId == packingJobId).ToList();
        // A box that was actually handled stays on the record; only untouched rows disappear with the job.
        if (mine.Any(x => x.Status != PickupBoxStatuses.Pending))
            throw new InvalidOperationException("Boxes from this job have already been marked. Set them back to pending before removing the job.");
        repo.RemoveRange(mine);
        repo.Remove(link);
        await repo.Save(t);
        return await BuildAsync(pickup, t);
    }

    public async Task<PickupCollectionModel?> SetBoxStatusAsync(Guid pickupId, SetBoxStatusCommand c, CancellationToken t)
    {
        if (await repo.PickupAsync(pickupId, t) is not { } pickup) return null;
        await GuardOpenAsync(pickupId, t);
        if (!PickupBoxSources.IsValid(c.Source)) throw new InvalidOperationException("Unknown box source.");
        if (!PickupBoxStatuses.IsValid(c.Status)) throw new InvalidOperationException("Unknown box status.");
        if (!PickupPickMethods.IsValid(c.Method)) throw new InvalidOperationException("Unknown method.");
        if (await repo.PickAsync(pickupId, c.Source, c.BoxId, track: true, t) is not { } pick) throw new InvalidOperationException("That box is not expected on this pickup.");
        Move(pick, c.Status, c.Method, c.Reason);
        await repo.Save(t);
        return await BuildAsync(pickup, t);
    }

    public async Task<PickupCollectionModel?> ScanAsync(Guid pickupId, ScanBoxCommand c, CancellationToken t)
    {
        if (await repo.PickupAsync(pickupId, t) is not { } pickup) return null;
        await GuardOpenAsync(pickupId, t);
        var status = string.IsNullOrWhiteSpace(c.Status) ? PickupBoxStatuses.Picked : c.Status;
        if (!PickupBoxStatuses.IsValid(status)) throw new InvalidOperationException("Unknown box status.");
        var code = (c.TrackingNumber ?? "").Trim();
        if (code.Length == 0) throw new InvalidOperationException("Scan a label.");
        if (await repo.PickByTrackingAsync(pickupId, code, track: true, t) is not { } pick)
            throw new InvalidOperationException("Label " + code + " is not expected on this pickup.");
        Move(pick, status, PickupPickMethods.Scan, c.Reason);
        await repo.Save(t);
        return await BuildAsync(pickup, t);
    }

    public async Task<PickupCollectionModel?> BulkAsync(Guid pickupId, BulkBoxStatusCommand c, CancellationToken t)
    {
        if (await repo.PickupAsync(pickupId, t) is not { } pickup) return null;
        await GuardOpenAsync(pickupId, t);
        if (!PickupBoxStatuses.IsValid(c.Status)) throw new InvalidOperationException("Unknown box status.");
        var picks = await repo.PicksAsync(pickupId, track: true, t);
        // "Mark all" still writes one row per box, so a count never costs traceability.
        foreach (var pick in picks.Where(x => c.PackingJobId is null || x.PackingJobId == c.PackingJobId).Where(x => x.Status != c.Status))
            Move(pick, c.Status, PickupPickMethods.Bulk, c.Reason);
        await repo.Save(t);
        return await BuildAsync(pickup, t);
    }

    public async Task<IReadOnlyList<CollectionEventModel>> HistoryAsync(Guid pickupId, string? source, Guid? boxId, CancellationToken t)
    {
        var events = source is not null && boxId is not null
            ? await repo.EventsAsync(pickupId, source, boxId.Value, t)
            : await repo.EventsAsync(pickupId, t);
        return events.Select(x => new CollectionEventModel(x.Id, x.Source, x.BoxId, x.TrackingNumber, x.FromStatus, x.ToStatus, x.Method, x.OccurredAtUtc, x.Actor, x.Notes)).ToList();
    }

    public async Task<PickupCollectionModel?> ApproveAsync(Guid pickupId, ApproveCollectionCommand c, CancellationToken t)
    {
        if (await repo.PickupAsync(pickupId, t) is not { } pickup) return null;
        await GuardOpenAsync(pickupId, t);
        var picks = await repo.PicksAsync(pickupId, track: false, t);
        if (picks.Count == 0) throw new InvalidOperationException("Add a packing job before approving the collection.");

        var pending = picks.Count(x => x.Status == PickupBoxStatuses.Pending);
        if (pending > 0) throw new InvalidOperationException(pending + " box(es) are still unmarked. Mark every box as picked, missing or removed first.");
        var missing = picks.Count(x => x.Status == PickupBoxStatuses.Missing);
        if (missing > 0 && !c.AcceptMissing) throw new InvalidOperationException(missing + " box(es) are missing. Approve again confirming the shortage to continue.");
        if (c.WarehouseId is { } w && await repo.WarehouseAsync(w, t) is null) throw new InvalidOperationException("Warehouse not found.");

        repo.Add(new PickupCollectionApproval(tenant.TenantId, pickupId, c.WarehouseId,
            picks.Count(x => x.Status == PickupBoxStatuses.Picked), missing, picks.Count(x => x.Status == PickupBoxStatuses.Excluded),
            clock.GetUtcNow(), Actor(), c.Notes));
        await repo.Save(t);
        return await BuildAsync(pickup, t);
    }

    public async Task<PickupCollectionModel?> ReopenAsync(Guid pickupId, ReopenCollectionCommand c, CancellationToken t)
    {
        if (await repo.PickupAsync(pickupId, t) is not { } pickup) return null;
        if (!CanReopen()) throw new UnauthorizedAccessException("Reopening an approved collection needs the " + SecurityPermissions.PickupCollectionReopen + " permission.");
        if (string.IsNullOrWhiteSpace(c.Reason)) throw new InvalidOperationException("Give a reason for reopening.");
        if (await repo.LatestApprovalAsync(pickupId, track: true, t) is not { } approval || approval.IsOpen)
            throw new InvalidOperationException("This collection is not approved.");
        approval.Reopen(clock.GetUtcNow(), Actor(), c.Reason);
        await repo.Save(t);
        return await BuildAsync(pickup, t);
    }

    /// <summary>Refuses every change once the warehouse has approved, until someone with the permission reopens it.</summary>
    private async Task GuardOpenAsync(Guid pickupId, CancellationToken t)
    {
        if (await repo.LatestApprovalAsync(pickupId, track: false, t) is { } a && !a.IsOpen)
            throw new InvalidOperationException("The warehouse approved this collection on " + a.ApprovedAtUtc.ToString("u") + ". Reopen it to make changes.");
    }

    private void Move(PickupBoxPick pick, string status, string method, string? reason)
    {
        if (pick.Status == status) return;
        var from = pick.Status;
        if (status == PickupBoxStatuses.Pending) pick.Reset(clock.GetUtcNow(), Actor(), method);
        else pick.MoveTo(status, clock.GetUtcNow(), Actor(), method, reason);
        repo.Add(new PickupBoxPickEvent(tenant.TenantId, pick.PickupId, pick.Source, pick.BoxId, pick.TrackingNumber, from, status, method, clock.GetUtcNow(), Actor(), reason));
    }

    /// <summary>The pickup's own packed boxes are expected too, so they appear in the same checklist.
    /// Saving the packing list deletes and recreates those rows under new ids, keeping only the tracking number,
    /// so matching is by label: an existing pick is re-pointed rather than duplicated, and its photos follow it.
    /// Returns true when anything changed.</summary>
    private async Task<bool> SyncOwnPackagesAsync(Guid pickupId, HashSet<(string, Guid)> known, CancellationToken t)
    {
        var packages = await repo.PickupPackagesAsync(pickupId, t);
        var picks = await repo.PicksAsync(pickupId, track: true, t);
        var own = picks.Where(x => x.Source == PickupBoxSources.Pickup).ToList();
        var media = await repo.BoxAttachmentsAsync(pickupId, track: true, t);
        var changed = false;

        foreach (var p in packages)
        {
            var match = own.FirstOrDefault(x => x.TrackingNumber == p.TrackingNumber);
            if (match is null)
            {
                if (!known.Add((PickupBoxSources.Pickup, p.Id))) continue;
                repo.Add(new PickupBoxPick(tenant.TenantId, pickupId, PickupBoxSources.Pickup, p.Id, p.TrackingNumber, null, clock.GetUtcNow(), Actor()));
                changed = true;
                continue;
            }
            if (match.BoxId == p.Id) { known.Add((PickupBoxSources.Pickup, p.Id)); continue; }
            foreach (var m in media.Where(m => m.BoxSource == PickupBoxSources.Pickup && m.BoxId == match.BoxId)) m.RelinkBox(p.Id);
            match.Relink(p.Id);
            known.Add((PickupBoxSources.Pickup, p.Id));
            changed = true;
        }

        // A label that no longer exists was deleted from the packing list. Untouched rows go with it; anything
        // the crew acted on stays, because its history is the record of what happened.
        var labels = packages.Select(x => x.TrackingNumber).ToHashSet();
        var gone = own.Where(x => !labels.Contains(x.TrackingNumber) && x.Status == PickupBoxStatuses.Pending
            && x.Condition == PickupBoxConditions.NotChecked
            && !media.Any(m => m.BoxSource == PickupBoxSources.Pickup && m.BoxId == x.BoxId)).ToList();
        if (gone.Count > 0) { repo.RemoveRange(gone); changed = true; }
        return changed;
    }

    private async Task<PickupCollectionModel> BuildAsync(Pickup pickup, CancellationToken t)
    {
        var links = await repo.LinksAsync(pickup.Id, t);
        var jobIds = links.Select(x => x.PackingJobId).ToList();
        var picks = await repo.PicksAsync(pickup.Id, track: false, t);
        var jobBoxes = await repo.JobBoxesAsync(jobIds, t);
        var ownPackages = await repo.PickupPackagesAsync(pickup.Id, t);
        var boxTypes = (await repo.BoxTypesAsync(t)).ToDictionary(x => x.Id, x => x.Name);
        var jobs = new List<PackingJob>();
        foreach (var id in jobIds) if (await repo.PackingJobAsync(id, t) is { } j) jobs.Add(j);
        var jobNumber = jobs.ToDictionary(x => x.Id, x => x.JobNumber);
        var media = await repo.BoxAttachmentsAsync(pickup.Id, t);

        var boxes = picks.Select(p =>
        {
            var jb = p.Source == PickupBoxSources.Packing ? jobBoxes.FirstOrDefault(b => b.Id == p.BoxId) : null;
            var own = p.Source == PickupBoxSources.Pickup ? ownPackages.FirstOrDefault(b => b.Id == p.BoxId) : null;
            var typeId = jb?.BoxTypeId ?? own?.BoxTypeId;
            return new CollectionBoxModel(p.BoxId, p.Source, p.TrackingNumber,
                typeId is { } ti && boxTypes.TryGetValue(ti, out var name) ? name : "Box",
                jb?.RoomName ?? own?.RoomName, jb?.IsFragile ?? own?.IsFragile ?? false, jb?.Notes ?? own?.Notes, 0,
                p.PackingJobId, p.PackingJobId is { } pj && jobNumber.TryGetValue(pj, out var jn) ? jn : null,
                p.AddedBy, p.AddedAtUtc,
                p.Status, p.StatusAtUtc, p.StatusBy, p.Method, p.StatusReason,
                p.Condition, p.ConditionNotes, p.ConditionAtUtc, p.ConditionBy,
                media.Where(m => m.BoxSource == p.Source && m.BoxId == p.BoxId)
                     .Select(m => new CollectionMediaModel(m.Id, m.OriginalFileName, m.ContentType, m.StoredSizeBytes ?? m.DeclaredSizeBytes, m.IsUploaded, m.UploadedBy, m.CreatedAtUtc)).ToList(),
                p.Version);
        }).OrderBy(x => x.PackingJobNumber ?? "~").ThenBy(x => x.TrackingNumber).ToList();

        int Count(string s) => picks.Count(x => x.Status == s);
        var linked = links.Select(l =>
        {
            var job = jobs.FirstOrDefault(j => j.Id == l.PackingJobId);
            var mine = picks.Where(x => x.PackingJobId == l.PackingJobId).ToList();
            return new LinkedPackingJobModel(l.PackingJobId, job?.JobNumber ?? "", job?.Status ?? "", job?.CustomerName ?? "", job?.Address ?? "",
                job?.ScheduledAtUtc ?? l.LinkedAtUtc, l.LinkedAtUtc, l.LinkedBy, mine.Count,
                mine.Count(x => x.Status == PickupBoxStatuses.Picked), mine.Count(x => x.Status == PickupBoxStatuses.Missing),
                mine.Count(x => x.Status == PickupBoxStatuses.Excluded), mine.Count(x => x.Status == PickupBoxStatuses.Pending));
        }).OrderBy(x => x.JobNumber).ToList();

        var approval = await repo.LatestApprovalAsync(pickup.Id, track: false, t);
        var warehouses = await repo.WarehousesAsync(t);
        var approved = approval is not null && !approval.IsOpen;
        var pending = Count(PickupBoxStatuses.Pending);
        var missing = Count(PickupBoxStatuses.Missing);

        return new PickupCollectionModel(pickup.Id, pickup.PickupNumber, linked, boxes,
            picks.Count, Count(PickupBoxStatuses.Picked), missing, Count(PickupBoxStatuses.Excluded), pending,
            picks.Count(x => x.Condition == PickupBoxConditions.Damaged),
            pending > 0 || missing > 0, approved, CanReopen(),
            approval is null ? null : new CollectionApprovalModel(approval.Id, approval.WarehouseId,
                approval.WarehouseId is { } wid ? warehouses.FirstOrDefault(w => w.Id == wid)?.Name : null,
                approval.PickedCount, approval.MissingCount, approval.ExcludedCount, approval.ApprovedAtUtc, approval.ApprovedBy, approval.Notes,
                approval.ReopenedAtUtc, approval.ReopenedBy, approval.ReopenReason));
    }
}
