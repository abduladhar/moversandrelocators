using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Movers.Api.Contracts.Tenants;
using Movers.Services.Security;
using Movers.Services.Tenants;

namespace Movers.Api.Controllers;

[ApiController]
[Authorize(Roles = RoleCodes.SystemAdmin)]
[Route("api/platform/tenants")]
public sealed class PlatformTenantsController(ITenantService tenantService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TenantResponse>>> List(CancellationToken cancellationToken)
    {
        var tenants = await tenantService.ListAsync(cancellationToken);
        return Ok(tenants.Select(TenantResponse.From).ToList());
    }

    /// <summary>The register's advanced search: search, sort, desc, skip, take, isActive. Summary: total, active, inactive.</summary>
    [HttpGet("search")]
    public async Task<ActionResult> Search([FromQuery] Movers.Services.Common.ListQuery query, [FromQuery] bool? isActive, CancellationToken cancellationToken)
    {
        var page = await tenantService.SearchAsync(new TenantListFilter(isActive), query, cancellationToken);
        return Ok(new Movers.Services.Common.PagedResult<TenantResponse>(page.Items.Select(TenantResponse.From).ToList(), page.Total, page.Summary));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TenantResponse>> Get(Guid id, CancellationToken cancellationToken)
    {
        var tenant = await tenantService.GetAsync(id, cancellationToken);
        return tenant is null ? NotFound() : Ok(TenantResponse.From(tenant));
    }

    [HttpPost]
    public async Task<ActionResult<TenantResponse>> Create(SaveTenantRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var tenant = await tenantService.CreateAsync(ToCommand(request), cancellationToken);
            var response = TenantResponse.From(tenant);
            return CreatedAtAction(nameof(Get), new { id = tenant.Id }, response);
        }
        catch (DuplicateTenantSlugException)
        {
            return DuplicateSlugProblem();
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TenantResponse>> Update(Guid id, SaveTenantRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var tenant = await tenantService.UpdateAsync(id, ToCommand(request), cancellationToken);
            return tenant is null ? NotFound() : Ok(TenantResponse.From(tenant));
        }
        catch (DuplicateTenantSlugException)
        {
            return DuplicateSlugProblem();
        }
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<TenantResponse>> SetStatus(Guid id, SetTenantStatusRequest request, CancellationToken cancellationToken)
    {
        var tenant = await tenantService.SetStatusAsync(id, request.IsActive, cancellationToken);
        return tenant is null ? NotFound() : Ok(TenantResponse.From(tenant));
    }

    private static SaveTenantCommand ToCommand(SaveTenantRequest request) =>
        new(request.Name, request.Slug, request.ContactEmail, request.Phone, request.Address);

    private ActionResult<TenantResponse> DuplicateSlugProblem()
    {
        // A message of its own (code), so the client can say exactly what is wrong in the user's language.
        return BadRequest(new { message = "This tenant slug is already in use." });
    }
}
