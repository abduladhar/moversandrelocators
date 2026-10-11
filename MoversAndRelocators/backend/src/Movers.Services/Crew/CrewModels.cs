using Movers.Domain.Employees;

namespace Movers.Services.Crew;

public sealed record TeamMemberModel(Guid MembershipId, Guid EmployeeId, string EmployeeName, string EmployeeNumber, string Role, DateTimeOffset JoinedAtUtc, DateTimeOffset? LeftAtUtc, string? LeaveReason, string RecordedBy);

public sealed record TeamModel(Guid Id, string Code, string Name, string Kind, Guid? SupervisorEmployeeId, string? SupervisorName, string? Notes, bool IsActive, Guid Version, int CurrentMembers, IReadOnlyList<TeamMemberModel> Members);

/// <summary>What one employee did, counted from the assignment rows - not from who is in the team now.</summary>
public sealed record EmployeeWorkModel(Guid EmployeeId, string EmployeeName, string EmployeeNumber, int PackingJobs, int Pickups, int BoxesPacked, int BoxesPicked, DateTimeOffset? LastWorkedAtUtc, IReadOnlyList<string> TeamsWorkedUnder);

/// <summary>A team's record, built from the team stamped on each assignment at the time it was made. Work done by
/// someone who has since moved on still counts to the team that did it.</summary>
public sealed record TeamPerformanceModel(Guid TeamId, string TeamName, string Kind, int PackingJobs, int Pickups, int BoxesPacked, int BoxesPicked, int PeopleInvolved, int CurrentMembers, DateTimeOffset? LastWorkedAtUtc);

public sealed record CrewOverviewModel(IReadOnlyList<TeamPerformanceModel> Teams, IReadOnlyList<EmployeeWorkModel> Employees, DateTimeOffset? From, DateTimeOffset? To);

public sealed record SaveTeamCommand(string Code, string Name, string Kind, Guid? SupervisorEmployeeId, string? Notes);
public sealed record AddMemberCommand(Guid EmployeeId, string Role, DateTimeOffset? JoinedAt);
public sealed record RemoveMemberCommand(DateTimeOffset? LeftAt, string? Reason);
/// <summary>Moves someone to another team: closes the current spell and opens one on the new team.</summary>
public sealed record MoveMemberCommand(Guid EmployeeId, Guid ToTeamId, string Role, DateTimeOffset? At, string? Reason);
