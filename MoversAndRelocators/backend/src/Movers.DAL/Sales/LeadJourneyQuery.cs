using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Delivery;
using Movers.Domain.Packing;
using Movers.Services.Sales;

namespace Movers.DAL.Sales;

/// <summary>
/// Follows a lead through the move. Records link to the lead directly (survey, quotation, pickup and packing store
/// SalesLeadId) or through the record before them (a quotation through its survey, a pickup or packing job through
/// its quotation, a delivery through the pickups whose boxes it carries). Tenant and company filters apply as usual.
/// </summary>
public sealed class LeadJourneyQuery(MoversDbContext db) : ILeadJourneyQuery
{
    public async Task<IReadOnlyList<LeadJourneyStep>> GetAsync(Guid leadId, CancellationToken token)
    {
        var surveys = await db.Surveys.AsNoTracking().Where(x => x.SalesLeadId == leadId)
            .Select(x => new { x.Id, x.SurveyNumber, x.Status, x.ScheduledAtUtc }).ToListAsync(token);
        var surveyIds = surveys.Select(x => x.Id).ToList();
        var quotations = await db.Quotations.AsNoTracking().Where(x => x.SalesLeadId == leadId || (x.SurveyId != null && surveyIds.Contains(x.SurveyId.Value)))
            .Select(x => new { x.Id, x.QuotationNumber, x.Status, x.CreatedAtUtc }).ToListAsync(token);
        var quotationIds = quotations.Select(x => x.Id).ToList();
        var pickups = await db.Pickups.AsNoTracking().Where(x => x.SalesLeadId == leadId || (x.QuotationId != null && quotationIds.Contains(x.QuotationId.Value)))
            .Join(db.PickupStatuses.AsNoTracking(), p => p.StatusId, s => s.Id, (p, s) => new { p.Id, p.PickupNumber, Status = s.Name, p.ScheduledAtUtc }).ToListAsync(token);
        var pickupIds = pickups.Select(x => x.Id).ToList();
        var packing = await db.Set<PackingJob>().AsNoTracking().Where(x => x.SalesLeadId == leadId
                || (x.QuotationId != null && quotationIds.Contains(x.QuotationId.Value)) || (x.PickupId != null && pickupIds.Contains(x.PickupId.Value)))
            .Select(x => new { x.Id, x.JobNumber, x.Status, x.ScheduledAtUtc }).ToListAsync(token);
        var deliveryIds = await db.Set<DeliveryItem>().AsNoTracking().Where(x => x.PickupId != null && pickupIds.Contains(x.PickupId.Value))
            .Select(x => x.DeliveryJobId).Distinct().ToListAsync(token);
        var deliveries = await db.Set<DeliveryJob>().AsNoTracking().Where(x => deliveryIds.Contains(x.Id))
            .Select(x => new { x.Id, x.DeliveryNumber, x.Status, x.ScheduledAtUtc }).ToListAsync(token);

        return [
            ..surveys.Select(x => new LeadJourneyStep(LeadJourneyStages.Survey, x.Id, x.SurveyNumber, x.Status, x.ScheduledAtUtc)),
            ..quotations.Select(x => new LeadJourneyStep(LeadJourneyStages.Quotation, x.Id, x.QuotationNumber, x.Status, x.CreatedAtUtc)),
            ..packing.Select(x => new LeadJourneyStep(LeadJourneyStages.Packing, x.Id, x.JobNumber, x.Status, x.ScheduledAtUtc)),
            ..pickups.Select(x => new LeadJourneyStep(LeadJourneyStages.Pickup, x.Id, x.PickupNumber, x.Status, x.ScheduledAtUtc)),
            ..deliveries.Select(x => new LeadJourneyStep(LeadJourneyStages.Delivery, x.Id, x.DeliveryNumber, x.Status, x.ScheduledAtUtc)),
        ];
    }

    public Task<string?> LeadNumberAsync(Guid leadId, CancellationToken token) =>
        db.SalesLeads.AsNoTracking().Where(x => x.Id == leadId).Select(x => (string?)x.LeadNumber).FirstOrDefaultAsync(token);

    /// <summary>Walks back from a record to its lead: directly, or through the survey, quotation or pickup it came from.</summary>
    public async Task<Guid?> FindLeadAsync(string stage, Guid id, CancellationToken token)
    {
        async Task<Guid?> FromSurvey(Guid? surveyId) => surveyId is null ? null
            : await db.Surveys.AsNoTracking().Where(x => x.Id == surveyId).Select(x => x.SalesLeadId).FirstOrDefaultAsync(token);
        async Task<Guid?> FromQuotation(Guid? quotationId)
        {
            if (quotationId is null) return null;
            var q = await db.Quotations.AsNoTracking().Where(x => x.Id == quotationId).Select(x => new { x.SalesLeadId, x.SurveyId }).FirstOrDefaultAsync(token);
            return q is null ? null : q.SalesLeadId ?? await FromSurvey(q.SurveyId);
        }
        async Task<Guid?> FromPickup(Guid? pickupId)
        {
            if (pickupId is null) return null;
            var p = await db.Pickups.AsNoTracking().Where(x => x.Id == pickupId).Select(x => new { x.SalesLeadId, x.QuotationId }).FirstOrDefaultAsync(token);
            return p is null ? null : p.SalesLeadId ?? await FromQuotation(p.QuotationId);
        }
        switch (stage)
        {
            case LeadJourneyStages.Survey: return await FromSurvey(id);
            case LeadJourneyStages.Quotation: return await FromQuotation(id);
            case LeadJourneyStages.Pickup: return await FromPickup(id);
            case LeadJourneyStages.Packing:
                var j = await db.Set<PackingJob>().AsNoTracking().Where(x => x.Id == id).Select(x => new { x.SalesLeadId, x.QuotationId, x.PickupId }).FirstOrDefaultAsync(token);
                return j is null ? null : j.SalesLeadId ?? await FromQuotation(j.QuotationId) ?? await FromPickup(j.PickupId);
            case LeadJourneyStages.Delivery:
                var pickups = await db.Set<DeliveryItem>().AsNoTracking().Where(x => x.DeliveryJobId == id && x.PickupId != null).Select(x => x.PickupId).Distinct().ToListAsync(token);
                foreach (var pickupId in pickups) if (await FromPickup(pickupId) is { } lead) return lead;
                return null;
            default: return null;
        }
    }
}
