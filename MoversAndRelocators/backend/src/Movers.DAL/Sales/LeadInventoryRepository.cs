using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Sales;
using Movers.Domain.Tenants;
using Movers.Services.Sales;

namespace Movers.DAL.Sales;

public sealed class LeadInventoryRepository(MoversDbContext db) : ILeadInventoryRepository
{
    public async Task<IReadOnlyList<SalesLeadInventoryItem>> Lines(Guid leadId, bool track, CancellationToken ct) =>
        await (track ? db.Set<SalesLeadInventoryItem>() : db.Set<SalesLeadInventoryItem>().AsNoTracking()).Where(x => x.SalesLeadId == leadId).OrderBy(x => x.SerialNo).ToListAsync(ct);

    // Summed in memory: decimal aggregates are not supported by every provider (SQLite).
    public async Task<IReadOnlyDictionary<Guid, LeadInventoryTotals>> Totals(CancellationToken ct) =>
        (await db.Set<SalesLeadInventoryItem>().AsNoTracking().Select(x => new { x.SalesLeadId, x.Quantity, x.UnitCbm, x.Fragile }).ToListAsync(ct))
        .GroupBy(x => x.SalesLeadId)
        .ToDictionary(g => g.Key, g => new LeadInventoryTotals(Math.Round(g.Sum(x => x.Quantity * x.UnitCbm), 3), g.Where(x => x.Fragile).Sum(x => x.Quantity)));

    public void Add(SalesLeadInventoryItem line) => db.Add(line);
    public void Remove(SalesLeadInventoryItem line) => db.Remove(line);
    public Task Save(CancellationToken ct) => db.SaveChangesAsync(ct);
}

/// <summary>Expected inventory of sales leads (table SalesLeadInventoryItems).</summary>
public static class LeadInventoryMapping
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        var x = modelBuilder.Entity<SalesLeadInventoryItem>();
        x.ToTable("SalesLeadInventoryItems");
        x.Property(e => e.Kind).HasMaxLength(10).IsRequired();
        x.Property(e => e.Room).HasMaxLength(80);
        x.Property(e => e.Name).HasMaxLength(160).IsRequired();
        x.Property(e => e.UnitCbm).HasPrecision(12, 3);
        x.Property(e => e.Handling).HasMaxLength(300);
        x.Property(e => e.Notes).HasMaxLength(1000);
        x.Property(e => e.ImageKey).HasMaxLength(500);
        x.Property(e => e.ImageMark).HasMaxLength(40);
        x.Property(e => e.CustomerStatus).HasMaxLength(20).IsRequired();
        x.Property(e => e.CustomerNote).HasMaxLength(500);
        x.Ignore(e => e.TotalCbm);
        x.Ignore(e => e.ConfirmedCbm);
        x.HasIndex(e => e.SalesLeadId);
        x.HasOne<Tenant>().WithMany().HasForeignKey(e => e.TenantId).HasPrincipalKey(t => t.Id).OnDelete(DeleteBehavior.Restrict);
        x.HasOne<SalesLead>().WithMany().HasForeignKey(e => e.SalesLeadId).HasPrincipalKey(l => l.Id).OnDelete(DeleteBehavior.Cascade);
    }
}
