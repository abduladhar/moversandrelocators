using Microsoft.EntityFrameworkCore;
using Movers.Domain.Delivery;
using Movers.Domain.Employees;
using Movers.Domain.Pickups;
using Movers.Domain.Tenants;

namespace Movers.DAL.Delivery;

/// <summary>Delivery module: runs, trip clock, crew, customer delivery notes with signatures, packages and money.</summary>
public static class DeliveryMapping
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        var job = modelBuilder.Entity<DeliveryJob>();
        job.ToTable("DeliveryJobs");
        job.Property(x => x.Version).IsConcurrencyToken();
        job.Property(x => x.DeliveryNumber).HasMaxLength(40).IsRequired();
        job.Property(x => x.Status).HasMaxLength(20).IsRequired();
        job.Property(x => x.Notes).HasMaxLength(2000);
        job.Property(x => x.DistanceKm).HasPrecision(9, 2);
        job.Ignore(x => x.IsLocked);
        job.HasIndex(x => new { x.TenantId, x.DeliveryNumber }).IsUnique();
        job.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        job.HasOne<Vehicle>().WithMany().HasForeignKey(x => x.VehicleId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        job.HasOne<Employee>().WithMany().HasForeignKey(x => x.DriverEmployeeId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var timeEvent = modelBuilder.Entity<DeliveryJobTimeEvent>();
        timeEvent.ToTable("DeliveryJobTimeEvents");
        timeEvent.Property(x => x.Type).HasMaxLength(20).IsRequired();
        timeEvent.Property(x => x.Reason).HasMaxLength(500);
        timeEvent.Property(x => x.RecordedBy).HasMaxLength(254).IsRequired();
        TenantAndJob(timeEvent, x => x.DeliveryJobId);

        var crew = modelBuilder.Entity<DeliveryJobCrew>();
        crew.ToTable("DeliveryJobCrew");
        crew.Property(x => x.Role).HasMaxLength(80).IsRequired();
        crew.Property(x => x.TeamName).HasMaxLength(120);
        TenantAndJob(crew, x => x.DeliveryJobId);
        crew.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var note = modelBuilder.Entity<DeliveryNote>();
        note.ToTable("DeliveryNotes");
        note.Property(x => x.NoteNumber).HasMaxLength(40).IsRequired();
        note.Property(x => x.CustomerName).HasMaxLength(160).IsRequired();
        note.Property(x => x.ContactName).HasMaxLength(160);
        note.Property(x => x.Phone).HasMaxLength(40);
        note.Property(x => x.Address).HasMaxLength(500);
        note.Property(x => x.SignerName).HasMaxLength(160);
        note.Property(x => x.Remarks).HasMaxLength(1000);
        note.Property(x => x.SignedBy).HasMaxLength(254);
        note.Ignore(x => x.IsSigned);
        note.Property(x => x.DateResponse).HasMaxLength(20);
        note.Property(x => x.LocationNotes).HasMaxLength(500);
        note.Property(x => x.Latitude).HasPrecision(9, 6);
        note.Property(x => x.Longitude).HasPrecision(9, 6);
        note.HasIndex(x => new { x.TenantId, x.NoteNumber }).IsUnique();
        TenantAndJob(note, x => x.DeliveryJobId);

        var link = modelBuilder.Entity<DeliveryNoteLink>();
        link.ToTable("DeliveryNoteLinks");
        link.Property(x => x.Purpose).HasMaxLength(20).IsRequired();
        link.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
        link.HasIndex(x => x.TokenHash).IsUnique();
        TenantAndJob(link, x => x.DeliveryJobId);
        link.HasOne<DeliveryNote>().WithMany().HasForeignKey(x => x.DeliveryNoteId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var item = modelBuilder.Entity<DeliveryItem>();
        item.ToTable("DeliveryItems");
        item.Property(x => x.Source).HasMaxLength(20).IsRequired();
        item.Property(x => x.TrackingNumber).HasMaxLength(80).IsRequired();
        item.Property(x => x.Description).HasMaxLength(160).IsRequired();
        item.Property(x => x.Contents).HasMaxLength(2000).IsRequired();
        item.Property(x => x.Location).HasMaxLength(500).IsRequired();
        item.Property(x => x.Reference).HasMaxLength(80).IsRequired();
        item.Property(x => x.Status).HasMaxLength(20).IsRequired();
        item.Property(x => x.LoadedBy).HasMaxLength(254).IsRequired();
        item.Property(x => x.ReceivedBy).HasMaxLength(160);
        item.Property(x => x.Notes).HasMaxLength(500);
        item.Property(x => x.UpdatedBy).HasMaxLength(254);
        item.HasIndex(x => x.BoxId);
        TenantAndJob(item, x => x.DeliveryJobId);
        item.HasOne<DeliveryNote>().WithMany().HasForeignKey(x => x.DeliveryNoteId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var tx = modelBuilder.Entity<DeliveryJobTransaction>();
        tx.ToTable("DeliveryJobTransactions");
        tx.Property(x => x.TransactionNumber).HasMaxLength(60).IsRequired();
        tx.Property(x => x.Type).HasMaxLength(20).IsRequired();
        tx.Property(x => x.Category).HasMaxLength(120).IsRequired();
        tx.Property(x => x.Amount).HasPrecision(20, 4);
        tx.Property(x => x.PaymentMethod).HasMaxLength(40).IsRequired();
        tx.Property(x => x.Notes).HasMaxLength(500);
        tx.HasIndex(x => new { x.TenantId, x.TransactionNumber }).IsUnique();
        TenantAndJob(tx, x => x.DeliveryJobId);
        tx.HasOne<DeliveryNote>().WithMany().HasForeignKey(x => x.DeliveryNoteId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
    }

    private static void TenantAndJob<T>(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<T> entity, System.Linq.Expressions.Expression<Func<T, object?>> jobKey) where T : class
    {
        entity.HasOne<Tenant>().WithMany().HasForeignKey("TenantId").HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne<DeliveryJob>().WithMany().HasForeignKey(jobKey).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade);
    }
}
