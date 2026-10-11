using System.ComponentModel.DataAnnotations;
using Movers.Services.Sales;

namespace Movers.Api.Contracts.Sales;

public sealed record GenerateUploadLinkRequest([Range(5, 30)] int ValidDays = 5, [StringLength(4000)] string? RequestedItems = null, [StringLength(4000)] string? Description = null);
public sealed record CustomerMoveDetails([StringLength(4000)] string? Items, [StringLength(4000)] string? Description);
/// <param name="Frames">JPEG data URLs: one for a local image, up to 20 stills for a video.</param>
/// <param name="Audio">The video's sound as a WAV data URL (optional), transcribed and used with the pictures.</param>
public sealed record ExtractAttachmentRequest(IReadOnlyList<string>? Frames, string? Audio = null);
public sealed record CreateUploadRequest([Required, StringLength(255)] string FileName,
    [Required, StringLength(150)] string ContentType, [Range(1, 524288000)] long SizeBytes)
{ public UploadRequestModel ToModel() => new(FileName, ContentType, SizeBytes); }
