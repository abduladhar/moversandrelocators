using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Delivery;
using Movers.Domain.Operations;
using Movers.Domain.Packing;
using Movers.Domain.Pickups;
using Movers.Domain.Surveys;
using Movers.Domain.Tenants;
using Movers.Services.Operations;

namespace Movers.DAL.Operations;

public sealed class ExpenseAttachmentRepository(MoversDbContext db) : IExpenseAttachmentRepository
{
    public async Task<IReadOnlyList<ExpenseAttachment>> ForExpenses(IReadOnlyCollection<Guid> expenseIds, CancellationToken ct) =>
        await db.Set<ExpenseAttachment>().AsNoTracking().Where(x => expenseIds.Contains(x.ExpenseId)).ToListAsync(ct);

    public Task<ExpenseAttachment?> Get(Guid id, CancellationToken ct) => db.Set<ExpenseAttachment>().SingleOrDefaultAsync(x => x.Id == id, ct);

    // Tenant query filters apply, so an expense of another tenant is never found.
    public Task<bool> ExpenseExists(string kind, Guid id, CancellationToken ct) => kind switch
    {
        ExpenseReceiptKinds.Survey => db.Set<SurveyExpense>().AnyAsync(x => x.Id == id, ct),
        ExpenseReceiptKinds.Pickup => PickupExpense(id, ct),
        ExpenseReceiptKinds.Packing => db.Set<PackingJobTransaction>().AnyAsync(x => x.Id == id && x.Type == "EXPENSE", ct),
        ExpenseReceiptKinds.Delivery => db.Set<DeliveryJobTransaction>().AnyAsync(x => x.Id == id && x.Type == "EXPENSE", ct),
        ExpenseReceiptKinds.Operations => db.Set<JobExpense>().AnyAsync(x => x.Id == id, ct),
        ExpenseReceiptKinds.Cash => db.Set<BillingRecord>().AnyAsync(x => x.Id == id && x.Kind == "CASH", ct),
        _ => Task.FromResult(false)
    };

    // Crew expenses, and expenses recorded the earlier way as pickup transactions.
    private async Task<bool> PickupExpense(Guid id, CancellationToken ct) =>
        await db.Set<PickupExpense>().AnyAsync(x => x.Id == id, ct) || await db.Set<PickupTransaction>().AnyAsync(x => x.Id == id && x.Type == "EXPENSE", ct);

    public void Add(ExpenseAttachment attachment) => db.Add(attachment);
    public Task Save(CancellationToken ct) => db.SaveChangesAsync(ct);
}

/// <summary>Receipts attached to expenses (table ExpenseAttachments).</summary>
public static class ExpenseAttachmentMapping
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        var x = modelBuilder.Entity<ExpenseAttachment>();
        x.ToTable("ExpenseAttachments");
        x.Property(e => e.Kind).HasMaxLength(20).IsRequired();
        x.Property(e => e.OriginalFileName).HasMaxLength(180).IsRequired();
        x.Property(e => e.ContentType).HasMaxLength(160).IsRequired();
        x.Property(e => e.ObjectKey).HasMaxLength(700).IsRequired();
        x.Property(e => e.UploadedBy).HasMaxLength(254).IsRequired();
        x.HasIndex(e => new { e.TenantId, e.ExpenseId });
        x.HasOne<Tenant>().WithMany().HasForeignKey(e => e.TenantId).HasPrincipalKey(t => t.Id).OnDelete(DeleteBehavior.Restrict);
    }
}
