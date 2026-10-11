using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Employees;
using Movers.Domain.Packing;
using Movers.Domain.Pickups;
using Movers.Services.Crew;
using Movers.Services.Security;
using Movers.Services.Tenancy;

namespace Movers.DAL.Crew;

/// <summary>Teams, their membership history, and the work each team and employee is on record for.</summary>
public sealed class CrewRepository(MoversDbContext db, ITenantContext tenant, IUserContext user, TimeProvider clock) : ICrewRepository
{
    private string Actor() => string.IsNullOrWhiteSpace(user.Email) ? "Staff" : user.Email;

    public async Task<IReadOnlyList<Team>> TeamsAsync(bool includeInactive, CancellationToken t) =>
        await db.Teams.AsNoTracking().Where(x => includeInactive || x.IsActive).OrderBy(x => x.Name).ToListAsync(t);

    public Task<Team?> TeamAsync(Guid id, bool track, CancellationToken t) =>
        (track ? db.Teams : db.Teams.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, t);

    public Task<bool> CodeExistsAsync(string code, Guid? excludingId, CancellationToken t) =>
        db.Teams.AnyAsync(x => x.Code == code && (!excludingId.HasValue || x.Id != excludingId), t);

    public async Task<IReadOnlyList<TeamMembership>> MembershipsAsync(Guid teamId, CancellationToken t) =>
        await db.TeamMemberships.AsNoTracking().Where(x => x.TeamId == teamId).OrderBy(x => x.JoinedAtUtc).ToListAsync(t);

    public async Task<IReadOnlyList<TeamMembership>> AllMembershipsAsync(CancellationToken t) =>
        await db.TeamMemberships.AsNoTracking().ToListAsync(t);

    public Task<TeamMembership?> CurrentMembershipAsync(Guid teamId, Guid employeeId, CancellationToken t) =>
        db.TeamMemberships.SingleOrDefaultAsync(x => x.TeamId == teamId && x.EmployeeId == employeeId && x.LeftAtUtc == null, t);

    public async Task<IReadOnlyList<TeamMembership>> OpenMembershipsForEmployeeAsync(Guid employeeId, CancellationToken t) =>
        await db.TeamMemberships.Where(x => x.EmployeeId == employeeId && x.LeftAtUtc == null).ToListAsync(t);

    public async Task<IReadOnlyList<Employee>> EmployeesAsync(CancellationToken t) =>
        await db.Employees.AsNoTracking().OrderBy(x => x.FirstName).ToListAsync(t);

    public Task<Employee?> EmployeeAsync(Guid id, CancellationToken t) => db.Employees.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, t);

    public async Task<IReadOnlyList<PickupAssignment>> PickupAssignmentsAsync(DateTimeOffset? from, DateTimeOffset? to, CancellationToken t) =>
        await db.PickupAssignments.AsNoTracking()
            .Where(x => (from == null || x.AssignedAtUtc >= from) && (to == null || x.AssignedAtUtc <= to)).ToListAsync(t);

    public async Task<IReadOnlyList<PackingJobCrew>> PackingCrewAsync(DateTimeOffset? from, DateTimeOffset? to, CancellationToken t) =>
        await db.Set<PackingJobCrew>().AsNoTracking()
            .Where(x => (from == null || x.AssignedAtUtc >= from) && (to == null || x.AssignedAtUtc <= to)).ToListAsync(t);

    /// <summary>Boxes per packing job, so a team's output is measured in work done rather than jobs opened.</summary>
    public async Task<IReadOnlyDictionary<Guid, int>> BoxesPerPackingJobAsync(CancellationToken t) =>
        await db.Set<PackingJobBox>().AsNoTracking().GroupBy(x => x.PackingJobId)
            .Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, t);

    public async Task<IReadOnlyDictionary<Guid, int>> BoxesPerPickupAsync(CancellationToken t) =>
        await db.PickupPackages.AsNoTracking().GroupBy(x => x.PickupId)
            .Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, t);

    public async Task<IReadOnlyList<Booking>> BookingsAsync(CancellationToken t)
    {
        var packing = await (from c in db.Set<PackingJobCrew>().AsNoTracking()
                             join j in db.Set<PackingJob>().AsNoTracking() on c.PackingJobId equals j.Id
                             where j.Status != PackingJobStatuses.Cancelled
                             select new { c.EmployeeId, j.Id, j.JobNumber, j.ScheduledAtUtc, j.DurationMinutes }).ToListAsync(t);
        var pickups = await (from a in db.PickupAssignments.AsNoTracking()
                             join p in db.Pickups.AsNoTracking() on a.PickupId equals p.Id
                             select new { a.EmployeeId, p.Id, p.PickupNumber, p.ScheduledAtUtc, p.DurationMinutes }).ToListAsync(t);
        var deliveries = await (from c in db.Set<Movers.Domain.Delivery.DeliveryJobCrew>().AsNoTracking()
                                join j in db.Set<Movers.Domain.Delivery.DeliveryJob>().AsNoTracking() on c.DeliveryJobId equals j.Id
                                where j.Status != Movers.Domain.Delivery.DeliveryStatuses.Cancelled
                                select new { c.EmployeeId, j.Id, j.DeliveryNumber, j.ScheduledAtUtc, j.DurationMinutes }).ToListAsync(t);
        // The driver is booked for the run too, even when not also listed as crew.
        deliveries.AddRange(await db.Set<Movers.Domain.Delivery.DeliveryJob>().AsNoTracking()
            .Where(j => j.DriverEmployeeId != null && j.Status != Movers.Domain.Delivery.DeliveryStatuses.Cancelled)
            .Select(j => new { EmployeeId = j.DriverEmployeeId!.Value, j.Id, j.DeliveryNumber, j.ScheduledAtUtc, j.DurationMinutes }).ToListAsync(t));
        return packing.Select(x => new Booking(x.EmployeeId, "PACKING", x.Id, x.JobNumber, x.ScheduledAtUtc, x.ScheduledAtUtc.AddMinutes(x.DurationMinutes)))
            .Concat(pickups.Select(x => new Booking(x.EmployeeId, "PICKUP", x.Id, x.PickupNumber, x.ScheduledAtUtc, x.ScheduledAtUtc.AddMinutes(x.DurationMinutes))))
            .Concat(deliveries.DistinctBy(x => (x.EmployeeId, x.Id)).Select(x => new Booking(x.EmployeeId, "DELIVERY", x.Id, x.DeliveryNumber, x.ScheduledAtUtc, x.ScheduledAtUtc.AddMinutes(x.DurationMinutes))))
            .ToList();
    }

    public async Task<Team?> CurrentTeamOfAsync(Guid employeeId, CancellationToken t)
    {
        var membership = await db.TeamMemberships.AsNoTracking()
            .Where(x => x.EmployeeId == employeeId && x.LeftAtUtc == null)
            .OrderByDescending(x => x.JoinedAtUtc).FirstOrDefaultAsync(t);
        return membership is null ? null : await db.Teams.AsNoTracking().SingleOrDefaultAsync(x => x.Id == membership.TeamId, t);
    }

    public Task<bool> AnyTeamsAsync(CancellationToken t) => db.Teams.AnyAsync(t);
    public Task<Designation?> AnyDesignationAsync(CancellationToken t) => db.Designations.AsNoTracking().FirstOrDefaultAsync(t);

    public void Add(object entity) => db.Add(entity);
    public Task Save(CancellationToken t) => db.SaveChangesAsync(t);
}
