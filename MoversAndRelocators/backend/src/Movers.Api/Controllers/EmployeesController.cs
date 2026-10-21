using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Api.Contracts.Employees;
using Movers.Services.Employees;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/employees")]
public sealed class EmployeesController(IEmployeeService service) : ControllerBase
{
    [Authorize(Policy = SecurityPermissions.EmployeesView)]
    [HttpGet]
    public async Task<ActionResult> List(CancellationToken cancellationToken) =>
        Ok(await service.ListEmployeesAsync(cancellationToken));

    /// <summary>The register's advanced search: search, sort, desc, skip, take, isActive, designationId, managerId (reports to).</summary>
    [Authorize(Policy = SecurityPermissions.EmployeesView)]
    [HttpGet("search")]
    public async Task<ActionResult> Search([FromQuery] Movers.Services.Common.ListQuery query, [FromQuery] bool? isActive, [FromQuery] Guid? designationId, [FromQuery] Guid? managerId, CancellationToken cancellationToken) =>
        Ok(await service.SearchEmployeesAsync(new EmployeeListFilter(isActive, designationId, managerId), query, cancellationToken));

    [Authorize(Policy = SecurityPermissions.EmployeesView)]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await service.GetEmployeeAsync(id, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [Authorize(Policy = SecurityPermissions.EmployeesView)]
    [HttpGet("hierarchy")]
    public async Task<ActionResult> Hierarchy(CancellationToken cancellationToken) =>
        Ok(await service.GetHierarchyAsync(cancellationToken));

    [Authorize(Policy = SecurityPermissions.EmployeesManage)]
    [HttpPost]
    public async Task<ActionResult> Create(SaveEmployeeRequest request, CancellationToken cancellationToken)
    {
        try { return Ok(await service.CreateEmployeeAsync(request.ToCommand(), cancellationToken)); }
        catch (InvalidOperationException exception) { return BadRequest(new { message = exception.Message }); }
    }

    [Authorize(Policy = SecurityPermissions.EmployeesManage)]
    [HttpPut("{id:guid}")]
    public async Task<ActionResult> Update(Guid id, SaveEmployeeRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await service.UpdateEmployeeAsync(id, request.ToCommand(), cancellationToken);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException exception) { return BadRequest(new { message = exception.Message }); }
    }

    [Authorize(Policy = SecurityPermissions.EmployeesManage)]
    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult> Status(Guid id, SetRecordStatusRequest request, CancellationToken cancellationToken)
    {
        var result = await service.SetEmployeeStatusAsync(id, request.IsActive, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }
}
