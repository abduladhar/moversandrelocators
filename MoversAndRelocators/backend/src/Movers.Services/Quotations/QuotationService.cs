using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Movers.Domain.Quotations;
using Movers.Domain.Surveys;
using Movers.Services.Security;
using Movers.Services.Tenancy;

namespace Movers.Services.Quotations;

public sealed class QuotationService(IQuotationRepository repository, ITenantContext tenantContext, IUserContext userContext, TimeProvider timeProvider, Movers.Services.Numbering.IRecordNumbers numbers, Movers.Services.Currencies.CurrencyService currencies) : IQuotationService
{
    public async Task<IReadOnlyList<ChargeModel>> ListChargesAsync(CancellationToken t) => (await repository.ListChargesAsync(t)).Select(Map).ToList();
    public async Task<ChargeModel> CreateChargeAsync(SaveChargeCommand c, CancellationToken t) { ValidateCharge(c); await UniqueCharge(c.Code, null, t); var x = new ChargeMaster(tenantContext.TenantId, c.Code, c.Name, c.Unit, c.DefaultRate, c.TaxPercent, c.Description); repository.AddCharge(x); await repository.SaveChangesAsync(t); return Map(x); }
    public async Task<ChargeModel?> UpdateChargeAsync(Guid id, SaveChargeCommand c, CancellationToken t) { ValidateCharge(c); var x = await repository.GetChargeAsync(id, true, t); if (x is null) return null; await UniqueCharge(c.Code, id, t); x.Update(c.Code, c.Name, c.Unit, c.DefaultRate, c.TaxPercent, c.Description); await repository.SaveChangesAsync(t); return Map(x); }
    public async Task<ChargeModel?> SetChargeActiveAsync(Guid id, bool active, CancellationToken t) { var x = await repository.GetChargeAsync(id, true, t); if (x is null) return null; x.SetActive(active); await repository.SaveChangesAsync(t); return Map(x); }
    public async Task<IReadOnlyList<TaxModel>> ListTaxesAsync(CancellationToken t) => (await repository.ListTaxesAsync(t)).Select(MapTax).ToList();
    public async Task<TaxModel> CreateTaxAsync(SaveTaxCommand c, CancellationToken t) { ValidateTax(c); await UniqueTax(c.Code, null, t); var x = new TaxMaster(tenantContext.TenantId, c.Code, c.Name, c.Kind, c.CalculationBasis, c.Rate, c.IsDefault, c.Description); repository.AddTax(x); await repository.SaveChangesAsync(t); return MapTax(x); }
    public async Task<TaxModel?> UpdateTaxAsync(Guid id, SaveTaxCommand c, CancellationToken t) { ValidateTax(c); var x = await repository.GetTaxAsync(id, true, t); if (x is null) return null; await UniqueTax(c.Code, id, t); x.Update(c.Code, c.Name, c.Kind, c.CalculationBasis, c.Rate, c.IsDefault, c.Description); await repository.SaveChangesAsync(t); return MapTax(x); }
    public async Task<TaxModel?> SetTaxActiveAsync(Guid id, bool active, CancellationToken t) { var x = await repository.GetTaxAsync(id, true, t); if (x is null) return null; x.SetActive(active); await repository.SaveChangesAsync(t); return MapTax(x); }

