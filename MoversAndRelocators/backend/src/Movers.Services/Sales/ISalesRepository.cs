using Movers.Domain.Employees;
using Movers.Domain.Sales;

namespace Movers.Services.Sales;

public interface ISalesRepository
{
    Task<IReadOnlyList<LeadStatus>> ListLeadStatusesAsync(CancellationToken token);
    Task<LeadStatus?> GetLeadStatusAsync(Guid id, bool track, CancellationToken token);
    Task<bool> LeadStatusCodeExistsAsync(string code, Guid? excludingId, CancellationToken token);
    void AddLeadStatus(LeadStatus item);
    Task<IReadOnlyList<FollowUpStatus>> ListFollowUpStatusesAsync(CancellationToken token);
    Task<FollowUpStatus?> GetFollowUpStatusAsync(Guid id, bool track, CancellationToken token);
    Task<bool> FollowUpStatusCodeExistsAsync(string code, Guid? excludingId, CancellationToken token);
    void AddFollowUpStatus(FollowUpStatus item);
    Task<IReadOnlyList<MoveType>> ListMoveTypesAsync(CancellationToken token);
    Task<MoveType?> GetMoveTypeAsync(Guid id, bool track, CancellationToken token);
    Task<bool> MoveTypeCodeExistsAsync(string code, Guid? excludingId, CancellationToken token);
    void AddMoveType(MoveType item);
    Task<IReadOnlyList<SalesLead>> ListLeadsAsync(CancellationToken token);
    Task<(IReadOnlyList<SalesLead> Items, int Total)> SearchLeadsAsync(SalesLeadListFilter filter, Movers.Services.Common.ListQuery query, IReadOnlyCollection<Guid>? onlyIds, CancellationToken token);
    Task<(IReadOnlyList<LeadStatus> Items, int Total, SalesMasterSummary Summary)> SearchLeadStatusesAsync(bool? active, Movers.Services.Common.ListQuery query, CancellationToken token);
    Task<(IReadOnlyList<FollowUpStatus> Items, int Total, SalesMasterSummary Summary)> SearchFollowUpStatusesAsync(bool? active, Movers.Services.Common.ListQuery query, CancellationToken token);
    Task<(IReadOnlyList<MoveType> Items, int Total, SalesMasterSummary Summary)> SearchMoveTypesAsync(bool? active, Movers.Services.Common.ListQuery query, CancellationToken token);
    Task<SalesLead?> GetLeadAsync(Guid id, bool track, CancellationToken token);
    Task<bool> LeadNumberExistsAsync(string number, Guid? excludingId, CancellationToken token);
    void AddLead(SalesLead lead);
    Task<IReadOnlyList<LeadFollowUp>> ListFollowUpsAsync(Guid leadId, CancellationToken token);
    Task<LeadFollowUp?> GetFollowUpAsync(Guid id, bool track, CancellationToken token);
    void AddFollowUp(LeadFollowUp followUp);
    Task<Employee?> GetEmployeeAsync(Guid id, CancellationToken token);
    Task<IReadOnlyList<Employee>> ListEmployeesAsync(CancellationToken token);
    Task SaveChangesAsync(CancellationToken token);
}
