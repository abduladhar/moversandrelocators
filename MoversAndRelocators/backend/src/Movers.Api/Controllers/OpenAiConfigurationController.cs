using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Api.Contracts.Configuration;
using Movers.Services.OpenAi;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

[ApiController, Authorize(Policy = SecurityPermissions.OpenAiConfigurationManage), Route("api/settings/openai")]
public sealed class OpenAiConfigurationController(IOpenAiConfigurationService service, AiUsageService usage, IOpenAiConfigurationRepository configurations) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> Get(CancellationToken token)
    {
        var configuration = await service.GetAsync(token);
        return configuration is null ? NoContent() : Ok(configuration);
    }

    /// <summary>OpenAI usage and approximate cost: this month, all time and the latest runs.</summary>
    [HttpGet("usage")]
    public async Task<ActionResult> Usage(CancellationToken token)
    {
        var configuration = await configurations.GetAsync(false, token);
        return Ok(await usage.Summary(configuration is not null && AiPrices.Of(configuration).Configured, false, token));
    }

    [HttpPut]
    public async Task<ActionResult> Save(SaveOpenAiConfigurationRequest request, CancellationToken token)
    {
        try { return Ok(await service.SaveAsync(request.ToCommand(), token)); }
        catch (InvalidOperationException exception) { return BadRequest(new { message = exception.Message }); }
    }
}
