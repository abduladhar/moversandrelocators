using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Operations;
using Movers.Services.Reporting;
namespace Movers.Api.Controllers;
[ApiController,Authorize,Route("api/report-v2")]
public sealed class ReportV2Controller(ReportTemplateV2Service templates,ReportDataService data,ReportBrandingService branding):ControllerBase {
 [HttpGet("types"),Authorize(Policy="reports.print")] public IActionResult Types()=>Ok(ReportTypesV2.All.Select(t=>new{t.Type,t.Label,t.Module}));
 [HttpGet("templates"),Authorize(Policy="reports.print")] public Task<IActionResult> Print(string type,CancellationToken ct)=>Run(()=>templates.List(type,true,ct));
 [HttpGet("templates/manage"),Authorize(Policy="reports.design")] public Task<IActionResult> Manage(string? type,CancellationToken ct)=>Run(()=>templates.List(type,false,ct));
 [HttpGet("templates/{id:guid}"),Authorize(Policy="reports.print")] public Task<IActionResult> Get(Guid id,CancellationToken ct)=>Run(()=>templates.Get(id,ct));
 [HttpGet("templates/{id:guid}/history"),Authorize(Policy="reports.design")] public Task<IActionResult> History(Guid id,CancellationToken ct)=>Run(()=>templates.History(id,ct));
 [HttpPost("templates"),Authorize(Policy="reports.design")] public Task<IActionResult> Create(SaveReportTemplateV2 c,CancellationToken ct)=>Run(()=>templates.Save(null,c,ct));
 [HttpPut("templates/{id:guid}"),Authorize(Policy="reports.design")] public Task<IActionResult> Save(Guid id,SaveReportTemplateV2 c,CancellationToken ct)=>Run(()=>templates.Save(id,c,ct));
 [HttpPost("templates/{id:guid}/duplicate"),Authorize(Policy="reports.design")] public Task<IActionResult> Duplicate(Guid id,CancellationToken ct)=>Run(()=>templates.Duplicate(id,ct));
 [HttpPut("templates/{id:guid}/flags"),Authorize(Policy="reports.publish")] public Task<IActionResult> Flags(Guid id,ReportTemplateV2Flags c,CancellationToken ct)=>Run(()=>templates.SetFlags(id,c,ct));
 [HttpDelete("templates/{id:guid}"),Authorize(Policy="reports.design")] public Task<IActionResult> Delete(Guid id,CancellationToken ct)=>Run(()=>templates.Delete(id,ct));
 /// <summary>Data record for one document. Query values (filters, transactionId, packageIds…) pass straight to the type's builder.</summary>
 [HttpGet("data/{type}"),Authorize(Policy="reports.print")] public Task<IActionResult> Data(string type,Guid? id,CancellationToken ct)=>Run(()=>data.Data(type,id,Query(),ct));
 /// <summary>Tenant letterhead (logo, address, contacts, footer note) applied to every report.</summary>
 [HttpGet("branding"),Authorize(Policy="reports.print")] public Task<IActionResult> Branding(CancellationToken ct)=>Run(()=>branding.Get(ct));
 [HttpPut("branding"),Authorize(Policy="reports.design")] public Task<IActionResult> SaveBranding(SaveReportBranding c,CancellationToken ct)=>Run(()=>branding.Save(c,ct));
 [HttpGet("sample/{type}"),Authorize(Policy="reports.design")] public Task<IActionResult> Sample(string type,CancellationToken ct)=>Run(()=>data.Sample(type,ct));
 private Dictionary<string,string> Query()=>Request.Query.Where(x=>x.Key!="id").ToDictionary(x=>x.Key,x=>x.Value.ToString());
 private async Task<IActionResult> Run<T>(Func<Task<T>> action) {
  try{return Ok(await action());}
  catch(KeyNotFoundException){return NotFound();}
  catch(UnauthorizedAccessException){return Forbid();}
  catch(OperationConflictException e){return Conflict(new{message=e.Message});}
  catch(InvalidOperationException e){return BadRequest(new{message=e.Message});}
 }
}
