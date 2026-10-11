using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Security;
using Movers.Services.Tenants;
using Movers.Services.Tenancy;

namespace Movers.Api.Controllers;

public sealed record SaveCompanyRequest(
    [Required, StringLength(20)] string Code,
    [Required, StringLength(160, MinimumLength = 2)] string Name,
    [StringLength(200)] string? LegalName,
    [StringLength(40)] string? TaxNumber,
    [StringLength(500)] string? Address,
    [StringLength(40)] string? Phone,
    [EmailAddress, StringLength(254)] string? Email,
    [StringLength(200)] string? Website,
    [StringLength(10)] string? NumberCode)
{
    public SaveCompanyCommand ToCommand() => new(Code, Name, LegalName, TaxNumber, Address, Phone, Email, Website, NumberCode);
}
public sealed record SetCompanyStatusRequest(bool IsActive);

/// <summary>Companies inside the tenant. Listing is open to every user (the company switcher); changes need
/// the Manage companies permission and a tenant-wide user (company users cannot manage other companies).</summary>
[ApiController, Authorize, Route("api/companies")]
public sealed class CompaniesController(CompanyService companies, ITenantContext tenant) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> List(CancellationToken t)
    {
        var all = await companies.ListAsync(t);
        return Ok(CompanyUser ? all.Where(x => x.Id == tenant.Company?.Id) : all);
    }

    [HttpGet("current")]
    public ActionResult Current() => tenant.Company is { } c
        ? Ok(new { c.Id, c.Code, c.Name, c.LegalName, c.TaxNumber, c.Address, c.Phone, c.Email, c.Website, c.NumberCode, c.IsDefault })
        : NotFound();

    [HttpPost, Authorize(Policy = SecurityPermissions.CompaniesManage)]
    public Task<ActionResult> Create(SaveCompanyRequest r, CancellationToken t) => Run(async () => Ok(await companies.CreateAsync(r.ToCommand(), t)));

    [HttpPut("{id:guid}"), Authorize(Policy = SecurityPermissions.CompaniesManage)]
    public Task<ActionResult> Update(Guid id, SaveCompanyRequest r, CancellationToken t) => Run(async () => await companies.UpdateAsync(id, r.ToCommand(), t) is { } x ? Ok(x) : NotFound());

    [HttpPatch("{id:guid}/status"), Authorize(Policy = SecurityPermissions.CompaniesManage)]
    public Task<ActionResult> SetStatus(Guid id, SetCompanyStatusRequest r, CancellationToken t) => Run(async () => await companies.SetActiveAsync(id, r.IsActive, t) is { } x ? Ok(x) : NotFound());

    [HttpPost("{id:guid}/default"), Authorize(Policy = SecurityPermissions.CompaniesManage)]
    public Task<ActionResult> SetDefault(Guid id, CancellationToken t) => Run(async () => await companies.SetDefaultAsync(id, t) is { } x ? Ok(x) : NotFound());

    private bool CompanyUser => User.FindFirst("company_scope")?.Value == "company";

    private async Task<ActionResult> Run(Func<Task<ActionResult>> action)
    {
        if (CompanyUser) return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only tenant users can manage companies." });
        try { return await action(); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
    }
}
