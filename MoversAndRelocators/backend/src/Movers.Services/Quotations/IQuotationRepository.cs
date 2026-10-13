using Movers.Domain.Employees;
using Movers.Domain.Quotations;
using Movers.Domain.Sales;
using Movers.Domain.Surveys;
using Movers.Domain.Tenants;

namespace Movers.Services.Quotations;

public sealed record PublicQuotationResolution(Quotation Quotation, Tenant Tenant);

public interface IQuotationRepository
{
    Task<IReadOnlyList<ChargeMaster>> ListChargesAsync(CancellationToken token);
    Task<ChargeMaster?> GetChargeAsync(Guid id, bool track, CancellationToken token);
    Task<bool> ChargeCodeExistsAsync(string code, Guid? excludingId, CancellationToken token);
    void AddCharge(ChargeMaster charge);
    Task<IReadOnlyList<TaxMaster>> ListTaxesAsync(CancellationToken token);
    Task<TaxMaster?> GetTaxAsync(Guid id, bool track, CancellationToken token);
    Task<bool> TaxCodeExistsAsync(string code, Guid? excludingId, CancellationToken token);
    void AddTax(TaxMaster tax);
    Task<IReadOnlyList<Quotation>> ListQuotationsAsync(Guid? assignedEmployeeId, CancellationToken token);
    Task<Quotation?> GetQuotationAsync(Guid id, bool track, Guid? assignedEmployeeId, CancellationToken token);
    Task<bool> QuotationNumberExistsAsync(string number, Guid? excludingId, CancellationToken token);
    void AddQuotation(Quotation quotation);
    Task<IReadOnlyList<QuotationLine>> ListLinesAsync(Guid quotationId, CancellationToken token);
    void AddLines(IEnumerable<QuotationLine> lines);
    void RemoveLines(IEnumerable<QuotationLine> lines);
    Task<IReadOnlyList<QuotationItem>> ListQuotationItemsAsync(Guid quotationId, CancellationToken token);
    void AddQuotationItems(IEnumerable<QuotationItem> items);
    void RemoveQuotationItems(IEnumerable<QuotationItem> items);
    Task<IReadOnlyList<QuotationLineTax>> ListLineTaxesAsync(IReadOnlyList<Guid> lineIds, CancellationToken token);
    void AddLineTaxes(IEnumerable<QuotationLineTax> taxes);
    Task<Employee?> GetEmployeeAsync(Guid id, CancellationToken token);
    Task<IReadOnlyList<Employee>> ListEmployeesAsync(CancellationToken token);
    Task<Designation?> GetDesignationAsync(Guid id, CancellationToken token);
    Task<Survey?> GetSurveyAsync(Guid id, CancellationToken token);
    Task<Survey?> GetSurveyForUpdateAsync(Guid id, CancellationToken token);
    Task<IReadOnlyList<SurveyRoom>> ListSurveyRoomsAsync(Guid id, CancellationToken token);
    Task<IReadOnlyList<SurveyItem>> ListSurveyItemsAsync(Guid id, CancellationToken token);
    Task<IReadOnlyList<SurveyItem>> ListSurveyItemsForUpdateAsync(Guid id, CancellationToken token);
    void RemoveSurveyItems(IEnumerable<SurveyItem> items);
    Task<IReadOnlyList<HouseholdItem>> ListHouseholdItemsAsync(CancellationToken token);
    Task<SalesLead?> GetLeadAsync(Guid id, CancellationToken token);
    Task<IReadOnlyList<SalesLeadInventoryItem>> ListLeadInventoryAsync(Guid leadId, CancellationToken token);
    Task<IReadOnlyList<SalesLead>> ListLeadsAsync(CancellationToken token);
    Task<PublicQuotationResolution?> ResolvePublicAsync(string tokenHash, CancellationToken token);
    Task<IReadOnlyList<QuotationRequoteRequest>> ListRequoteRequestsAsync(Guid quotationId, CancellationToken token);
    Task<QuotationRequoteRequest?> GetRequoteRequestAsync(Guid quotationId, Guid requestId, bool track, CancellationToken token);
    void AddRequoteRequest(QuotationRequoteRequest request);
    Task SaveChangesAsync(CancellationToken token);
}
