using Movers.Services.Currencies;
using Movers.Domain.Configuration;
using Movers.Domain.Pickups;
using Movers.Domain.Surveys;
using Movers.Services.Aws;
using Movers.Services.Operations;
using Movers.Services.Sales;
using Movers.Services.Security;
using Movers.Services.Surveys;
using Movers.Services.Tenancy;

namespace Movers.Services.Pickups;

public sealed record PickupTripModel(decimal? DistanceKm, bool IsPaused, long ActiveSeconds, long PausedSeconds, IReadOnlyList<SurveyTimeEventModel> Events);
public sealed record PickupExpenseModel(int SerialNo, Guid Id, string Category, decimal Amount, string Currency, DateTimeOffset IncurredAtUtc, Guid? PaidByEmployeeId, string? PaidByName, string? Notes);
public sealed record PickupAttachmentModel(int SerialNo, Guid Id, string Stage, string? RoomName, string UploadedBy, string OriginalFileName, string ContentType, long SizeBytes, DateTimeOffset? UploadedAtUtc);
public sealed record PickupSignoffModel(Guid Id, string Party, string SignerName, Guid? EmployeeId, string Statement, string? Remarks, string SignaturePng, DateTimeOffset SignedAtUtc, string RecordedBy);
public sealed record PackageStorageModel(Guid PackageId, string Status, string? Location, Guid? WarehouseId, string? WarehouseName, DateTimeOffset? UpdatedAtUtc);
public sealed record ExpectedItemModel(string RoomName, Guid? HouseholdItemId, string ItemName, int Quantity);
public sealed record PickupWorkModel(PickupTripModel Trip, IReadOnlyList<PickupExpenseModel> Expenses, IReadOnlyList<ExpenseTotalModel> ExpenseTotals, IReadOnlyList<PickupAttachmentModel> Attachments,
    IReadOnlyList<PickupSignoffModel> Signoffs, IReadOnlyList<PackageStorageModel> Storage, IReadOnlyList<ExpectedItemModel> ExpectedInventory, string? InventorySource);
public sealed record WarehouseModel(int SerialNo, Guid Id, string Code, string Name, string? Address, bool IsActive);
public sealed record SaveWarehouseCommand(string Code, string Name, string? Address);
public sealed record CompletePickupTripCommand(DateTimeOffset? At, decimal? DistanceKm);
public sealed record SavePickupExpenseCommand(string Category, decimal Amount, string Currency, DateTimeOffset IncurredAtUtc, Guid? PaidByEmployeeId, string? Notes, decimal? ExchangeRate = null);
public sealed record PickupSignoffCommand(string Party, string SignerName, Guid? EmployeeId, string Statement, string? Remarks, string SignaturePng);
public sealed record StoreInWarehouseCommand(Guid WarehouseId, string? Bay, IReadOnlyList<Guid> PackageIds, string ReceivedBy, string? Notes);

