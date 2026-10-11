using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Movers.Api.Contracts.Sales;
using Movers.Api.Contracts.Surveys;
using Movers.Services.Surveys;

namespace Movers.Api.Controllers;

[ApiController, AllowAnonymous, EnableRateLimiting("customer-links"), Route("api/public/surveys/{token}")]
public sealed class PublicSurveysController(ISurveyService service, ISurveyFileService files) : ControllerBase
{
    [HttpGet] public async Task<ActionResult> Get(string token, CancellationToken t) { var x = await service.GetPublicAsync(token, t); return x is null ? NotFound(new { message = "This confirmation link is invalid or expired." }) : Ok(x); }
    [HttpPost("confirm-schedule")] public async Task<ActionResult> ConfirmSchedule(string token, ConfirmSurveyScheduleRequest r, CancellationToken t) { try { var x = await service.ConfirmScheduleAsync(token, r.ToCommand(), t); return x is null ? NotFound() : Ok(x); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    [HttpPost("confirm-items")] public async Task<ActionResult> ConfirmItems(string token, ConfirmSurveyItemsRequest r, CancellationToken t) { var x = await service.ConfirmItemsAsync(token, r.Notes, t); return x is null ? NotFound() : Ok(x); }
    [HttpGet("catalog")] public async Task<ActionResult> Catalog(string token, CancellationToken t) { var x = await service.GetPublicCatalogAsync(token, t); return x is null ? NotFound() : Ok(x); }
    [HttpPost("changes")] public async Task<ActionResult> Changes(string token, SubmitCustomerChangesRequest r, CancellationToken t) { try { var x = await service.SubmitCustomerChangesAsync(token, r.ToCommand(), t); return x is null ? NotFound() : Ok(x); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    [HttpGet("attachments")] public async Task<ActionResult> Attachments(string token, CancellationToken t) { var x = await files.ListPublicAsync(token, t); return x is null ? NotFound() : Ok(x); }
    [HttpPost("upload-requests")] public async Task<ActionResult> CreateUpload(string token, CreateUploadRequest r, CancellationToken t) { try { var x = await files.CreatePublicUploadAsync(token, r.ToModel(), t); return x is null ? NotFound() : Ok(x); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    [HttpPost("attachments/{attachmentId:guid}/complete")] public async Task<ActionResult> Complete(string token, Guid attachmentId, CancellationToken t) { try { var x = await files.CompletePublicUploadAsync(token, attachmentId, t); return x is null ? NotFound() : Ok(x); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
}
