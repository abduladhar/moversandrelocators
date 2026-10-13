using Microsoft.EntityFrameworkCore;
using Movers.Domain.Employees;
using Movers.Domain.Operations;
using Movers.Domain.Pickups;
using Movers.Domain.Sales;
using Movers.Domain.Tenants;

namespace Movers.DAL.Pickups;

/// <summary>Pickup field work: trip clock, crew expenses, stage photos, sign-offs, warehouses and room-level packing.</summary>
public static class PickupWorkMapping
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        var pickup = modelBuilder.Entity<Pickup>();
        pickup.Property(x => x.DistanceKm).HasPrecision(10, 2);
        pickup.HasOne<SalesLead>().WithMany().HasForeignKey(x => x.SalesLeadId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<PickupPackage>().Property(x => x.RoomName).HasMaxLength(120);
        modelBuilder.Entity<PickupPackageItem>().Property(x => x.RoomName).HasMaxLength(120);

        var timeEvent = modelBuilder.Entity<PickupTimeEvent>();
        timeEvent.ToTable("PickupTimeEvents"); timeEvent.Property(x => x.Type).HasMaxLength(20).IsRequired(); timeEvent.Property(x => x.Reason).HasMaxLength(500); timeEvent.Property(x => x.RecordedBy).HasMaxLength(254).IsRequired();
        timeEvent.HasIndex(x => new { x.PickupId, x.SerialNo }); TenantAndPickup(timeEvent, x => x.PickupId);

        var expense = modelBuilder.Entity<PickupExpense>();
        expense.ToTable("PickupExpenses"); expense.Property(x => x.Category).HasMaxLength(30).IsRequired(); expense.Property(x => x.Amount).HasPrecision(20, 4); expense.Property(x => x.Currency).HasMaxLength(3).IsRequired(); expense.Property(x => x.Notes).HasMaxLength(500);
        expense.HasIndex(x => new { x.PickupId, x.SerialNo }); TenantAndPickup(expense, x => x.PickupId);
        expense.HasOne<Employee>().WithMany().HasForeignKey(x => x.PaidByEmployeeId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var attachment = modelBuilder.Entity<PickupAttachment>();
        attachment.ToTable("PickupAttachments"); attachment.Property(x => x.Stage).HasMaxLength(20).IsRequired(); attachment.Property(x => x.RoomName).HasMaxLength(120); attachment.Property(x => x.UploadedBy).HasMaxLength(254).IsRequired();
        attachment.Property(x => x.OriginalFileName).HasMaxLength(255).IsRequired(); attachment.Property(x => x.ContentType).HasMaxLength(150).IsRequired(); attachment.Property(x => x.S3ObjectKey).HasMaxLength(700).IsRequired();
        // Same length as script 026 (NVARCHAR(20)); without it a model-built SQL Server database gets nvarchar(max), which
        // the box index (PickupCollectionSchema) cannot use.
        attachment.Property(x => x.BoxSource).HasMaxLength(20);
        attachment.HasIndex(x => new { x.PickupId, x.SerialNo }); TenantAndPickup(attachment, x => x.PickupId);

        var signoff = modelBuilder.Entity<PickupSignoff>();
        signoff.ToTable("PickupSignoffs"); signoff.Property(x => x.Party).HasMaxLength(20).IsRequired(); signoff.Property(x => x.SignerName).HasMaxLength(160).IsRequired(); signoff.Property(x => x.Statement).HasMaxLength(1000).IsRequired();
        signoff.Property(x => x.Remarks).HasMaxLength(1000); signoff.Property(x => x.SignaturePng).IsRequired(); signoff.Property(x => x.RecordedBy).HasMaxLength(254).IsRequired();
        signoff.HasIndex(x => new { x.PickupId, x.SerialNo }); TenantAndPickup(signoff, x => x.PickupId);
        signoff.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var warehouse = modelBuilder.Entity<Warehouse>();
        warehouse.ToTable("Warehouses"); warehouse.Property(x => x.Code).HasMaxLength(40).IsRequired(); warehouse.Property(x => x.Name).HasMaxLength(160).IsRequired(); warehouse.Property(x => x.Address).HasMaxLength(500);
        warehouse.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        warehouse.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<PackageHandover>().HasOne<Warehouse>().WithMany().HasForeignKey(x => x.WarehouseId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
    }

    private static void TenantAndPickup<T>(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<T> entity, System.Linq.Expressions.Expression<Func<T, object?>> pickupKey) where T : class
    {
        entity.HasOne<Tenant>().WithMany().HasForeignKey("TenantId").HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne<Pickup>().WithMany().HasForeignKey(pickupKey).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade);
    }
}

