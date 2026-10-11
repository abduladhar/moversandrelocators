using Movers.Domain.Configuration;
using Movers.Domain.Employees;
using Movers.Domain.Operations;
using Movers.Domain.Pickups;
using Movers.Domain.Quotations;
using Movers.Domain.Sales;
using Movers.Domain.Surveys;

namespace Movers.Services.Pickups;

/// <summary>Data access for pickup field work: trip, expenses, stage photos, sign-offs, warehouses and expected inventory.</summary>
public interface IPickupWorkRepository
{
    Task<SalesLead?> LeadAsync(Guid id, CancellationToken t);
    Task<Employee?> EmployeeAsync(Guid id, CancellationToken t);
    Task<IReadOnlyList<Employee>> EmployeesAsync(CancellationToken t);
    Task<IReadOnlyList<BoxTypeMaterial>> RecipeAsync(Guid boxTypeId, CancellationToken t);
    Task<IReadOnlyList<QuotationItem>> QuotationItemsAsync(Guid quotationId, CancellationToken t);
    Task<Guid?> LatestSurveyIdForLeadAsync(Guid salesLeadId, CancellationToken t);
    Task<IReadOnlyList<(string RoomName, Guid HouseholdItemId, string ItemName, int Quantity)>> SurveyInventoryAsync(Guid surveyId, CancellationToken t);

    Task<IReadOnlyList<PickupTimeEvent>> TimeEventsAsync(Guid pickupId, CancellationToken t);
    Task<IReadOnlyList<PickupExpense>> ExpensesAsync(Guid pickupId, CancellationToken t);
    Task<PickupExpense?> ExpenseAsync(Guid id, bool track, CancellationToken t);
    Task<IReadOnlyList<PickupAttachment>> AttachmentsAsync(Guid pickupId, CancellationToken t);
    Task<PickupAttachment?> AttachmentAsync(Guid id, bool track, CancellationToken t);
    Task<IReadOnlyList<PickupSignoff>> SignoffsAsync(Guid pickupId, CancellationToken t);
    Task<IReadOnlyList<PackageHandover>> HandoversAsync(Guid pickupId, CancellationToken t);
    Task<IReadOnlyList<Warehouse>> WarehousesAsync(CancellationToken t);
    Task<Warehouse?> WarehouseAsync(Guid id, bool track, CancellationToken t);
    Task<bool> WarehouseCodeExistsAsync(string code, Guid? excludingId, CancellationToken t);
    Task<TenantAwsConfiguration?> AwsAsync(CancellationToken t);

    void Add(object entity);
    void Remove(object entity);
}
