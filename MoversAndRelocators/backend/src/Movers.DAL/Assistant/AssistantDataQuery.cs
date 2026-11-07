using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Assistant;
using Movers.Domain.Configuration;
using Movers.Domain.Delivery;
using Movers.Domain.Packing;
using Movers.Services.Assistant;

namespace Movers.DAL.Assistant;

/// <summary>
/// Rows of the assistant's operational datasets, as small projections through the normal context, so the tenant and
/// company filters apply exactly as on the screens. Times are turned into the user's local time here (SQLite cannot
/// compare DateTimeOffset values in SQL, and the model reasons in local time). Field names match <see cref="AssistantCatalog"/>.
/// </summary>
public sealed class AssistantDataQuery(MoversDbContext db) : IAssistantData
{
    public async Task<IReadOnlyList<IReadOnlyDictionary<string, object?>>> Load(string dataset, TimeSpan offset, DateTimeOffset nowUtc, CancellationToken t)
    {
        DateTime? L(DateTimeOffset? at) => at?.ToOffset(offset).DateTime;
        var people = await db.Employees.AsNoTracking().Select(e => new { e.Id, Name = (e.FirstName + " " + e.LastName).Trim() }).ToDictionaryAsync(e => e.Id, e => e.Name, t);
        string? Person(Guid? id) => id is { } x ? people.GetValueOrDefault(x) : null;

        switch (dataset)
        {
            case AssistantCatalog.Leads:
            {
                var statuses = await db.LeadStatuses.AsNoTracking().ToDictionaryAsync(s => s.Id, t);
                var moveTypes = await db.MoveTypes.AsNoTracking().ToDictionaryAsync(s => s.Id, s => s.Name, t);
                var rows = await db.SalesLeads.AsNoTracking().Where(x => x.IsActive).ToListAsync(t);
                return rows.Select(x => Row(("number", x.LeadNumber), ("customer", x.CustomerName), ("phone", x.Phone), ("email", x.Email), ("source", x.Source),
                    ("move_type", moveTypes.GetValueOrDefault(x.MoveTypeId)), ("origin", x.Origin), ("destination", x.Destination), ("expected_move_date", x.ExpectedMoveDate),
                    ("status", statuses.GetValueOrDefault(x.StatusId)?.Name), ("closed", statuses.GetValueOrDefault(x.StatusId)?.IsClosed ?? false), ("assigned_to", Person(x.AssignedEmployeeId)),
                    ("created", L(x.CreatedAtUtc)), ("updated", L(x.UpdatedAtUtc)))).ToList();
            }
            case AssistantCatalog.FollowUps:
            {
                var rows = await (from f in db.LeadFollowUps.AsNoTracking()
                                  join l in db.SalesLeads.AsNoTracking() on f.SalesLeadId equals l.Id
                                  join s in db.FollowUpStatuses.AsNoTracking() on f.StatusId equals s.Id
                                  where l.IsActive
                                  select new { l.LeadNumber, l.CustomerName, l.AssignedEmployeeId, f.ScheduledAtUtc, Status = s.Name, s.IsCompleted, f.NextFollowUpAtUtc, f.Notes, f.CreatedAtUtc }).ToListAsync(t);
                return rows.Select(x =>
                {
                    // Same rule as the dashboards: a follow-up is open until it is done, or while a next one is planned.
                    var open = x.NextFollowUpAtUtc.HasValue || !x.IsCompleted;
                    var due = x.NextFollowUpAtUtc ?? x.ScheduledAtUtc;
                    return Row(("lead_number", x.LeadNumber), ("customer", x.CustomerName), ("assigned_to", Person(x.AssignedEmployeeId)), ("scheduled", L(x.ScheduledAtUtc)),
                        ("status", x.Status), ("completed", x.IsCompleted), ("next_follow_up", L(x.NextFollowUpAtUtc)), ("overdue", open && due < nowUtc), ("notes", x.Notes), ("created", L(x.CreatedAtUtc)));
                }).ToList();
            }
            case AssistantCatalog.Surveys:
            {
                var leads = await db.SalesLeads.AsNoTracking().ToDictionaryAsync(l => l.Id, l => l.LeadNumber, t);
                var rows = await db.Surveys.AsNoTracking().Select(x => new { x.Id, x.SurveyNumber, x.SalesLeadId, x.CustomerName, x.AssignedEmployeeId, x.ScheduledAtUtc, x.Address, x.Status, x.StartedAtUtc, x.EndedAtUtc, x.CreatedAtUtc }).ToListAsync(t);
                var expenses = (await db.SurveyExpenses.AsNoTracking().Select(e => new { e.SurveyId, e.Amount, e.Currency }).ToListAsync(t)).ToLookup(e => e.SurveyId);
                return rows.Select(x =>
                {
                    var spent = expenses[x.Id].ToList();
                    var currencies = spent.Select(e => e.Currency).Distinct().ToList();
                    return Row(("number", x.SurveyNumber), ("lead_number", x.SalesLeadId is { } id ? leads.GetValueOrDefault(id) : null), ("customer", x.CustomerName),
                        ("surveyor", Person(x.AssignedEmployeeId)), ("scheduled", L(x.ScheduledAtUtc)), ("address", x.Address), ("status", x.Status),
                        ("started", L(x.StartedAtUtc)), ("ended", L(x.EndedAtUtc)), ("created", L(x.CreatedAtUtc)),
                        ("expenses", spent.Sum(e => e.Amount)), ("expense_count", spent.Count), ("expense_currency", currencies switch { [] => null, [var only] => only, _ => "MIXED" }));
                }).ToList();
            }
            case AssistantCatalog.SurveyExpenses:
            {
                var rows = await (from e in db.SurveyExpenses.AsNoTracking()
                                  join s in db.Surveys.AsNoTracking() on e.SurveyId equals s.Id
                                  select new { s.SurveyNumber, s.CustomerName, s.AssignedEmployeeId, s.Status, e.Category, e.Amount, e.Currency, e.IncurredAtUtc, e.PaidByEmployeeId, e.Notes, e.CreatedAtUtc }).ToListAsync(t);
                return rows.Select(x => Row(("survey_number", x.SurveyNumber), ("customer", x.CustomerName), ("surveyor", Person(x.AssignedEmployeeId)), ("survey_status", x.Status),
                    ("category", x.Category), ("amount", x.Amount), ("currency", x.Currency), ("incurred", L(x.IncurredAtUtc)), ("paid_by", Person(x.PaidByEmployeeId)),
                    ("notes", x.Notes), ("created", L(x.CreatedAtUtc)))).ToList();
            }
            case AssistantCatalog.Quotations:
            {
                var rows = await db.Quotations.AsNoTracking().Select(x => new { x.QuotationNumber, x.CustomerName, x.Origin, x.Destination, x.AssignedEmployeeId, x.Currency, x.Status,
                    x.Subtotal, x.DiscountTotal, x.TaxTotal, x.GrandTotal, x.ValidUntil, x.SentAtUtc, x.RespondedAtUtc, x.RejectionReason, x.CreatedAtUtc }).ToListAsync(t);
                return rows.Select(x => Row(("number", x.QuotationNumber), ("customer", x.CustomerName), ("origin", x.Origin), ("destination", x.Destination), ("assigned_to", Person(x.AssignedEmployeeId)),
                    ("currency", x.Currency), ("status", x.Status), ("subtotal", x.Subtotal), ("discount", x.DiscountTotal), ("tax", x.TaxTotal), ("grand_total", x.GrandTotal),
                    ("valid_until", x.ValidUntil), ("sent", L(x.SentAtUtc)), ("responded", L(x.RespondedAtUtc)), ("rejection_reason", x.RejectionReason), ("created", L(x.CreatedAtUtc)))).ToList();
            }
            case AssistantCatalog.Pickups:
            {
                var statuses = await db.PickupStatuses.AsNoTracking().ToDictionaryAsync(s => s.Id, t);
                var rows = await db.Pickups.AsNoTracking().Select(x => new { x.PickupNumber, x.CustomerName, x.Address, x.ScheduledAtUtc, x.StatusId, x.StartedAtUtc, x.EndedAtUtc, x.DistanceKm, x.CreatedAtUtc }).ToListAsync(t);
                return rows.Select(x => Row(("number", x.PickupNumber), ("customer", x.CustomerName), ("address", x.Address), ("scheduled", L(x.ScheduledAtUtc)),
                    ("status", statuses.GetValueOrDefault(x.StatusId)?.Name), ("completed", statuses.GetValueOrDefault(x.StatusId)?.IsCompleted ?? false),
                    ("started", L(x.StartedAtUtc)), ("ended", L(x.EndedAtUtc)), ("distance_km", x.DistanceKm), ("created", L(x.CreatedAtUtc)))).ToList();
            }
            case AssistantCatalog.PackingJobs:
            {
                var rows = await db.Set<PackingJob>().AsNoTracking().Select(x => new { x.Id, x.JobNumber, x.CustomerName, x.Address, x.ScheduledAtUtc, x.Status, x.StartedAtUtc, x.CompletedAtUtc, x.CreatedAtUtc }).ToListAsync(t);
                var materials = (await db.Set<PackingJobMaterial>().AsNoTracking().Select(m => new { m.PackingJobId, m.Quantity, m.UnitCost }).ToListAsync(t))
                    .GroupBy(m => m.PackingJobId).ToDictionary(g => g.Key, g => Math.Round(g.Sum(m => m.Quantity * m.UnitCost), 2));
                return rows.Select(x => Row(("number", x.JobNumber), ("customer", x.CustomerName), ("address", x.Address), ("scheduled", L(x.ScheduledAtUtc)), ("status", x.Status),
                    ("started", L(x.StartedAtUtc)), ("completed", L(x.CompletedAtUtc)), ("created", L(x.CreatedAtUtc)), ("material_cost", materials.GetValueOrDefault(x.Id)))).ToList();
            }
            case AssistantCatalog.Deliveries:
            {
                var rows = await db.Set<DeliveryJob>().AsNoTracking().Select(x => new { x.DeliveryNumber, x.ScheduledAtUtc, x.Status, x.DriverEmployeeId, x.StartedAtUtc, x.CompletedAtUtc, x.DistanceKm, x.Notes, x.CreatedAtUtc }).ToListAsync(t);
                return rows.Select(x => Row(("number", x.DeliveryNumber), ("scheduled", L(x.ScheduledAtUtc)), ("status", x.Status), ("driver", Person(x.DriverEmployeeId)),
                    ("started", L(x.StartedAtUtc)), ("completed", L(x.CompletedAtUtc)), ("distance_km", x.DistanceKm), ("notes", x.Notes), ("created", L(x.CreatedAtUtc)))).ToList();
            }
            case AssistantCatalog.Employees:
            {
                var designations = await db.Designations.AsNoTracking().ToDictionaryAsync(d => d.Id, d => d.Name, t);
                var rows = await db.Employees.AsNoTracking().ToListAsync(t);
                return rows.Select(x => Row(("number", x.EmployeeNumber), ("name", $"{x.FirstName} {x.LastName}".Trim()), ("designation", designations.GetValueOrDefault(x.DesignationId)),
                    ("email", x.WorkEmail), ("phone", x.Phone), ("joining_date", x.JoiningDate), ("active", x.IsActive), ("reports_to", Person(x.ReportsToEmployeeId)))).ToList();
            }
            case AssistantCatalog.AiUsage:
            {
                var rows = await db.Set<AiUsageRecord>().AsNoTracking().Select(x => new { x.Feature, x.Model, x.InputTokens, x.OutputTokens, x.TotalCost, x.Currency, x.CreatedBy, x.CreatedAtUtc }).ToListAsync(t);
                return rows.Select(x => Row(("feature", x.Feature switch { AiUsageRecord.Assistant => "Management assistant", AiUsageRecord.LeadExtraction => "Lead extraction", _ => x.Feature }),
                    ("model", x.Model), ("input_tokens", x.InputTokens), ("output_tokens", x.OutputTokens), ("cost", x.TotalCost), ("currency", x.Currency), ("by", x.CreatedBy), ("created", L(x.CreatedAtUtc)))).ToList();
            }
            default:
                throw new InvalidOperationException($"Unknown dataset {dataset}.");
        }
    }

