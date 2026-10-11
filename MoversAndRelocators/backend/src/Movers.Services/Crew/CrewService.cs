using Movers.Domain.Employees;
using Movers.Services.Security;
using Movers.Services.Tenancy;

namespace Movers.Services.Crew;

public interface ICrewService
{
    Task<IReadOnlyList<TeamModel>> TeamsAsync(bool includeInactive, CancellationToken t);
    Task<TeamModel?> TeamAsync(Guid id, CancellationToken t);
    Task<TeamModel> CreateAsync(SaveTeamCommand c, CancellationToken t);
    Task<TeamModel?> UpdateAsync(Guid id, SaveTeamCommand c, CancellationToken t);
    Task<TeamModel?> SetActiveAsync(Guid id, bool active, CancellationToken t);
    Task<TeamModel?> AddMemberAsync(Guid teamId, AddMemberCommand c, CancellationToken t);
    Task<TeamModel?> RemoveMemberAsync(Guid teamId, Guid employeeId, RemoveMemberCommand c, CancellationToken t);
    Task<TeamModel?> MoveMemberAsync(Guid fromTeamId, MoveMemberCommand c, CancellationToken t);
    Task<CrewOverviewModel> PerformanceAsync(DateTimeOffset? from, DateTimeOffset? to, CancellationToken t);
    Task<int> SeedDemoAsync(CancellationToken t);
}

/// <summary>Crew management: teams, who is in them over time, and what each team and person is on record for.</summary>
public sealed class CrewService(ICrewRepository repo, ITenantContext tenant, IUserContext user, TimeProvider clock) : ICrewService
{
    private string Actor() => string.IsNullOrWhiteSpace(user.Email) ? "Staff" : user.Email;

    public async Task<IReadOnlyList<TeamModel>> TeamsAsync(bool includeInactive, CancellationToken t)
    {
        var teams = await repo.TeamsAsync(includeInactive, t);
        var memberships = await repo.AllMembershipsAsync(t);
        var employees = (await repo.EmployeesAsync(t)).ToDictionary(x => x.Id);
        return teams.Select(x => Map(x, memberships.Where(m => m.TeamId == x.Id).ToList(), employees)).ToList();
    }

    public async Task<TeamModel?> TeamAsync(Guid id, CancellationToken t)
    {
        if (await repo.TeamAsync(id, false, t) is not { } team) return null;
        var employees = (await repo.EmployeesAsync(t)).ToDictionary(x => x.Id);
        return Map(team, await repo.MembershipsAsync(id, t), employees);
    }

    public async Task<TeamModel> CreateAsync(SaveTeamCommand c, CancellationToken t)
    {
        await GuardCodeAsync(c.Code, null, t);
        var team = new Team(tenant.TenantId, c.Code, c.Name, c.Kind, await SupervisorAsync(c.SupervisorEmployeeId, t), c.Notes);
        repo.Add(team);
        await repo.Save(t);
        return (await TeamAsync(team.Id, t))!;
    }

    public async Task<TeamModel?> UpdateAsync(Guid id, SaveTeamCommand c, CancellationToken t)
    {
        if (await repo.TeamAsync(id, true, t) is not { } team) return null;
        await GuardCodeAsync(c.Code, id, t);
        team.Update(c.Code, c.Name, c.Kind, await SupervisorAsync(c.SupervisorEmployeeId, t), c.Notes);
        await repo.Save(t);
        return await TeamAsync(id, t);
    }

    public async Task<TeamModel?> SetActiveAsync(Guid id, bool active, CancellationToken t)
    {
        if (await repo.TeamAsync(id, true, t) is not { } team) return null;
        team.SetActive(active);
        await repo.Save(t);
        return await TeamAsync(id, t);
    }

    public async Task<TeamModel?> AddMemberAsync(Guid teamId, AddMemberCommand c, CancellationToken t)
    {
        if (await repo.TeamAsync(teamId, false, t) is null) return null;
        var employee = await repo.EmployeeAsync(c.EmployeeId, t) ?? throw new InvalidOperationException("Employee not found.");
        if (await repo.CurrentMembershipAsync(teamId, c.EmployeeId, t) is not null) throw new InvalidOperationException("That employee is already in this team.");
        // One crew at a time. The message names the crew, because "already in another crew" leaves the
        // scheduler hunting through every team to find out which.
        if (await repo.CurrentTeamOfAsync(c.EmployeeId, t) is { } other)
            throw new InvalidOperationException($"{employee.FirstName} {employee.LastName} is already in {other.Name}. Move them from there instead of adding them twice.");
        repo.Add(new TeamMembership(tenant.TenantId, teamId, c.EmployeeId, c.Role, c.JoinedAt ?? clock.GetUtcNow(), Actor()));
        await repo.Save(t);
        return await TeamAsync(teamId, t);
    }

