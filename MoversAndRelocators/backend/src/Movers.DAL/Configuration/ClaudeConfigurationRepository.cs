using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Configuration;
using Movers.Domain.Tenants;
using Movers.Services.Claude;

namespace Movers.DAL.Configuration;

public sealed class ClaudeConfigurationRepository(MoversDbContext db) : IClaudeConfigurationRepository
{
    public Task<TenantClaudeConfiguration?> GetAsync(bool trackChanges, CancellationToken token) =>
        (trackChanges ? db.Set<TenantClaudeConfiguration>() : db.Set<TenantClaudeConfiguration>().AsNoTracking()).SingleOrDefaultAsync(token);

    public void Add(TenantClaudeConfiguration configuration) => db.Add(configuration);
    public Task SaveChangesAsync(CancellationToken token) => db.SaveChangesAsync(token);
}

/// <summary>Table TenantClaudeConfigurations: one encrypted Claude profile per tenant (script 036).</summary>
public static class ClaudeConfigurationMapping
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        var x = modelBuilder.Entity<TenantClaudeConfiguration>();
        x.ToTable("TenantClaudeConfigurations");
        x.Property(e => e.EncryptedApiKey).HasMaxLength(1000).IsRequired();
        x.Property(e => e.ApiKeyLastFour).HasMaxLength(4).IsRequired();
        x.Property(e => e.ExtractionModel).HasMaxLength(120).IsRequired();
        x.Property(e => e.Effort).HasMaxLength(20).IsRequired();
        x.Property(e => e.InputPricePerMillion).HasPrecision(18, 6);
        x.Property(e => e.CachedInputPricePerMillion).HasPrecision(18, 6);
        x.Property(e => e.OutputPricePerMillion).HasPrecision(18, 6);
        x.HasIndex(e => e.TenantId).IsUnique();
        x.HasOne<Tenant>().WithMany().HasForeignKey(e => e.TenantId).HasPrincipalKey(t => t.Id).OnDelete(DeleteBehavior.Restrict);
    }
}
