namespace Movers.Services.Sales;

public interface ISalesService
{
    Task<IReadOnlyList<LeadStatusModel>> ListLeadStatusesAsync(CancellationToken token);
    Task<LeadStatusModel> CreateLeadStatusAsync(SaveLeadStatusCommand command, CancellationToken token);
    Task<LeadStatusModel?> UpdateLeadStatusAsync(Guid id, SaveLeadStatusCommand command, CancellationToken token);
    Task<LeadStatusModel?> SetLeadStatusActiveAsync(Guid id, bool active, CancellationToken token);
    Task<IReadOnlyList<FollowUpStatusModel>> ListFollowUpStatusesAsync(CancellationToken token);
    Task<FollowUpStatusModel> CreateFollowUpStatusAsync(SaveFollowUpStatusCommand command, CancellationToken token);
    Task<FollowUpStatusModel?> UpdateFollowUpStatusAsync(Guid id, SaveFollowUpStatusCommand command, CancellationToken token);
    Task<FollowUpStatusModel?> SetFollowUpStatusActiveAsync(Guid id, bool active, CancellationToken token);
    Task<IReadOnlyList<MoveTypeModel>> ListMoveTypesAsync(CancellationToken token);
    Task<MoveTypeModel> CreateMoveTypeAsync(SaveMoveTypeCommand command, CancellationToken token);
    Task<MoveTypeModel?> UpdateMoveTypeAsync(Guid id, SaveMoveTypeCommand command, CancellationToken token);
    Task<MoveTypeModel?> SetMoveTypeActiveAsync(Guid id, bool active, CancellationToken token);
    Task<IReadOnlyList<SalesLeadModel>> ListLeadsAsync(CancellationToken token);
    Task<Movers.Services.Common.PagedResult<SalesLeadModel>> SearchLeadsAsync(SalesLeadListFilter filter, Movers.Services.Common.ListQuery query, CancellationToken token);
    /// <summary>One page of a sales master; Summary is a SalesMasterSummary of the whole master (next display order default).</summary>
    Task<Movers.Services.Common.PagedResult<LeadStatusModel>> SearchLeadStatusesAsync(bool? active, Movers.Services.Common.ListQuery query, CancellationToken token);
    Task<Movers.Services.Common.PagedResult<FollowUpStatusModel>> SearchFollowUpStatusesAsync(bool? active, Movers.Services.Common.ListQuery query, CancellationToken token);
    Task<Movers.Services.Common.PagedResult<MoveTypeModel>> SearchMoveTypesAsync(bool? active, Movers.Services.Common.ListQuery query, CancellationToken token);
    Task<SalesLeadModel> CreateLeadAsync(SaveSalesLeadCommand command, CancellationToken token);
    Task<SalesLeadModel?> UpdateLeadAsync(Guid id, SaveSalesLeadCommand command, CancellationToken token);
    Task<SalesLeadModel?> SetLeadActiveAsync(Guid id, bool active, CancellationToken token);
    Task<IReadOnlyList<FollowUpModel>> ListFollowUpsAsync(Guid leadId, CancellationToken token);
    Task<FollowUpModel> CreateFollowUpAsync(Guid leadId, SaveFollowUpCommand command, CancellationToken token);
    Task<FollowUpModel?> UpdateFollowUpAsync(Guid id, SaveFollowUpCommand command, CancellationToken token);
}
