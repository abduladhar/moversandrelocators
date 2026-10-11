using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Crew;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

public sealed record SaveTeamRequest([Required, StringLength(40)] string Code, [Required, StringLength(160)] string Name, [Required, StringLength(20)] string Kind, Guid? LeaderEmployeeId, [StringLength(1000)] string? Notes)
{ public SaveTeamCommand Command() => new(Code, Name, Kind, LeaderEmployeeId, Notes); }
public sealed record AddMemberRequest(Guid EmployeeId, [Required, StringLength(60)] string Role, DateTimeOffset? JoinedAt) { public AddMemberCommand Command() => new(EmployeeId, Role, JoinedAt); }
public sealed record RemoveMemberRequest(DateTimeOffset? LeftAt, [StringLength(500)] string? Reason) { public RemoveMemberCommand Command() => new(LeftAt, Reason); }
public sealed record MoveMemberRequest(Guid EmployeeId, Guid ToTeamId, [StringLength(60)] string? Role, DateTimeOffset? At, [StringLength(500)] string? Reason)
{ public MoveMemberCommand Command() => new(EmployeeId, ToTeamId, Role ?? "", At, Reason); }

/// <summary>Crew management: teams, who is in them over time, and what each team and person is on record for.</summary>
[ApiController, Authorize(Policy = SecurityPermissions.EmployeesView), Route("api/crew")]
public sealed class CrewController(ICrewService crew, IWebHostEnvironment environment) : ControllerBase
{
    [HttpGet("teams")] public async Task<ActionResult> Teams([FromQuery] bool includeInactive, CancellationToken t) => Ok(await crew.TeamsAsync(includeInactive, t));

    [HttpGet("teams/{id:guid}")] public async Task<ActionResult> Team(Guid id, CancellationToken t) { var x = await crew.TeamAsync(id, t); return x is null ? NotFound() : Ok(x); }

    [HttpGet("performance")] public async Task<ActionResult> Performance([FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, CancellationToken t) => Ok(await crew.PerformanceAsync(from, to, t));

    [HttpPost("teams"), Authorize(Policy = SecurityPermissions.EmployeesManage)]
    public async Task<ActionResult> Create(SaveTeamRequest r, CancellationToken t) { try { return Ok(await crew.CreateAsync(r.Command(), t)); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }

    [HttpPut("teams/{id:guid}"), Authorize(Policy = SecurityPermissions.EmployeesManage)]
    public Task<ActionResult> Update(Guid id, SaveTeamRequest r, CancellationToken t) => Run(() => crew.UpdateAsync(id, r.Command(), t));

    [HttpPut("teams/{id:guid}/active"), Authorize(Policy = SecurityPermissions.EmployeesManage)]
    public Task<ActionResult> SetActive(Guid id, [FromQuery] bool active, CancellationToken t) => Run(() => crew.SetActiveAsync(id, active, t));

    [HttpPost("teams/{id:guid}/members"), Authorize(Policy = SecurityPermissions.EmployeesManage)]
    public Task<ActionResult> AddMember(Guid id, AddMemberRequest r, CancellationToken t) => Run(() => crew.AddMemberAsync(id, r.Command(), t));

    [HttpDelete("teams/{id:guid}/members/{employeeId:guid}"), Authorize(Policy = SecurityPermissions.EmployeesManage)]
    public Task<ActionResult> RemoveMember(Guid id, Guid employeeId, [FromBody] RemoveMemberRequest? r, CancellationToken t) => Run(() => crew.RemoveMemberAsync(id, employeeId, (r ?? new(null, null)).Command(), t));

    [HttpPost("teams/{id:guid}/members/move"), Authorize(Policy = SecurityPermissions.EmployeesManage)]
    public Task<ActionResult> MoveMember(Guid id, MoveMemberRequest r, CancellationToken t) => Run(() => crew.MoveMemberAsync(id, r.Command(), t));

    /// <summary>Fake employees and teams for trying the app; only available in Development so real tenants never get them.</summary>
    [HttpPost("demo-data"), Authorize(Policy = SecurityPermissions.EmployeesManage)]
    public async Task<ActionResult> SeedDemo(CancellationToken t)
    { if (!environment.IsDevelopment()) return NotFound(); try { return Ok(new { created = await crew.SeedDemoAsync(t) }); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }

    private async Task<ActionResult> Run(Func<Task<TeamModel?>> action)
    {
        try { var x = await action(); return x is null ? NotFound() : Ok(x); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
    }
}
