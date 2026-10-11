namespace Movers.Services.Sales;

/// <summary>File rules shared by every customer and staff upload (sales leads and surveys).</summary>
public static class UploadPolicy
{
    public const long MaxFileBytes = 500L * 1024 * 1024;
    private static readonly string[] DocumentTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];

    /// <summary>Validates the request and returns the sanitised file name and normalised content type.</summary>
    public static (string FileName, string ContentType) Validate(UploadRequestModel request)
    {
        if (request.SizeBytes is <= 0 or > MaxFileBytes) throw new InvalidOperationException("Each file must be between 1 byte and 500 MB.");
        var fileName = SafeFileName(request.FileName);
        if (fileName.Length == 0) throw new InvalidOperationException("A valid file name is required.");
        var contentType = string.IsNullOrWhiteSpace(request.ContentType) ? "application/octet-stream" : request.ContentType.Trim().ToLowerInvariant();
        var mediaType = contentType.Split(';')[0].Trim();
        if (!(mediaType.StartsWith("image/") && mediaType != "image/svg+xml") &&
            !mediaType.StartsWith("video/") && !mediaType.StartsWith("audio/") && !DocumentTypes.Contains(mediaType))
            throw new InvalidOperationException("Upload an image, video, audio recording, PDF, Word document, or Excel workbook.");
        return (fileName, contentType);
    }

    public static void EnsureStoredSize(StoredObjectInfo info, long declaredSizeBytes)
    {
        if (info.SizeBytes > MaxFileBytes || info.SizeBytes != declaredSizeBytes) throw new InvalidOperationException("Uploaded file size does not match the declared size.");
    }

    private static string SafeFileName(string value) => string.Concat(Path.GetFileName(value).Take(180).Select(c => char.IsLetterOrDigit(c) || c is '.' or '-' or '_' ? c : '_'));
}