    public async Task<TeamModel?> RemoveMemberAsync(Guid teamId, Guid employeeId, RemoveMemberCommand c, CancellationToken t)
    {
        if (await repo.TeamAsync(teamId, false, t) is null) return null;
        if (await repo.CurrentMembershipAsync(teamId, employeeId, t) is not { } membership) throw new InvalidOperationException("That employee is not currently in this team.");
        membership.Leave(c.LeftAt ?? clock.GetUtcNow(), c.Reason);
        await repo.Save(t);
        return await TeamAsync(teamId, t);
    }

    /// <summary>Closes the spell in the old team and opens one in the new. Nothing already assigned is touched,
    /// so jobs the employee did with the old team stay that team's record and remain their responsibility.</summary>
    public async Task<TeamModel?> MoveMemberAsync(Guid fromTeamId, MoveMemberCommand c, CancellationToken t)
    {
        if (await repo.TeamAsync(fromTeamId, false, t) is null) return null;
        if (await repo.TeamAsync(c.ToTeamId, false, t) is null) throw new InvalidOperationException("Destination team not found.");
        if (fromTeamId == c.ToTeamId) throw new InvalidOperationException("Choose a different team to move to.");
        if (await repo.CurrentMembershipAsync(fromTeamId, c.EmployeeId, t) is not { } current) throw new InvalidOperationException("That employee is not currently in this team.");
        if (await repo.CurrentMembershipAsync(c.ToTeamId, c.EmployeeId, t) is not null) throw new InvalidOperationException("That employee is already in the destination team.");

        var at = c.At ?? clock.GetUtcNow();
        current.Leave(at, c.Reason ?? "Moved to another team");
        repo.Add(new TeamMembership(tenant.TenantId, c.ToTeamId, c.EmployeeId, string.IsNullOrWhiteSpace(c.Role) ? current.Role : c.Role, at, Actor()));
        await repo.Save(t);
        return await TeamAsync(fromTeamId, t);
    }

    public async Task<CrewOverviewModel> PerformanceAsync(DateTimeOffset? from, DateTimeOffset? to, CancellationToken t)
    {
        var teams = await repo.TeamsAsync(true, t);
        var employees = (await repo.EmployeesAsync(t)).ToDictionary(x => x.Id);
        var memberships = await repo.AllMembershipsAsync(t);
        var pickups = await repo.PickupAssignmentsAsync(from, to, t);
        var packing = await repo.PackingCrewAsync(from, to, t);
        var packBoxes = await repo.BoxesPerPackingJobAsync(t);
        var pickBoxes = await repo.BoxesPerPickupAsync(t);

        // Everything below counts the team stamped on the assignment, never current membership, so a move
        // leaves history untouched.
        var teamRows = teams.Select(team =>
        {
            var p = packing.Where(x => x.TeamId == team.Id).ToList();
            var u = pickups.Where(x => x.TeamId == team.Id).ToList();
            var last = p.Select(x => x.AssignedAtUtc).Concat(u.Select(x => x.AssignedAtUtc)).DefaultIfEmpty().Max();
            return new TeamPerformanceModel(team.Id, team.Name, team.Kind,
                p.Select(x => x.PackingJobId).Distinct().Count(), u.Select(x => x.PickupId).Distinct().Count(),
                p.Select(x => x.PackingJobId).Distinct().Sum(id => packBoxes.TryGetValue(id, out var n) ? n : 0),
                u.Select(x => x.PickupId).Distinct().Sum(id => pickBoxes.TryGetValue(id, out var n) ? n : 0),
                p.Select(x => x.EmployeeId).Concat(u.Select(x => x.EmployeeId)).Distinct().Count(),
                memberships.Count(m => m.TeamId == team.Id && m.LeftAtUtc == null),
                last == default ? null : last);
        }).OrderByDescending(x => x.PackingJobs + x.Pickups).ToList();

        var ids = packing.Select(x => x.EmployeeId).Concat(pickups.Select(x => x.EmployeeId)).Distinct();
        var employeeRows = ids.Select(id =>
        {
            var p = packing.Where(x => x.EmployeeId == id).ToList();
            var u = pickups.Where(x => x.EmployeeId == id).ToList();
            var last = p.Select(x => x.AssignedAtUtc).Concat(u.Select(x => x.AssignedAtUtc)).DefaultIfEmpty().Max();
            var name = employees.TryGetValue(id, out var e) ? e.FirstName + " " + e.LastName : "Unknown";
            return new EmployeeWorkModel(id, name, employees.TryGetValue(id, out var e2) ? e2.EmployeeNumber : "",
                p.Select(x => x.PackingJobId).Distinct().Count(), u.Select(x => x.PickupId).Distinct().Count(),
                p.Select(x => x.PackingJobId).Distinct().Sum(j => packBoxes.TryGetValue(j, out var n) ? n : 0),
                u.Select(x => x.PickupId).Distinct().Sum(j => pickBoxes.TryGetValue(j, out var n) ? n : 0),
                last == default ? null : last,
                p.Select(x => x.TeamName).Concat(u.Select(x => x.TeamName)).Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x!).Distinct().OrderBy(x => x).ToList());
        }).OrderByDescending(x => x.PackingJobs + x.Pickups).ToList();

