using System.Text.Json;
using Movers.Services.Aws;
using Movers.Services.OpenAi;
using Movers.Services.Security;
namespace Movers.Services.Sales;

public sealed record ExtractedMoveItem(string Name, int Quantity, string Notes);
public sealed record ExtractionResult(IReadOnlyList<ExtractedMoveItem> Items);
public interface IInventoryVisionGateway
{
    Task<string> Extract(string apiKey, string model, IReadOnlyList<string> images, CancellationToken ct);
}
public sealed class LeadExtractionService(ILeadUploadRepository repository, ILeadUploadService uploads,
    IOpenAiConfigurationRepository configuration, ISecretProtector protector, IAwsObjectStorage storage,
    IInventoryVisionGateway gateway, IUserContext user)
{
    public async Task<ExtractionResult> Extract(Guid leadId, Guid attachmentId, IReadOnlyList<string>? frames, CancellationToken ct)
    {
        if (!user.IsAuthenticated || !user.HasPermission(SecurityPermissions.SalesExtract))
            throw new UnauthorizedAccessException("Item extraction permission is required.");
        var attachment = await repository.GetAttachmentAsync(attachmentId, true, ct);
        if (attachment is null || attachment.SalesLeadId != leadId || !attachment.IsUploaded)
            throw new KeyNotFoundException("Uploaded attachment not found.");
        var isVideo = attachment.ContentType.StartsWith("video/", StringComparison.OrdinalIgnoreCase);
        var isImage = attachment.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);
        if (!isVideo && !isImage) throw new InvalidOperationException("Select an image or video.");
        var config = await configuration.GetAsync(false, ct)
            ?? throw new InvalidOperationException("Configure this tenant's OpenAI API key and extraction model first.");
        var images = new List<string>();
        if (isImage && storage.RequiresTenantCredentials)
        {
            if (!new[] { "image/jpeg", "image/png", "image/webp", "image/gif" }.Contains(attachment.ContentType.ToLowerInvariant()))
                throw new InvalidOperationException("Convert this image to JPEG, PNG or WEBP before extraction.");
            var url = await uploads.CreateDownloadUrlAsync(leadId, attachmentId, ct);
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != "https")
                throw new InvalidOperationException("A secure S3 download link is required.");
            images.Add(url!);
        }
        else
        {
            if (frames is null || frames.Count < 1 || frames.Count > (isVideo ? 6 : 1))
                throw new InvalidOperationException("Provide up to six video frames, or one local image.");
            foreach (var frame in frames)
            {
                if (frame is null || !frame.StartsWith("data:image/jpeg;base64,", StringComparison.Ordinal) || frame.Length > 2_800_000)
                    throw new InvalidOperationException("Each preview must be a JPEG smaller than 2 MB.");
                byte[] bytes;
                try { bytes = Convert.FromBase64String(frame[23..]); }
                catch (FormatException) { throw new InvalidOperationException("Invalid JPEG preview."); }
                if (bytes.Length < 3 || bytes[0] != 0xff || bytes[1] != 0xd8 || bytes[2] != 0xff)
                    throw new InvalidOperationException("Invalid JPEG preview.");
                images.Add(frame);
            }
        }
        var key = protector.Unprotect(config.EncryptedApiKey, $"openai-api:{config.TenantId}");
        var json = await gateway.Extract(key, config.ExtractionModel, images, ct);
        ExtractionResult result;
        try { result = JsonSerializer.Deserialize<ExtractionResult>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!; }
        catch (JsonException) { throw new InvalidOperationException("OpenAI returned an unreadable result. Please retry."); }
        if (result?.Items is null || result.Items.Count > 200 ||
            result.Items.Any(x => x is null || string.IsNullOrWhiteSpace(x.Name) || x.Name.Length > 160 || x.Quantity < 1 || x.Quantity > 10000 || x.Notes is null || x.Notes.Length > 1000))
            throw new InvalidOperationException("OpenAI returned invalid items. Please retry.");
        attachment.SaveExtraction(JsonSerializer.Serialize(result));
        await repository.SaveChangesAsync(ct);
        return result;
    }
}
