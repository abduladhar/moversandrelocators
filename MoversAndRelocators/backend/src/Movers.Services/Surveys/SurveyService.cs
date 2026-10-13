using System.Text.Json;
using Movers.Domain.Surveys;
using Movers.Services.Tenancy;

namespace Movers.Services.Surveys;

public sealed class SurveyService(ISurveyRepository repository, ITenantContext tenantContext, TimeProvider timeProvider, Movers.Services.Numbering.IRecordNumbers numbers, Movers.Services.Tenants.ICompanyScope? companies = null, Movers.Services.OpenAi.AiUsageService? aiUsage = null) : ISurveyService
{
    public async Task<IReadOnlyList<HouseholdItemModel>> ListItemsAsync(CancellationToken t) => (await repository.ListItemsAsync(t)).Select(Map).ToList();
    public async Task<HouseholdItemModel> CreateItemAsync(SaveHouseholdItemCommand c, CancellationToken t) { ValidateItem(c); await UniqueItem(c.Code, null, t); var x = new HouseholdItem(tenantContext.TenantId, c.Code, c.Name, c.VolumeCbm, c.Description); repository.AddItem(x); await repository.SaveChangesAsync(t); return Map(x); }
    public async Task<HouseholdItemModel?> UpdateItemAsync(Guid id, SaveHouseholdItemCommand c, CancellationToken t) { ValidateItem(c); var x = await repository.GetItemAsync(id, true, t); if (x is null) return null; await UniqueItem(c.Code, id, t); x.Update(c.Code, c.Name, c.VolumeCbm, c.Description); await repository.SaveChangesAsync(t); return Map(x); }
    public async Task<HouseholdItemModel?> SetItemActiveAsync(Guid id, bool active, CancellationToken t) { var x = await repository.GetItemAsync(id, true, t); if (x is null) return null; x.SetActive(active); await repository.SaveChangesAsync(t); return Map(x); }

    public async Task<IReadOnlyList<MaterialModel>> ListMaterialsAsync(CancellationToken t) => (await repository.ListMaterialsAsync(t)).Select(Map).ToList();
    public async Task<MaterialModel> CreateMaterialAsync(SaveMaterialCommand c, CancellationToken t) { ValidateMaterial(c); await UniqueMaterial(c.Code, null, t); var x = new PackingMaterial(tenantContext.TenantId, c.Code, c.Name, c.Unit, c.CurrentUnitCost, c.Description); repository.AddMaterial(x); await repository.SaveChangesAsync(t); return Map(x); }
    public async Task<MaterialModel?> UpdateMaterialAsync(Guid id, SaveMaterialCommand c, CancellationToken t) { ValidateMaterial(c); var x = await repository.GetMaterialAsync(id, true, t); if (x is null) return null; await UniqueMaterial(c.Code, id, t); x.Update(c.Code, c.Name, c.Unit, c.CurrentUnitCost, c.Description); await repository.SaveChangesAsync(t); return Map(x); }
    public async Task<MaterialModel?> SetMaterialActiveAsync(Guid id, bool active, CancellationToken t) { var x = await repository.GetMaterialAsync(id, true, t); if (x is null) return null; x.SetActive(active); await repository.SaveChangesAsync(t); return Map(x); }