        return new CrewOverviewModel(teamRows, employeeRows, from, to);
    }

    /// <summary>Demo employees and teams for trying crew management out. Does nothing once any team exists.</summary>
    public async Task<int> SeedDemoAsync(CancellationToken t)
    {
        var now = clock.GetUtcNow();
        // Employees are seeded whether or not teams exist, so this stays useful after the first run. A
        // designation is created when the tenant has none, rather than refusing over a missing master record.
        var designation = await repo.AnyDesignationAsync(t);
        if (designation is null)
        {
            designation = new Designation(tenant.TenantId, "CREW", "Crew member", 1, "Packs and collects on site");
            repo.Add(designation);
        }
        var existing = (await repo.EmployeesAsync(t)).Select(x => x.EmployeeNumber).ToHashSet();

        string[,] people = {
            { "Rashid", "Ali" }, { "Imran", "Khan" }, { "Sunil", "Nair" }, { "Vikram", "Patel" },
            { "Joseph", "Mathew" }, { "Arun", "Kumar" }, { "Fahad", "Hassan" }, { "Deepak", "Sharma" },
            { "Noor", "Rahman" }, { "Sajid", "Iqbal" }, { "Mahesh", "Rao" }, { "Tariq", "Aziz" },
        };
        var created = new List<Employee>();
        for (var i = 0; i < people.GetLength(0); i++)
        {
            var number = "EMP-DEMO-" + (i + 1).ToString("00");
            if (existing.Contains(number)) continue;
            var e = new Employee(tenant.TenantId, number, people[i, 0], people[i, 1],
                $"{people[i, 0].ToLowerInvariant()}.{people[i, 1].ToLowerInvariant()}@demo.local", "05" + (50000000 + i).ToString(),
                DateOnly.FromDateTime(now.UtcDateTime.AddDays(-200 + i * 7)), designation.Id, null);
            repo.Add(e); created.Add(e);
        }
        // Teams only on a tenant that has none, so running this again tops up people without touching crews
        // that have real work against them.
        if (await repo.AnyTeamsAsync(t) || created.Count == 0)
        {
            if (created.Count > 0) await repo.Save(t);
            return created.Count;
        }

        (string Code, string Name, string Kind)[] teams = [
            ("PACK-A", "Packing crew A", TeamKinds.Packing),
            ("PACK-B", "Packing crew B", TeamKinds.Packing),
            ("PICK-A", "Pickup crew A", TeamKinds.Pickup),
            ("FLEX-1", "Flexible crew", TeamKinds.Both),
        ];
        var index = 0;
        foreach (var (code, name, kind) in teams)
        {
            var members = created.Skip(index).Take(3).ToList();
            index += 3;
            if (members.Count == 0) break;
            var team = new Team(tenant.TenantId, code, name, kind, members[0].Id, "Demo data");
            repo.Add(team);
            for (var i = 0; i < members.Count; i++)
                repo.Add(new TeamMembership(tenant.TenantId, team.Id, members[i].Id,
                    i == 0 ? TeamRoles.Leader : kind == TeamKinds.Pickup ? TeamRoles.Driver : TeamRoles.Packer,
                    now.AddDays(-90 + i), Actor()));
        }
        await repo.Save(t);
        return created.Count;
    }

    private async Task<Guid?> SupervisorAsync(Guid? id, CancellationToken t)
    {
        if (id is null) return null;
        if (await repo.EmployeeAsync(id.Value, t) is null) throw new InvalidOperationException("Supervisor not found.");
        return id;
    }

    private async Task GuardCodeAsync(string code, Guid? excludingId, CancellationToken t)
    {
        if (string.IsNullOrWhiteSpace(code)) throw new InvalidOperationException("Give the team a short code.");
        if (await repo.CodeExistsAsync(code.Trim().ToUpperInvariant(), excludingId, t)) throw new InvalidOperationException("Another team already uses that code.");
    }

    private static TeamModel Map(Team team, IReadOnlyList<TeamMembership> memberships, IReadOnlyDictionary<Guid, Employee> employees)
    {
        string Name(Guid id) => employees.TryGetValue(id, out var e) ? e.FirstName + " " + e.LastName : "Unknown";
        var members = memberships.OrderByDescending(x => x.LeftAtUtc == null).ThenByDescending(x => x.JoinedAtUtc)
            .Select(m => new TeamMemberModel(m.Id, m.EmployeeId, Name(m.EmployeeId),
                employees.TryGetValue(m.EmployeeId, out var e) ? e.EmployeeNumber : "", m.Role, m.JoinedAtUtc, m.LeftAtUtc, m.LeaveReason, m.RecordedBy)).ToList();
        return new TeamModel(team.Id, team.Code, team.Name, team.Kind, team.SupervisorEmployeeId,
            team.SupervisorEmployeeId is { } l ? Name(l) : null, team.Notes, team.IsActive, team.Version,
            members.Count(x => x.LeftAtUtc is null), members);
    }
}