public interface IPickupWorkService
{
    Task<PickupWorkModel?> GetAsync(Guid pickupId, CancellationToken t);
    Task<PickupWorkModel?> StartAsync(Guid pickupId, TripStepCommand c, CancellationToken t);
    Task<PickupWorkModel?> PauseAsync(Guid pickupId, TripStepCommand c, CancellationToken t);
    Task<PickupWorkModel?> ResumeAsync(Guid pickupId, TripStepCommand c, CancellationToken t);
    Task<PickupWorkModel?> CompleteAsync(Guid pickupId, CompletePickupTripCommand c, CancellationToken t);
    Task<PickupWorkModel?> UpdateDistanceAsync(Guid pickupId, decimal? distanceKm, CancellationToken t);
    Task<PickupWorkModel?> AddExpenseAsync(Guid pickupId, SavePickupExpenseCommand c, CancellationToken t);
    Task<PickupWorkModel?> UpdateExpenseAsync(Guid pickupId, Guid expenseId, SavePickupExpenseCommand c, CancellationToken t);
    Task<PickupWorkModel?> DeleteExpenseAsync(Guid pickupId, Guid expenseId, CancellationToken t);
    Task<PresignedUploadModel?> CreateUploadAsync(Guid pickupId, string stage, string? roomName, UploadRequestModel request, CancellationToken t, string? boxSource = null, Guid? boxId = null);
    Task<PickupAttachmentModel?> CompleteUploadAsync(Guid pickupId, Guid attachmentId, CancellationToken t);
    Task<string?> DownloadUrlAsync(Guid pickupId, Guid attachmentId, CancellationToken t);
    Task<bool> DeleteAttachmentAsync(Guid pickupId, Guid attachmentId, CancellationToken t);
    Task<PickupWorkModel?> SignAsync(Guid pickupId, PickupSignoffCommand c, CancellationToken t);
    Task<PickupWorkModel?> StoreAsync(Guid pickupId, StoreInWarehouseCommand c, CancellationToken t);
    Task<IReadOnlyList<WarehouseModel>> WarehousesAsync(CancellationToken t);
    Task<Movers.Services.Common.PagedResult<WarehouseModel>> SearchWarehousesAsync(Movers.Services.Common.ListQuery query, CancellationToken t);
    Task<WarehouseModel> CreateWarehouseAsync(SaveWarehouseCommand c, CancellationToken t);
    Task<WarehouseModel?> UpdateWarehouseAsync(Guid id, SaveWarehouseCommand c, CancellationToken t);
    Task<WarehouseModel?> SetWarehouseActiveAsync(Guid id, bool active, CancellationToken t);
}

