using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Employees;
using Movers.Domain.Quotations;
using Movers.Domain.Sales;
using Movers.Domain.Surveys;
using Movers.Services.Quotations;

namespace Movers.DAL.Quotations;

public sealed class QuotationRepository(MoversDbContext db) : IQuotationRepository
{
    public async Task<IReadOnlyList<ChargeMaster>> ListChargesAsync(CancellationToken t) => await db.ChargeMasters.AsNoTracking().OrderByDescending(x => x.SerialNo).ToListAsync(t);
    public Task<ChargeMaster?> GetChargeAsync(Guid id, bool track, CancellationToken t) => (track ? db.ChargeMasters : db.ChargeMasters.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, t);
    public Task<bool> ChargeCodeExistsAsync(string code, Guid? excludingId, CancellationToken t) => db.ChargeMasters.AnyAsync(x => x.Code == code && (!excludingId.HasValue || x.Id != excludingId), t);
    public void AddCharge(ChargeMaster x) => db.ChargeMasters.Add(x);
    public async Task<IReadOnlyList<TaxMaster>> ListTaxesAsync(CancellationToken t) => await db.TaxMasters.AsNoTracking().OrderByDescending(x => x.SerialNo).ToListAsync(t);
    public Task<TaxMaster?> GetTaxAsync(Guid id, bool track, CancellationToken t) => (track ? db.TaxMasters : db.TaxMasters.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, t);
    public Task<bool> TaxCodeExistsAsync(string code, Guid? excludingId, CancellationToken t) => db.TaxMasters.AnyAsync(x => x.Code == code && (!excludingId.HasValue || x.Id != excludingId), t);
    public void AddTax(TaxMaster x) => db.TaxMasters.Add(x);
    public async Task<IReadOnlyList<Quotation>> ListQuotationsAsync(Guid? employeeId, CancellationToken t) => await db.Quotations.AsNoTracking().Where(x => !employeeId.HasValue || x.AssignedEmployeeId == employeeId).OrderByDescending(x => x.SerialNo).ToListAsync(t);
    public Task<Quotation?> GetQuotationAsync(Guid id, bool track, Guid? employeeId, CancellationToken t) => (track ? db.Quotations : db.Quotations.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id && (!employeeId.HasValue || x.AssignedEmployeeId == employeeId), t);
    public Task<bool> QuotationNumberExistsAsync(string number, Guid? excludingId, CancellationToken t) => db.Quotations.AnyAsync(x => x.QuotationNumber == number && (!excludingId.HasValue || x.Id != excludingId), t);
    public void AddQuotation(Quotation x) => db.Quotations.Add(x);
    public async Task<IReadOnlyList<QuotationLine>> ListLinesAsync(Guid id, CancellationToken t) => await db.QuotationLines.AsNoTracking().Where(x => x.QuotationId == id).OrderBy(x => x.DisplayOrder).ThenBy(x => x.SerialNo).ToListAsync(t);
    public void AddLines(IEnumerable<QuotationLine> x) => db.QuotationLines.AddRange(x);
    public void RemoveLines(IEnumerable<QuotationLine> x) => db.QuotationLines.RemoveRange(x);
    public async Task<IReadOnlyList<QuotationItem>> ListQuotationItemsAsync(Guid id, CancellationToken t) => await db.QuotationItems.AsNoTracking().Where(x => x.QuotationId == id).OrderBy(x => x.DisplayOrder).ThenBy(x => x.SerialNo).ToListAsync(t);
    public void AddQuotationItems(IEnumerable<QuotationItem> x) => db.QuotationItems.AddRange(x);
    public void RemoveQuotationItems(IEnumerable<QuotationItem> x) => db.QuotationItems.RemoveRange(x);
    public async Task<IReadOnlyList<QuotationLineTax>> ListLineTaxesAsync(IReadOnlyList<Guid> lineIds, CancellationToken t) => await db.QuotationLineTaxes.AsNoTracking().Where(x => lineIds.Contains(x.QuotationLineId)).OrderBy(x => x.SerialNo).ToListAsync(t);
    public void AddLineTaxes(IEnumerable<QuotationLineTax> x) => db.QuotationLineTaxes.AddRange(x);
    public Task<Employee?> GetEmployeeAsync(Guid id, CancellationToken t) => db.Employees.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, t);
    public async Task<IReadOnlyList<Employee>> ListEmployeesAsync(CancellationToken t) => await db.Employees.AsNoTracking().ToListAsync(t);
    public Task<Designation?> GetDesignationAsync(Guid id, CancellationToken t) => db.Designations.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, t);
    public Task<Survey?> GetSurveyAsync(Guid id, CancellationToken t) => db.Surveys.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, t);
    public Task<Survey?> GetSurveyForUpdateAsync(Guid id, CancellationToken t) => db.Surveys.SingleOrDefaultAsync(x => x.Id == id, t);
    public async Task<IReadOnlyList<SurveyRoom>> ListSurveyRoomsAsync(Guid id, CancellationToken t) => await db.SurveyRooms.AsNoTracking().Where(x => x.SurveyId == id).ToListAsync(t);
    public async Task<IReadOnlyList<SurveyItem>> ListSurveyItemsAsync(Guid id, CancellationToken t) => await db.SurveyItems.AsNoTracking().Where(x => x.SurveyId == id).ToListAsync(t);
    public async Task<IReadOnlyList<SurveyItem>> ListSurveyItemsForUpdateAsync(Guid id, CancellationToken t) => await db.SurveyItems.Where(x => x.SurveyId == id).ToListAsync(t);
    public void RemoveSurveyItems(IEnumerable<SurveyItem> items) => db.SurveyItems.RemoveRange(items);
    public async Task<IReadOnlyList<HouseholdItem>> ListHouseholdItemsAsync(CancellationToken t) => await db.HouseholdItems.AsNoTracking().ToListAsync(t);
    public async Task<IReadOnlyList<SalesLeadInventoryItem>> ListLeadInventoryAsync(Guid leadId, CancellationToken t) => await db.Set<SalesLeadInventoryItem>().AsNoTracking().Where(x => x.SalesLeadId == leadId).OrderBy(x => x.SerialNo).ToListAsync(t);
    public Task<SalesLead?> GetLeadAsync(Guid id, CancellationToken t) => db.SalesLeads.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, t);
    public async Task<IReadOnlyList<SalesLead>> ListLeadsAsync(CancellationToken t) => await db.SalesLeads.AsNoTracking().ToListAsync(t);
    public async Task<PublicQuotationResolution?> ResolvePublicAsync(string hash, CancellationToken t) { var quote = await db.Quotations.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.ShareTokenHash == hash, t); if (quote is null) return null; var tenant = await db.Tenants.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == quote.TenantId && x.IsActive, t); return tenant is null ? null : new(quote, tenant); }
    public async Task<IReadOnlyList<QuotationRequoteRequest>> ListRequoteRequestsAsync(Guid id, CancellationToken t) => await db.QuotationRequoteRequests.AsNoTracking().Where(x => x.QuotationId == id).OrderByDescending(x => x.SerialNo).ToListAsync(t);
    public Task<QuotationRequoteRequest?> GetRequoteRequestAsync(Guid quotationId, Guid requestId, bool track, CancellationToken t) => (track ? db.QuotationRequoteRequests : db.QuotationRequoteRequests.AsNoTracking()).SingleOrDefaultAsync(x => x.QuotationId == quotationId && x.Id == requestId, t);
    public void AddRequoteRequest(QuotationRequoteRequest request) => db.QuotationRequoteRequests.Add(request);
    public async Task SaveChangesAsync(CancellationToken t) => await db.SaveChangesAsync(t);
}
