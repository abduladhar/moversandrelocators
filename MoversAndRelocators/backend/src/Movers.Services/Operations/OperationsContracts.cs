using Movers.Domain.Operations;
using Movers.Domain.Pickups;
using Movers.Domain.Employees;

namespace Movers.Services.Operations;

public sealed record RecordLabour(Guid RequestId, Guid PickupId, Guid EmployeeId, string Activity,
    DateTimeOffset StartedAtUtc, DateTimeOffset EndedAtUtc, decimal UnpaidBreakMinutes,
    decimal OvertimeHours, decimal HourlyRate, decimal OvertimeRate, string Currency, string? Notes, decimal? ExchangeRate = null);
public sealed record CreateTrip(string? Number, Guid VehicleId, string Origin, string Destination,
    DateTimeOffset StartedAtUtc, decimal StartOdometer, decimal KmPerLitre, decimal FuelPricePerLitre,
    string Currency, IReadOnlyList<AllocationInput> Allocations, decimal? ExchangeRate = null);
public sealed record AllocationInput(Guid PickupId, decimal Weight);
public sealed record CompleteTrip(Guid Version, decimal EndOdometer, decimal OtherCost, DateTimeOffset CompletedAtUtc);
public sealed record RecordExpense(Guid RequestId, Guid PickupId, string Category, string Vendor,
    string Reference, decimal Amount, string Currency, string? Notes, decimal? ExchangeRate = null);
public sealed record SaveReport(string Name, IReadOnlyList<string> Columns, string SortBy, Guid? Version);
public sealed record ReportDefinition(Guid Id, string Name, IReadOnlyList<string> Columns, string SortBy, Guid Version);
public sealed record CostRow(Guid PickupId, string PickupNumber, string CustomerName, string Currency,
    decimal RecordedIncome, decimal LabourHours, decimal LabourCost, decimal MaterialCost,
    decimal FuelCost, decimal TransportOtherCost, decimal VendorCost, decimal OtherExpense,
    decimal LegacyExpense, decimal TotalCost, decimal RecordedSurplus);
public sealed record PickupChoice(Guid Id, string PickupNumber, string CustomerName);
public sealed record EmployeeChoice(Guid Id, string FullName, bool IsActive);
public sealed record VehicleChoice(Guid Id, string RegistrationNumber, string Name, bool IsActive);
public sealed record OperationsChoices(IReadOnlyList<PickupChoice> Pickups, IReadOnlyList<EmployeeChoice> Employees, IReadOnlyList<VehicleChoice> Vehicles);
public sealed record TripDetails(TransportTrip Trip, IReadOnlyList<TripAllocation> Allocations);
public sealed record JournalInput(Guid RequestId, string Reference, string Description, string Currency,
    DateOnly PostingDate, Guid? PickupId, IReadOnlyList<JournalLineInput> Lines, decimal? ExchangeRate = null);
public sealed record JournalLineInput(string AccountCode, decimal Debit, decimal Credit);
public sealed record AccountDefinition(string Code, string Name, string Kind);
public sealed record AccountBalance(string Code, string Name, decimal Debit, decimal Credit, decimal Balance);
public sealed record JournalDetails(JournalEntry Entry, IReadOnlyList<JournalLine> Lines);
public sealed class OperationConflictException(string message) : Exception(message);

public interface IOperationsRepository
{
    Task<T> Transaction<T>(Func<Task<T>> action, CancellationToken ct);
    Task<Pickup?> Pickup(Guid id, CancellationToken ct);
    Task<Employee?> Employee(Guid id, CancellationToken ct);
    Task<Vehicle?> Vehicle(Guid id, CancellationToken ct);
    Task<IReadOnlyList<Pickup>> Pickups(CancellationToken ct);
    Task<IReadOnlyList<Employee>> Employees(CancellationToken ct);
    Task<IReadOnlyList<Vehicle>> Vehicles(CancellationToken ct);
    Task<IReadOnlyList<PickupMaterialUsage>> Materials(CancellationToken ct);
    Task<IReadOnlyList<PickupTransaction>> LegacyTransactions(CancellationToken ct);
    Task<IReadOnlyList<Movers.Domain.Packing.PackingJob>> PackingJobs(CancellationToken ct);
    Task<IReadOnlyList<Movers.Domain.Packing.PackingJobTransaction>> PackingTransactions(CancellationToken ct);
    Task<IReadOnlyList<Movers.Domain.Delivery.DeliveryJob>> DeliveryJobs(CancellationToken ct);
    Task<IReadOnlyList<Movers.Domain.Delivery.DeliveryJobTransaction>> DeliveryTransactions(CancellationToken ct);
    /// <summary>Customer name per delivery note, for labelling money collected on a delivery.</summary>
    Task<IReadOnlyDictionary<Guid, string>> DeliveryNoteCustomers(CancellationToken ct);
    Task<IReadOnlyList<PickupExpense>> CrewExpenses(CancellationToken ct);
    Task<IReadOnlyList<LabourEntry>> Labour(CancellationToken ct);
    Task<IReadOnlyList<TransportTrip>> Trips(CancellationToken ct);
    Task<TransportTrip?> Trip(Guid id, CancellationToken ct);
    Task<IReadOnlyList<TripAllocation>> Allocations(CancellationToken ct);
    Task<IReadOnlyList<JobExpense>> Expenses(CancellationToken ct);
    Task<IReadOnlyList<SavedReport>> Reports(CancellationToken ct);
    Task<SavedReport?> Report(Guid id, CancellationToken ct);
    Task<IReadOnlyList<JournalEntry>> Journals(CancellationToken ct);
    /// <summary>Full names of users (for example who posted a journal), by user id.</summary>
    Task<IReadOnlyDictionary<Guid, string>> UserNames(IReadOnlyCollection<Guid> ids, CancellationToken ct);
    Task<IReadOnlyList<JournalLine>> JournalLines(CancellationToken ct);
    Task<string?> QuotationCurrency(Guid? quotationId, CancellationToken ct);
    void Add(object entity);
    Task Save(CancellationToken ct);
}

public interface IOperationsService
{
    Task<OperationsChoices> Choices(CancellationToken ct);
    Task<IReadOnlyList<LabourEntry>> Labour(CancellationToken ct);
    Task<LabourEntry> RecordLabour(RecordLabour command, CancellationToken ct);
    Task<IReadOnlyList<TripDetails>> Trips(CancellationToken ct);
    Task<TripDetails> CreateTrip(CreateTrip command, CancellationToken ct);
    Task<TripDetails> CompleteTrip(Guid id, CompleteTrip command, CancellationToken ct);
    Task<IReadOnlyList<JobExpense>> Expenses(CancellationToken ct);
    Task<JobExpense> RecordExpense(RecordExpense command, CancellationToken ct);
    Task<IReadOnlyList<CostRow>> Costs(CancellationToken ct, string mode = "TRANSACTION", DateOnly? date = null);
    Task<IReadOnlyList<ReportDefinition>> Reports(CancellationToken ct);
    Task<ReportDefinition> SaveReport(Guid? id, SaveReport command, CancellationToken ct);
    Task<string> ExportReport(Guid id, CancellationToken ct, string mode = "TRANSACTION", DateOnly? date = null);
    Task<IReadOnlyList<JournalDetails>> Journals(CancellationToken ct);
    Task<JournalDetails> PostJournal(JournalInput command, CancellationToken ct);
    Task<JournalDetails> ReverseJournal(Guid id, Guid requestId, DateOnly date, CancellationToken ct);
    Task<IReadOnlyList<AccountBalance>> TrialBalance(string currency, CancellationToken ct);
}