/// <summary>
/// Pickup field work: trip clock (leave office → pause/resume → back at office), crew expenses, before/after packing photos by room,
/// crew and customer sign-off with signature, and storing packed boxes in a warehouse (recorded as shipment handovers).
/// </summary>
public sealed class PickupWorkService(IPickupRepository pickups, IPickupWorkRepository work, ITenantContext tenant, IUserContext user,
    ISecretProtector protector, IAwsObjectStorage storage, TimeProvider clock, Movers.Services.Masters.BusinessMasterService masters, WarehouseService warehouseReceiving, Movers.Services.Billing.IBillingRepository billing, IOperationsRepository billingUnit, CurrencyService currencies) : IPickupWorkService
{
    private const int MaxSignatureLength = 400_000;

    public async Task<PickupWorkModel?> GetAsync(Guid pickupId, CancellationToken t)
    {
        var pickup = await pickups.Pickup(pickupId, false, t); if (pickup is null) return null;
        var employees = await work.EmployeesAsync(t); string? Name(Guid? id) => id is null ? null : employees.FirstOrDefault(e => e.Id == id)?.FullName;
        var events = await work.TimeEventsAsync(pickupId, t);
        var (active, paused) = TripClock.Durations(pickup.StartedAtUtc, pickup.EndedAtUtc, events.Select(e => new TripClock.Step(e.Type, e.OccurredAtUtc)).ToList(), clock.GetUtcNow());
        var expenses = (await work.ExpensesAsync(pickupId, t)).Select(x => new PickupExpenseModel(x.SerialNo, x.Id, x.Category, x.Amount, x.Currency, x.IncurredAtUtc, x.PaidByEmployeeId, Name(x.PaidByEmployeeId), x.Notes)).ToList();
        var warehouses = await work.WarehousesAsync(t); var handovers = await work.HandoversAsync(pickupId, t);
        var storageRows = (await pickups.Packages(pickupId, t)).Select(p =>
        {
            var last = handovers.LastOrDefault(h => h.PackageId == p.Id);
            return new PackageStorageModel(p.Id, last?.Status ?? "PACKED", last?.Location, last?.WarehouseId, warehouses.FirstOrDefault(w => w.Id == last?.WarehouseId)?.Name, last?.RecordedAtUtc);
        }).ToList();
        var (expected, source) = await ExpectedInventory(pickup, t);
        return new(new(pickup.DistanceKm, pickup.IsPaused, active, paused, events.Select(x => new SurveyTimeEventModel(x.Id, x.Type, x.OccurredAtUtc, x.Reason, x.RecordedBy)).ToList()),
            expenses, expenses.GroupBy(x => x.Currency).OrderBy(g => g.Key).Select(g => new ExpenseTotalModel(g.Key, g.Sum(x => x.Amount))).ToList(),
            (await work.AttachmentsAsync(pickupId, t)).Select(Map).ToList(),
            (await work.SignoffsAsync(pickupId, t)).Select(x => new PickupSignoffModel(x.Id, x.Party, x.SignerName, x.EmployeeId, x.Statement, x.Remarks, x.SignaturePng, x.SignedAtUtc, x.RecordedBy)).ToList(),
            storageRows, expected, source);
    }

    public Task<PickupWorkModel?> StartAsync(Guid pickupId, TripStepCommand c, CancellationToken t) => Step(pickupId, c.At, null, SurveyTimeEventTypes.Started, (p, at) => p.StartTrip(at), t);
    public Task<PickupWorkModel?> PauseAsync(Guid pickupId, TripStepCommand c, CancellationToken t)
    {
        if (string.IsNullOrWhiteSpace(c.Reason)) throw new InvalidOperationException("Enter why the pickup is being paused.");
        return Step(pickupId, c.At, c.Reason, SurveyTimeEventTypes.Paused, (p, _) => p.PauseTrip(), t);
    }
    public Task<PickupWorkModel?> ResumeAsync(Guid pickupId, TripStepCommand c, CancellationToken t) => Step(pickupId, c.At, c.Reason, SurveyTimeEventTypes.Resumed, (p, _) => p.ResumeTrip(), t);
    public Task<PickupWorkModel?> CompleteAsync(Guid pickupId, CompletePickupTripCommand c, CancellationToken t)
    {
        if (c.DistanceKm is null) throw new InvalidOperationException("Enter the distance travelled for the pickup.");
        ValidDistance(c.DistanceKm);
        return Step(pickupId, c.At, null, SurveyTimeEventTypes.Completed, (p, at) => p.CompleteTrip(at, c.DistanceKm.Value), t);
    }
    public async Task<PickupWorkModel?> UpdateDistanceAsync(Guid pickupId, decimal? distanceKm, CancellationToken t)
    {
        var pickup = await pickups.Pickup(pickupId, true, t); if (pickup is null) return null;
        ValidDistance(distanceKm); pickup.RecordDistance(distanceKm); await pickups.Save(t); return await GetAsync(pickupId, t);
    }

    public async Task<PickupWorkModel?> AddExpenseAsync(Guid pickupId, SavePickupExpenseCommand c, CancellationToken t)
    {
        if (await pickups.Pickup(pickupId, false, t) is null) return null;
        await ValidateExpense(c, t);
        var expense=new PickupExpense(tenant.TenantId, pickupId, c.Category, c.Amount, c.Currency, c.IncurredAtUtc, c.PaidByEmployeeId, c.Notes);
        var fx=await currencies.Resolve(c.Currency,DateOnly.FromDateTime(c.IncurredAtUtc.UtcDateTime),c.ExchangeRate,t);CurrencyService.Amount(c.Amount,fx);await currencies.SaveSnapshot(expense.Id,fx,t);work.Add(expense);
        await pickups.Save(t); return await GetAsync(pickupId, t);
    }
    public Task<PickupWorkModel?> UpdateExpenseAsync(Guid pickupId, Guid expenseId, SavePickupExpenseCommand c, CancellationToken t) => billingUnit.Transaction(async () =>
    {
        var expense = await work.ExpenseAsync(expenseId, true, t); if (expense is null || expense.PickupId != pickupId) return null;
        if(await billing.CashIsPosted(expenseId,t))throw new InvalidOperationException("This expense is posted to the ledger and cannot be edited.");
        var fx=await currencies.Resolve(c.Currency,DateOnly.FromDateTime(c.IncurredAtUtc.UtcDateTime),c.ExchangeRate,t);CurrencyService.Amount(c.Amount,fx);await currencies.SaveSnapshot(expense.Id,fx,t);
        await ValidateExpense(c,t);expense.Update(c.Category,c.Amount,c.Currency,c.IncurredAtUtc,c.PaidByEmployeeId,c.Notes);
        await pickups.Save(t);return await GetAsync(pickupId,t);
    },t);
    public Task<PickupWorkModel?> DeleteExpenseAsync(Guid pickupId, Guid expenseId, CancellationToken t) => billingUnit.Transaction(async () =>
    {
        var expense = await work.ExpenseAsync(expenseId,true,t);if(expense is null||expense.PickupId!=pickupId)return null;
        if(await billing.CashIsPosted(expenseId,t))throw new InvalidOperationException("This expense is posted to the ledger and cannot be deleted.");
        work.Remove(expense);await pickups.Save(t);return await GetAsync(pickupId,t);
    },t);
    public async Task<PresignedUploadModel?> CreateUploadAsync(Guid pickupId, string stage, string? roomName, UploadRequestModel request, CancellationToken t, string? boxSource = null, Guid? boxId = null)
    {
        if (await pickups.Pickup(pickupId, false, t) is null) return null;
        stage = stage?.Trim().ToUpperInvariant() ?? "";
        if (!PickupPhotoStages.All.Contains(stage)) throw new InvalidOperationException("Choose whether the file is from before packing, after packing, or other.");
        if (roomName?.Trim().Length > 120) throw new InvalidOperationException("Keep the room name under 120 characters.");
        var (fileName, contentType) = UploadPolicy.Validate(request);
        var credentials = StorageCredentials.Resolve(storage, protector, await work.AwsAsync(t));
        var attachment = new PickupAttachment(tenant.TenantId, pickupId, stage, roomName, RecordedBy(), fileName, contentType, request.SizeBytes, boxSource, boxId);
        work.Add(attachment); await pickups.Save(t);
        var expires = clock.GetUtcNow().AddMinutes(15);
        return new(attachment.Id, await storage.CreateUploadUrlAsync(credentials, attachment.S3ObjectKey, contentType, expires, t), expires);
    }
    public async Task<PickupAttachmentModel?> CompleteUploadAsync(Guid pickupId, Guid attachmentId, CancellationToken t)
    {
        var attachment = await work.AttachmentAsync(attachmentId, true, t); if (attachment is null || attachment.PickupId != pickupId) return null;
        if (attachment.IsUploaded) return Map(attachment);
        var info = await storage.GetObjectInfoAsync(StorageCredentials.Resolve(storage, protector, await work.AwsAsync(t)), attachment.S3ObjectKey, t)
            ?? throw new InvalidOperationException("The file has not reached storage yet.");
        UploadPolicy.EnsureStoredSize(info, attachment.DeclaredSizeBytes);
        attachment.MarkUploaded(info.SizeBytes); await pickups.Save(t); return Map(attachment);
    }
    public async Task<string?> DownloadUrlAsync(Guid pickupId, Guid attachmentId, CancellationToken t)
    {
        var attachment = await work.AttachmentAsync(attachmentId, false, t); if (attachment is null || attachment.PickupId != pickupId || !attachment.IsUploaded) return null;
        return await storage.CreateDownloadUrlAsync(StorageCredentials.Resolve(storage, protector, await work.AwsAsync(t)), attachment.S3ObjectKey, attachment.OriginalFileName, clock.GetUtcNow().AddMinutes(10), t);
    }
    public async Task<bool> DeleteAttachmentAsync(Guid pickupId, Guid attachmentId, CancellationToken t)
    {
        var attachment = await work.AttachmentAsync(attachmentId, true, t); if (attachment is null || attachment.PickupId != pickupId) return false;
        work.Remove(attachment); await pickups.Save(t); return true;
    }

    /// <summary>Records an on-site sign-off. Sign-offs are permanent; a correction is a new sign-off.</summary>
    public async Task<PickupWorkModel?> SignAsync(Guid pickupId, PickupSignoffCommand c, CancellationToken t)
    {
        if (await pickups.Pickup(pickupId, false, t) is null) return null;
        var party = c.Party?.Trim().ToUpperInvariant();
        if (party is not (PickupSignoffParties.Employee or PickupSignoffParties.Customer)) throw new InvalidOperationException("Choose whether the employee or the customer is signing.");
        if (string.IsNullOrWhiteSpace(c.SignerName) || c.SignerName.Trim().Length > 160) throw new InvalidOperationException("Enter the signer's full name.");
        if (string.IsNullOrWhiteSpace(c.Statement) || c.Statement.Length > 1000 || c.Remarks?.Length > 1000) throw new InvalidOperationException("The confirmation statement is required and remarks must be under 1000 characters.");
        if (string.IsNullOrWhiteSpace(c.SignaturePng) || !c.SignaturePng.StartsWith("data:image/png;base64,", StringComparison.Ordinal) || c.SignaturePng.Length > MaxSignatureLength)
            throw new InvalidOperationException("Capture a signature before confirming.");
        if (party == PickupSignoffParties.Employee && (c.EmployeeId is null || await work.EmployeeAsync(c.EmployeeId.Value, t) is null)) throw new InvalidOperationException("Select the employee who is signing.");
        work.Add(new PickupSignoff(tenant.TenantId, pickupId, party, c.SignerName, party == PickupSignoffParties.Employee ? c.EmployeeId : null, c.Statement.Trim(), c.Remarks, c.SignaturePng, clock.GetUtcNow(), RecordedBy()));
        await pickups.Save(t); return await GetAsync(pickupId, t);
    }

    /// <summary>Moves packed boxes into a warehouse through the shipment custody chain, which requires the customer's packing confirmation.</summary>
    public async Task<PickupWorkModel?> StoreAsync(Guid pickupId, StoreInWarehouseCommand c, CancellationToken t)
    {
        if (await pickups.Pickup(pickupId, false, t) is null) return null;
        await warehouseReceiving.ReceivePickup(new ReceivePickupBoxes(Guid.NewGuid(), pickupId, c.WarehouseId, c.Bay, c.ReceivedBy, c.Notes, c.PackageIds), t);
        return await GetAsync(pickupId, t);
    }

    public async Task<IReadOnlyList<WarehouseModel>> WarehousesAsync(CancellationToken t) => (await work.WarehousesAsync(t)).Select(Map).ToList();
    public async Task<Movers.Services.Common.PagedResult<WarehouseModel>> SearchWarehousesAsync(Movers.Services.Common.ListQuery query, CancellationToken t) { var (items, total) = await work.SearchWarehousesAsync(query.Normalized(), t); return new(items.Select(Map).ToList(), total); }
    public async Task<WarehouseModel> CreateWarehouseAsync(SaveWarehouseCommand c, CancellationToken t)
    {
        await ValidateWarehouse(c, null, t); var x = new Warehouse(tenant.TenantId, c.Code, c.Name, c.Address); work.Add(x); await pickups.Save(t); return Map(x);
    }
    public async Task<WarehouseModel?> UpdateWarehouseAsync(Guid id, SaveWarehouseCommand c, CancellationToken t)
    {
        var x = await work.WarehouseAsync(id, true, t); if (x is null) return null; await ValidateWarehouse(c, id, t); x.Update(c.Code, c.Name, c.Address); await pickups.Save(t); return Map(x);
    }
    public async Task<WarehouseModel?> SetWarehouseActiveAsync(Guid id, bool active, CancellationToken t)
    {
        var x = await work.WarehouseAsync(id, true, t); if (x is null) return null; x.SetActive(active); await pickups.Save(t); return Map(x);
    }

    private async Task<PickupWorkModel?> Step(Guid pickupId, DateTimeOffset? requestedAt, string? reason, string type, Action<Pickup, DateTimeOffset> apply, CancellationToken t)
    {
        var pickup = await pickups.Pickup(pickupId, true, t); if (pickup is null) return null;
        if (reason?.Length > 500) throw new InvalidOperationException("Keep the reason under 500 characters.");
        var previous = (await work.TimeEventsAsync(pickupId, t)).LastOrDefault()?.OccurredAtUtc ?? pickup.StartedAtUtc;
        var at = TripClock.StepTime(requestedAt, previous, type == SurveyTimeEventTypes.Started, clock.GetUtcNow());
        apply(pickup, at);
        work.Add(new PickupTimeEvent(tenant.TenantId, pickupId, type, at, reason, RecordedBy()));
        await pickups.Save(t); return await GetAsync(pickupId, t);
    }

    /// <summary>What the crew should pack: quotation items, otherwise the quotation's survey, otherwise the sales lead's latest survey.</summary>
    private async Task<(IReadOnlyList<ExpectedItemModel>, string?)> ExpectedInventory(Pickup pickup, CancellationToken t)
    {
        if (pickup.QuotationId is { } quotationId)
        {
            var items = await work.QuotationItemsAsync(quotationId, t);
            if (items.Count > 0) return (items.Select(x => new ExpectedItemModel(x.RoomName, x.HouseholdItemId, x.ItemName, x.Quantity)).ToList(), "QUOTATION");
            if ((await pickups.Quotation(quotationId, t))?.SurveyId is { } quoteSurvey) return (await SurveyItems(quoteSurvey, t), "SURVEY");
        }
        if (pickup.SalesLeadId is { } leadId && await work.LatestSurveyIdForLeadAsync(leadId, t) is { } leadSurvey) return (await SurveyItems(leadSurvey, t), "SURVEY");
        return ([], null);
    }
    private async Task<IReadOnlyList<ExpectedItemModel>> SurveyItems(Guid surveyId, CancellationToken t) =>
        (await work.SurveyInventoryAsync(surveyId, t)).Select(x => new ExpectedItemModel(x.RoomName, x.HouseholdItemId, x.ItemName, x.Quantity)).ToList();

    private async Task ValidateExpense(SavePickupExpenseCommand c, CancellationToken t)
    {
        await masters.EnsureActive("expense-category", c.Category, t);
        TripClock.ValidateExpense("OTHER", c.Amount, c.Currency, c.IncurredAtUtc, c.Notes, clock.GetUtcNow());
        if (c.PaidByEmployeeId is not null && await work.EmployeeAsync(c.PaidByEmployeeId.Value, t) is null) throw new InvalidOperationException("Select the employee who paid.");
    }
    private async Task ValidateWarehouse(SaveWarehouseCommand c, Guid? id, CancellationToken t)
    {
        if (string.IsNullOrWhiteSpace(c.Code) || string.IsNullOrWhiteSpace(c.Name)) throw new InvalidOperationException("Warehouse code and name are required.");
        if (await work.WarehouseCodeExistsAsync(c.Code.Trim().ToUpperInvariant(), id, t)) throw new InvalidOperationException("Warehouse code already exists.");
    }
    private static void ValidDistance(decimal? distanceKm) { if (distanceKm is < 0 or > 5000) throw new InvalidOperationException("Distance must be between 0 and 5000 km."); }
    private string RecordedBy() => string.IsNullOrWhiteSpace(user.Email) ? "Staff" : user.Email;
    private static PickupAttachmentModel Map(PickupAttachment x) => new(x.SerialNo, x.Id, x.Stage, x.RoomName, x.UploadedBy, x.OriginalFileName, x.ContentType, x.StoredSizeBytes ?? x.DeclaredSizeBytes, x.UploadedAtUtc);
    private static WarehouseModel Map(Warehouse x) => new(x.SerialNo, x.Id, x.Code, x.Name, x.Address, x.IsActive);
}





