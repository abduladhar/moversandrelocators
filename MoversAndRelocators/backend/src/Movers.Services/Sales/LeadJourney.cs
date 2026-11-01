namespace Movers.Services.Sales;

/// <summary>One record that came from a lead: its stage of the move, number, status and date.</summary>
public sealed record LeadJourneyStep(string Stage, Guid Id, string Number, string Status, DateTimeOffset? Date);

/// <summary>Stage names, in the order a move goes through them.</summary>
public static class LeadJourneyStages
{
    public const string Survey = "SURVEY", Quotation = "QUOTATION", Packing = "PACKING", Pickup = "PICKUP", Delivery = "DELIVERY";
}

/// <summary>Everything that follows from a lead: its surveys, quotations, packing jobs, pickups and deliveries.</summary>
public interface ILeadJourneyQuery
{
    Task<IReadOnlyList<LeadJourneyStep>> GetAsync(Guid leadId, CancellationToken token);
    /// <summary>The lead a survey, quotation, pickup, packing job or delivery belongs to, if any.</summary>
    Task<Guid?> FindLeadAsync(string stage, Guid id, CancellationToken token);
    Task<string?> LeadNumberAsync(Guid leadId, CancellationToken token);
}
