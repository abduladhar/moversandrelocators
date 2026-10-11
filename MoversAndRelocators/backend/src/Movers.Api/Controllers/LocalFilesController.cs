using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Movers.Api.Storage;
namespace Movers.Api.Controllers;

[ApiController, AllowAnonymous, EnableRateLimiting("customer-links"), Route("api/public/local-files")]
public sealed class LocalFilesController(LocalObjectStorage storage, IConfiguration configuration) : ControllerBase
{
    [HttpPut, RequestSizeLimit(LocalObjectStorage.MaximumBytes)]
    public async Task<IActionResult> Upload([FromQuery] string grant, CancellationToken ct)
    {
        if (!IsLocal) return NotFound();
        try
        {
            var permission = storage.Validate(grant, "PUT");
            await storage.Write(permission, Request.Body, ct);
            return NoContent();
        }
        catch (UnauthorizedAccessException) { return Unauthorized(); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
        catch (IOException) { return Conflict(new { message = "An upload is already present or storage is unavailable." }); }
    }
    [HttpGet]
    public IActionResult Download([FromQuery] string grant)
    {
        Response.Headers.CacheControl = "no-store"; Response.Headers["X-Content-Type-Options"] = "nosniff";
        if (!IsLocal) return NotFound();
        try
        {
            var permission = storage.Validate(grant, "GET");
            var path = storage.ObjectPath(permission.Key);
            return System.IO.File.Exists(path) ? PhysicalFile(path, "application/octet-stream", permission.FileName, enableRangeProcessing: true) : NotFound();
        }
        catch (UnauthorizedAccessException) { return Unauthorized(); }
    }
    private bool IsLocal => string.Equals(configuration["Storage:Provider"], "Local", StringComparison.OrdinalIgnoreCase);
}
