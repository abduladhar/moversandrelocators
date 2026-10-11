using System.Text.Json;
using Movers.Services.Aws;
using Movers.Services.OpenAi;
using Movers.Services.Packing;
using Movers.Services.Security;
namespace Movers.Services.Sales;

/// <param name="Room">Room the item is in, when it can be told from the video or narration.</param>
/// <param name="Fragile">Needs fragile packing (glass, mirrors, electronics…).</param>
/// <param name="Handling">Special handling such as dismantling, crating or a heavy lift; null when none.</param>
/// <param name="VolumeCbm">AI estimate of one unit's volume in cubic metres (the Household items master wins when the name matches).</param>
public sealed record ExtractedMoveItem(string Name, int Quantity, string Notes, string? Room = null, bool Fragile = false, string? Handling = null, decimal VolumeCbm = 0);
/// <summary>Boxes suggested to pack loose contents, using the tenant's box types.</summary>
public sealed record ExtractedBox(string BoxType, int Quantity, string Contents, string? Room = null);
/// <param name="Transcript">What was said in the video (speech-to-text), used together with the pictures.</param>
/// <param name="Warning">Set when part of the analysis was skipped (for example the sound could not be transcribed).</param>
/// <param name="Usage">Tokens/audio used and the approximate cost of this run.</param>
public sealed record ExtractionResult(IReadOnlyList<ExtractedMoveItem> Items, IReadOnlyList<ExtractedBox>? Boxes = null, string? Transcript = null, int FramesAnalysed = 0, string? Warning = null, Movers.Services.OpenAi.AiUsageModel? Usage = null);
/// <summary>OpenAI's answer and the tokens it used (input includes cached input).</summary>
public sealed record VisionResult(string Json, int InputTokens, int CachedInputTokens, int OutputTokens);
/// <summary>What OpenAI is given: picture URLs (S3 presigned links, or inline images for local storage), the narration and the box types.</summary>
public sealed record ExtractionInput(IReadOnlyList<string> Images, string? Transcript, IReadOnlyList<string> BoxTypes);

public interface IInventoryVisionGateway
{
    /// <summary>Returns the JSON inventory (items and boxes) for the given pictures and narration.</summary>
    Task<VisionResult> Extract(string apiKey, string model, ExtractionInput input, CancellationToken ct);
    /// <summary>Speech-to-text of a short audio file (WAV).</summary>
    Task<string> Transcribe(string apiKey, string model, byte[] audio, string fileName, string contentType, CancellationToken ct);
}
/// <summary>Writes bytes to a presigned upload URL (used to store video frames in S3 so OpenAI can read them by link).</summary>
public interface IObjectUploader { Task PutAsync(string url, byte[] content, string contentType, CancellationToken ct); }

