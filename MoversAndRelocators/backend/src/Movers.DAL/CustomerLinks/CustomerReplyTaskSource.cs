using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.CustomerLinks;
using Movers.Domain.Delivery;
using Movers.Domain.Packing;
using Movers.Services.CustomerLinks;
using Movers.Services.Tasks;

namespace Movers.DAL.CustomerLinks;

/// <summary>My Tasks: every customer reply the office has not marked as handled yet, in the modules the user can see.</summary>
public sealed class CustomerReplyTaskSource(MoversDbContext db, ICustomerReplyQueries replies, TimeProvider clock) : ITodayTaskSource
{
    private static readonly Dictionary<string, (string Module, string Target)> Modules = new()
    {
        [CustomerReplyRecordTypes.SalesLead] = ("Sales", "sales"),
        [CustomerReplyRecordTypes.Quotation] = ("Quotations", "quotations"),
        [CustomerReplyRecordTypes.Survey] = ("Surveys", "surveys"),
        [CustomerReplyRecordTypes.Pickup] = ("Pickups", "pickups"),
        [CustomerReplyRecordTypes.PackingJob] = ("Packing", "packing"),
        [CustomerReplyRecordTypes.DeliveryJob] = ("Delivery", "delivery"),
    };

    public async Task<IReadOnlyList<MyTaskModel>> GetTasksDueThroughAsync(DateTimeOffset endUtc, CancellationToken token)
    {
        var replied = (await replies.ListAsync(null, token)).Where(x => x.State == CustomerReplyStates.Replied).ToList();
        if (replied.Count == 0) return [];
        var names = await Names(replied, token);
        var now = clock.GetUtcNow();
        return replied.Where(x => names.ContainsKey(x.RecordId)).Select(x =>
        {
            var (number, customer) = names[x.RecordId]; var module = Modules[x.RecordType];
            var what = Describe(x.ReplyKind);
            return new MyTaskModel($"customer-reply:{x.RecordId}", "customer-reply", module.Module, $"Customer replied: {customer}",
                $"{number} · {what}{(x.ReplyNote is null ? "" : $" · {x.ReplyNote}")}", x.RepliedAtUtc ?? now, false, x.RecordId.ToString(), module.Target);
        }).ToList();
    }

    private async Task<Dictionary<Guid, (string Number, string Customer)>> Names(IReadOnlyList<CustomerReplyModel> rows, CancellationToken t)
    {
        List<Guid> Ids(string type) => rows.Where(x => x.RecordType == type).Select(x => x.RecordId).ToList();
        var result = new Dictionary<Guid, (string, string)>();
        void Add(IEnumerable<(Guid Id, string Number, string Customer)> xs) { foreach (var x in xs) result[x.Id] = (x.Number, x.Customer); }
        var ids = Ids(CustomerReplyRecordTypes.SalesLead);
        if (ids.Count > 0) Add((await db.SalesLeads.AsNoTracking().Where(x => ids.Contains(x.Id)).Select(x => new { x.Id, x.LeadNumber, x.CustomerName }).ToListAsync(t)).Select(x => (x.Id, x.LeadNumber, x.CustomerName)));
        ids = Ids(CustomerReplyRecordTypes.Quotation);
        if (ids.Count > 0) Add((await db.Quotations.AsNoTracking().Where(x => ids.Contains(x.Id)).Select(x => new { x.Id, x.QuotationNumber, x.CustomerName }).ToListAsync(t)).Select(x => (x.Id, x.QuotationNumber, x.CustomerName)));
        ids = Ids(CustomerReplyRecordTypes.Survey);
        if (ids.Count > 0) Add((await db.Surveys.AsNoTracking().Where(x => ids.Contains(x.Id)).Select(x => new { x.Id, x.SurveyNumber, x.CustomerName }).ToListAsync(t)).Select(x => (x.Id, x.SurveyNumber, x.CustomerName)));
        ids = Ids(CustomerReplyRecordTypes.Pickup);
        if (ids.Count > 0) Add((await db.Pickups.AsNoTracking().Where(x => ids.Contains(x.Id)).Select(x => new { x.Id, x.PickupNumber, x.CustomerName }).ToListAsync(t)).Select(x => (x.Id, x.PickupNumber, x.CustomerName)));
        ids = Ids(CustomerReplyRecordTypes.PackingJob);
        if (ids.Count > 0) Add((await db.Set<PackingJob>().AsNoTracking().Where(x => ids.Contains(x.Id)).Select(x => new { x.Id, x.JobNumber, x.CustomerName }).ToListAsync(t)).Select(x => (x.Id, x.JobNumber, x.CustomerName)));
        ids = Ids(CustomerReplyRecordTypes.DeliveryJob);
        if (ids.Count > 0) Add((await db.Set<DeliveryJob>().AsNoTracking().Where(x => ids.Contains(x.Id)).Select(x => new { x.Id, x.DeliveryNumber }).ToListAsync(t)).Select(x => (x.Id, x.DeliveryNumber, "Delivery run")));
        return result;
    }

    private static string Describe(string? kind) => kind switch
    {
        CustomerReplyKinds.LeadDetails => "Sent move details", CustomerReplyKinds.LeadFiles => "Uploaded a file", CustomerReplyKinds.LeadInventory => "Reviewed the inventory",
        CustomerReplyKinds.QuotationAccepted => "Accepted the quotation", CustomerReplyKinds.QuotationRejected => "Rejected the quotation", CustomerReplyKinds.QuotationRequote => "Asked for a requote",
        CustomerReplyKinds.SurveySchedule => "Confirmed the survey date", CustomerReplyKinds.SurveyItems => "Confirmed the items", CustomerReplyKinds.SurveyChanges => "Asked for item changes", CustomerReplyKinds.SurveyFiles => "Uploaded a file",
        CustomerReplyKinds.PickupConfirmed => "Confirmed the pickup", CustomerReplyKinds.PackingListConfirmed => "Confirmed the packing list", CustomerReplyKinds.PackingListDisputed => "Disputed the packing list",
        CustomerReplyKinds.PackingSchedule => "Confirmed the packing date", CustomerReplyKinds.PackingLocation => "Shared the location",
        CustomerReplyKinds.PackingItemsConfirmed => "Confirmed the packed items", CustomerReplyKinds.PackingItemsCorrections => "Asked for corrections",
        CustomerReplyKinds.DeliveryConfirmed => "Confirmed the delivery time", CustomerReplyKinds.DeliveryReschedule => "Asked for another delivery time", CustomerReplyKinds.DeliveryLocation => "Shared the delivery location",
        _ => "Replied",
    };
}
