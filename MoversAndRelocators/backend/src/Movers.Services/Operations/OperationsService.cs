using Movers.Services.Currencies;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Movers.Domain.Operations;
using Movers.Services.Security;
using Movers.Services.Tenancy;
namespace Movers.Services.Operations;

public sealed partial class OperationsService(IOperationsRepository repository, ITenantContext tenant, IUserContext user, TimeProvider clock, Movers.Services.Numbering.IRecordNumbers numbers, Movers.Services.Billing.IBillingRepository billingRepository, Movers.Services.Billing.BillingService billing, CurrencyService currencies, Movers.Services.Masters.BusinessMasterService masters) : IOperationsService
{
    public static readonly string[] Activities = ["PACKING", "LOADING", "TRAVEL", "WAITING", "UNLOADING", "UNPACKING"];
    public static readonly string[] ExpenseCategories = ["HIRED_TRANSPORT", "VENDOR_SERVICE", "STORAGE", "CLAIM", "OTHER"];
    public static readonly string[] ReportColumns = ["pickupNumber", "customerName", "currency", "recordedIncome", "labourHours", "labourCost", "materialCost", "fuelCost", "transportOtherCost", "vendorCost", "otherExpense", "legacyExpense", "totalCost", "recordedSurplus"];
    public static readonly IReadOnlyList<AccountDefinition> Accounts =
    [
        new("1000", "Cash and bank", "Asset"), new("1100", "Customer receivables", "Asset"),
        new("1200", "Employee advances", "Asset"), new("1300", "Packing material stock", "Asset"),
        new("2000", "Vendor payables", "Liability"), new("2100", "Customer advances", "Liability"),
        new("2200", "Tax payable", "Liability"), new("3000", "Opening equity", "Equity"),
        new("4300", "General service revenue", "Revenue"), new("5600", "General service expense", "Expense"),
        new("4000", "Moving revenue", "Revenue"), new("4100", "Storage revenue", "Revenue"),
        new("5000", "Labour expense", "Expense"), new("5100", "Material expense", "Expense"),
        new("5200", "Fuel expense", "Expense"), new("5300", "Vendor transport expense", "Expense"),
        new("5400", "Other job expense", "Expense"), new("4200-FX", "Realized exchange gain", "Revenue"), new("5500", "Exchange loss and rounding", "Expense")
    ];
    public async Task<OperationsChoices> Choices(CancellationToken ct) => new(
        (await repository.Pickups(ct)).Select(x => new PickupChoice(x.Id, x.PickupNumber, x.CustomerName)).ToList(),
        (await repository.Employees(ct)).Select(x => new EmployeeChoice(x.Id, x.FullName, x.IsActive)).ToList(),
        (await repository.Vehicles(ct)).Select(x => new VehicleChoice(x.Id, x.RegistrationNumber, x.Name, x.IsActive)).ToList());
    public Task<IReadOnlyList<LabourEntry>> Labour(CancellationToken ct) => repository.Labour(ct);
    public Task<IReadOnlyList<JobExpense>> Expenses(CancellationToken ct) => repository.Expenses(ct);
    public Task<LabourEntry> RecordLabour(RecordLabour c, CancellationToken ct) => repository.Transaction(async () =>
    {
        RequireRequest(c.RequestId);
        var entries = await repository.Labour(ct);
        var existing = entries.SingleOrDefault(x => x.RequestId == c.RequestId);
        if (existing is not null) { SameRequest(existing.RequestHash, c); return existing; }
        await ValidatePickup(c.PickupId, c.Currency, ct);
        var employee = await repository.Employee(c.EmployeeId, ct);
        if (employee is null || !employee.IsActive) throw new InvalidOperationException("Select an active employee.");
        if (!Activities.Contains(c.Activity)) throw new InvalidOperationException("Select a work activity.");
        if (entries.Any(x => x.EmployeeId == c.EmployeeId && x.StartedAtUtc < c.EndedAtUtc && x.EndedAtUtc > c.StartedAtUtc))
            throw new InvalidOperationException("This employee already has work recorded during this time.");
        CheckAmount(c.HourlyRate); CheckAmount(c.OvertimeRate);
        var calculated = CostCalculations.Labour(c.StartedAtUtc, c.EndedAtUtc, c.UnpaidBreakMinutes, c.OvertimeHours, c.HourlyRate, c.OvertimeRate);
        var entry = new LabourEntry(tenant.TenantId)
        {
            PickupId = c.PickupId, EmployeeId = c.EmployeeId, EmployeeName = employee.FullName, Activity = c.Activity,
            StartedAtUtc = c.StartedAtUtc.ToUniversalTime(), EndedAtUtc = c.EndedAtUtc.ToUniversalTime(),
            UnpaidBreakMinutes = c.UnpaidBreakMinutes, RegularHours = calculated.Regular, OvertimeHours = calculated.Overtime,
            HourlyRate = c.HourlyRate, OvertimeRate = c.OvertimeRate, Cost = calculated.Cost,
            Currency = Currency(c.Currency), Notes = Text(c.Notes, 1000), RequestId = c.RequestId,
            RequestHash = Hash(c), RecordedBy = user.UserId ?? throw new InvalidOperationException("Sign in to record work.")
        };
        var fx=await currencies.Resolve(c.Currency,DateOnly.FromDateTime(c.StartedAtUtc.UtcDateTime),c.ExchangeRate,ct);
        entry.Cost=CurrencyService.Round(entry.RegularHours*c.HourlyRate+entry.OvertimeHours*c.OvertimeRate,fx.DecimalPlaces);
        await currencies.SaveSnapshot(entry.Id,fx,ct);
        repository.Add(entry); await repository.Save(ct); return entry;
    }, ct);
    public async Task<IReadOnlyList<TripDetails>> Trips(CancellationToken ct)
    {
        var allocations = await repository.Allocations(ct);
        return (await repository.Trips(ct)).Select(t => new TripDetails(t, allocations.Where(a => a.TripId == t.Id).ToList())).ToList();
    }
    public async Task<TripDetails> CreateTrip(CreateTrip c, CancellationToken ct)
    {
        var number = await numbers.Next("TR", ct);
        return await repository.Transaction(async () =>
        {
        var trips = await repository.Trips(ct);
        if (trips.Any(x => x.Number == number)) throw new InvalidOperationException("Trip number already exists.");
        var vehicle = await repository.Vehicle(c.VehicleId, ct);
        if (vehicle is null || !vehicle.IsActive) throw new InvalidOperationException("Select an active vehicle.");
        if (trips.Any(x => x.VehicleId == c.VehicleId && x.Status == "PLANNED"))
            throw new InvalidOperationException("Complete the vehicle's current trip before assigning another.");
        if (c.Allocations is null || c.Allocations.Count is < 1 or > 100 || c.Allocations.Select(x => x.PickupId).Distinct().Count() != c.Allocations.Count)
            throw new InvalidOperationException("Select one or more different pickups for this trip.");
        if (c.StartOdometer < 0 || c.StartOdometer > 99999999 || c.KmPerLitre <= 0 || c.KmPerLitre > 1000)
            throw new InvalidOperationException("Check start odometer and fuel efficiency.");
        CheckAmount(c.FuelPricePerLitre);
        var allAllocations = await repository.Allocations(ct);
        foreach (var a in c.Allocations)
        {
            if (a.Weight <= 0 || a.Weight > 1000000) throw new InvalidOperationException("Enter a positive allocation weight.");
            await ValidatePickup(a.PickupId, c.Currency, ct);
            if (allAllocations.Any(x => x.PickupId == a.PickupId && trips.Any(t => t.Id == x.TripId && t.Status == "PLANNED")))
                throw new InvalidOperationException("A selected pickup is already on an unfinished trip.");
        }
        var trip = new TransportTrip(tenant.TenantId)
        {
            Number = number, VehicleId = c.VehicleId, VehicleNumber = vehicle.RegistrationNumber,
            Origin = Required(c.Origin, 500), Destination = Required(c.Destination, 500), StartedAtUtc = c.StartedAtUtc.ToUniversalTime(),
            StartOdometer = c.StartOdometer, KmPerLitre = c.KmPerLitre, FuelPricePerLitre = c.FuelPricePerLitre, Currency = Currency(c.Currency)
        };
        await currencies.SaveSnapshot(trip.Id,await currencies.Resolve(c.Currency,DateOnly.FromDateTime(c.StartedAtUtc.UtcDateTime),c.ExchangeRate,ct),ct);
        repository.Add(trip);
        var allocations = c.Allocations.Select(a => new TripAllocation(tenant.TenantId) { TripId = trip.Id, PickupId = a.PickupId, Weight = a.Weight }).ToList();
        foreach (var allocation in allocations) repository.Add(allocation);
        await repository.Save(ct); return new TripDetails(trip, allocations);
        }, ct);
    }
    public Task<TripDetails> CompleteTrip(Guid id, CompleteTrip c, CancellationToken ct) => repository.Transaction(async () =>
    {
        var trip = await repository.Trip(id, ct) ?? throw new KeyNotFoundException("Trip not found.");
        if (trip.Version != c.Version) throw new OperationConflictException("Trip changed. Refresh before completing.");
        if (trip.Status != "PLANNED") throw new InvalidOperationException("This trip is already completed.");
        if (c.CompletedAtUtc < trip.StartedAtUtc) throw new InvalidOperationException("Completion is before trip start.");
        CheckAmount(c.OtherCost);
        if (c.EndOdometer > 99999999) throw new InvalidOperationException("Odometer reading is out of range.");
        trip.FuelCost = CostCalculations.Fuel(trip.StartOdometer, c.EndOdometer, trip.KmPerLitre, trip.FuelPricePerLitre);
        var decimals=(await currencies.Require(trip.Currency,ct)).DecimalPlaces;
        trip.FuelCost=CurrencyService.Round((c.EndOdometer-trip.StartOdometer)/trip.KmPerLitre*trip.FuelPricePerLitre,decimals);
        if(CurrencyService.Round(c.OtherCost,decimals)!=c.OtherCost)throw new InvalidOperationException("Other cost exceeds currency decimal precision.");
        trip.Kilometres = c.EndOdometer - trip.StartOdometer; trip.EndOdometer = c.EndOdometer; trip.OtherCost = c.OtherCost;
        trip.CompletedAtUtc = c.CompletedAtUtc.ToUniversalTime(); trip.Status = "COMPLETED"; trip.Version = Guid.NewGuid();
        var allocations = (await repository.Allocations(ct)).Where(x => x.TripId == id).OrderBy(x => x.SerialNo).ToList();
        var fuel = CostCalculations.Allocate(trip.FuelCost, allocations.Select(x => x.Weight).ToList(),decimals);
        var other = CostCalculations.Allocate(trip.OtherCost, allocations.Select(x => x.Weight).ToList(),decimals);
        for (var i = 0; i < allocations.Count; i++) { allocations[i].FuelCost = fuel[i]; allocations[i].OtherCost = other[i]; }
        await repository.Save(ct); return new TripDetails(trip, allocations);
    }, ct);
    public Task<JobExpense> RecordExpense(RecordExpense c, CancellationToken ct) => repository.Transaction(async () =>
    {
        RequireRequest(c.RequestId);
        var expenses = await repository.Expenses(ct);
        var existing = expenses.SingleOrDefault(x => x.RequestId == c.RequestId);
        if (existing is not null) { SameRequest(existing.RequestHash, c); return existing; }
        await ValidatePickup(c.PickupId, c.Currency, ct);
        if (!ExpenseCategories.Contains(c.Category)) throw new InvalidOperationException("Select an expense category.");
        CheckAmount(c.Amount);
        if (c.Amount <= 0) throw new InvalidOperationException("Expense must be greater than zero.");
        var vendor = Required(c.Vendor, 160); var reference = Required(c.Reference, 120);
        if (expenses.Any(x => x.Vendor.Equals(vendor, StringComparison.OrdinalIgnoreCase) && x.Reference.Equals(reference, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("This vendor reference has already been recorded.");
        var expense = new JobExpense(tenant.TenantId)
        {
            PickupId = c.PickupId, Category = c.Category, Vendor = vendor, Reference = reference, Amount = c.Amount,
            Currency = Currency(c.Currency), Notes = Text(c.Notes, 1000), RecordedAtUtc = clock.GetUtcNow(), RequestId = c.RequestId, RequestHash = Hash(c)
        };
        var fx=await currencies.Resolve(c.Currency,DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime),c.ExchangeRate,ct);CurrencyService.Amount(c.Amount,fx);await currencies.SaveSnapshot(expense.Id,fx,ct);
        repository.Add(expense); await repository.Save(ct); return expense;
    }, ct);
    public async Task<IReadOnlyList<ReportDefinition>> Reports(CancellationToken ct) => (await repository.Reports(ct)).Select(Definition).ToList();
    public Task<ReportDefinition> SaveReport(Guid? id, SaveReport c, CancellationToken ct) => repository.Transaction(async () =>
    {
        if (c.Columns is null || c.Columns.Count == 0 || c.Columns.Distinct().Count() != c.Columns.Count || c.Columns.Any(x => !ReportColumns.Contains(x)) || !ReportColumns.Contains(c.SortBy))
            throw new InvalidOperationException("Choose distinct supported report columns and a valid sort field.");
        var report = id.HasValue ? await repository.Report(id.Value, ct) ?? throw new KeyNotFoundException("Report not found.") : new SavedReport(tenant.TenantId);
        if (id.HasValue && report.Version != c.Version) throw new OperationConflictException("Report changed. Refresh before editing.");
        report.Name = Required(c.Name, 160); report.ColumnsJson = JsonSerializer.Serialize(c.Columns);
        report.SortBy = c.SortBy; report.Version = Guid.NewGuid(); report.UpdatedAtUtc = clock.GetUtcNow();
        if (!id.HasValue) repository.Add(report);
        await repository.Save(ct); return Definition(report);
    }, ct);
    public async Task<string> ExportReport(Guid id, CancellationToken ct, string mode = "TRANSACTION", DateOnly? date = null)
    {
        var report = await repository.Report(id, ct) ?? throw new KeyNotFoundException("Report not found.");
        var columns = JsonSerializer.Deserialize<string[]>(report.ColumnsJson)!;
        var values = (await Costs(ct,mode,date)).Select(x => JsonSerializer.SerializeToElement(x, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));
        values = values.OrderBy(x => x.GetProperty(report.SortBy), new ReportValueComparer());
        var output = new StringBuilder(); output.AppendLine(string.Join(",", columns.Select(Csv)));
        foreach (var row in values) output.AppendLine(string.Join(",", columns.Select(c => Csv(row.GetProperty(c).ToString()))));
        return output.ToString();
    }
    public async Task<IReadOnlyList<JournalDetails>> Journals(CancellationToken ct)
    {
        var lines = await repository.JournalLines(ct);
        return (await repository.Journals(ct)).Select(x => new JournalDetails(x, lines.Where(l => l.JournalId == x.Id).ToList())).ToList();
    }
    public Task<JournalDetails> PostJournal(JournalInput c, CancellationToken ct) => repository.Transaction(() => Post(c, null, ct), ct);
    public Task<JournalDetails> ReverseJournal(Guid id, Guid requestId, DateOnly date, CancellationToken ct) => repository.Transaction(async () =>
    {
        var entries = await repository.Journals(ct);
        if(await billingRepository.OwnsJournal(id,ct)) throw new InvalidOperationException("Reverse billing documents and vouchers from Billing to keep outstanding balances correct.");
        var original = entries.SingleOrDefault(x => x.Id == id) ?? throw new KeyNotFoundException("Journal not found.");
        var lines = (await repository.JournalLines(ct)).Where(x => x.JournalId == id).ToList();
        var command = new JournalInput(requestId, "REV-" + original.Id.ToString("N"), "Reversal: " + original.Reference,
            original.Currency, date, original.PickupId, lines.Select(x => new JournalLineInput(x.AccountCode, x.Credit, x.Debit)).ToList());
        var existing = entries.SingleOrDefault(x => x.ReversesId == id);
        if (existing is not null)
        {
            if (existing.RequestId != requestId) throw new OperationConflictException("This journal has already been reversed.");
            SameRequest(existing.RequestHash, command);
            return new JournalDetails(existing, (await repository.JournalLines(ct)).Where(x => x.JournalId == existing.Id).ToList());
        }
        return await Post(command, id, ct);
    }, ct);
    private async Task<JournalDetails> Post(JournalInput c, Guid? reversesId, CancellationToken ct)
    {
        RequireRequest(c.RequestId);
        var journals = await repository.Journals(ct); var existing = journals.SingleOrDefault(x => x.RequestId == c.RequestId);
        if (existing is not null)
        {
            SameRequest(existing.RequestHash, c);
            return new(existing, (await repository.JournalLines(ct)).Where(x => x.JournalId == existing.Id).ToList());
        }
        var reference = Required(c.Reference, 120);
        if (journals.Any(x => x.Reference.Equals(reference, StringComparison.OrdinalIgnoreCase))) throw new InvalidOperationException("Journal reference already exists.");
        var currency = Currency(c.Currency);
        if (c.PickupId.HasValue) await ValidatePickup(c.PickupId.Value, currency, ct);
        if (c.PostingDate == default || c.PostingDate > DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime)) throw new InvalidOperationException("Choose a posting date no later than today.");
        if (c.Lines is null || c.Lines.Count is < 2 or > 100) throw new InvalidOperationException("Provide 2 to 100 journal lines.");
        var availableAccounts = await billing.Accounts(ct);
        foreach (var line in c.Lines)
        {
            if (!availableAccounts.Any(x => x.Code == line.AccountCode && x.IsActive)) throw new InvalidOperationException("Select a ledger account.");
            CheckAmount(line.Debit); CheckAmount(line.Credit);
            if ((line.Debit > 0) == (line.Credit > 0)) throw new InvalidOperationException("Each line needs either a debit or a credit.");
        }
        if (c.Lines.Sum(x => x.Debit) != c.Lines.Sum(x => x.Credit)) throw new InvalidOperationException("Journal debits and credits must balance.");
        var entry = new JournalEntry(tenant.TenantId)
        {
            Reference = reference, Description = Required(c.Description, 1000), Currency = currency, PostingDate = c.PostingDate,
            PickupId = c.PickupId, ReversesId = reversesId, RequestId = c.RequestId, RequestHash = Hash(c),
            PostedBy = user.UserId ?? throw new InvalidOperationException("Sign in."), PostedAtUtc = clock.GetUtcNow()
        };
        repository.Add(entry);
        var lines = c.Lines.Select(x => new JournalLine(tenant.TenantId) { JournalId = entry.Id, AccountCode = x.AccountCode, Debit = x.Debit, Credit = x.Credit }).ToList();
        foreach (var line in lines) repository.Add(line);
        if(reversesId.HasValue)await currencies.SaveBaseJournal(entry.Id,(await currencies.BaseLines(reversesId.Value,ct)).Select(x=>new JournalLineInput(x.AccountCode,x.Credit,x.Debit)).ToList(),ct);
        else {
          var fx=await currencies.Resolve(currency,c.PostingDate,c.ExchangeRate,ct);
          foreach(var l in c.Lines){CurrencyService.Amount(l.Debit,fx,true);CurrencyService.Amount(l.Credit,fx,true);}
          await currencies.SaveBaseJournal(entry.Id,CurrencyService.ConvertLines(c.Lines,fx),ct);
          await currencies.SaveSnapshot(entry.Id,fx,ct);
        }
        await repository.Save(ct); return new(entry, lines);
    }
    public async Task<IReadOnlyList<AccountBalance>> TrialBalance(string currency, CancellationToken ct)
    {
        currency = Currency(currency);
        var ids = (await repository.Journals(ct)).Where(x => x.Currency == currency).Select(x => x.Id).ToHashSet();
        var lines = (await repository.JournalLines(ct)).Where(x => ids.Contains(x.JournalId)).ToList();
        return (await billing.Accounts(ct)).Select(a =>
        {
            var debit = lines.Where(x => x.AccountCode == a.Code).Sum(x => x.Debit); var credit = lines.Where(x => x.AccountCode == a.Code).Sum(x => x.Credit);
            return new AccountBalance(a.Code, a.Name, debit, credit, debit - credit);
        }).ToList();
    }
    private async Task ValidatePickup(Guid id, string currency, CancellationToken ct)
    {
        var pickup = await repository.Pickup(id, ct) ?? throw new InvalidOperationException("Select a pickup in this workspace.");
        await currencies.Require(currency,ct);
    }
    private static ReportDefinition Definition(SavedReport x) => new(x.Id, x.Name, JsonSerializer.Deserialize<string[]>(x.ColumnsJson)!, x.SortBy, x.Version);
    private static string Currency(string value)
    {
        var result = Required(value, 3).ToUpperInvariant();
        if (result.Length != 3 || result.Any(x => x < 'A' || x > 'Z')) throw new InvalidOperationException("Use a three-letter currency code.");
        return result;
    }
    private static void CheckAmount(decimal value)
    {
        if (value < 0 || value > 1000000000m || CurrencyService.Round(value,4) != value) throw new InvalidOperationException("Amounts must be between 0 and 1,000,000,000 with at most four decimal places.");
    }
    private static string Required(string? value, int max) { var text = Text(value, max); if (text.Length == 0) throw new InvalidOperationException("Complete all required fields."); return text; }
    private static string Text(string? value, int max) { var text = value?.Trim() ?? ""; if (text.Length > max) throw new InvalidOperationException($"Text is limited to {max} characters."); return text; }
    private static void RequireRequest(Guid id) { if (id == Guid.Empty) throw new InvalidOperationException("A request ID is required."); }
    private static string Hash<T>(T value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value))));
    private static void SameRequest<T>(string hash, T value) { if (hash != Hash(value)) throw new OperationConflictException("This request ID was already used with different values."); }
    private static string Csv(string value)
    {
        var trimmed = value.TrimStart();
        if (trimmed.Length > 0 && "=+-@".Contains(trimmed[0]) && !decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out _)) value = "'" + value;
        return "\"" + value.Replace("\"", "\"\"") + "\"";
    }
    private sealed class ReportValueComparer : IComparer<JsonElement>
    {
        public int Compare(JsonElement a, JsonElement b) => a.ValueKind == JsonValueKind.Number && b.ValueKind == JsonValueKind.Number ? a.GetDecimal().CompareTo(b.GetDecimal()) : StringComparer.OrdinalIgnoreCase.Compare(a.ToString(), b.ToString());
    }
}