/// <summary>
/// AI inventory from a sales-lead photo or video. OpenAI cannot read video, so for a video the browser sends still
/// frames (up to 20) and the sound track; frames are stored in S3 next to the video and passed to OpenAI as presigned
/// links, and the sound is transcribed so the narration ("three boxes of books in the study") is used too.
/// </summary>
public sealed class LeadExtractionService(ILeadUploadRepository repository, ILeadUploadService uploads,
    IOpenAiConfigurationRepository configuration, ISecretProtector protector, IAwsObjectStorage storage,
    IInventoryVisionGateway gateway, IObjectUploader uploader, IPackingRepository packing, LeadInventoryService inventory, Movers.Services.OpenAi.AiUsageService usage, IUserContext user, TimeProvider clock)
{
    public const int MaxFrames = 20;
    private const string WavPrefix = "data:audio/wav;base64,";

    /// <returns>The extraction, and the lead's inventory after the extracted lines were stored on it.</returns>
    public async Task<(ExtractionResult Result, LeadInventoryModel Inventory)> Extract(Guid leadId, Guid attachmentId, IReadOnlyList<string>? frames, string? audio, CancellationToken ct)
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
        var key = protector.Unprotect(config.EncryptedApiKey, $"openai-api:{config.TenantId}");
        // Check the sound before storing any frame, so a rejected request leaves nothing behind.
        var wav = isVideo && !string.IsNullOrEmpty(audio) ? Wav(audio) : null;

        var images = new List<string>();
        if (isImage && storage.RequiresTenantCredentials)
        {
            if (!new[] { "image/jpeg", "image/png", "image/webp", "image/gif" }.Contains(attachment.ContentType.ToLowerInvariant()))
                throw new InvalidOperationException("Convert this image to JPEG, PNG or WEBP before extraction.");
            images.Add(SecureUrl(await uploads.CreateDownloadUrlAsync(leadId, attachmentId, ct)));
        }
        else
        {
            if (frames is null || frames.Count < 1 || frames.Count > (isVideo ? MaxFrames : 1))
                throw new InvalidOperationException($"Provide up to {MaxFrames} video frames, or one local image.");
            var credentials = StorageCredentials.Resolve(storage, protector, await repository.GetAwsAsync(ct));
            var folder = attachment.S3ObjectKey[..(attachment.S3ObjectKey.LastIndexOf('/') + 1)] + "frames/";
            for (var i = 0; i < frames.Count; i++)
            {
                var bytes = Jpeg(frames[i]);
                if (storage.RequiresTenantCredentials)
                {
                    // Store the frame next to the video and give OpenAI a short-lived presigned link to it.
                    var frameKey = $"{folder}frame-{i + 1:00}.jpg";
                    await uploader.PutAsync(await storage.CreateUploadUrlAsync(credentials, frameKey, "image/jpeg", clock.GetUtcNow().AddMinutes(10), ct), bytes, "image/jpeg", ct);
                    images.Add(SecureUrl(await storage.CreateDownloadUrlAsync(credentials, frameKey, $"frame-{i + 1:00}.jpg", clock.GetUtcNow().AddMinutes(15), ct)));
                }
                else images.Add(frames[i]); // local storage is not reachable by OpenAI: send the picture inline
            }
        }

        string? transcript = null, warning = null;
        // Speech-to-text uses the tenant's transcription model (Settings › OpenAI).
        if (wav is not null && !string.IsNullOrWhiteSpace(config.TranscriptionModel))
        {
            try
            {
                transcript = (await gateway.Transcribe(key, config.TranscriptionModel, wav, "narration.wav", "audio/wav", ct)).Trim();
                if (transcript.Length > 8000) transcript = transcript[..8000];
                if (transcript.Length == 0) transcript = null;
            }
            catch (InvalidOperationException) { warning = "The sound could not be transcribed, so items come from the pictures only."; }
            catch (HttpRequestException) { warning = "The sound could not be transcribed, so items come from the pictures only."; }
        }

        var boxTypes = (await packing.ActiveBoxTypes(ct)).Select(b => $"{b.Name} ({b.CapacityCbm:0.###} CBM)").ToList();
        var vision = await gateway.Extract(key, config.ExtractionModel, new ExtractionInput(images, transcript, boxTypes), ct);
        var json = vision.Json;
        ExtractionResult result;
        try { result = JsonSerializer.Deserialize<ExtractionResult>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!; }
        catch (JsonException) { throw new InvalidOperationException("OpenAI returned an unreadable result. Please retry."); }
        if (result?.Items is null || result.Items.Count > 300 ||
            result.Items.Any(x => x is null || string.IsNullOrWhiteSpace(x.Name) || x.Name.Length > 160 || x.Quantity < 1 || x.Quantity > 10000 || x.Notes is null || x.Notes.Length > 1000 || x.Room?.Length > 80 || x.Handling?.Length > 300 || x.VolumeCbm is < 0 or > 100))
            throw new InvalidOperationException("OpenAI returned invalid items. Please retry.");
        var boxes = result.Boxes ?? [];
        if (boxes.Count > 100 || boxes.Any(b => b is null || string.IsNullOrWhiteSpace(b.BoxType) || b.BoxType.Length > 160 || b.Quantity is < 1 or > 1000 || b.Contents is null || b.Contents.Length > 500 || b.Room?.Length > 80))
            throw new InvalidOperationException("OpenAI returned invalid box suggestions. Please retry.");
        static string? Blank(string? x) => string.IsNullOrWhiteSpace(x) ? null : x.Trim();
        result = new ExtractionResult(
            result.Items.Select(x => x with { Room = Blank(x.Room), Handling = Blank(x.Handling) }).ToList(),
            boxes.Select(b => b with { Room = Blank(b.Room) }).ToList(), transcript, images.Count, warning);
        // What this run used and roughly cost (tenant prices in Settings › OpenAI).
        var audioSeconds = wav is not null && warning is null ? WavSeconds(wav) : 0m;
        result = result with { Usage = await usage.Record(config, Movers.Domain.Configuration.AiUsageRecord.LeadExtraction, leadId, attachmentId, config.ExtractionModel,
            vision.InputTokens, vision.CachedInputTokens, vision.OutputTokens, config.TranscriptionModel, audioSeconds, ct) };
        attachment.SaveExtraction(JsonSerializer.Serialize(result));
        await repository.SaveChangesAsync(ct);
        // Keep the result on the lead: its expected inventory, CBM and fragile items.
        return (result, await inventory.Import(leadId, attachmentId, result, ct));
    }

    private static string SecureUrl(string? url) =>
        url is not null && Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == "https" ? url : throw new InvalidOperationException("A secure S3 download link is required.");

    private static byte[] Jpeg(string frame)
    {
        if (frame is null || !frame.StartsWith("data:image/jpeg;base64,", StringComparison.Ordinal) || frame.Length > 2_800_000)
            throw new InvalidOperationException("Each frame must be a JPEG smaller than 2 MB.");
        byte[] bytes;
        try { bytes = Convert.FromBase64String(frame[23..]); }
        catch (FormatException) { throw new InvalidOperationException("Invalid JPEG frame."); }
        if (bytes.Length < 3 || bytes[0] != 0xff || bytes[1] != 0xd8 || bytes[2] != 0xff) throw new InvalidOperationException("Invalid JPEG frame.");
        return bytes;
    }

    /// <summary>Length of a PCM WAV from its byte rate (header offset 28).</summary>
    private static decimal WavSeconds(byte[] wav)
    {
        var byteRate = BitConverter.ToInt32(wav, 28);
        return byteRate > 0 ? Math.Round((wav.Length - 44) / (decimal)byteRate, 1) : 0m;
    }

    /// <summary>The browser sends the video's sound as 16-bit mono WAV (at most about 10 minutes).</summary>
    private static byte[] Wav(string audio)
    {
        if (!audio.StartsWith(WavPrefix, StringComparison.Ordinal) || audio.Length > 22_000_000)
            throw new InvalidOperationException("The sound must be a WAV recording of at most 10 minutes.");
        byte[] bytes;
        try { bytes = Convert.FromBase64String(audio[WavPrefix.Length..]); }
        catch (FormatException) { throw new InvalidOperationException("Invalid sound recording."); }
        if (bytes.Length < 44 || bytes[0] != (byte)'R' || bytes[1] != (byte)'I' || bytes[2] != (byte)'F' || bytes[3] != (byte)'F' || bytes[8] != (byte)'W' || bytes[9] != (byte)'A' || bytes[10] != (byte)'V' || bytes[11] != (byte)'E')
            throw new InvalidOperationException("Invalid sound recording.");
        return bytes;
    }
}
