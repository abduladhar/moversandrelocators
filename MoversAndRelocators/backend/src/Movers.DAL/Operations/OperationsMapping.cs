using Microsoft.EntityFrameworkCore;
using Movers.Domain.Operations;
using Movers.Domain.Pickups;
using Movers.Domain.Employees;
using Movers.Domain.Common;
using Movers.Domain.Tenants;
namespace Movers.DAL.Operations;

public static class OperationsMapping
{
    public static void Configure(ModelBuilder model)
    {
        var labour = model.Entity<LabourEntry>(); labour.ToTable("LabourEntries");
        labour.HasIndex(x => new { x.TenantId, x.RequestId }).IsUnique();
        labour.HasIndex(x => new { x.TenantId, x.EmployeeId });
        labour.HasOne<Pickup>().WithMany().HasForeignKey(x => x.PickupId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        labour.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var trip = model.Entity<TransportTrip>(); trip.ToTable("TransportTrips");
        trip.HasIndex(x => new { x.TenantId, x.Number }).IsUnique();
        trip.Property(x => x.Version).IsConcurrencyToken();
        trip.HasOne<Vehicle>().WithMany().HasForeignKey(x => x.VehicleId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var allocation = model.Entity<TripAllocation>(); allocation.ToTable("TripAllocations");
        allocation.HasIndex(x => new { x.TripId, x.PickupId }).IsUnique();
        allocation.HasOne<TransportTrip>().WithMany().HasForeignKey(x => x.TripId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        allocation.HasOne<Pickup>().WithMany().HasForeignKey(x => x.PickupId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var expense = model.Entity<JobExpense>(); expense.ToTable("JobExpenses");
        expense.HasIndex(x => new { x.TenantId, x.RequestId }).IsUnique();
        expense.HasIndex(x => new { x.TenantId, x.Vendor, x.Reference }).IsUnique();
        expense.HasOne<Pickup>().WithMany().HasForeignKey(x => x.PickupId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var report = model.Entity<SavedReport>(); report.ToTable("SavedReports"); report.Property(x => x.Version).IsConcurrencyToken();
        var journal = model.Entity<JournalEntry>(); journal.ToTable("JournalEntries");
        journal.HasIndex(x => new { x.TenantId, x.RequestId }).IsUnique();
        journal.HasIndex(x => new { x.TenantId, x.Reference }).IsUnique();
        journal.HasIndex(x => x.ReversesId).IsUnique();
        journal.HasOne<JournalEntry>().WithMany().HasForeignKey(x => x.ReversesId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        journal.HasOne<Pickup>().WithMany().HasForeignKey(x => x.PickupId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var line = model.Entity<JournalLine>(); line.ToTable("JournalLines");
        line.HasOne<JournalEntry>().WithMany().HasForeignKey(x => x.JournalId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        Type[] types = [typeof(LabourEntry), typeof(TransportTrip), typeof(TripAllocation), typeof(JobExpense), typeof(SavedReport), typeof(JournalEntry), typeof(JournalLine)];
        foreach (var type in types)
        {
            var builder = model.Entity(type);
            builder.HasOne(typeof(Tenant)).WithMany().HasForeignKey(nameof(TenantOwnedEntity.TenantId)).HasPrincipalKey(nameof(Entity.Id)).OnDelete(DeleteBehavior.Restrict);
            foreach (var property in builder.Metadata.GetProperties())
            {
                if (property.ClrType == typeof(string)) property.SetMaxLength(property.Name is "Notes" or "Description" or "ColumnsJson" ? 2000 : property.Name is "Origin" or "Destination" ? 500 : 160);
                if (property.ClrType == typeof(decimal) || property.ClrType == typeof(decimal?))
                {
                    property.SetPrecision(18);
                    property.SetScale(property.Name is "RegularHours" or "OvertimeHours" or "UnpaidBreakMinutes" or "Weight" ? 4 : 2);
                }
            }
        }
        expense.Property(x => x.Reference).HasMaxLength(120);
    }
}
