using Movers.Domain.Common;

namespace Movers.Domain.Employees;

/// <summary>A crew that takes packing jobs and pickups. Membership changes over time, so a team is an identity
/// here, not a list of people - who was in it on a given day comes from TeamMembership.</summary>
public sealed class Team : TenantOwnedEntity
{
    private Team() { }
    public Team(Guid tenantId, string code, string name, string kind, Guid? supervisorEmployeeId, string? notes) : base(tenantId)
    { CreatedAtUtc = DateTimeOffset.UtcNow; Update(code, name, kind, supervisorEmployeeId, notes); IsActive = true; }

    public string Code { get; private set; } = "";
    public string Name { get; private set; } = "";
    /// <summary>PACKING, PICKUP or BOTH - what the crew is normally sent to.</summary>
    public string Kind { get; private set; } = TeamKinds.Both;
    /// <summary>Who supervises this crew - watches its jobs and its performance. One supervisor covers several
    /// crews and need not be a member of any. The on-site lead is a crew ROLE, not this.</summary>
    public Guid? SupervisorEmployeeId { get; private set; }
    public string? Notes { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public Guid Version { get; private set; } = Guid.NewGuid();

    public void Update(string code, string name, string kind, Guid? supervisorEmployeeId, string? notes)
    {
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Kind = TeamKinds.IsValid(kind) ? kind : throw new InvalidOperationException("Choose whether the team packs, picks up, or both.");
        SupervisorEmployeeId = supervisorEmployeeId;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        UpdatedAtUtc = DateTimeOffset.UtcNow;
        Version = Guid.NewGuid();
    }

    public void SetActive(bool active) { IsActive = active; UpdatedAtUtc = DateTimeOffset.UtcNow; Version = Guid.NewGuid(); }
}

/// <summary>One spell of an employee in a team. Moving someone closes their open row and opens a new one, so the
/// record shows who was in which team on any date - and a move never rewrites the past.</summary>
public sealed class TeamMembership : TenantOwnedEntity
{
    private TeamMembership() { }
    public TeamMembership(Guid tenantId, Guid teamId, Guid employeeId, string role, DateTimeOffset joinedAt, string recordedBy) : base(tenantId)
    { TeamId = teamId; EmployeeId = employeeId; Role = role.Trim(); JoinedAtUtc = joinedAt; RecordedBy = recordedBy; }

    public Guid TeamId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public string Role { get; private set; } = "";
    public DateTimeOffset JoinedAtUtc { get; private set; }
    /// <summary>Null while the employee is still in the team.</summary>
    public DateTimeOffset? LeftAtUtc { get; private set; }
    public string RecordedBy { get; private set; } = "";
    public string? LeaveReason { get; private set; }
    public bool IsCurrent => LeftAtUtc is null;

    public void Leave(DateTimeOffset at, string? reason)
    { LeftAtUtc = at; LeaveReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim(); }

    public void ChangeRole(string role) => Role = role.Trim();
}

public static class TeamKinds
{
    public const string Packing = "PACKING";
    public const string Pickup = "PICKUP";
    public const string Both = "BOTH";
    public static bool IsValid(string? x) => x is Packing or Pickup or Both;
    /// <summary>True when a team of this kind may be sent to that kind of work.</summary>
    public static bool Covers(string teamKind, string work) => teamKind == Both || teamKind == work;
}

public static class TeamRoles
{
    public const string Leader = "Team leader";
    public const string Packer = "Packer";
    public const string Driver = "Driver";
    public const string Helper = "Helper";
    public static readonly string[] All = [Leader, Packer, Driver, Helper];
}
