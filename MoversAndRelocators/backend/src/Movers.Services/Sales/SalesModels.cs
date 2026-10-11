namespace Movers.Services.Sales;

public sealed record SaveLeadStatusCommand(string Code, string Name, int DisplayOrder, string? Color, bool IsClosed);
public sealed record SaveFollowUpStatusCommand(string Code, string Name, int DisplayOrder, string? Color, bool IsCompleted);
public sealed record LeadStatusModel(int SerialNo, Guid Id, string Code, string Name, int DisplayOrder, string? Color, bool IsClosed, bool IsActive);
public sealed record FollowUpStatusModel(int SerialNo, Guid Id, string Code, string Name, int DisplayOrder, string? Color, bool IsCompleted, bool IsActive);
public sealed record SaveMoveTypeCommand(string Code, string Name, int DisplayOrder, string? Description);
public sealed record MoveTypeModel(int SerialNo, Guid Id, string Code, string Name, int DisplayOrder, string? Description, bool IsActive);
public sealed record SaveSalesLeadCommand(string LeadNumber, string CustomerName, string Phone, string? Email, string? Source, Guid MoveTypeId, string Origin, string Destination, DateOnly? ExpectedMoveDate, Guid StatusId, Guid? AssignedEmployeeId, string? Notes);
public sealed record SalesLeadModel(int SerialNo, Guid Id, string LeadNumber, string CustomerName, string Phone, string? Email, string? Source, Guid MoveTypeId, string MoveTypeName, string Origin, string Destination, DateOnly? ExpectedMoveDate, Guid StatusId, string StatusName, string? StatusColor, bool StatusIsClosed, Guid? AssignedEmployeeId, string? AssignedEmployeeName, string? Notes, bool IsActive, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc);
public sealed record SaveFollowUpCommand(DateTimeOffset ScheduledAtUtc, Guid StatusId, string Notes, DateTimeOffset? NextFollowUpAtUtc);
public sealed record FollowUpModel(int SerialNo, Guid Id, Guid SalesLeadId, DateTimeOffset ScheduledAtUtc, Guid StatusId, string StatusName, string? StatusColor, bool StatusIsCompleted, string Notes, DateTimeOffset? NextFollowUpAtUtc, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc);
