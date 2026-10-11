using System.Net;
using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Movers.Services.Sales;

namespace Movers.Api.Storage;

public sealed class S3ObjectStorage : IAwsObjectStorage
{
    public async Task<string> CreateUploadUrlAsync(AwsStorageCredentials c, string key, string contentType, DateTimeOffset expiresAtUtc, CancellationToken token)
    {
        using var client = Client(c);
        return await client.GetPreSignedURLAsync(new GetPreSignedUrlRequest { BucketName = c.BucketName, Key = key, Verb = HttpVerb.PUT, ContentType = contentType, Expires = expiresAtUtc.UtcDateTime });
    }

    public async Task<string> CreateDownloadUrlAsync(AwsStorageCredentials c, string key, string fileName, DateTimeOffset expiresAtUtc, CancellationToken token)
    {
        using var client = Client(c);
        return await client.GetPreSignedURLAsync(new GetPreSignedUrlRequest { BucketName = c.BucketName, Key = key, Verb = HttpVerb.GET, Expires = expiresAtUtc.UtcDateTime, ResponseHeaderOverrides = new ResponseHeaderOverrides { ContentDisposition = $"attachment; filename=\"{fileName.Replace("\"", "")}\"" } });
    }

    public async Task<StoredObjectInfo?> GetObjectInfoAsync(AwsStorageCredentials c, string key, CancellationToken token)
    {
        using var client = Client(c);
        try { var response = await client.GetObjectMetadataAsync(c.BucketName, key, token); return new StoredObjectInfo(response.ContentLength); }
        catch (AmazonS3Exception exception) when (exception.StatusCode == HttpStatusCode.NotFound) { return null; }
    }

    private static AmazonS3Client Client(AwsStorageCredentials c) => new(new BasicAWSCredentials(c.AccessKey, c.SecretKey), new AmazonS3Config { RegionEndpoint = RegionEndpoint.GetBySystemName(c.Region) });
}
