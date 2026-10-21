namespace Movers.Services.Sales;

public sealed record SaveLeadStatusCommand(string Code, string Name, int DisplayOrder, string? Color, bool IsClosed);
public sealed record SaveFollowUpStatusCommand(string Code, string Name, int DisplayOrder, string? Color, bool IsCompleted);
public sealed record LeadStatusModel(int SerialNo, Guid Id, string Code, string Name, int DisplayOrder, string? Color, bool IsClosed, bool IsActive);
public sealed record FollowUpStatusModel(int SerialNo, Guid Id, string Code, string Name, int DisplayOrder, string? Color, bool IsCompleted, bool IsActive);
public sealed record SaveMoveTypeCommand(string Code, string Name, int DisplayOrder, string? Description);
public sealed record MoveTypeModel(int SerialNo, Guid Id, string Code, string Name, int DisplayOrder, string? Description, bool IsActive);
public sealed record SaveSalesLeadCommand(string LeadNumber, string CustomerName, string Phone, string? Email, string? Source, Guid MoveTypeId, string Origin, string Destination, DateOnly? ExpectedMoveDate, Guid StatusId, Guid? AssignedEmployeeId, string? Notes);
public sealed record SalesLeadModel(int SerialNo, Guid Id, string LeadNumber, string CustomerName, string Phone, string? Email, string? Source, Guid MoveTypeId, string MoveTypeName, string Origin, string Destination, DateOnly? ExpectedMoveDate, Guid StatusId, string StatusName, string? StatusColor, bool StatusIsClosed, Guid? AssignedEmployeeId, string? AssignedEmployeeName, string? Notes, bool IsActive, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc,
    decimal ExpectedCbm = 0, int FragileItems = 0);
public sealed record SaveFollowUpCommand(DateTimeOffset ScheduledAtUtc, Guid StatusId, string Notes, DateTimeOffset? NextFollowUpAtUtc);
public sealed record FollowUpModel(int SerialNo, Guid Id, Guid SalesLeadId, DateTimeOffset ScheduledAtUtc, Guid StatusId, string StatusName, string? StatusColor, bool StatusIsCompleted, string Notes, DateTimeOffset? NextFollowUpAtUtc, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc);
/// <summary>Filters of the sales leads list (advanced search); CustomerState narrows to leads whose customer reply is in that state.</summary>
public sealed record SalesLeadListFilter(Guid? StatusId = null, Guid? MoveTypeId = null, Guid? EmployeeId = null, bool? Active = null, string? CustomerState = null);
/// <summary>Whole-list figures of a sales master (lead statuses, follow-up statuses, move types) for the next display order default.</summary>
public sealed record SalesMasterSummary(int Count, int MaxDisplayOrder);
