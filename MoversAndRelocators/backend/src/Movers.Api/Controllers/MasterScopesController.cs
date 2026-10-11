using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Tenants;

namespace Movers.Api.Controllers;

public sealed record SetMasterScopeRequest(bool CompanyOnly);

/// <summary>Marks a master record for the current company only, or shares it with every company of the tenant.</summary>
[ApiController, Authorize, Route("api/master-scopes/{kind}")]
public sealed class MasterScopesController(MasterScopeService scopes, IAuthorizationService authorization) : ControllerBase
{
    [HttpGet]
    public Task<ActionResult> Get(string kind, CancellationToken t) => Run(kind, async () => Ok(await scopes.GetAsync(kind, t)));

    [HttpPut("{key}")]
    public Task<ActionResult> Set(string kind, string key, SetMasterScopeRequest r, CancellationToken t) =>
        Run(kind, async () => await scopes.SetAsync(kind, key, r.CompanyOnly, t) ? NoContent() : NotFound());

    private async Task<ActionResult> Run(string kind, Func<Task<ActionResult>> action)
    {
        if (!MasterScopeService.Kinds.TryGetValue(kind, out var permission)) return NotFound();
        if (!(await authorization.AuthorizeAsync(User, null, permission)).Succeeded) return Forbid();
        try { return await action(); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
    }
}