    public async Task<IReadOnlyList<BoxTypeModel>> ListBoxTypesAsync(CancellationToken t)
    {
        var boxes = await repository.ListBoxTypesAsync(t); var materials = await repository.ListMaterialsAsync(t); var recipes = await repository.ListBoxMaterialsAsync(t);
        return boxes.Select(x => Map(x, recipes.Where(r => r.BoxTypeId == x.Id), materials)).ToList();
    }
    public async Task<BoxTypeModel> CreateBoxTypeAsync(SaveBoxTypeCommand c, CancellationToken t)
    {
        ValidateBox(c); await UniqueBox(c.Code, null, t); await ValidateRecipe(c.Materials, t);
        var x = new BoxType(tenantContext.TenantId, c.Code, c.Name, c.CapacityCbm, c.Description); repository.AddBoxType(x);
        foreach (var m in c.Materials) repository.AddBoxMaterial(new BoxTypeMaterial(tenantContext.TenantId, x.Id, m.MaterialId, m.Quantity));
        await repository.SaveChangesAsync(t); return (await ListBoxTypesAsync(t)).Single(y => y.Id == x.Id);
    }
    public async Task<BoxTypeModel?> UpdateBoxTypeAsync(Guid id, SaveBoxTypeCommand c, CancellationToken t)
    {
        ValidateBox(c); var x = await repository.GetBoxTypeAsync(id, true, t); if (x is null) return null; await UniqueBox(c.Code, id, t); await ValidateRecipe(c.Materials, t);
        x.Update(c.Code, c.Name, c.CapacityCbm, c.Description); repository.RemoveBoxMaterials(await repository.ListBoxMaterialsAsync(id, t));
        foreach (var m in c.Materials) repository.AddBoxMaterial(new BoxTypeMaterial(tenantContext.TenantId, id, m.MaterialId, m.Quantity));
        await repository.SaveChangesAsync(t); return (await ListBoxTypesAsync(t)).Single(y => y.Id == id);
    }
    public async Task<BoxTypeModel?> SetBoxTypeActiveAsync(Guid id, bool active, CancellationToken t) { var x = await repository.GetBoxTypeAsync(id, true, t); if (x is null) return null; x.SetActive(active); await repository.SaveChangesAsync(t); return (await ListBoxTypesAsync(t)).Single(y => y.Id == id); }

