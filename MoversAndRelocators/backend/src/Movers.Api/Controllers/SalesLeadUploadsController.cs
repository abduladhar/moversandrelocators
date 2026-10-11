using Movers.Api.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Api.Contracts.Sales;
using Movers.Services.Sales;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

[ApiController, Authorize, Route("api/sales/leads/{leadId:guid}")]
public sealed class SalesLeadUploadsController(ILeadUploadService service, PublicLinks links, LeadExtractionService extraction) : ControllerBase
{
    [HttpGet("upload-links"), Authorize(Policy = SecurityPermissions.SalesView)]
    public async Task<ActionResult> Links(Guid leadId, CancellationToken token) => Ok(await service.ListLinksAsync(leadId, token));

    [HttpPost("upload-links"), Authorize(Policy = SecurityPermissions.SalesManage)]
    public async Task<ActionResult> Generate(Guid leadId, GenerateUploadLinkRequest request, CancellationToken token)
    {
        try
        {
            var generated = await service.GenerateLinkAsync(leadId, request.ValidDays, token, request.RequestedItems, request.Description);
            var baseUrl = links.BaseUrl;
            return Ok(new { generated.Link, url = $"{baseUrl}/upload/{Uri.EscapeDataString(generated.Token)}" });
        }
        catch (InvalidOperationException exception) { return BadRequest(new { message = exception.Message }); }
    }

    [HttpPatch("upload-links/{id:guid}/revoke"), Authorize(Policy = SecurityPermissions.SalesManage)]
    public async Task<ActionResult> Revoke(Guid leadId, Guid id, CancellationToken token)
    { var result = await service.RevokeLinkAsync(leadId, id, token); return result is null ? NotFound() : Ok(result); }

    [HttpGet("attachments"), Authorize(Policy = SecurityPermissions.SalesView)]
    public async Task<ActionResult> Attachments(Guid leadId, CancellationToken token) => Ok(await service.ListAttachmentsAsync(leadId, token));

    [HttpPost("attachments/{id:guid}/extract"), Authorize(Policy = SecurityPermissions.SalesExtract), RequestSizeLimit(18_000_000)]
    public async Task<ActionResult> Extract(Guid leadId, Guid id, ExtractAttachmentRequest request, CancellationToken ct) {
        try { return Ok(await extraction.Extract(leadId, id, request.Frames, ct)); }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
        catch (HttpRequestException) { return StatusCode(502, new { message = "OpenAI is unavailable. Try again later." }); }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested) { return StatusCode(504, new { message = "OpenAI timed out. Try again later." }); }
    }

    [HttpGet("attachments/{id:guid}/download"), Authorize(Policy = SecurityPermissions.SalesView)]
    public async Task<ActionResult> Download(Guid leadId, Guid id, CancellationToken token)
    { var url = await service.CreateDownloadUrlAsync(leadId, id, token); return url is null ? NotFound() : Ok(new { url }); }
}