    public async Task<IReadOnlyList<QuotationModel>> ListAsync(CancellationToken t)
    {
        var restriction = await EmployeeRestriction(t); var quotes = await repository.ListQuotationsAsync(restriction, t); return await MapQuotes(quotes, t);
    }
    public async Task<QuotationDetailModel?> GetAsync(Guid id, CancellationToken t) => await LoadDetail(id, await EmployeeRestriction(t), t);
    public async Task<QuotationModel> CreateAsync(SaveQuotationCommand c, CancellationToken t)
    {
        c = c with { QuotationNumber = await numbers.Next("QT", t) }; var normalized = await ValidateQuotation(c, null, t); var restriction = await EmployeeRestriction(t); if (restriction.HasValue && normalized.AssignedEmployeeId != restriction) throw new InvalidOperationException("Sales users can create quotations only for themselves.");
        var x = new Quotation(tenantContext.TenantId, normalized.QuotationNumber, normalized.SurveyId, normalized.SalesLeadId, normalized.CustomerName, normalized.Phone, normalized.Email, normalized.Origin!, normalized.Destination!, normalized.AssignedEmployeeId, normalized.Currency, normalized.ValidUntil, normalized.Terms, normalized.Notes, normalized.IncludeSurveyItems); repository.AddQuotation(x); await repository.SaveChangesAsync(t); return (await MapQuotes([x], t)).Single();
    }
    public async Task<QuotationModel?> CreateRevisionAsync(Guid id, CancellationToken t)
    {
        var restriction = await EmployeeRestriction(t);
        var source = await repository.GetQuotationAsync(id, false, restriction, t);
        if (source is null) return null;
        if (source.Status != QuotationStatuses.Rejected) throw new InvalidOperationException("Only rejected quotations can be revised.");
        var quote = new Quotation(tenantContext.TenantId, await numbers.Next("QT", t), source.SurveyId, source.SalesLeadId,
            source.CustomerName, source.Phone, source.Email, source.Origin, source.Destination, source.AssignedEmployeeId,
            source.Currency, DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime).AddDays(14), source.Terms, source.Notes, source.IncludeSurveyItems);
        quote.SetRevisionSource(source);
        quote.SetTotals(source.Subtotal, source.DiscountTotal, source.TaxTotal, source.GrandTotal);
        var sourceLines = await repository.ListLinesAsync(id, t);
        var sourceTaxes = await repository.ListLineTaxesAsync(sourceLines.Select(x => x.Id).ToList(), t);
        var lines = new List<QuotationLine>(); var taxes = new List<QuotationLineTax>();
        foreach (var line in sourceLines)
        {
            var copy = new QuotationLine(tenantContext.TenantId, quote.Id, line.ChargeMasterId, line.Description, line.Quantity, line.Unit, line.Rate, line.DiscountPercent, line.TaxPercent, line.TaxAmount, line.DisplayOrder,(await currencies.Require(source.Currency,t)).DecimalPlaces);
            lines.Add(copy);
            taxes.AddRange(sourceTaxes.Where(x => x.QuotationLineId == line.Id).Select(x => new QuotationLineTax(tenantContext.TenantId, copy.Id, x.TaxMasterId, x.Code, x.Name, x.Kind, x.CalculationBasis, x.Rate, x.TaxableBase, x.Amount)));
        }
        var items = await repository.ListQuotationItemsAsync(id, t);
        repository.AddQuotation(quote);
        repository.AddLines(lines); repository.AddLineTaxes(taxes);
        repository.AddQuotationItems(items.Select(x => new QuotationItem(tenantContext.TenantId, quote.Id, x.HouseholdItemId, x.RoomName, x.ItemName, x.Quantity, x.VolumePerUnitCbm, x.Notes, x.DisplayOrder)));
        // Persist the draft, copied items, charges, taxes and audit records atomically.
        await repository.SaveChangesAsync(t);
        return (await MapQuotes([quote], t)).Single();
    }
    public async Task<QuotationModel?> UpdateAsync(Guid id, SaveQuotationCommand c, CancellationToken t)
    {
        var restriction = await EmployeeRestriction(t); var x = await repository.GetQuotationAsync(id, true, restriction, t); if (x is null) return null; c = c with { QuotationNumber = x.QuotationNumber }; var normalized = await ValidateQuotation(c, id, t); if (restriction.HasValue && normalized.AssignedEmployeeId != restriction) throw new InvalidOperationException("Sales users cannot reassign quotations."); x.Update(normalized.SurveyId, normalized.SalesLeadId, normalized.CustomerName, normalized.Phone, normalized.Email, normalized.Origin!, normalized.Destination!, normalized.AssignedEmployeeId, normalized.Currency, normalized.ValidUntil, normalized.Terms, normalized.Notes, normalized.IncludeSurveyItems); await repository.SaveChangesAsync(t); return (await MapQuotes([x], t)).Single();
    }
    public async Task<QuotationDetailModel?> SaveLinesAsync(Guid id, IReadOnlyList<SaveQuotationLineCommand> commands, CancellationToken t)
    {
        var restriction = await EmployeeRestriction(t); var quote = await repository.GetQuotationAsync(id, true, restriction, t); if (quote is null) return null; if (quote.Status is QuotationStatuses.Accepted or QuotationStatuses.Rejected) throw new InvalidOperationException("Customer-responded quotations cannot be changed.");
        var lines = new List<QuotationLine>(); var lineTaxes = new List<QuotationLineTax>();
        foreach (var c in commands)
        {
            var charge = await repository.GetChargeAsync(c.ChargeMasterId, false, t); if (charge is null || !charge.IsActive) throw new InvalidOperationException("Select an active charge."); if (c.Quantity <= 0 || (c.Rate ?? charge.DefaultRate) < 0 || c.DiscountPercent is < 0 or > 100) throw new InvalidOperationException("Charge quantities and discount are invalid.");
            var selectedTaxes = new List<TaxMaster>(); foreach (var taxId in c.TaxIds.Distinct()) { var tax = await repository.GetTaxAsync(taxId, false, t); if (tax is null || !tax.IsActive) throw new InvalidOperationException("Select only active tax configurations."); selectedTaxes.Add(tax); }
            var digits=(await currencies.Require(quote.Currency,t)).DecimalPlaces; var rate = c.Rate ?? charge.DefaultRate; var gross = c.Quantity * rate; var discount = decimal.Round(gross * c.DiscountPercent / 100m, digits, MidpointRounding.AwayFromZero); var taxable = gross - discount;
            var components = new List<(TaxMaster Tax, decimal Base, decimal Amount)>();
            foreach (var tax in selectedTaxes.Where(x => x.Kind == TaxKinds.Tax)) { var basis = tax.CalculationBasis == TaxCalculationBases.Quantity ? c.Quantity : taxable; var amount = tax.CalculationBasis == TaxCalculationBases.Quantity ? basis * tax.Rate : basis * tax.Rate / 100m; components.Add((tax, basis, decimal.Round(amount, digits, MidpointRounding.AwayFromZero))); }
            var regularTax = components.Sum(x => x.Amount);
            foreach (var tax in selectedTaxes.Where(x => x.Kind == TaxKinds.Cess)) { var basis = tax.CalculationBasis switch { TaxCalculationBases.TaxAmount => regularTax, TaxCalculationBases.Quantity => c.Quantity, _ => taxable }; var amount = tax.CalculationBasis == TaxCalculationBases.Quantity ? basis * tax.Rate : basis * tax.Rate / 100m; components.Add((tax, basis, decimal.Round(amount, digits, MidpointRounding.AwayFromZero))); }
            var taxAmount = components.Sum(x => x.Amount); var effectivePercent = taxable == 0 ? 0 : decimal.Round(taxAmount / taxable * 100m, 3); var line = new QuotationLine(tenantContext.TenantId, id, charge.Id, string.IsNullOrWhiteSpace(c.Description) ? charge.Name : c.Description, c.Quantity, charge.Unit, rate, c.DiscountPercent, effectivePercent, taxAmount, c.DisplayOrder,digits); lines.Add(line);
            lineTaxes.AddRange(components.Select(x => new QuotationLineTax(tenantContext.TenantId, line.Id, x.Tax.Id, x.Tax.Code, x.Tax.Name, x.Tax.Kind, x.Tax.CalculationBasis, x.Tax.Rate, x.Base, x.Amount)));
        }
        repository.RemoveLines(await repository.ListLinesAsync(id, t)); repository.AddLines(lines); repository.AddLineTaxes(lineTaxes); quote.SetTotals(lines.Sum(x => x.Quantity * x.Rate), lines.Sum(x => x.DiscountAmount), lines.Sum(x => x.TaxAmount), lines.Sum(x => x.LineTotal)); await repository.SaveChangesAsync(t); return await LoadDetail(id, restriction, t);
    }
    public async Task<GeneratedQuotationLinkModel> GenerateLinkAsync(Guid id, int validDays, CancellationToken t)
    {
        if (validDays is < 1 or > 30) throw new InvalidOperationException("Quotation links must be valid for 1 to 30 days."); var restriction = await EmployeeRestriction(t); var quote = await repository.GetQuotationAsync(id, true, restriction, t) ?? throw new InvalidOperationException("Quotation was not found."); if (!(await repository.ListLinesAsync(id, t)).Any()) throw new InvalidOperationException("Add charges before sharing the quotation."); var latestRequest = (await repository.ListRequoteRequestsAsync(id, t)).FirstOrDefault(); if (quote.Status == QuotationStatuses.RequoteRequested && latestRequest is { AppliedAtUtc: null }) throw new InvalidOperationException("Apply the latest customer item changes and recalculate the quotation before resending."); var raw = Base64Url(RandomNumberGenerator.GetBytes(32)); var expires = timeProvider.GetUtcNow().AddDays(validDays); quote.Share(Hash(raw), expires); await repository.SaveChangesAsync(t); return new(raw, expires);
    }
    public async Task<QuotationDetailModel?> SaveItemsAsync(Guid id, IReadOnlyList<SaveQuotationItemCommand> commands, CancellationToken t)
    {
        var restriction = await EmployeeRestriction(t); var quote = await repository.GetQuotationAsync(id, true, restriction, t); if (quote is null) return null; if (quote.Status is QuotationStatuses.Accepted or QuotationStatuses.Rejected) throw new InvalidOperationException("Customer-responded quotations cannot be changed.");
        var masters = (await repository.ListHouseholdItemsAsync(t)).ToDictionary(x => x.Id); var items = new List<QuotationItem>();
        foreach (var c in commands) { if (!masters.TryGetValue(c.HouseholdItemId, out var master) || !master.IsActive) throw new InvalidOperationException("Select an active household item."); if (string.IsNullOrWhiteSpace(c.RoomName) || c.Quantity <= 0) throw new InvalidOperationException("Room and a positive quantity are required."); var volume = c.VolumePerUnitCbm ?? master.VolumeCbm; if (volume <= 0) throw new InvalidOperationException("Item volume must be greater than zero."); items.Add(new QuotationItem(tenantContext.TenantId, id, master.Id, c.RoomName, master.Name, c.Quantity, volume, c.Notes, c.DisplayOrder)); }
        repository.RemoveQuotationItems(await repository.ListQuotationItemsAsync(id, t)); repository.AddQuotationItems(items); await repository.SaveChangesAsync(t); return await LoadDetail(id, restriction, t);
    }
    public async Task<QuotationDetailModel?> ApplyRequoteRequestAsync(Guid quotationId, Guid requestId, CancellationToken t)
    {
        var restriction = await EmployeeRestriction(t); var quote = await repository.GetQuotationAsync(quotationId, true, restriction, t); if (quote is null) return null; if (quote.Status != QuotationStatuses.RequoteRequested || !quote.SurveyId.HasValue) throw new InvalidOperationException("This quotation does not have a pending customer requote request.");
        var latest = (await repository.ListRequoteRequestsAsync(quotationId, t)).FirstOrDefault() ?? throw new InvalidOperationException("The requote request was not found."); if (latest.Id != requestId) throw new InvalidOperationException("Only the latest customer requote request can be applied."); var request = await repository.GetRequoteRequestAsync(quotationId, requestId, true, t) ?? throw new InvalidOperationException("The requote request was not found."); if (request.AppliedAtUtc.HasValue) throw new InvalidOperationException("This requote request has already been applied.");
        var requested = JsonSerializer.Deserialize<List<RequoteStoredItem>>(request.ItemsJson) ?? []; var surveyItems = await repository.ListSurveyItemsForUpdateAsync(quote.SurveyId.Value, t); var remove = new List<SurveyItem>(); foreach (var change in requested) { var item = surveyItems.SingleOrDefault(x => x.Id == change.SurveyItemId) ?? throw new InvalidOperationException("A requested survey item no longer exists."); if (change.RequestedQuantity == 0) remove.Add(item); else item.ApplyRequoteChange(change.RequestedQuantity, change.Notes); } if (remove.Count > 0) repository.RemoveSurveyItems(remove); var survey = await repository.GetSurveyForUpdateAsync(quote.SurveyId.Value, t); survey?.RecordRequoteInventoryChange(); request.MarkApplied();
        var newVolume = surveyItems.Except(remove).Sum(x => x.Quantity * x.VolumePerUnitCbm); var existingLines = await repository.ListLinesAsync(quotationId, t); var existingTaxes = await repository.ListLineTaxesAsync(existingLines.Select(x => x.Id).ToList(), t); await repository.SaveChangesAsync(t);
        var commands = existingLines.Select(line => new SaveQuotationLineCommand(line.ChargeMasterId, line.Description, line.Unit.Equals("CBM", StringComparison.OrdinalIgnoreCase) ? newVolume : line.Quantity, line.Rate, line.DiscountPercent, existingTaxes.Where(x => x.QuotationLineId == line.Id).Select(x => x.TaxMasterId).ToList(), line.DisplayOrder)).ToList(); return await SaveLinesAsync(quotationId, commands, t);
    }
    public async Task<PublicQuotationModel?> GetPublicAsync(string token, CancellationToken t) { var r = await Resolve(token, t); return r is null ? null : await MapPublic(r.Value.Quotation, r.Value.TenantName, t); }
    public async Task<PublicQuotationModel?> AcceptAsync(string token, CancellationToken t) { var r = await Resolve(token, t); if (r is null) return null; var quote = await repository.GetQuotationAsync(r.Value.Quotation.Id, true, null, t); if (quote is null) return null; quote.Accept(); await repository.SaveChangesAsync(t); return await MapPublic(quote, r.Value.TenantName, t); }
    public async Task<PublicQuotationModel?> RejectAsync(string token, string reason, CancellationToken t) { var r = await Resolve(token, t); if (r is null) return null; var quote = await repository.GetQuotationAsync(r.Value.Quotation.Id, true, null, t); if (quote is null) return null; quote.Reject(reason); await repository.SaveChangesAsync(t); return await MapPublic(quote, r.Value.TenantName, t); }
    public async Task<PublicQuotationModel?> RequestRequoteAsync(string token, SubmitRequoteCommand command, CancellationToken t)
    {
        var r = await Resolve(token, t); if (r is null) return null; var quote = await repository.GetQuotationAsync(r.Value.Quotation.Id, true, null, t); if (quote is null || !quote.SurveyId.HasValue) return null;
        var rooms = await repository.ListSurveyRoomsAsync(quote.SurveyId.Value, t); var roomNames = rooms.ToDictionary(x => x.Id, x => x.Name); var surveyItems = await repository.ListSurveyItemsAsync(quote.SurveyId.Value, t); var masters = (await repository.ListHouseholdItemsAsync(t)).ToDictionary(x => x.Id, x => x.Name);
        if (command.Items.Count == 0) throw new InvalidOperationException("Submit at least one surveyed item."); if (command.Items.Select(x => x.SurveyItemId).Distinct().Count() != command.Items.Count) throw new InvalidOperationException("Duplicate surveyed items are not allowed.");
        var stored = new List<RequoteStoredItem>(); foreach (var requested in command.Items) { var item = surveyItems.SingleOrDefault(x => x.Id == requested.SurveyItemId) ?? throw new InvalidOperationException("A submitted item does not belong to this survey."); if (requested.RequestedQuantity is < 0 or > 10000) throw new InvalidOperationException("Requested item quantities must be between 0 and 10,000."); stored.Add(new(item.Id, roomNames.GetValueOrDefault(item.RoomId) ?? "Room", masters.GetValueOrDefault(item.HouseholdItemId) ?? "Item", item.Quantity, requested.RequestedQuantity, Clean(requested.Notes))); }
        if (stored.All(x => x.OriginalQuantity == x.RequestedQuantity) && string.IsNullOrWhiteSpace(command.CustomerNotes) && stored.All(x => string.IsNullOrWhiteSpace(x.Notes))) throw new InvalidOperationException("Change an item quantity or add a note before requesting a requote.");
        quote.RequestRequote(); repository.AddRequoteRequest(new QuotationRequoteRequest(quote.TenantId, quote.Id, JsonSerializer.Serialize(stored), command.CustomerNotes)); await repository.SaveChangesAsync(t); return await MapPublic(quote, r.Value.TenantName, t);
    }

    private async Task<Guid?> EmployeeRestriction(CancellationToken t)
    {
        if (userContext.IsSystemAdmin) return null; if (!userContext.EmployeeId.HasValue) throw new InvalidOperationException("This user is not linked to an employee."); var employee = await repository.GetEmployeeAsync(userContext.EmployeeId.Value, t) ?? throw new InvalidOperationException("The linked employee was not found."); var designation = await repository.GetDesignationAsync(employee.DesignationId, t); return designation?.IsSalesman == true ? employee.Id : null;
    }
    private async Task<SaveQuotationCommand> ValidateQuotation(SaveQuotationCommand c, Guid? id, CancellationToken t)
    {
        if (string.IsNullOrWhiteSpace(c.QuotationNumber) || string.IsNullOrWhiteSpace(c.CustomerName) || string.IsNullOrWhiteSpace(c.Phone) || string.IsNullOrWhiteSpace(c.Currency)) throw new InvalidOperationException("Quotation number, customer, phone and currency are required."); if (await repository.QuotationNumberExistsAsync(c.QuotationNumber.Trim().ToUpperInvariant(), id, t)) throw new InvalidOperationException("Quotation number already exists."); var employee = await repository.GetEmployeeAsync(c.AssignedEmployeeId, t); if (employee is null || !employee.IsActive) throw new InvalidOperationException("Select an active employee.");
        Guid? leadId = c.SalesLeadId; if (c.SurveyId.HasValue) { var survey = await repository.GetSurveyAsync(c.SurveyId.Value, t) ?? throw new InvalidOperationException("Survey was not found."); if (survey.SalesLeadId.HasValue) leadId = survey.SalesLeadId; }
        var lead = leadId.HasValue ? await repository.GetLeadAsync(leadId.Value, t) : null; if (leadId.HasValue && lead is null) throw new InvalidOperationException("Sales lead was not found.");
        var origin = string.IsNullOrWhiteSpace(c.Origin) ? lead?.Origin : c.Origin.Trim(); var destination = string.IsNullOrWhiteSpace(c.Destination) ? lead?.Destination : c.Destination.Trim(); if (string.IsNullOrWhiteSpace(origin) || string.IsNullOrWhiteSpace(destination)) throw new InvalidOperationException("Origin and destination are required.");
        if (c.ValidUntil < DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime.Date)) throw new InvalidOperationException("Validity date cannot be in the past."); return c with { SalesLeadId = leadId, Origin = origin, Destination = destination };
    }
    private async Task<QuotationDetailModel?> LoadDetail(Guid id, Guid? restriction, CancellationToken t)
    {
        var quote = await repository.GetQuotationAsync(id, false, restriction, t); if (quote is null) return null; var model = (await MapQuotes([quote], t)).Single(); var charges = (await repository.ListChargesAsync(t)).ToDictionary(x => x.Id); var entities = await repository.ListLinesAsync(id, t); var taxRows = await repository.ListLineTaxesAsync(entities.Select(x => x.Id).ToList(), t); var lines = entities.Select(x => new QuotationLineModel(x.SerialNo, x.Id, x.ChargeMasterId, charges.GetValueOrDefault(x.ChargeMasterId)?.Name ?? x.Description, x.Description, x.Quantity, x.Unit, x.Rate, x.DiscountPercent, x.DiscountAmount, x.TaxPercent, x.TaxAmount, x.LineTotal, x.DisplayOrder, taxRows.Where(y => y.QuotationLineId == x.Id).Select(y => new QuotationLineTaxModel(y.TaxMasterId, y.Code, y.Name, y.Kind, y.CalculationBasis, y.Rate, y.TaxableBase, y.Amount)).ToList())).ToList(); var rooms = quote.SurveyId.HasValue ? await LoadSurveyRooms(quote.SurveyId.Value, t) : []; var quoteItems = (await repository.ListQuotationItemsAsync(id, t)).Select(x => new QuotationItemModel(x.SerialNo, x.Id, x.HouseholdItemId, x.RoomName, x.ItemName, x.Quantity, x.VolumePerUnitCbm, x.TotalVolumeCbm, x.Notes, x.DisplayOrder)).ToList(); decimal? volume = quoteItems.Count > 0 ? quoteItems.Sum(x => x.TotalVolumeCbm) : quote.SurveyId.HasValue ? rooms.Sum(x => x.TotalVolumeCbm) : null; var requests = (await repository.ListRequoteRequestsAsync(id, t)).Select(MapRequoteRequest).ToList(); return new(model, lines, volume, null, rooms, quoteItems, requests);
    }
    private async Task<IReadOnlyList<QuotationModel>> MapQuotes(IReadOnlyList<Quotation> quotes, CancellationToken t)
    {
        var employees = (await repository.ListEmployeesAsync(t)).ToDictionary(x => x.Id); var leads = (await repository.ListLeadsAsync(t)).ToDictionary(x => x.Id); var result = new List<QuotationModel>(); foreach (var x in quotes) { Survey? survey = x.SurveyId.HasValue ? await repository.GetSurveyAsync(x.SurveyId.Value, t) : null; result.Add(new QuotationModel(x.SerialNo, x.Id, x.QuotationNumber, x.SurveyId, survey?.SurveyNumber, x.SalesLeadId, x.SalesLeadId.HasValue ? leads.GetValueOrDefault(x.SalesLeadId.Value)?.LeadNumber : null, x.CustomerName, x.Phone, x.Email, x.Origin, x.Destination, x.AssignedEmployeeId, employees.GetValueOrDefault(x.AssignedEmployeeId)?.FullName ?? "Unknown", x.Currency, x.ValidUntil, x.Terms, x.Notes, x.IncludeSurveyItems, x.Status, x.Subtotal, x.DiscountTotal, x.TaxTotal, x.GrandTotal, x.SentAtUtc, x.RespondedAtUtc, x.RejectionReason, x.CreatedAtUtc, x.UpdatedAtUtc, x.RevisedFromNumber, x.RevisionReason)); } return result;
    }
    private async Task<(Quotation Quotation, string TenantName)?> Resolve(string token, CancellationToken t) { if (string.IsNullOrWhiteSpace(token)) return null; var r = await repository.ResolvePublicAsync(Hash(token), t); if (r is null || r.Quotation.ShareExpiresAtUtc < timeProvider.GetUtcNow()) return null; if (!tenantContext.IsResolved) tenantContext.SetTenant(r.Tenant); return (r.Quotation, r.Tenant.Name); }
    private async Task<PublicQuotationModel> MapPublic(Quotation quote, string tenantName, CancellationToken t) { var detail = await LoadDetail(quote.Id, null, t) ?? throw new InvalidOperationException("Quotation was not found."); return new(tenantName, detail.Quotation, detail.Lines, quote.IncludeSurveyItems ? detail.SurveyRooms : [], detail.QuotationItems); }
    private async Task<IReadOnlyList<QuotationSurveyRoomModel>> LoadSurveyRooms(Guid surveyId, CancellationToken t)
    {
        var rooms = await repository.ListSurveyRoomsAsync(surveyId, t); var items = await repository.ListSurveyItemsAsync(surveyId, t); var masters = (await repository.ListHouseholdItemsAsync(t)).ToDictionary(x => x.Id, x => x.Name);
        return rooms.OrderBy(x => x.DisplayOrder).ThenBy(x => x.SerialNo).Select(room => { var roomItems = items.Where(x => x.RoomId == room.Id).OrderBy(x => x.SerialNo).Select(x => new QuotationSurveyItemModel(x.Id, masters.GetValueOrDefault(x.HouseholdItemId) ?? "Item", x.Quantity, x.VolumePerUnitCbm, x.Quantity * x.VolumePerUnitCbm, x.Notes)).ToList(); return new QuotationSurveyRoomModel(room.Id, room.Name, room.DisplayOrder, roomItems, roomItems.Sum(x => x.TotalVolumeCbm)); }).ToList();
    }
    private static QuotationRequoteRequestModel MapRequoteRequest(QuotationRequoteRequest request) { var items = JsonSerializer.Deserialize<List<RequoteStoredItem>>(request.ItemsJson) ?? []; return new(request.SerialNo, request.Id, request.CustomerNotes, request.CreatedAtUtc, request.AppliedAtUtc, items.Select(x => new RequoteRequestedItemModel(x.SurveyItemId, x.RoomName, x.ItemName, x.OriginalQuantity, x.RequestedQuantity, x.Notes)).ToList()); }
    private async Task UniqueCharge(string code, Guid? id, CancellationToken t) { if (await repository.ChargeCodeExistsAsync(code.Trim().ToUpperInvariant(), id, t)) throw new InvalidOperationException("Charge code already exists."); }
    private async Task UniqueTax(string code, Guid? id, CancellationToken t) { if (await repository.TaxCodeExistsAsync(code.Trim().ToUpperInvariant(), id, t)) throw new InvalidOperationException("Tax code already exists."); }
    private static void ValidateCharge(SaveChargeCommand c) { if (string.IsNullOrWhiteSpace(c.Code) || string.IsNullOrWhiteSpace(c.Name) || string.IsNullOrWhiteSpace(c.Unit) || c.DefaultRate < 0 || c.TaxPercent is < 0 or > 100) throw new InvalidOperationException("Charge code, name, unit, rate and tax are invalid."); }
    private static ChargeModel Map(ChargeMaster x) => new(x.SerialNo, x.Id, x.Code, x.Name, x.Unit, x.DefaultRate, x.TaxPercent, x.Description, x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc);
    private static TaxModel MapTax(TaxMaster x) => new(x.SerialNo, x.Id, x.Code, x.Name, x.Kind, x.CalculationBasis, x.Rate, x.IsDefault, x.Description, x.IsActive, x.CreatedAtUtc, x.UpdatedAtUtc);
    private static void ValidateTax(SaveTaxCommand c) { var kind = c.Kind.Trim().ToUpperInvariant(); var basis = c.CalculationBasis.Trim().ToUpperInvariant(); if (string.IsNullOrWhiteSpace(c.Code) || string.IsNullOrWhiteSpace(c.Name) || kind is not (TaxKinds.Tax or TaxKinds.Cess) || basis is not (TaxCalculationBases.TaxableAmount or TaxCalculationBases.TaxAmount or TaxCalculationBases.Quantity) || c.Rate < 0) throw new InvalidOperationException("Tax configuration is invalid."); if (kind == TaxKinds.Tax && basis == TaxCalculationBases.TaxAmount) throw new InvalidOperationException("A standard tax cannot be calculated on another tax amount."); }
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private static string Base64Url(byte[] value) => Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private sealed record RequoteStoredItem(Guid SurveyItemId, string RoomName, string ItemName, int OriginalQuantity, int RequestedQuantity, string? Notes);
}