    public async Task<IReadOnlyList<SurveyModel>> ListSurveysAsync(CancellationToken t)
    {
        var rows = await repository.ListSurveysAsync(t); var employees = await repository.ListEmployeesAsync(t);
        return rows.Select(x => Map(x, employees.FirstOrDefault(e => e.Id == x.AssignedEmployeeId)?.FullName ?? "Unknown")).ToList();
    }
    public async Task<SurveyModel> CreateSurveyAsync(SaveSurveyCommand c, CancellationToken t)
    {
        c = c with { SurveyNumber = await numbers.Next("SV", t) }; await ValidateSurvey(c, null, t); var x = new Survey(tenantContext.TenantId, c.SurveyNumber, c.SalesLeadId, c.CustomerName, c.Phone, c.Email, c.AssignedEmployeeId, c.ScheduledAtUtc, c.Address, c.Notes);
        repository.AddSurvey(x); await repository.SaveChangesAsync(t); var employee = await repository.GetEmployeeAsync(c.AssignedEmployeeId, t); return Map(x, employee!.FullName);
    }
    public async Task<SurveyModel?> UpdateSurveyAsync(Guid id, SaveSurveyCommand c, CancellationToken t)
    {
        var x = await repository.GetSurveyAsync(id, true, t); if (x is null) return null; c = c with { SurveyNumber = x.SurveyNumber }; await ValidateSurvey(c, id, t); x.Update(c.SalesLeadId, c.CustomerName, c.Phone, c.Email, c.AssignedEmployeeId, c.ScheduledAtUtc, c.Address, c.Notes); await repository.SaveChangesAsync(t); var employee = await repository.GetEmployeeAsync(c.AssignedEmployeeId, t); return Map(x, employee!.FullName);
    }
    public Task<SurveyDetailModel?> GetSurveyAsync(Guid id, CancellationToken t) => LoadDetail(id, t);
    public async Task<SurveyDetailModel?> SaveDetailsAsync(Guid id, SaveSurveyDetailsCommand c, CancellationToken t)
    {
        var survey = await repository.GetSurveyAsync(id, false, t); if (survey is null) return null;
        var itemMasters = await repository.ListItemsAsync(t); var itemMap = itemMasters.ToDictionary(x => x.Id);
        foreach (var room in c.Rooms) { if (string.IsNullOrWhiteSpace(room.Name)) throw new InvalidOperationException("Every room requires a name."); foreach (var item in room.Items) { if (item.Quantity <= 0) throw new InvalidOperationException("Item quantity must be greater than zero."); if (!itemMap.TryGetValue(item.HouseholdItemId, out var master) || !master.IsActive) throw new InvalidOperationException("Select an active household item."); if ((item.VolumePerUnitCbm ?? master.VolumeCbm) <= 0) throw new InvalidOperationException("Item volume must be greater than zero."); } }
        var materialMap = (await repository.ListMaterialsAsync(t)).ToDictionary(x => x.Id);
        foreach (var extra in c.ExtraMaterials) if (extra.Quantity <= 0 || !materialMap.TryGetValue(extra.MaterialId, out var m) || !m.IsActive) throw new InvalidOperationException("Extra materials require an active material and a positive quantity.");
        repository.RemoveSurveyItems(await repository.ListSurveyItemsAsync(id, t)); repository.RemoveExtraMaterials(await repository.ListExtraMaterialsAsync(id, t)); repository.RemoveRooms(await repository.ListRoomsAsync(id, t));
        var rooms = c.Rooms.Select(r => new SurveyRoom(tenantContext.TenantId, id, r.Name, r.DisplayOrder)).ToList(); repository.AddRooms(rooms);
        var lines = c.Rooms.Zip(rooms).SelectMany(pair => pair.First.Items.Select(i => new SurveyItem(tenantContext.TenantId, id, pair.Second.Id, i.HouseholdItemId, i.Quantity, i.VolumePerUnitCbm ?? itemMap[i.HouseholdItemId].VolumeCbm, i.Notes))).ToList();
        repository.AddSurveyItems(lines); repository.AddExtraMaterials(c.ExtraMaterials.Select(x => new SurveyExtraMaterial(tenantContext.TenantId, id, x.MaterialId, x.Quantity)));
        await repository.SaveChangesAsync(t); return await LoadDetail(id, t);
    }
    public async Task<GeneratedSurveyLinkModel> GenerateConfirmationLinkAsync(Guid id, int validDays, CancellationToken t)
    {
        if (validDays is < 1 or > 30) throw new InvalidOperationException("Confirmation links must be valid for 1 to 30 days."); var x = await repository.GetSurveyAsync(id, true, t) ?? throw new InvalidOperationException("Survey was not found.");
        var raw = SurveyLinkTokens.NewToken(); var expires = timeProvider.GetUtcNow().AddDays(validDays); x.SetConfirmationLink(SurveyLinkTokens.Hash(raw), expires); await repository.SaveChangesAsync(t); return new(raw, expires);
    }
    public async Task<PublicSurveyModel?> GetPublicAsync(string token, CancellationToken t)
    {
        var resolved = await Resolve(token, t); return resolved is null ? null : await MapPublic(resolved.Value.Survey, resolved.Value.TenantName, t);
    }
    public async Task<PublicSurveyModel?> ConfirmScheduleAsync(string token, ConfirmSurveyScheduleCommand c, CancellationToken t)
    {
        var resolved = await Resolve(token, t); if (resolved is null) return null; var x = await repository.GetSurveyAsync(resolved.Value.Survey.Id, true, t); if (x is null) return null;
        if (c.ScheduledAtUtc < timeProvider.GetUtcNow().AddMinutes(-5)) throw new InvalidOperationException("The survey date cannot be in the past."); if (string.IsNullOrWhiteSpace(c.Address)) throw new InvalidOperationException("Survey location is required.");
        x.ConfirmSchedule(c.ScheduledAtUtc, c.Address, c.Latitude, c.Longitude, c.Notes); await repository.SaveChangesAsync(t); return await MapPublic(x, resolved.Value.TenantName, t);
    }
    public async Task<PublicSurveyModel?> ConfirmItemsAsync(string token, string? notes, CancellationToken t)
    {
        var resolved = await Resolve(token, t); if (resolved is null) return null; var x = await repository.GetSurveyAsync(resolved.Value.Survey.Id, true, t); if (x is null) return null; x.ConfirmItems(notes); await repository.SaveChangesAsync(t); return await MapPublic(x, resolved.Value.TenantName, t);
    }

    private async Task<(Survey Survey, string TenantName)?> Resolve(string token, CancellationToken t)
    {
        var r = await SurveyLinkTokens.ResolveAsync(repository, tenantContext, timeProvider, token, t, companies); return r is null ? null : (r.Survey, tenantContext.Company?.Name ?? r.Tenant.Name);
    }

