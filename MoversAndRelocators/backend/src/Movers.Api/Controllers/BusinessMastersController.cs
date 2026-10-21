using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Masters;
using Movers.Services.Security;
namespace Movers.Api.Controllers;
[ApiController, Authorize, Route("api/business-masters/{kind}")]
public sealed class BusinessMastersController(BusinessMasterService service, IAuthorizationService authorization) : ControllerBase {
 [HttpGet, Authorize(Policy = SecurityPermissions.OperationsManage)] public Task<ActionResult> List(string kind, CancellationToken ct) => Run(() => service.List(kind, ct));
 [HttpGet("search"), Authorize(Policy = SecurityPermissions.OperationsManage)] public Task<ActionResult> Search(string kind, [FromQuery] Movers.Services.Common.ListQuery query, [FromQuery] bool? active, CancellationToken ct) => Run(() => service.Search(kind, active, query, ct));
 [HttpPost, Authorize(Policy = SecurityPermissions.OperationsManage)] public Task<ActionResult> Create(string kind, MasterInput input, CancellationToken ct) => Run(() => service.Save(kind, null, input, ct));
 [HttpPut("{code}"), Authorize(Policy = SecurityPermissions.OperationsManage)] public Task<ActionResult> Update(string kind, string code, MasterInput input, CancellationToken ct) => Run(() => service.Save(kind, code, input, ct));
 [HttpGet("choices")] public async Task<ActionResult> Choices(string kind, CancellationToken ct) {
   var policies = kind switch {
     "customer" => new[] { SecurityPermissions.OperationsManage, SecurityPermissions.SalesManage, SecurityPermissions.SurveysManage, SecurityPermissions.QuotesManage },
     "vendor" => new[] { SecurityPermissions.OperationsManage, SecurityPermissions.AccountingManage },
     _ => Array.Empty<string>()
   };
   if (policies.Length == 0) return NotFound();
   foreach (var policy in policies)
     if ((await authorization.AuthorizeAsync(User, null, policy)).Succeeded)
       return await Run(async () => (await service.List(kind, ct)).Where(x => x.IsActive).ToArray());
   return Forbid();
 }
 [HttpPost("quick-create")] public async Task<ActionResult> QuickCreate(string kind, MasterInput input, CancellationToken ct) {
   if (kind != "customer") return NotFound();
   foreach (var policy in new[] { SecurityPermissions.OperationsManage, SecurityPermissions.SalesManage, SecurityPermissions.QuotesManage })
     if ((await authorization.AuthorizeAsync(User, null, policy)).Succeeded)
       return await Run(() => service.Save("customer", null, input with { IsActive = true }, ct));
   return Forbid();
 }
 private async Task<ActionResult> Run<T>(Func<Task<T>> action) { try { return Ok(await action()); } catch (KeyNotFoundException) { return NotFound(); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
}

