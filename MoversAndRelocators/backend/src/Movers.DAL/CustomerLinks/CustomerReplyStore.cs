using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.CustomerLinks;
using Movers.Services.CustomerLinks;
using Movers.Services.Security;
using Movers.Services.Tenancy;

namespace Movers.DAL.CustomerLinks;

/// <summary>
/// Keeps one CustomerReply row per record (its current state) and a CustomerReplyEvent per step (its history). Writes join
/// the calling service's unit of work (same DbContext), so they are saved with it.
/// </summary>
public sealed class CustomerReplyStore(MoversDbContext db, ITenantContext tenant, IUserContext user, TimeProvider clock) : ICustomerReplies, ICustomerReplyQueries
{
    /// <summary>Actor recorded for the customer's own steps (the client shows it as "Customer").</summary>
    public const string CustomerActor = "CUSTOMER";

    /// <summary>Who may see (and act on) the replies of each kind of record: the permission of that module's pages.</summary>
    private static readonly Dictionary<string, (string View, string Manage)> Permissions = new()
    {
        [CustomerReplyRecordTypes.SalesLead] = (SecurityPermissions.SalesView, SecurityPermissions.SalesManage),
        [CustomerReplyRecordTypes.Quotation] = (SecurityPermissions.QuotesManage, SecurityPermissions.QuotesManage),
        [CustomerReplyRecordTypes.Survey] = (SecurityPermissions.SurveysManage, SecurityPermissions.SurveysManage),
        [CustomerReplyRecordTypes.Pickup] = (SecurityPermissions.OperationsManage, SecurityPermissions.OperationsManage),
        [CustomerReplyRecordTypes.PackingJob] = (SecurityPermissions.PackingManage, SecurityPermissions.PackingManage),
        [CustomerReplyRecordTypes.DeliveryJob] = (SecurityPermissions.DeliveryManage, SecurityPermissions.DeliveryManage),
    };

    public async Task SharedAsync(string recordType, Guid recordId, DateTimeOffset expiresAtUtc, CancellationToken t)
    {
        var now = clock.GetUtcNow();
        (await Row(recordType, recordId, true, t))!.Share(now, expiresAtUtc);
        Log(recordType, recordId, CustomerReplyEvents.Shared, null, null, await StaffName(t), now, expiresAtUtc);
    }

    public async Task WithdrawnAsync(string recordType, Guid recordId, CancellationToken t)
    {
        var row = await Row(recordType, recordId, false, t);
        if (row?.SharedAtUtc is null) return;
        row.Withdraw();
        Log(recordType, recordId, CustomerReplyEvents.Withdrawn, null, null, await StaffName(t), clock.GetUtcNow());
    }

    public async Task RepliedAsync(string recordType, Guid recordId, string kind, string? note, CancellationToken t)
    {
        var now = clock.GetUtcNow();
        (await Row(recordType, recordId, true, t))!.Reply(kind, note, now);
        Log(recordType, recordId, CustomerReplyEvents.Replied, kind, note, CustomerActor, now);
    }

    public async Task HandledAsync(string recordType, Guid recordId, string action, CancellationToken t)
    {
        var row = await Row(recordType, recordId, false, t);
        if (row is not null) await Handle(row, action, null, t);
    }

    public async Task<IReadOnlyList<CustomerReplyModel>> ListAsync(string? recordType, CancellationToken t)
    {
        var types = Permissions.Where(x => (recordType is null || x.Key == recordType) && user.HasPermission(x.Value.View)).Select(x => x.Key).ToList();
        if (types.Count == 0) return [];
        // Rows with nothing to show (a withdrawn link never answered) are skipped in the database where it is cheap to tell.
        var rows = await db.CustomerReplies.AsNoTracking()
            .Where(x => types.Contains(x.RecordType) && (x.SharedAtUtc != null || x.RepliedAtUtc != null || x.HandledAtUtc != null))
            .ToListAsync(t);
        var now = clock.GetUtcNow();
        return rows.Select(x => Map(x, now)).Where(x => x.State != CustomerReplyStates.None).ToList();
    }

