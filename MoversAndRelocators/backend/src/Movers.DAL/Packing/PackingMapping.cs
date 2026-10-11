using Microsoft.EntityFrameworkCore;
using Movers.Domain.Employees;
using Movers.Domain.Packing;
using Movers.Domain.Pickups;
using Movers.Domain.Quotations;
using Movers.Domain.Sales;
using Movers.Domain.Surveys;
using Movers.Domain.Tenants;

namespace Movers.DAL.Packing;

/// <summary>Packing module: jobs, crew, labelled boxes and their items, material usage and income/expense transactions.</summary>
public static class PackingMapping
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        var job = modelBuilder.Entity<PackingJob>();
        job.ToTable("PackingJobs");
        job.Property(x => x.Version).IsConcurrencyToken();
        job.Property(x => x.JobNumber).HasMaxLength(40).IsRequired();
        job.Property(x => x.CustomerName).HasMaxLength(160).IsRequired();
        job.Property(x => x.Phone).HasMaxLength(40).IsRequired();
        job.Property(x => x.Email).HasMaxLength(254);
        job.Property(x => x.Address).HasMaxLength(500).IsRequired();
        job.Property(x => x.Status).HasMaxLength(20).IsRequired();
        job.Property(x => x.Notes).HasMaxLength(2000);
        job.Ignore(x => x.IsLocked);
        job.Property(x => x.LocationNotes).HasMaxLength(500);
        job.Property(x => x.Latitude).HasPrecision(9, 6);
        job.Property(x => x.Longitude).HasPrecision(9, 6);
        job.Property(x => x.ItemsResponse).HasMaxLength(20);
        job.Property(x => x.ItemsResponderName).HasMaxLength(160);
        job.Property(x => x.ItemsResponseNotes).HasMaxLength(2000);
        job.Property(x => x.ItemsSnapshotHash).HasMaxLength(64);
        job.HasIndex(x => new { x.TenantId, x.JobNumber }).IsUnique();
        job.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        job.HasOne<Pickup>().WithMany().HasForeignKey(x => x.PickupId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        job.HasOne<Quotation>().WithMany().HasForeignKey(x => x.QuotationId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        job.HasOne<SalesLead>().WithMany().HasForeignKey(x => x.SalesLeadId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var timeEvent = modelBuilder.Entity<PackingJobTimeEvent>();
        timeEvent.ToTable("PackingJobTimeEvents");
        timeEvent.Property(x => x.Type).HasMaxLength(20).IsRequired();
        timeEvent.Property(x => x.Reason).HasMaxLength(500);
        timeEvent.Property(x => x.RecordedBy).HasMaxLength(254).IsRequired();
        TenantAndJob(timeEvent, x => x.PackingJobId);

        var link = modelBuilder.Entity<PackingJobLink>();
        link.ToTable("PackingJobLinks");
        link.Property(x => x.Purpose).HasMaxLength(20).IsRequired();
        link.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
        link.HasIndex(x => x.TokenHash).IsUnique();
        TenantAndJob(link, x => x.PackingJobId);

        var crew = modelBuilder.Entity<PackingJobCrew>();
        crew.ToTable("PackingJobCrew");
        crew.Property(x => x.Role).HasMaxLength(80).IsRequired();
        TenantAndJob(crew, x => x.PackingJobId);
        crew.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var box = modelBuilder.Entity<PackingJobBox>();
        box.ToTable("PackingJobBoxes");
        box.Property(x => x.TrackingNumber).HasMaxLength(80).IsRequired();
        box.Property(x => x.RoomName).HasMaxLength(120);
        box.Property(x => x.Notes).HasMaxLength(500);
        box.HasIndex(x => new { x.TenantId, x.TrackingNumber }).IsUnique();
        TenantAndJob(box, x => x.PackingJobId);
        box.HasOne<BoxType>().WithMany().HasForeignKey(x => x.BoxTypeId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var item = modelBuilder.Entity<PackingJobBoxItem>();
        item.ToTable("PackingJobBoxItems");
        item.Property(x => x.ItemName).HasMaxLength(160).IsRequired();
        item.Property(x => x.Notes).HasMaxLength(500);
        item.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        item.HasOne<PackingJobBox>().WithMany().HasForeignKey(x => x.PackingJobBoxId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade);

        var boxMaterial = modelBuilder.Entity<PackingJobBoxMaterial>();
        boxMaterial.ToTable("PackingJobBoxMaterials");
        boxMaterial.Property(x => x.Quantity).HasPrecision(12, 3);
        boxMaterial.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        boxMaterial.HasOne<PackingJobBox>().WithMany().HasForeignKey(x => x.PackingJobBoxId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade);
        boxMaterial.HasOne<PackingMaterial>().WithMany().HasForeignKey(x => x.MaterialId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var material = modelBuilder.Entity<PackingJobMaterial>();
        material.ToTable("PackingJobMaterials");
        material.Property(x => x.Quantity).HasPrecision(12, 3);
        material.Property(x => x.UnitCost).HasPrecision(20, 4);
        material.Ignore(x => x.TotalCost);
        TenantAndJob(material, x => x.PackingJobId);
        material.HasOne<PackingMaterial>().WithMany().HasForeignKey(x => x.MaterialId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var tx = modelBuilder.Entity<PackingJobTransaction>();
        tx.ToTable("PackingJobTransactions");
        tx.Property(x => x.TransactionNumber).HasMaxLength(60).IsRequired();
        tx.Property(x => x.Type).HasMaxLength(20).IsRequired();
        tx.Property(x => x.Category).HasMaxLength(120).IsRequired();
        tx.Property(x => x.Amount).HasPrecision(20, 4);
        tx.Property(x => x.PaymentMethod).HasMaxLength(40).IsRequired();
        tx.Property(x => x.Notes).HasMaxLength(500);
        tx.HasIndex(x => new { x.TenantId, x.TransactionNumber }).IsUnique();
        TenantAndJob(tx, x => x.PackingJobId);
    }

    private static void TenantAndJob<T>(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<T> entity, System.Linq.Expressions.Expression<Func<T, object?>> jobKey) where T : class
    {
        entity.HasOne<Tenant>().WithMany().HasForeignKey("TenantId").HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne<PackingJob>().WithMany().HasForeignKey(jobKey).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade);
    }
}
