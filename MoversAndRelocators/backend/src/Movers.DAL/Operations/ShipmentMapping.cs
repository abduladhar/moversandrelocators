using Microsoft.EntityFrameworkCore;
using Movers.Domain.Common;
using Movers.Domain.Operations;
using Movers.Domain.Pickups;
using Movers.Domain.Tenants;
namespace Movers.DAL.Operations;
public static class ShipmentMapping
{
    public static void Configure(ModelBuilder model)
    {
        var confirmation = model.Entity<PackingConfirmation>(); confirmation.ToTable("PackingConfirmations");
        confirmation.HasIndex(x => new { x.TenantId, x.PickupId }).IsUnique();
        confirmation.HasIndex(x => x.TokenHash).IsUnique();
        confirmation.Property(x => x.TokenHash).HasMaxLength(64); confirmation.Property(x => x.SnapshotHash).HasMaxLength(64);
        confirmation.Property(x => x.Response).HasMaxLength(30); confirmation.Property(x => x.ResponderName).HasMaxLength(160);
        confirmation.Property(x => x.ResponseNotes).HasMaxLength(2000); confirmation.Property(x => x.Version).IsConcurrencyToken();
        confirmation.HasOne<Pickup>().WithMany().HasForeignKey(x => x.PickupId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var handover = model.Entity<PackageHandover>(); handover.ToTable("PackageHandovers");
        handover.HasIndex(x => new { x.TenantId, x.RequestId }).IsUnique();
        handover.HasIndex(x => new { x.TenantId, x.PackageId, x.SerialNo });
        handover.Property(x => x.Status).HasMaxLength(30); handover.Property(x => x.Location).HasMaxLength(500);
        handover.Property(x => x.ReceivedBy).HasMaxLength(160); handover.Property(x => x.Notes).HasMaxLength(2000);
        handover.HasOne<Pickup>().WithMany().HasForeignKey(x => x.PickupId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        handover.HasOne<PickupPackage>().WithMany().HasForeignKey(x => x.PackageId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var claim = model.Entity<ShipmentClaim>(); claim.ToTable("ShipmentClaims");
        claim.Property(x => x.Category).HasMaxLength(30); claim.Property(x => x.Status).HasMaxLength(30);
        claim.Property(x => x.Description).HasMaxLength(2000); claim.Property(x => x.Resolution).HasMaxLength(2000);
        claim.Property(x => x.Owner).HasMaxLength(160); claim.Property(x => x.Version).IsConcurrencyToken();
        claim.HasOne<Pickup>().WithMany().HasForeignKey(x => x.PickupId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        claim.HasOne<PickupPackage>().WithMany().HasForeignKey(x => x.PackageId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        foreach (var type in new[] { typeof(PackingConfirmation), typeof(PackageHandover), typeof(ShipmentClaim) })
            model.Entity(type).HasOne(typeof(Tenant)).WithMany().HasForeignKey(nameof(TenantOwnedEntity.TenantId)).HasPrincipalKey(nameof(Entity.Id)).OnDelete(DeleteBehavior.Restrict);
    }
}