    public async Task<CustomerReplyModel?> MarkHandledAsync(string recordType, Guid recordId, string? note, CancellationToken t)
    {
        Require(recordType, manage: true);
        var row = await Row(recordType, recordId, false, t);
        if (row is null) return null;
        var now = clock.GetUtcNow();
        if (row.StateAt(now) is not (CustomerReplyStates.Replied or CustomerReplyStates.Expired))
            throw new InvalidOperationException("There is no customer reply or expired link waiting for action.");
        await Handle(row, CustomerReplyActions.Marked, note, t);
        await db.SaveChangesAsync(t);
        return Map(row, now);
    }

    // The state depends on the clock (a link expires), so it is worked out here rather than in SQL; the table holds one row per shared record.
    public async Task<IReadOnlyCollection<Guid>> RecordIdsInStateAsync(string recordType, string state, CancellationToken t)
    {
        var now = clock.GetUtcNow();
        var rows = await db.CustomerReplies.AsNoTracking().Where(x => x.RecordType == recordType).ToListAsync(t);
        return rows.Where(x => x.StateAt(now) == state).Select(x => x.RecordId).ToHashSet();
    }

    public async Task<IReadOnlyList<CustomerReplyEventModel>> HistoryAsync(string recordType, Guid recordId, CancellationToken t)
    {
        Require(recordType, manage: false);
        return await db.CustomerReplyEvents.AsNoTracking()
            .Where(x => x.RecordType == recordType && x.RecordId == recordId)
            .OrderByDescending(x => x.SerialNo) // steps are written in the order they happen
            .Select(x => new CustomerReplyEventModel(x.Event, x.Detail, x.Note, x.Actor, x.AtUtc, x.ExpiresAtUtc))
            .ToListAsync(t);
    }

    private void Require(string recordType, bool manage)
    {
        if (!Permissions.TryGetValue(recordType, out var permission)) throw new InvalidOperationException("Choose a valid record type.");
        if (!user.HasPermission(manage ? permission.Manage : permission.View)) throw new UnauthorizedAccessException();
    }

    private async Task Handle(CustomerReply row, string action, string? note, CancellationToken t)
    {
        var now = clock.GetUtcNow(); var by = await StaffName(t);
        row.MarkHandled(action, note, by, now);
        Log(row.RecordType, row.RecordId, CustomerReplyEvents.ActionTaken, action, note, by, now);
    }

    private void Log(string recordType, Guid recordId, string @event, string? detail, string? note, string actor, DateTimeOffset at, DateTimeOffset? expiresAtUtc = null) =>
        db.CustomerReplyEvents.Add(new CustomerReplyEvent(tenant.TenantId, recordType, recordId, @event, detail, note, actor, at, expiresAtUtc));

    private string? staffName;
    /// <summary>The signed-in user's name for the history (their email when the account has no name).</summary>
    private async Task<string> StaffName(CancellationToken t)
    {
        if (staffName is not null) return staffName;
        var name = user.UserId is { } id ? await db.Users.IgnoreQueryFilters().AsNoTracking().Where(x => x.Id == id).Select(x => x.FullName).FirstOrDefaultAsync(t) : null;
        return staffName = !string.IsNullOrWhiteSpace(name) ? name : string.IsNullOrWhiteSpace(user.Email) ? "System" : user.Email;
    }

    private async Task<CustomerReply?> Row(string recordType, Guid recordId, bool create, CancellationToken t)
    {
        var row = db.CustomerReplies.Local.FirstOrDefault(x => x.RecordType == recordType && x.RecordId == recordId)
            ?? await db.CustomerReplies.FirstOrDefaultAsync(x => x.RecordType == recordType && x.RecordId == recordId, t);
        if (row is null && create)
        {
            row = new CustomerReply(tenant.TenantId, recordType, recordId);
            db.CustomerReplies.Add(row);
        }
        return row;
    }

    private static CustomerReplyModel Map(CustomerReply x, DateTimeOffset now) =>
        new(x.RecordType, x.RecordId, x.StateAt(now), x.SharedAtUtc, x.ExpiresAtUtc, x.RepliedAtUtc, x.ReplyKind, x.ReplyNote, x.HandledAtUtc, x.HandledBy, x.HandledAction, x.HandledNote);
}