    /// <summary>A row; numbers are stored as decimal so sums and comparisons treat them alike.</summary>
    private static IReadOnlyDictionary<string, object?> Row(params (string Key, object? Value)[] values) =>
        values.ToDictionary(v => v.Key, v => v.Value switch { int i => (decimal)i, double d => (decimal)d, _ => v.Value });
}

public sealed class AssistantConversationRepository(MoversDbContext db) : IAssistantConversationRepository
{
    public async Task<IReadOnlyList<AssistantConversation>> ForUser(Guid userId, CancellationToken ct) =>
        await db.Set<AssistantConversation>().AsNoTracking().Where(x => x.UserId == userId).ToListAsync(ct);
    public Task<AssistantConversation?> Get(Guid id, Guid userId, CancellationToken ct) =>
        db.Set<AssistantConversation>().SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct);
    public void Add(AssistantConversation conversation) => db.Add(conversation);
    public void Remove(AssistantConversation conversation) => db.Remove(conversation);
    public Task Save(CancellationToken ct) => db.SaveChangesAsync(ct);
}

public static class AssistantMapping
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        var c = modelBuilder.Entity<AssistantConversation>();
        c.ToTable("AssistantConversations");
        c.Property(x => x.Title).HasMaxLength(AssistantConversation.TitleLength).IsRequired();
        c.Property(x => x.MessagesJson).IsRequired();
        c.HasIndex(x => new { x.TenantId, x.UserId });
        c.HasOne<Movers.Domain.Tenants.Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
    }
}
