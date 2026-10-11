using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Api.Contracts.Surveys;
using Movers.Services.Security;
using Movers.Services.Surveys;

namespace Movers.Api.Controllers;

[ApiController, Authorize(Policy = SecurityPermissions.SurveysManage), Route("api/surveys/masters")]
public sealed class SurveyMastersController(ISurveyService service) : ControllerBase
{
    [HttpGet("items")] public async Task<ActionResult> Items(CancellationToken t) => Ok(await service.ListItemsAsync(t));
    [HttpPost("items")] public async Task<ActionResult> CreateItem(SaveHouseholdItemRequest r, CancellationToken t) => await Run(() => service.CreateItemAsync(r.ToCommand(), t));
    [HttpPut("items/{id:guid}")] public async Task<ActionResult> UpdateItem(Guid id, SaveHouseholdItemRequest r, CancellationToken t) => await RunNullable(() => service.UpdateItemAsync(id, r.ToCommand(), t));
    [HttpPatch("items/{id:guid}/status")] public async Task<ActionResult> ItemStatus(Guid id, SetSurveyMasterStatusRequest r, CancellationToken t) => await RunNullable(() => service.SetItemActiveAsync(id, r.IsActive, t));
    [HttpGet("materials")] public async Task<ActionResult> Materials(CancellationToken t) => Ok(await service.ListMaterialsAsync(t));
    [HttpPost("materials")] public async Task<ActionResult> CreateMaterial(SaveMaterialRequest r, CancellationToken t) => await Run(() => service.CreateMaterialAsync(r.ToCommand(), t));
    [HttpPut("materials/{id:guid}")] public async Task<ActionResult> UpdateMaterial(Guid id, SaveMaterialRequest r, CancellationToken t) => await RunNullable(() => service.UpdateMaterialAsync(id, r.ToCommand(), t));
    [HttpPatch("materials/{id:guid}/status")] public async Task<ActionResult> MaterialStatus(Guid id, SetSurveyMasterStatusRequest r, CancellationToken t) => await RunNullable(() => service.SetMaterialActiveAsync(id, r.IsActive, t));
    [HttpGet("box-types")] public async Task<ActionResult> Boxes(CancellationToken t) => Ok(await service.ListBoxTypesAsync(t));
    [HttpPost("box-types")] public async Task<ActionResult> CreateBox(SaveBoxTypeRequest r, CancellationToken t) => await Run(() => service.CreateBoxTypeAsync(r.ToCommand(), t));
    [HttpPut("box-types/{id:guid}")] public async Task<ActionResult> UpdateBox(Guid id, SaveBoxTypeRequest r, CancellationToken t) => await RunNullable(() => service.UpdateBoxTypeAsync(id, r.ToCommand(), t));
    [HttpPatch("box-types/{id:guid}/status")] public async Task<ActionResult> BoxStatus(Guid id, SetSurveyMasterStatusRequest r, CancellationToken t) => await RunNullable(() => service.SetBoxTypeActiveAsync(id, r.IsActive, t));
    private async Task<ActionResult> Run<T>(Func<Task<T>> action) { try { return Ok(await action()); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    private async Task<ActionResult> RunNullable<T>(Func<Task<T?>> action) where T : class { try { var x = await action(); return x is null ? NotFound() : Ok(x); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
}
