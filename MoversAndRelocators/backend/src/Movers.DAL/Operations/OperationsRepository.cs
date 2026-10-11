using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using Npgsql;
using Movers.DAL.Persistence;
using Movers.Domain.Operations;
using Movers.Domain.Pickups;
using Movers.Domain.Employees;
using Movers.Services.Operations;
namespace Movers.DAL.Operations;

public sealed class OperationsRepository(MoversDbContext db) : IOperationsRepository
{
    public async Task<T> Transaction<T>(Func<Task<T>> action, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try { var result = await action(); await transaction.CommitAsync(ct); return result; }
        catch (Exception ex) when (IsConflict(ex))
        {
            await transaction.RollbackAsync(CancellationToken.None);
            throw new OperationConflictException("Another request changed these records. Refresh and retry with the same request ID.");
        }
    }
    private static bool IsConflict(Exception ex) => ex is DbUpdateConcurrencyException ||
        ex is SqlException { Number: 1205 or 2601 or 2627 } ||
        ex is PostgresException { SqlState: "40001" or "40P01" or "23505" } ||
        ex.InnerException is not null && IsConflict(ex.InnerException);
    public Task<Pickup?> Pickup(Guid id, CancellationToken ct) => db.Pickups.SingleOrDefaultAsync(x => x.Id == id, ct);
    public Task<Employee?> Employee(Guid id, CancellationToken ct) => db.Employees.SingleOrDefaultAsync(x => x.Id == id, ct);
    public Task<Vehicle?> Vehicle(Guid id, CancellationToken ct) => db.Vehicles.SingleOrDefaultAsync(x => x.Id == id, ct);
    public async Task<IReadOnlyList<Employee>> Employees(CancellationToken ct) => await db.Employees.AsNoTracking().ToListAsync(ct);
    public async Task<IReadOnlyList<Vehicle>> Vehicles(CancellationToken ct) => await db.Vehicles.AsNoTracking().ToListAsync(ct);
    public async Task<IReadOnlyList<Pickup>> Pickups(CancellationToken ct) => await db.Pickups.OrderByDescending(x => x.SerialNo).ToListAsync(ct);
    public async Task<IReadOnlyList<PickupMaterialUsage>> Materials(CancellationToken ct) => await db.PickupMaterialUsages.ToListAsync(ct);
    public async Task<IReadOnlyList<PickupTransaction>> LegacyTransactions(CancellationToken ct) => await db.PickupTransactions.ToListAsync(ct);
    public async Task<IReadOnlyList<Movers.Domain.Packing.PackingJob>> PackingJobs(CancellationToken ct) => await db.Set<Movers.Domain.Packing.PackingJob>().AsNoTracking().ToListAsync(ct);
    public async Task<IReadOnlyList<Movers.Domain.Packing.PackingJobTransaction>> PackingTransactions(CancellationToken ct) => await db.Set<Movers.Domain.Packing.PackingJobTransaction>().AsNoTracking().ToListAsync(ct);
    public async Task<IReadOnlyList<Movers.Domain.Delivery.DeliveryJob>> DeliveryJobs(CancellationToken ct) => await db.Set<Movers.Domain.Delivery.DeliveryJob>().AsNoTracking().ToListAsync(ct);
    public async Task<IReadOnlyList<Movers.Domain.Delivery.DeliveryJobTransaction>> DeliveryTransactions(CancellationToken ct) => await db.Set<Movers.Domain.Delivery.DeliveryJobTransaction>().AsNoTracking().ToListAsync(ct);
    public async Task<IReadOnlyDictionary<Guid, string>> DeliveryNoteCustomers(CancellationToken ct) => await db.Set<Movers.Domain.Delivery.DeliveryNote>().AsNoTracking().Select(x => new { x.Id, x.CustomerName }).ToDictionaryAsync(x => x.Id, x => x.CustomerName, ct);
    public async Task<IReadOnlyList<PickupExpense>> CrewExpenses(CancellationToken ct) => await db.Set<PickupExpense>().AsNoTracking().ToListAsync(ct);
    public async Task<IReadOnlyList<LabourEntry>> Labour(CancellationToken ct) => await db.Set<LabourEntry>().OrderByDescending(x => x.SerialNo).ToListAsync(ct);
    public async Task<IReadOnlyList<TransportTrip>> Trips(CancellationToken ct) => await db.Set<TransportTrip>().OrderByDescending(x => x.SerialNo).ToListAsync(ct);
    public Task<TransportTrip?> Trip(Guid id, CancellationToken ct) => db.Set<TransportTrip>().SingleOrDefaultAsync(x => x.Id == id, ct);
    public async Task<IReadOnlyList<TripAllocation>> Allocations(CancellationToken ct) => await db.Set<TripAllocation>().ToListAsync(ct);
    public async Task<IReadOnlyList<JobExpense>> Expenses(CancellationToken ct) => await db.Set<JobExpense>().OrderByDescending(x => x.SerialNo).ToListAsync(ct);
    public async Task<IReadOnlyList<SavedReport>> Reports(CancellationToken ct) => await db.Set<SavedReport>().OrderByDescending(x => x.SerialNo).ToListAsync(ct);
    public Task<SavedReport?> Report(Guid id, CancellationToken ct) => db.Set<SavedReport>().SingleOrDefaultAsync(x => x.Id == id, ct);
    public async Task<IReadOnlyDictionary<Guid, string>> UserNames(IReadOnlyCollection<Guid> ids, CancellationToken ct) =>
        await db.Users.AsNoTracking().Where(u => ids.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName, ct);
    public async Task<IReadOnlyList<JournalEntry>> Journals(CancellationToken ct) => await db.Set<JournalEntry>().OrderByDescending(x => x.SerialNo).ToListAsync(ct);
    public async Task<IReadOnlyList<JournalLine>> JournalLines(CancellationToken ct) => await db.Set<JournalLine>().OrderBy(x => x.SerialNo).ToListAsync(ct);
    public async Task<string?> QuotationCurrency(Guid? id, CancellationToken ct) => id.HasValue ? await db.Quotations.Where(x => x.Id == id.Value).Select(x => x.Currency).SingleOrDefaultAsync(ct) : null;
    public void Add(object entity) => db.Add(entity);
    public async Task Save(CancellationToken ct) => await db.SaveChangesAsync(ct);
}
