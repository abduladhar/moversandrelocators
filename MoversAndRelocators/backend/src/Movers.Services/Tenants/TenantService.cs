using Movers.Domain.Tenants;
using Movers.Domain.Sales;
using Movers.Services.Sales;
using Movers.Services.Tenancy;
using Movers.Domain.Surveys;
using Movers.Services.Surveys;
using Movers.Domain.Quotations;
using Movers.Services.Quotations;

namespace Movers.Services.Tenants;

public sealed class TenantService(ITenantRepository repository, ITenantContext tenantContext, ISalesRepository? salesRepository = null, ISurveyRepository? surveyRepository = null, IQuotationRepository? quotationRepository = null, TenantSeedDefaults? seedDefaults = null) : ITenantService
{
    public async Task<IReadOnlyList<TenantModel>> ListAsync(CancellationToken cancellationToken) =>
        (await repository.ListAsync(cancellationToken)).Select(Map).ToList();

    public async Task<TenantModel?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var tenant = await repository.GetAsync(id, false, cancellationToken);
        return tenant is null ? null : Map(tenant);
    }

    public async Task<TenantModel> CreateAsync(SaveTenantCommand command, CancellationToken cancellationToken)
    {
        var slug = Tenant.NormalizeSlug(command.Slug);
        await EnsureUniqueSlugAsync(slug, null, cancellationToken);
        var tenant = new Tenant(command.Name, slug, command.ContactEmail, command.Phone, command.Address);
        repository.Add(tenant);
        if (salesRepository is not null || surveyRepository is not null || quotationRepository is not null)
            tenantContext.SetTenant(tenant);
        if (salesRepository is not null)
        {
            AddSalesDefaults(tenant.Id, salesRepository);
        }
        if (surveyRepository is not null)
        {
            AddSurveyDefaults(tenant.Id, surveyRepository);
        }
        if (quotationRepository is not null)
        {
            AddQuotationDefaults(tenant.Id, quotationRepository, seedDefaults ?? TenantSeedDefaults.None);
        }
        await repository.SaveChangesAsync(cancellationToken);
        return Map(tenant);
    }

    public async Task<TenantModel?> UpdateAsync(Guid id, SaveTenantCommand command, CancellationToken cancellationToken)
    {
        var tenant = await repository.GetAsync(id, true, cancellationToken);
        if (tenant is null) return null;
        var slug = Tenant.NormalizeSlug(command.Slug);
        await EnsureUniqueSlugAsync(slug, id, cancellationToken);
        tenant.Update(command.Name, slug, command.ContactEmail, command.Phone, command.Address);
        await repository.SaveChangesAsync(cancellationToken);
        return Map(tenant);
    }

    public async Task<TenantModel?> SetStatusAsync(Guid id, bool isActive, CancellationToken cancellationToken)
    {
        var tenant = await repository.GetAsync(id, true, cancellationToken);
        if (tenant is null) return null;
        tenant.SetActive(isActive);
        await repository.SaveChangesAsync(cancellationToken);
        return Map(tenant);
    }

    public async Task<bool> ResolveCurrentAsync(string? tenantId, string? tenantSlug, CancellationToken cancellationToken)
    {
        Guid? id = Guid.TryParse(tenantId, out var parsedId) ? parsedId : null;
        var slug = string.IsNullOrWhiteSpace(tenantSlug) ? null : Tenant.NormalizeSlug(tenantSlug);
        var tenant = await repository.FindActiveAsync(id, slug, cancellationToken);
        if (tenant is null) return false;
        tenantContext.SetTenant(tenant);
        return true;
    }

    public TenantModel GetCurrent() => Map(
        tenantContext.Tenant ?? throw new InvalidOperationException("No tenant has been resolved for this request."));

    private async Task EnsureUniqueSlugAsync(string slug, Guid? excludingId, CancellationToken cancellationToken)
    {
        if (await repository.SlugExistsAsync(slug, excludingId, cancellationToken))
            throw new DuplicateTenantSlugException(slug);
    }

    private static void AddSalesDefaults(Guid tenantId, ISalesRepository sales)
    {
        sales.AddLeadStatus(new LeadStatus(tenantId, "NEW", "New enquiry", 10, "#1677ff", false));
        sales.AddLeadStatus(new LeadStatus(tenantId, "CONTACTED", "Contacted", 20, "#13c2c2", false));
        sales.AddLeadStatus(new LeadStatus(tenantId, "SURVEY", "Survey scheduled", 30, "#722ed1", false));
        sales.AddLeadStatus(new LeadStatus(tenantId, "QUOTED", "Quotation sent", 40, "#fa8c16", false));
        sales.AddLeadStatus(new LeadStatus(tenantId, "WON", "Accepted", 50, "#52c41a", true));
        sales.AddLeadStatus(new LeadStatus(tenantId, "LOST", "Rejected", 60, "#ff4d4f", true));

        sales.AddFollowUpStatus(new FollowUpStatus(tenantId, "PLANNED", "Planned", 10, "#1677ff", false));
        sales.AddFollowUpStatus(new FollowUpStatus(tenantId, "CONTACTED", "Contacted", 20, "#13c2c2", true));
        sales.AddFollowUpStatus(new FollowUpStatus(tenantId, "NO_ANSWER", "No answer", 30, "#faad14", true));
        sales.AddFollowUpStatus(new FollowUpStatus(tenantId, "RESCHEDULED", "Rescheduled", 40, "#722ed1", true));
        sales.AddFollowUpStatus(new FollowUpStatus(tenantId, "COMPLETED", "Completed", 50, "#52c41a", true));

        sales.AddMoveType(new MoveType(tenantId, "HOUSEHOLD", "Household move", 10, "Residential household relocation"));
        sales.AddMoveType(new MoveType(tenantId, "OFFICE", "Office move", 20, "Office and commercial relocation"));
        sales.AddMoveType(new MoveType(tenantId, "VEHICLE", "Vehicle transport", 30, "Car and two-wheeler transportation"));
        sales.AddMoveType(new MoveType(tenantId, "INTERNATIONAL", "International move", 40, "International household or office relocation"));
        sales.AddMoveType(new MoveType(tenantId, "STORAGE", "Storage only", 50, "Warehouse storage without an immediate move"));
    }

    private static void AddSurveyDefaults(Guid tenantId, ISurveyRepository surveys)
    {
        foreach (var x in new[] { ("KING_BED", "King bed", 5m), ("QUEEN_BED", "Queen bed", 4m), ("CHAIR", "Dining chair", 1m), ("BIG_SOFA", "Large sofa", 3m), ("DINING_TABLE", "Dining table", 2.5m), ("WARDROBE", "Wardrobe", 4.5m), ("TV_55", "Television 55 inch", .5m), ("FRIDGE", "Refrigerator", 1.5m) })
            surveys.AddItem(new HouseholdItem(tenantId, x.Item1, x.Item2, x.Item3, "Starter survey master data"));
        var cardboard = new PackingMaterial(tenantId, "CARDBOARD", "Corrugated cardboard", "sheet", 120m, "Box wall material");
        var tape = new PackingMaterial(tenantId, "TAPE", "Packing tape", "roll", 75m, "Heavy-duty tape");
        var bubble = new PackingMaterial(tenantId, "BUBBLE_WRAP", "Bubble wrap", "meter", 35m, "Fragile-item wrapping");
        var foam = new PackingMaterial(tenantId, "FOAM", "Protective foam", "sheet", 55m, "Impact protection");
        var stretch = new PackingMaterial(tenantId, "STRETCH_WRAP", "Stretch wrap", "roll", 280m, "Furniture protection");
        foreach (var x in new[] { cardboard, tape, bubble, foam, stretch }) surveys.AddMaterial(x);
        var small = new BoxType(tenantId, "SMALL", "Small box", 1m, "Small household carton"); var medium = new BoxType(tenantId, "MEDIUM", "Medium box", 3m, "General household carton"); var large = new BoxType(tenantId, "LARGE", "Large box", 5m, "Large-item carton"); var xl = new BoxType(tenantId, "XL", "Extra-large crate", 8m, "Reinforced crate for bulky items");
        foreach (var x in new[] { small, medium, large, xl }) surveys.AddBoxType(x);
        foreach (var x in new[] { new BoxTypeMaterial(tenantId, small.Id, cardboard.Id, 2m), new BoxTypeMaterial(tenantId, small.Id, tape.Id, .15m), new BoxTypeMaterial(tenantId, medium.Id, cardboard.Id, 3m), new BoxTypeMaterial(tenantId, medium.Id, tape.Id, .25m), new BoxTypeMaterial(tenantId, large.Id, cardboard.Id, 5m), new BoxTypeMaterial(tenantId, large.Id, tape.Id, .4m), new BoxTypeMaterial(tenantId, large.Id, foam.Id, 1m), new BoxTypeMaterial(tenantId, xl.Id, cardboard.Id, 8m), new BoxTypeMaterial(tenantId, xl.Id, tape.Id, .75m), new BoxTypeMaterial(tenantId, xl.Id, foam.Id, 2m) }) surveys.AddBoxMaterial(x);
    }

    /// <summary>Starter taxes and charges from configuration (TenantDefaults), so they can match the tenant's country.</summary>
    private static void AddQuotationDefaults(Guid tenantId, IQuotationRepository quotations, TenantSeedDefaults defaults)
    {
        foreach (var x in defaults.Taxes) quotations.AddTax(new TaxMaster(tenantId, x.Code, x.Name, x.Kind, x.CalculationBasis, x.Rate, x.IsDefault, x.Description));
        foreach (var x in defaults.Charges) quotations.AddCharge(new ChargeMaster(tenantId, x.Code, x.Name, x.Unit, x.DefaultRate, x.TaxPercent, x.Description));
    }

    private static TenantModel Map(Tenant tenant) => new(
        tenant.SerialNo, tenant.Id, tenant.Name, tenant.Slug, tenant.ContactEmail, tenant.Phone,
        tenant.Address, tenant.IsActive, tenant.CreatedAtUtc, tenant.UpdatedAtUtc);
}
