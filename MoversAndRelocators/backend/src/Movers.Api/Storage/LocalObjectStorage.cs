using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Movers.Services.Aws;
using Movers.Services.Sales;
namespace Movers.Api.Storage;

/// <summary>Private in-house storage. Only encrypted, expiring capability URLs expose file access.</summary>
public sealed class LocalObjectStorage(IConfiguration configuration, IWebHostEnvironment environment,
    ISecretProtector protector, TimeProvider clock) : IAwsObjectStorage
{
    public bool RequiresTenantCredentials => false;
    public const long MaximumBytes = 500L * 1024 * 1024;
    public string Root => Path.GetFullPath(configuration["Storage:LocalRoot"] ?? Path.Combine(environment.ContentRootPath, ".data", "private"));
    public Task<string> CreateUploadUrlAsync(AwsStorageCredentials credentials, string key, string contentType, DateTimeOffset expires, CancellationToken ct) =>
        Task.FromResult(Url(new Grant(key, "PUT", contentType, "", expires)));
    public Task<string> CreateDownloadUrlAsync(AwsStorageCredentials credentials, string key, string fileName, DateTimeOffset expires, CancellationToken ct) =>
        Task.FromResult(Url(new Grant(key, "GET", "application/octet-stream", fileName, expires)));
    public Task<StoredObjectInfo?> GetObjectInfoAsync(AwsStorageCredentials credentials, string key, CancellationToken ct)
    {
        var path = ObjectPath(key);
        return Task.FromResult<StoredObjectInfo?>(File.Exists(path) ? new StoredObjectInfo(new FileInfo(path).Length) : null);
    }
    public Grant Validate(string value, string method)
    {
        try
        {
            if (value.Length > 8192) throw new CryptographicException();
            var grant = JsonSerializer.Deserialize<Grant>(protector.Unprotect(value, "private-local-file")) ?? throw new CryptographicException();
            if (grant.Method != method || grant.ExpiresAtUtc <= clock.GetUtcNow()) throw new CryptographicException();
            return grant;
        }
        catch (Exception ex) when (ex is FormatException or CryptographicException or JsonException)
        { throw new UnauthorizedAccessException("File link is invalid or expired."); }
    }
    public string ObjectPath(string key)
    {
        // Hash keys rather than accepting caller-supplied filesystem paths.
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key)));
        return Path.Combine(Root, hash[..2], hash + ".blob");
    }
    public async Task Write(Grant grant, Stream input, CancellationToken ct)
    {
        var path = ObjectPath(grant.Key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        if (File.Exists(path)) throw new InvalidOperationException("This file was already uploaded. Complete the upload or choose a new attachment.");
        var temporary = path + "." + Guid.NewGuid().ToString("N") + ".upload";
        try
        {
            long count = 0;
            await using (var output = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, true))
            {
                var buffer = new byte[81920];
                int read;
                while ((read = await input.ReadAsync(buffer, ct)) > 0)
                {
                    count += read;
                    if (count > MaximumBytes) throw new InvalidOperationException("File exceeds 500 MB.");
                    await output.WriteAsync(buffer.AsMemory(0, read), ct);
                }
                if (count == 0) throw new InvalidOperationException("An empty file cannot be uploaded.");
                await output.FlushAsync(ct);
            }
            File.Move(temporary, path, false);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
    private string Url(Grant grant)
    {
        var token = protector.Protect(JsonSerializer.Serialize(grant), "private-local-file");
        // With the web app on another domain, links must name the API's own address (PublicApi:BaseUrl); unset = same site.
        return (configuration["PublicApi:BaseUrl"] ?? "").Trim().TrimEnd('/') + "/api/public/local-files?grant=" + Uri.EscapeDataString(token);
    }
    public sealed record Grant(string Key, string Method, string ContentType, string FileName, DateTimeOffset ExpiresAtUtc);
}
