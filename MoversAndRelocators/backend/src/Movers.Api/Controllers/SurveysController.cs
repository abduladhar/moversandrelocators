using Movers.Api.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Movers.Api.Contracts.Sales;
using Movers.Api.Contracts.Surveys;
using Movers.Services.Security;
using Movers.Services.Surveys;

namespace Movers.Api.Controllers;

[ApiController, Authorize(Policy = SecurityPermissions.SurveysManage), Route("api/surveys")]
public sealed class SurveysController(ISurveyService service, ISurveyFileService files, ISurveyTripService trips, PublicLinks links) : ControllerBase
{
    [HttpGet] public async Task<ActionResult> List(CancellationToken t) => Ok(await service.ListSurveysAsync(t));
    [HttpGet("{id:guid}")] public async Task<ActionResult> Get(Guid id, CancellationToken t) { var x = await service.GetSurveyAsync(id, t); return x is null ? NotFound() : Ok(x); }
    [HttpPost] public async Task<ActionResult> Create(SaveSurveyRequest r, CancellationToken t) => await Run(() => service.CreateSurveyAsync(r.ToCommand(), t));
    [HttpPut("{id:guid}")] public async Task<ActionResult> Update(Guid id, SaveSurveyRequest r, CancellationToken t) => await RunNullable(() => service.UpdateSurveyAsync(id, r.ToCommand(), t));
    [HttpPut("{id:guid}/details")] public async Task<ActionResult> Details(Guid id, SaveSurveyDetailsRequest r, CancellationToken t) => await RunNullable(() => service.SaveDetailsAsync(id, r.ToCommand(), t));
    [HttpPost("{id:guid}/confirmation-link")] public async Task<ActionResult> Link(Guid id, GenerateSurveyLinkRequest r, CancellationToken t)
    {
        try { var x = await service.GenerateConfirmationLinkAsync(id, r.ValidDays, t); var baseUrl = links.BaseUrl; return Ok(new { url = $"{baseUrl}/survey-confirm/{Uri.EscapeDataString(x.Token)}", x.ExpiresAtUtc }); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
    }
    [HttpPost("{id:guid}/start")] public async Task<ActionResult> Start(Guid id, [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] TripStepRequest? r, CancellationToken t) => await RunNullable(() => trips.StartAsync(id, (r ?? new(null, null)).ToCommand(), t));
    [HttpPost("{id:guid}/pause")] public async Task<ActionResult> Pause(Guid id, TripStepRequest r, CancellationToken t) => await RunNullable(() => trips.PauseAsync(id, r.ToCommand(), t));
    [HttpPost("{id:guid}/resume")] public async Task<ActionResult> Resume(Guid id, [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] TripStepRequest? r, CancellationToken t) => await RunNullable(() => trips.ResumeAsync(id, (r ?? new(null, null)).ToCommand(), t));
    [HttpPost("{id:guid}/complete")] public async Task<ActionResult> Complete(Guid id, CompleteSurveyRequest r, CancellationToken t) => await RunNullable(() => trips.CompleteAsync(id, r.ToCommand(), t));
    [HttpPut("{id:guid}/trip")] public async Task<ActionResult> UpdateTrip(Guid id, UpdateSurveyTripRequest r, CancellationToken t) => await RunNullable(() => trips.UpdateTripAsync(id, r.ToCommand(), t));
    [HttpPost("{id:guid}/expenses")] public async Task<ActionResult> AddExpense(Guid id, SaveSurveyExpenseRequest r, CancellationToken t) => await RunNullable(() => trips.AddExpenseAsync(id, r.ToCommand(), t));
    [HttpPut("{id:guid}/expenses/{expenseId:guid}")] public async Task<ActionResult> UpdateExpense(Guid id, Guid expenseId, SaveSurveyExpenseRequest r, CancellationToken t) => await RunNullable(() => trips.UpdateExpenseAsync(id, expenseId, r.ToCommand(), t));
    [HttpDelete("{id:guid}/expenses/{expenseId:guid}")] public async Task<ActionResult> DeleteExpense(Guid id, Guid expenseId, CancellationToken t) => await RunNullable(() => trips.DeleteExpenseAsync(id, expenseId, t));
    [HttpPost("{id:guid}/customer-changes/apply")] public async Task<ActionResult> ApplyCustomerChanges(Guid id, CancellationToken t) => await RunNullable(() => service.ApplyCustomerChangesAsync(id, t));
    [HttpPost("{id:guid}/customer-changes/dismiss")] public async Task<ActionResult> DismissCustomerChanges(Guid id, CancellationToken t) => await RunNullable(() => service.DismissCustomerChangesAsync(id, t));
    [HttpGet("{id:guid}/attachments")] public async Task<ActionResult> Attachments(Guid id, CancellationToken t) { var x = await files.ListAsync(id, t); return x is null ? NotFound() : Ok(x); }
    [HttpPost("{id:guid}/attachments/upload-requests")] public async Task<ActionResult> CreateUpload(Guid id, CreateUploadRequest r, CancellationToken t) => await RunNullable(() => files.CreateStaffUploadAsync(id, r.ToModel(), t));
    [HttpPost("{id:guid}/attachments/{attachmentId:guid}/complete")] public async Task<ActionResult> CompleteUpload(Guid id, Guid attachmentId, CancellationToken t) => await RunNullable(() => files.CompleteStaffUploadAsync(id, attachmentId, t));
    [HttpGet("{id:guid}/attachments/{attachmentId:guid}/download")] public async Task<ActionResult> Download(Guid id, Guid attachmentId, CancellationToken t) { try { var url = await files.CreateDownloadUrlAsync(id, attachmentId, t); return url is null ? NotFound() : Ok(new { url }); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    [HttpDelete("{id:guid}/attachments/{attachmentId:guid}")] public async Task<ActionResult> DeleteAttachment(Guid id, Guid attachmentId, CancellationToken t) => await files.DeleteAsync(id, attachmentId, t) ? NoContent() : NotFound();
    private async Task<ActionResult> Run<T>(Func<Task<T>> action) { try { return Ok(await action()); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
    private async Task<ActionResult> RunNullable<T>(Func<Task<T?>> action) where T : class { try { var x = await action(); return x is null ? NotFound() : Ok(x); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
}
