using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Api.Contracts.Employees;
using Movers.Services.Employees;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/designations")]
public sealed class DesignationsController(IEmployeeService service) : ControllerBase
{
    [Authorize(Policy = SecurityPermissions.EmployeesView)]
    [HttpGet]
    public async Task<ActionResult> List(CancellationToken cancellationToken) =>
        Ok(await service.ListDesignationsAsync(cancellationToken));

    [Authorize(Policy = SecurityPermissions.DesignationsManage)]
    [HttpPost]
    public async Task<ActionResult> Create(SaveDesignationRequest request, CancellationToken cancellationToken)
    {
        try { return Ok(await service.CreateDesignationAsync(request.ToCommand(), cancellationToken)); }
        catch (InvalidOperationException exception) { return BadRequest(new { message = exception.Message }); }
    }

    [Authorize(Policy = SecurityPermissions.DesignationsManage)]
    [HttpPut("{id:guid}")]
    public async Task<ActionResult> Update(Guid id, SaveDesignationRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await service.UpdateDesignationAsync(id, request.ToCommand(), cancellationToken);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException exception) { return BadRequest(new { message = exception.Message }); }
    }

    [Authorize(Policy = SecurityPermissions.DesignationsManage)]
    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult> Status(Guid id, SetRecordStatusRequest request, CancellationToken cancellationToken)
    {
        var result = await service.SetDesignationStatusAsync(id, request.IsActive, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }
}
