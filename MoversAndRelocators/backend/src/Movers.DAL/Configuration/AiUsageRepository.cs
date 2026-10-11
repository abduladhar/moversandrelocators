using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Configuration;
using Movers.Domain.Tenants;
using Movers.Services.OpenAi;

namespace Movers.DAL.Configuration;

public sealed class AiUsageRepository(MoversDbContext db) : IAiUsageRepository
{
    public void Add(AiUsageRecord record) => db.Add(record);
    public Task Save(CancellationToken ct) => db.SaveChangesAsync(ct);
    public async Task<IReadOnlyList<AiUsageRecord>> All(CancellationToken ct) => await db.Set<AiUsageRecord>().AsNoTracking().ToListAsync(ct);
    public async Task<IReadOnlyList<AiUsageRecord>> ForLead(Guid leadId, CancellationToken ct) => await db.Set<AiUsageRecord>().AsNoTracking().Where(x => x.SalesLeadId == leadId).ToListAsync(ct);
}

/// <summary>OpenAI usage and approximate cost per run (table AiUsageRecords) and the prices on the OpenAI settings.</summary>
public static class AiUsageMapping
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        var openAi = modelBuilder.Entity<TenantOpenAiConfiguration>();
        openAi.Property(x => x.InputPricePerMillion).HasPrecision(18, 6);
        openAi.Property(x => x.CachedInputPricePerMillion).HasPrecision(18, 6);
        openAi.Property(x => x.OutputPricePerMillion).HasPrecision(18, 6);
        openAi.Property(x => x.TranscriptionPricePerMinute).HasPrecision(18, 6);

        var x = modelBuilder.Entity<AiUsageRecord>();
        x.ToTable("AiUsageRecords");
        x.Property(e => e.Feature).HasMaxLength(40).IsRequired();
        x.Property(e => e.Model).HasMaxLength(120).IsRequired();
        x.Property(e => e.TranscriptionModel).HasMaxLength(120);
        x.Property(e => e.AudioSeconds).HasPrecision(12, 1);
        x.Property(e => e.VisionCost).HasPrecision(18, 6);
        x.Property(e => e.TranscriptionCost).HasPrecision(18, 6);
        x.Property(e => e.TotalCost).HasPrecision(18, 6);
        x.Property(e => e.Currency).HasMaxLength(3).IsRequired();
        x.Property(e => e.CreatedBy).HasMaxLength(254).IsRequired();
        x.HasIndex(e => e.SalesLeadId);
        x.HasOne<Tenant>().WithMany().HasForeignKey(e => e.TenantId).HasPrincipalKey(t => t.Id).OnDelete(DeleteBehavior.Restrict);
    }
}
