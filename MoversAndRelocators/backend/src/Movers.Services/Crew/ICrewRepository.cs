using Movers.Domain.Employees;
using Movers.Domain.Packing;
using Movers.Domain.Pickups;

namespace Movers.Services.Crew;

public interface ICrewRepository
{
    Task<IReadOnlyList<Team>> TeamsAsync(bool includeInactive, CancellationToken t);
    Task<Team?> TeamAsync(Guid id, bool track, CancellationToken t);
    Task<bool> CodeExistsAsync(string code, Guid? excludingId, CancellationToken t);

    Task<IReadOnlyList<TeamMembership>> MembershipsAsync(Guid teamId, CancellationToken t);
    Task<IReadOnlyList<TeamMembership>> AllMembershipsAsync(CancellationToken t);
    Task<TeamMembership?> CurrentMembershipAsync(Guid teamId, Guid employeeId, CancellationToken t);
    Task<IReadOnlyList<TeamMembership>> OpenMembershipsForEmployeeAsync(Guid employeeId, CancellationToken t);

    Task<IReadOnlyList<Employee>> EmployeesAsync(CancellationToken t);
    Task<Employee?> EmployeeAsync(Guid id, CancellationToken t);

    Task<IReadOnlyList<PickupAssignment>> PickupAssignmentsAsync(DateTimeOffset? from, DateTimeOffset? to, CancellationToken t);
    Task<IReadOnlyList<PackingJobCrew>> PackingCrewAsync(DateTimeOffset? from, DateTimeOffset? to, CancellationToken t);
    Task<IReadOnlyDictionary<Guid, int>> BoxesPerPackingJobAsync(CancellationToken t);
    Task<IReadOnlyDictionary<Guid, int>> BoxesPerPickupAsync(CancellationToken t);

    /// <summary>Every assignment with the window its job occupies, for double-booking checks.</summary>
    Task<IReadOnlyList<Booking>> BookingsAsync(CancellationToken t);
    /// <summary>The team an employee is currently in, if any - used to keep one crew per person.</summary>
    Task<Team?> CurrentTeamOfAsync(Guid employeeId, CancellationToken t);

    Task<bool> AnyTeamsAsync(CancellationToken t);
    Task<Designation?> AnyDesignationAsync(CancellationToken t);

    void Add(object entity);
    Task Save(CancellationToken t);
}
