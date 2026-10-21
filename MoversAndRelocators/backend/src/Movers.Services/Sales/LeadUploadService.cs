using System.Security.Cryptography;
using System.Text;
using Movers.Domain.Configuration;
using Movers.Domain.CustomerLinks;
using Movers.Domain.Sales;
using Movers.Services.Aws;
using Movers.Services.CustomerLinks;
using Movers.Services.Tenancy;

namespace Movers.Services.Sales;

public sealed class LeadUploadService(ILeadUploadRepository repository, ITenantContext tenantContext,
    ISecretProtector protector, IAwsObjectStorage storage, TimeProvider timeProvider, ICustomerReplies replies, Movers.Services.Tenants.ICompanyScope? companies = null) : ILeadUploadService
{

    public async Task<GeneratedUploadLinkModel> GenerateLinkAsync(Guid leadId, int validDays, CancellationToken token, string? requestedItems = null, string? description = null)
    {
        if (validDays is < 5 or > 30) throw new InvalidOperationException("Upload links must be valid for 5 to 30 days.");
        if (await repository.GetLeadAsync(leadId, token) is null) throw new InvalidOperationException("Sales lead was not found.");
        var aws = await repository.GetAwsAsync(token);
        if (storage.RequiresTenantCredentials && (aws is null || string.IsNullOrWhiteSpace(aws.BucketName))) throw new InvalidOperationException("Configure the tenant AWS region, S3 bucket and credentials first.");
        var rawToken = Base64Url(RandomNumberGenerator.GetBytes(32));
        var link = new SalesLeadUploadLink(tenantContext.TenantId, leadId, Hash(rawToken), timeProvider.GetUtcNow().AddDays(validDays));
        link.SetInstructions(OptionalText(requestedItems), OptionalText(description));
        repository.AddLink(link); await replies.SharedAsync(CustomerReplyRecordTypes.SalesLead, leadId, link.ExpiresAtUtc, token); await repository.SaveChangesAsync(token);
        return new GeneratedUploadLinkModel(Map(link), rawToken);
    }

    public async Task<IReadOnlyList<UploadLinkModel>> ListLinksAsync(Guid leadId, CancellationToken token) =>
        (await repository.ListLinksAsync(leadId, token)).Where(x => !IsStaffLink(x)).Select(Map).ToList();

    public async Task<UploadLinkModel?> RevokeLinkAsync(Guid leadId, Guid id, CancellationToken token)
    {
        var link = await repository.GetLinkAsync(id, true, token); if (link is null || link.SalesLeadId != leadId) return null; link.Revoke();
        var now = timeProvider.GetUtcNow();
        if (!(await repository.ListLinksAsync(leadId, token)).Any(x => x.Id != id && x.IsActive && !IsStaffLink(x) && x.ExpiresAtUtc > now))
            await replies.WithdrawnAsync(CustomerReplyRecordTypes.SalesLead, leadId, token);
        await repository.SaveChangesAsync(token); return Map(link);
    }

    public async Task<IReadOnlyList<AttachmentModel>> ListAttachmentsAsync(Guid leadId, CancellationToken token) =>
        (await repository.ListAttachmentsAsync(leadId, token)).Select(Map).ToList();

    public async Task<PublicUploadInfoModel?> GetPublicInfoAsync(string token, CancellationToken cancellationToken)
    { var r = await Resolve(token, cancellationToken); return r is null ? null : new(tenantContext.Company?.Name ?? r.Tenant.Name, r.Lead.LeadNumber, r.Lead.CustomerName, r.Link.ExpiresAtUtc, r.Link.RequestedItems, r.Link.Description, r.Link.CustomerItems, r.Link.CustomerDescription); }

    public async Task<PublicLinkLeadModel?> ResolveLeadAsync(string token, CancellationToken cancellationToken)
    { var r = await Resolve(token, cancellationToken); return r is null ? null : new(r.Lead.Id, tenantContext.Company?.Name ?? r.Tenant.Name, r.Lead.LeadNumber, r.Lead.CustomerName, r.Link.ExpiresAtUtc); }

    public async Task<PresignedUploadModel> CreateUploadAsync(string token, UploadRequestModel request, CancellationToken cancellationToken)
    {
        var r = await Resolve(token, cancellationToken) ?? throw new InvalidOperationException("This upload link is invalid or expired.");
        var (fileName, contentType) = UploadPolicy.Validate(request);
        var attachment = new SalesLeadAttachment(r.Tenant.Id, r.Lead.Id, r.Link.Id, fileName, contentType, request.SizeBytes);
        var key = attachment.S3ObjectKey;
        repository.AddAttachment(attachment); await repository.SaveChangesAsync(cancellationToken);
        var expires = timeProvider.GetUtcNow().AddMinutes(15);
        var url = await storage.CreateUploadUrlAsync(Credentials(r.Aws), key, contentType, expires, cancellationToken);
        return new PresignedUploadModel(attachment.Id, url, expires);
    }

    public async Task<AttachmentModel?> CompleteUploadAsync(string token, Guid attachmentId, CancellationToken cancellationToken)
    {
        var r = await Resolve(token, cancellationToken) ?? throw new InvalidOperationException("This upload link is invalid or expired.");
        var attachment = await repository.GetAttachmentAsync(attachmentId, true, cancellationToken);
        if (attachment is null || attachment.UploadLinkId != r.Link.Id || attachment.SalesLeadId != r.Lead.Id) return null;
        var info = await storage.GetObjectInfoAsync(Credentials(r.Aws), attachment.S3ObjectKey, cancellationToken)
            ?? throw new InvalidOperationException("The file has not reached storage yet.");
        UploadPolicy.EnsureStoredSize(info, attachment.DeclaredSizeBytes);
        attachment.MarkUploaded(info.SizeBytes); await replies.RepliedAsync(CustomerReplyRecordTypes.SalesLead, r.Lead.Id, CustomerReplyKinds.LeadFiles, attachment.OriginalFileName, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken); return Map(attachment) with { ExtractionJson = null };
    }

    public async Task<string?> CreateDownloadUrlAsync(Guid leadId, Guid attachmentId, CancellationToken cancellationToken)
    {
        var attachment = await repository.GetAttachmentAsync(attachmentId, false, cancellationToken);
        if (attachment is null || attachment.SalesLeadId != leadId || !attachment.IsUploaded) return null;
        var aws = await repository.GetAwsAsync(cancellationToken);
        return await storage.CreateDownloadUrlAsync(Credentials(aws), attachment.S3ObjectKey, attachment.OriginalFileName, timeProvider.GetUtcNow().AddMinutes(10), cancellationToken);
    }

    /* Staff capture: files recorded by staff hang off one hidden, never-shareable link per lead (its token hash is
       not a real hash, so no customer token can ever resolve to it). */
    private const string StaffLinkPrefix = "STAFF:";
    private static bool IsStaffLink(SalesLeadUploadLink link) => link.TokenHash.StartsWith(StaffLinkPrefix, StringComparison.Ordinal);

    public async Task<PresignedUploadModel> CreateStaffUploadAsync(Guid leadId, UploadRequestModel request, CancellationToken cancellationToken)
    {
        if (await repository.GetLeadAsync(leadId, cancellationToken) is null) throw new KeyNotFoundException();
        var aws = await repository.GetAwsAsync(cancellationToken);
        var (fileName, contentType) = UploadPolicy.Validate(request);
        var link = (await repository.ListLinksAsync(leadId, cancellationToken)).FirstOrDefault(IsStaffLink);
        if (link is null)
        {
            link = new SalesLeadUploadLink(tenantContext.TenantId, leadId, StaffLinkPrefix + leadId.ToString("N"), timeProvider.GetUtcNow());
            link.SetInstructions(null, "Captured by staff");
            link.Revoke();
            repository.AddLink(link);
        }
        var attachment = new SalesLeadAttachment(tenantContext.TenantId, leadId, link.Id, fileName, contentType, request.SizeBytes);
        repository.AddAttachment(attachment); await repository.SaveChangesAsync(cancellationToken);
        var expires = timeProvider.GetUtcNow().AddMinutes(15);
        var url = await storage.CreateUploadUrlAsync(Credentials(aws), attachment.S3ObjectKey, contentType, expires, cancellationToken);
        return new PresignedUploadModel(attachment.Id, url, expires);
    }

    public async Task<AttachmentModel?> CompleteStaffUploadAsync(Guid leadId, Guid attachmentId, CancellationToken cancellationToken)
    {
        var attachment = await repository.GetAttachmentAsync(attachmentId, true, cancellationToken);
        if (attachment is null || attachment.SalesLeadId != leadId) return null;
        if (attachment.IsUploaded) return Map(attachment);
        var info = await storage.GetObjectInfoAsync(Credentials(await repository.GetAwsAsync(cancellationToken)), attachment.S3ObjectKey, cancellationToken)
            ?? throw new InvalidOperationException("The file has not reached storage yet.");
        UploadPolicy.EnsureStoredSize(info, attachment.DeclaredSizeBytes);
        attachment.MarkUploaded(info.SizeBytes); await repository.SaveChangesAsync(cancellationToken); return Map(attachment);
    }

    private static string? OptionalText(string? value) {
        if (value?.Length > 4000) throw new InvalidOperationException("Keep items and descriptions under 4000 characters each.");
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
    public async Task SaveCustomerDetailsAsync(string token, string? items, string? description, CancellationToken ct) {
        var r = await Resolve(token, ct) ?? throw new InvalidOperationException("This upload link is invalid or expired.");
        var link = await repository.GetLinkAsync(r.Link.Id, true, ct) ?? throw new InvalidOperationException("Link not found.");
        link.SetCustomerDetails(OptionalText(items), OptionalText(description));
        await replies.RepliedAsync(CustomerReplyRecordTypes.SalesLead, r.Lead.Id, CustomerReplyKinds.LeadDetails, description ?? items, ct);
        await repository.SaveChangesAsync(ct);
    }

    private async Task<PublicUploadResolution?> Resolve(string token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var r = await repository.ResolvePublicAsync(Hash(token), cancellationToken);
        if (r is null || !r.Link.IsActive || r.Link.ExpiresAtUtc < timeProvider.GetUtcNow()) return null;
        if (storage.RequiresTenantCredentials && r.Aws is null) return null;
        if (!tenantContext.IsResolved) tenantContext.SetTenant(r.Tenant);
        if (tenantContext.TenantId != r.Tenant.Id) return null;
        if (companies is not null) await companies.UseCompanyOfAsync(r.Lead, cancellationToken);
        return r;
    }

    private AwsStorageCredentials Credentials(TenantAwsConfiguration? x) => !storage.RequiresTenantCredentials
        ? new("local", "local", "", "")
        : x is null ? throw new InvalidOperationException("AWS configuration is missing.") : new(x.Region, x.BucketName,
        protector.Unprotect(x.EncryptedAccessKey, $"aws-access:{x.TenantId}"),
        protector.Unprotect(x.EncryptedSecretKey, $"aws-secret:{x.TenantId}"));
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private static string Base64Url(byte[] value) => Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    private static UploadLinkModel Map(SalesLeadUploadLink x) => new(x.SerialNo, x.Id, x.SalesLeadId, x.ExpiresAtUtc, x.IsActive, x.CreatedAtUtc, x.RequestedItems, x.Description, x.CustomerItems, x.CustomerDescription);
    private static AttachmentModel Map(SalesLeadAttachment x) => new(x.SerialNo, x.Id, x.SalesLeadId, x.OriginalFileName, x.ContentType, x.DeclaredSizeBytes, x.StoredSizeBytes, x.IsUploaded, x.CreatedAtUtc, x.UploadedAtUtc, x.ExtractionJson);
}
