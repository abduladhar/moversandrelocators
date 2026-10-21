namespace Movers.Services.Quotations;

public interface IQuotationService
{
    Task<IReadOnlyList<ChargeModel>> ListChargesAsync(CancellationToken token);
    Task<ChargeModel> CreateChargeAsync(SaveChargeCommand command, CancellationToken token);
    Task<ChargeModel?> UpdateChargeAsync(Guid id, SaveChargeCommand command, CancellationToken token);
    Task<ChargeModel?> SetChargeActiveAsync(Guid id, bool active, CancellationToken token);
    Task<IReadOnlyList<TaxModel>> ListTaxesAsync(CancellationToken token);
    Task<Movers.Services.Common.PagedResult<ChargeModel>> SearchChargesAsync(bool? active, Movers.Services.Common.ListQuery query, CancellationToken token);
    Task<Movers.Services.Common.PagedResult<TaxModel>> SearchTaxesAsync(string? kind, Movers.Services.Common.ListQuery query, CancellationToken token);
    Task<TaxModel> CreateTaxAsync(SaveTaxCommand command, CancellationToken token);
    Task<TaxModel?> UpdateTaxAsync(Guid id, SaveTaxCommand command, CancellationToken token);
    Task<TaxModel?> SetTaxActiveAsync(Guid id, bool active, CancellationToken token);
    Task<IReadOnlyList<QuotationModel>> ListAsync(CancellationToken token);
    /// <summary>The quotation register's advanced search: one page, searched, filtered and sorted in the database.</summary>
    Task<Movers.Services.Common.PagedResult<QuotationModel>> SearchAsync(QuotationListFilter filter, Movers.Services.Common.ListQuery query, CancellationToken token);
    Task<QuotationDetailModel?> GetAsync(Guid id, CancellationToken token);
    Task<QuotationModel?> CreateRevisionAsync(Guid id, CancellationToken token);
    Task<QuotationModel> CreateAsync(SaveQuotationCommand command, CancellationToken token);
    Task<QuotationModel?> UpdateAsync(Guid id, SaveQuotationCommand command, CancellationToken token);
    Task<QuotationDetailModel?> SaveLinesAsync(Guid id, IReadOnlyList<SaveQuotationLineCommand> lines, CancellationToken token);
    Task<QuotationDetailModel?> SaveItemsAsync(Guid id, IReadOnlyList<SaveQuotationItemCommand> items, CancellationToken token);
    /// <summary>Replaces the quotation's items with the sales lead's inventory, leaving out what the customer said they do not need.</summary>
    Task<LeadInventoryImportModel?> ImportLeadInventoryAsync(Guid id, CancellationToken token);
    Task<GeneratedQuotationLinkModel> GenerateLinkAsync(Guid id, int validDays, CancellationToken token);
    Task<QuotationDetailModel?> ApplyRequoteRequestAsync(Guid quotationId, Guid requestId, CancellationToken token);
    Task<PublicQuotationModel?> GetPublicAsync(string token, CancellationToken cancellationToken);
    Task<PublicQuotationModel?> AcceptAsync(string token, CancellationToken cancellationToken);
    Task<PublicQuotationModel?> RejectAsync(string token, string reason, CancellationToken cancellationToken);
    Task<PublicQuotationModel?> RequestRequoteAsync(string token, SubmitRequoteCommand command, CancellationToken cancellationToken);
}

/// <summary>The quotation register's filters. CustomerState: a CustomerReplyStates value.</summary>
public sealed record QuotationListFilter(string? Status = null, Guid? EmployeeId = null, string? CustomerState = null);
