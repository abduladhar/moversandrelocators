using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Movers.Api.Contracts.Tenants;
using Movers.Services.Tenants;

namespace Movers.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/tenant/current")]
public sealed class CurrentTenantController(ITenantService tenantService) : ControllerBase
{
    [HttpGet]
    public ActionResult<TenantResponse> Get()
    {
        return Ok(TenantResponse.From(tenantService.GetCurrent()));
    }
}
