using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Api.Contracts.Configuration;
using Movers.Services.Aws;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

[ApiController, Authorize(Policy = SecurityPermissions.AwsConfigurationManage), Route("api/settings/aws")]
public sealed class AwsConfigurationController(IAwsConfigurationService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> Get(CancellationToken token)
    {
        var configuration = await service.GetAsync(token);
        return configuration is null ? NoContent() : Ok(configuration);
    }

    [HttpPut]
    public async Task<ActionResult> Save(SaveAwsConfigurationRequest request, CancellationToken token)
    {
        try { return Ok(await service.SaveAsync(request.ToCommand(), token)); }
        catch (InvalidOperationException exception) { return BadRequest(new { message = exception.Message }); }
    }
}
