using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Api.Contracts.Sales;
using Movers.Services.Sales;

namespace Movers.Api.Controllers;

[ApiController, AllowAnonymous, Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("customer-links"), Route("api/public/lead-uploads/{token}")]
public sealed class PublicLeadUploadsController(ILeadUploadService service) : ControllerBase
{
    [HttpPut("details")]
    public async Task<ActionResult> Details(string token, CustomerMoveDetails request, CancellationToken ct) {
        try { await service.SaveCustomerDetailsAsync(token, request.Items, request.Description, ct); return NoContent(); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
    }
    [HttpGet]
    public async Task<ActionResult> Info(string token, CancellationToken cancellationToken)
    { var result = await service.GetPublicInfoAsync(token, cancellationToken); return result is null ? NotFound(new { message = "This upload link is invalid or expired." }) : Ok(result); }

    /// <summary>The files received through this link, so the customer can see what arrived (e.g. on the laptop while uploading from a phone).</summary>
    [HttpGet("files")]
    public async Task<ActionResult> Files(string token, CancellationToken cancellationToken)
    { var result = await service.ListPublicFilesAsync(token, cancellationToken); return result is null ? NotFound(new { message = "This upload link is invalid or expired." }) : Ok(result); }

    [HttpPost("upload-requests")]
    public async Task<ActionResult> CreateUpload(string token, CreateUploadRequest request, CancellationToken cancellationToken)
    { try { return Ok(await service.CreateUploadAsync(token, request.ToModel(), cancellationToken)); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }

    [HttpPost("attachments/{attachmentId:guid}/complete")]
    public async Task<ActionResult> Complete(string token, Guid attachmentId, CancellationToken cancellationToken)
    { try { var result = await service.CompleteUploadAsync(token, attachmentId, cancellationToken); return result is null ? NotFound() : Ok(result); } catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); } }
}