    public async Task<IReadOnlyList<PublicCatalogItemModel>?> GetPublicCatalogAsync(string token, CancellationToken t)
    {
        if (await Resolve(token, t) is null) return null;
        return (await repository.ListItemsAsync(t)).Where(x => x.IsActive).OrderBy(x => x.Name).Select(x => new PublicCatalogItemModel(x.Id, x.Name, x.VolumeCbm)).ToList();
    }
    public async Task<PublicSurveyModel?> SubmitCustomerChangesAsync(string token, SubmitCustomerChangesCommand c, CancellationToken t)
    {
        var resolved = await Resolve(token, t); if (resolved is null) return null; var x = await repository.GetSurveyAsync(resolved.Value.Survey.Id, true, t); if (x is null) return null;
        if (c.RemovedItems.Count == 0 && c.AddedItems.Count == 0) throw new InvalidOperationException("Mark an item for removal or add an item before sending changes.");
        if (c.RemovedItems.Count > 500 || c.AddedItems.Count > 100) throw new InvalidOperationException("Too many changes in one request. Contact your move coordinator.");
        if (c.Notes?.Length > 2000 || c.RemovedItems.Any(r => r.Reason?.Length > 300) || c.AddedItems.Any(a => a.Notes?.Length > 300)) throw new InvalidOperationException("Keep notes under 300 characters per item and 2000 overall.");
        var rooms = (await repository.ListRoomsAsync(x.Id, t)).ToDictionary(r => r.Id); var lines = (await repository.ListSurveyItemsAsync(x.Id, t)).ToDictionary(l => l.Id); var masters = (await repository.ListItemsAsync(t)).ToDictionary(m => m.Id);
        if (c.RemovedItems.GroupBy(r => r.SurveyItemId).Any(g => g.Count() > 1) || c.RemovedItems.Any(r => !lines.ContainsKey(r.SurveyItemId))) throw new InvalidOperationException("One of the items marked for removal is no longer on the survey. Refresh the page and try again.");
        var removed = c.RemovedItems.Select(r => { var line = lines[r.SurveyItemId]; return new CustomerRemovedItemModel(line.Id, rooms.TryGetValue(line.RoomId, out var room) ? room.Name : "Room", masters.TryGetValue(line.HouseholdItemId, out var m) ? m.Name : "Item", line.Quantity, Clean(r.Reason)); }).ToList();
        var added = c.AddedItems.Select(a =>
        {
            if (string.IsNullOrWhiteSpace(a.RoomName) || a.RoomName.Trim().Length > 120) throw new InvalidOperationException("Every added item needs a room name of up to 120 characters.");
            if (a.Quantity is < 1 or > 100) throw new InvalidOperationException("Item quantities must be between 1 and 100.");
            if (!masters.TryGetValue(a.HouseholdItemId, out var m) || !m.IsActive) throw new InvalidOperationException("Choose items from the list provided.");
            return new CustomerAddedItemModel(a.RoomName.Trim(), m.Id, m.Name, a.Quantity, m.VolumeCbm, Clean(a.Notes));
        }).ToList();
        x.SubmitCustomerChanges(JsonSerializer.Serialize(new CustomerChangeRequestModel(timeProvider.GetUtcNow(), Clean(c.Notes), removed, added)));
        await repository.SaveChangesAsync(t); return await MapPublic(x, resolved.Value.TenantName, t);
    }
    /// <summary>Applies the customer's pending request to the saved inventory: removes marked lines and adds requested items, creating rooms by name when needed.</summary>
    public async Task<SurveyDetailModel?> ApplyCustomerChangesAsync(Guid id, CancellationToken t)
    {
        var x = await repository.GetSurveyAsync(id, true, t); if (x is null) return null; var request = ReadChanges(x) ?? throw new InvalidOperationException("There are no customer changes to apply.");
        var masters = (await repository.ListItemsAsync(t)).ToDictionary(m => m.Id);
        var inactive = request.AddedItems.FirstOrDefault(a => !masters.TryGetValue(a.HouseholdItemId, out var m) || !m.IsActive);
        if (inactive is not null) throw new InvalidOperationException($"{inactive.ItemName} is no longer an active household item. Reactivate it or dismiss the request and add items manually.");
        var removeIds = request.RemovedItems.Select(r => r.SurveyItemId).ToHashSet();
        repository.RemoveSurveyItems((await repository.ListSurveyItemsAsync(id, t)).Where(l => removeIds.Contains(l.Id)));
        var rooms = (await repository.ListRoomsAsync(id, t)).ToList(); var newRooms = new List<SurveyRoom>(); var order = rooms.Count == 0 ? 0 : rooms.Max(r => r.DisplayOrder);
        var newLines = request.AddedItems.Select(a =>
        {
            var room = rooms.Concat(newRooms).FirstOrDefault(r => string.Equals(r.Name, a.RoomName, StringComparison.OrdinalIgnoreCase));
            if (room is null) { room = new SurveyRoom(tenantContext.TenantId, id, a.RoomName, ++order); newRooms.Add(room); }
            return new SurveyItem(tenantContext.TenantId, id, room.Id, a.HouseholdItemId, a.Quantity, a.VolumePerUnitCbm, a.Notes is null ? "Added at customer request" : $"Customer: {a.Notes}");
        }).ToList();
        repository.AddRooms(newRooms); repository.AddSurveyItems(newLines); x.ClearCustomerChanges();
        await repository.SaveChangesAsync(t); return await LoadDetail(id, t);
    }
    public async Task<SurveyDetailModel?> DismissCustomerChangesAsync(Guid id, CancellationToken t)
    {
        var x = await repository.GetSurveyAsync(id, true, t); if (x is null) return null; x.ClearCustomerChanges(); await repository.SaveChangesAsync(t); return await LoadDetail(id, t);
    }
    private static CustomerChangeRequestModel? ReadChanges(Survey x) => string.IsNullOrWhiteSpace(x.CustomerChangeRequestJson) ? null : JsonSerializer.Deserialize<CustomerChangeRequestModel>(x.CustomerChangeRequestJson);
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private async Task<SurveyDetailModel?> LoadDetail(Guid id, CancellationToken t)
    {
        var survey = await repository.GetSurveyAsync(id, false, t); if (survey is null) return null; var employees = await repository.ListEmployeesAsync(t); var rooms = await repository.ListRoomsAsync(id, t); var lines = await repository.ListSurveyItemsAsync(id, t); var items = await repository.ListItemsAsync(t); var extras = await repository.ListExtraMaterialsAsync(id, t); var materials = await repository.ListMaterialsAsync(t); var boxes = await repository.ListBoxTypesAsync(t); var recipes = await repository.ListBoxMaterialsAsync(t);
        var roomModels = MapRooms(rooms, lines, items); var extraModels = extras.Join(materials, x => x.MaterialId, x => x.Id, (x, m) => new SurveyExtraMaterialModel(m.Id, m.Name, m.Unit, x.Quantity, m.CurrentUnitCost, x.Quantity * m.CurrentUnitCost)).ToList();
        // The AI was paid for before this survey existed, on the lead it came from; the survey reports it, it does not own it.
        var aiSpend = survey.SalesLeadId is { } leadId && aiUsage is not null ? await aiUsage.LeadSpend(leadId, t) : null;
        return new(Map(survey, employees.FirstOrDefault(x => x.Id == survey.AssignedEmployeeId)?.FullName ?? "Unknown"), roomModels, extraModels, Plan(roomModels, boxes.Where(x => x.IsActive).ToList(), recipes, materials, extraModels), ReadChanges(survey),
            SurveyTrip.Build(survey, await repository.ListTimeEventsAsync(id, t), await repository.ListExpensesAsync(id, t), employees, timeProvider.GetUtcNow()), aiSpend);
    }
    private async Task<PublicSurveyModel> MapPublic(Survey x, string tenantName, CancellationToken t) { var detail = await LoadDetail(x.Id, t) ?? throw new InvalidOperationException("Survey was not found."); return new(x.Id, tenantName, x.SurveyNumber, x.CustomerName, x.ScheduledAtUtc, x.Address, x.Status, x.ConfirmationExpiresAtUtc!.Value, x.ScheduleConfirmedAtUtc.HasValue, x.ItemsConfirmedAtUtc.HasValue, detail.Rooms, detail.PackingPlan.ItemsVolumeCbm, detail.CustomerChanges); }
    private static IReadOnlyList<SurveyRoomModel> MapRooms(IReadOnlyList<SurveyRoom> rooms, IReadOnlyList<SurveyItem> lines, IReadOnlyList<HouseholdItem> items) => rooms.Select(room => { var mapped = lines.Where(x => x.RoomId == room.Id).Join(items, x => x.HouseholdItemId, x => x.Id, (x, item) => new SurveyItemModel(x.SerialNo, x.Id, item.Id, item.Name, x.Quantity, x.VolumePerUnitCbm, x.Quantity * x.VolumePerUnitCbm, x.Notes)).ToList(); return new SurveyRoomModel(room.SerialNo, room.Id, room.Name, room.DisplayOrder, mapped, mapped.Sum(x => x.TotalVolumeCbm)); }).ToList();
    private static PackingPlanModel Plan(IReadOnlyList<SurveyRoomModel> rooms, IReadOnlyList<BoxType> boxTypes, IReadOnlyList<BoxTypeMaterial> recipes, IReadOnlyList<PackingMaterial> materials, IReadOnlyList<SurveyExtraMaterialModel> extras)
    {
        var units = rooms.SelectMany(r => r.Items.SelectMany(i => Enumerable.Range(0, i.Quantity).Select(_ => new BoxContentModel(r.Name, i.ItemName, i.VolumePerUnitCbm)))).OrderByDescending(x => x.VolumeCbm).ToList(); var planned = new List<MutableBox>(); var unboxed = new List<BoxContentModel>();
        foreach (var unit in units) { var target = planned.Where(x => x.Remaining >= unit.VolumeCbm).OrderBy(x => x.Remaining - unit.VolumeCbm).FirstOrDefault(); if (target is null) { var type = boxTypes.Where(x => x.CapacityCbm >= unit.VolumeCbm).OrderBy(x => x.CapacityCbm).FirstOrDefault(); if (type is null) { unboxed.Add(unit); continue; } target = new MutableBox(type); planned.Add(target); } target.Contents.Add(unit); target.Used += unit.VolumeCbm; }
        var materialTotals = new Dictionary<Guid, decimal>(); foreach (var box in planned) foreach (var recipe in recipes.Where(x => x.BoxTypeId == box.Type.Id)) materialTotals[recipe.MaterialId] = materialTotals.GetValueOrDefault(recipe.MaterialId) + recipe.Quantity; foreach (var extra in extras) materialTotals[extra.MaterialId] = materialTotals.GetValueOrDefault(extra.MaterialId) + extra.Quantity;
        var costs = materialTotals.Select(x => { var material = materials.Single(m => m.Id == x.Key); return new MaterialCostModel(material.Id, material.Name, material.Unit, x.Value, material.CurrentUnitCost, x.Value * material.CurrentUnitCost); }).OrderBy(x => x.MaterialName).ToList();
        var result = planned.Select((x, index) => { var buildCost = recipes.Where(r => r.BoxTypeId == x.Type.Id).Join(materials, r => r.MaterialId, m => m.Id, (r, m) => r.Quantity * m.CurrentUnitCost).Sum(); return new PlannedBoxModel(index + 1, x.Type.Id, x.Type.Name, x.Type.CapacityCbm, x.Used, x.Remaining, buildCost, x.Contents); }).ToList();
        return new(result, unboxed, costs, units.Sum(x => x.VolumeCbm), result.Sum(x => x.CapacityCbm), costs.Sum(x => x.Cost));
    }
    private sealed class MutableBox(BoxType type) { public BoxType Type { get; } = type; public decimal Used { get; set; } public decimal Remaining => Type.CapacityCbm - Used; public List<BoxContentModel> Contents { get; } = []; }
    private async Task ValidateSurvey(SaveSurveyCommand c, Guid? id, CancellationToken t) { if (string.IsNullOrWhiteSpace(c.SurveyNumber) || string.IsNullOrWhiteSpace(c.CustomerName) || string.IsNullOrWhiteSpace(c.Phone) || string.IsNullOrWhiteSpace(c.Address)) throw new InvalidOperationException("Survey number, customer, phone and address are required."); if (await repository.SurveyNumberExistsAsync(c.SurveyNumber.Trim().ToUpperInvariant(), id, t)) throw new InvalidOperationException("Survey number already exists."); var e = await repository.GetEmployeeAsync(c.AssignedEmployeeId, t); if (e is null || !e.IsActive) throw new InvalidOperationException("Select an active employee."); if (c.SalesLeadId.HasValue && await repository.GetLeadAsync(c.SalesLeadId.Value, t) is null) throw new InvalidOperationException("Sales lead was not found."); }
    private async Task ValidateRecipe(IReadOnlyList<BoxMaterialInput> rows, CancellationToken t) { if (rows.GroupBy(x => x.MaterialId).Any(x => x.Count() > 1)) throw new InvalidOperationException("A material can appear only once in a box recipe."); foreach (var row in rows) { var m = await repository.GetMaterialAsync(row.MaterialId, false, t); if (m is null || !m.IsActive || row.Quantity <= 0) throw new InvalidOperationException("Box materials require an active material and positive quantity."); } }
    private static void ValidateItem(SaveHouseholdItemCommand c) { if (string.IsNullOrWhiteSpace(c.Code) || string.IsNullOrWhiteSpace(c.Name) || c.VolumeCbm <= 0) throw new InvalidOperationException("Code, name and a positive volume are required."); }
    private static void ValidateMaterial(SaveMaterialCommand c) { if (string.IsNullOrWhiteSpace(c.Code) || string.IsNullOrWhiteSpace(c.Name) || string.IsNullOrWhiteSpace(c.Unit) || c.CurrentUnitCost < 0) throw new InvalidOperationException("Code, name, unit and a non-negative cost are required."); }
    private static void ValidateBox(SaveBoxTypeCommand c) { if (string.IsNullOrWhiteSpace(c.Code) || string.IsNullOrWhiteSpace(c.Name) || c.CapacityCbm <= 0) throw new InvalidOperationException("Code, name and a positive capacity are required."); }
    private async Task UniqueItem(string code, Guid? id, CancellationToken t) { if (await repository.ItemCodeExistsAsync(code.Trim().ToUpperInvariant(), id, t)) throw new InvalidOperationException("Household item code already exists."); }
    private async Task UniqueMaterial(string code, Guid? id, CancellationToken t) { if (await repository.MaterialCodeExistsAsync(code.Trim().ToUpperInvariant(), id, t)) throw new InvalidOperationException("Material code already exists."); }
    private async Task UniqueBox(string code, Guid? id, CancellationToken t) { if (await repository.BoxCodeExistsAsync(code.Trim().ToUpperInvariant(), id, t)) throw new InvalidOperationException("Box type code already exists."); }
    private static HouseholdItemModel Map(HouseholdItem x) => new(x.SerialNo, x.Id, x.Code, x.Name, x.VolumeCbm, x.Description, x.IsActive);
    private static MaterialModel Map(PackingMaterial x) => new(x.SerialNo, x.Id, x.Code, x.Name, x.Unit, x.CurrentUnitCost, x.Description, x.IsActive);
    private static BoxTypeModel Map(BoxType x, IEnumerable<BoxTypeMaterial> recipes, IEnumerable<PackingMaterial> materials) { var rows = recipes.Join(materials, r => r.MaterialId, m => m.Id, (r, m) => new BoxMaterialModel(m.Id, m.Name, m.Unit, r.Quantity, m.CurrentUnitCost, r.Quantity * m.CurrentUnitCost)).ToList(); return new(x.SerialNo, x.Id, x.Code, x.Name, x.CapacityCbm, x.Description, x.IsActive, rows, rows.Sum(r => r.Cost)); }
    private static SurveyModel Map(Survey x, string employeeName) => new(x.SerialNo, x.Id, x.SurveyNumber, x.SalesLeadId, x.CustomerName, x.Phone, x.Email, x.AssignedEmployeeId, employeeName, x.ScheduledAtUtc, x.Address, x.Latitude, x.Longitude, x.Status, x.StartedAtUtc, x.EndedAtUtc, x.ScheduleConfirmedAtUtc, x.ItemsConfirmedAtUtc, x.Notes, x.CreatedAtUtc, x.UpdatedAtUtc);
}
