using Movers.Domain.Configuration;
using Movers.Domain.Surveys;
using Movers.Services.Aws;
using Movers.Services.Sales;
using Movers.Services.Security;
using Movers.Services.Tenancy;

namespace Movers.Services.Surveys;

public interface ISurveyFileService
{
    Task<IReadOnlyList<SurveyAttachmentModel>?> ListAsync(Guid surveyId, CancellationToken t);
    Task<PresignedUploadModel?> CreateStaffUploadAsync(Guid surveyId, UploadRequestModel request, CancellationToken t);
    Task<SurveyAttachmentModel?> CompleteStaffUploadAsync(Guid surveyId, Guid attachmentId, CancellationToken t);
    Task<string?> CreateDownloadUrlAsync(Guid surveyId, Guid attachmentId, CancellationToken t);
    Task<bool> DeleteAsync(Guid surveyId, Guid attachmentId, CancellationToken t);
    Task<IReadOnlyList<SurveyAttachmentModel>?> ListPublicAsync(string token, CancellationToken t);
    Task<PresignedUploadModel?> CreatePublicUploadAsync(string token, UploadRequestModel request, CancellationToken t);
    Task<SurveyAttachmentModel?> CompletePublicUploadAsync(string token, Guid attachmentId, CancellationToken t);
}

/// <summary>Survey photos, videos and documents. Customers see and add only their own uploads; staff see all.</summary>
public sealed class SurveyFileService(ISurveyRepository repository, ITenantContext tenantContext, IUserContext user,
    ISecretProtector protector, IAwsObjectStorage storage, TimeProvider clock, Movers.Services.Tenants.ICompanyScope? companies = null) : ISurveyFileService
{
    public async Task<IReadOnlyList<SurveyAttachmentModel>?> ListAsync(Guid surveyId, CancellationToken t) =>
        await repository.GetSurveyAsync(surveyId, false, t) is null ? null : (await repository.ListAttachmentsAsync(surveyId, t)).Select(Map).ToList();

    public async Task<PresignedUploadModel?> CreateStaffUploadAsync(Guid surveyId, UploadRequestModel request, CancellationToken t)
    {
        if (await repository.GetSurveyAsync(surveyId, false, t) is null) return null;
        return await CreateUpload(surveyId, SurveyAttachmentSources.Staff, string.IsNullOrWhiteSpace(user.Email) ? "Staff" : user.Email, request, t);
    }

    public async Task<SurveyAttachmentModel?> CompleteStaffUploadAsync(Guid surveyId, Guid attachmentId, CancellationToken t) =>
        await Complete(surveyId, attachmentId, SurveyAttachmentSources.Staff, t);

    public async Task<string?> CreateDownloadUrlAsync(Guid surveyId, Guid attachmentId, CancellationToken t)
    {
        var attachment = await repository.GetAttachmentAsync(attachmentId, false, t);
        if (attachment is null || attachment.SurveyId != surveyId || !attachment.IsUploaded) return null;
        return await storage.CreateDownloadUrlAsync(Credentials(await repository.GetAwsAsync(t)), attachment.S3ObjectKey, attachment.OriginalFileName, clock.GetUtcNow().AddMinutes(10), t);
    }

    /// <summary>Removes the attachment record; the stored object becomes unreachable because download links are issued only for listed records.</summary>
    public async Task<bool> DeleteAsync(Guid surveyId, Guid attachmentId, CancellationToken t)
    {
        var attachment = await repository.GetAttachmentAsync(attachmentId, true, t);
        if (attachment is null || attachment.SurveyId != surveyId) return false;
        repository.RemoveAttachment(attachment); await repository.SaveChangesAsync(t); return true;
    }

    public async Task<IReadOnlyList<SurveyAttachmentModel>?> ListPublicAsync(string token, CancellationToken t)
    {
        var r = await SurveyLinkTokens.ResolveAsync(repository, tenantContext, clock, token, t, companies);
        return r is null ? null : (await repository.ListAttachmentsAsync(r.Survey.Id, t)).Where(x => x.Source == SurveyAttachmentSources.Customer).Select(Map).ToList();
    }

    public async Task<PresignedUploadModel?> CreatePublicUploadAsync(string token, UploadRequestModel request, CancellationToken t)
    {
        var r = await SurveyLinkTokens.ResolveAsync(repository, tenantContext, clock, token, t, companies);
        return r is null ? null : await CreateUpload(r.Survey.Id, SurveyAttachmentSources.Customer, r.Survey.CustomerName, request, t);
    }

    public async Task<SurveyAttachmentModel?> CompletePublicUploadAsync(string token, Guid attachmentId, CancellationToken t)
    {
        var r = await SurveyLinkTokens.ResolveAsync(repository, tenantContext, clock, token, t, companies);
        return r is null ? null : await Complete(r.Survey.Id, attachmentId, SurveyAttachmentSources.Customer, t);
    }

    private async Task<PresignedUploadModel> CreateUpload(Guid surveyId, string source, string uploadedBy, UploadRequestModel request, CancellationToken t)
    {
        var (fileName, contentType) = UploadPolicy.Validate(request);
        var credentials = Credentials(await repository.GetAwsAsync(t));
        var attachment = new SurveyAttachment(tenantContext.TenantId, surveyId, source, uploadedBy.Length > 160 ? uploadedBy[..160] : uploadedBy, fileName, contentType, request.SizeBytes);
        repository.AddAttachment(attachment); await repository.SaveChangesAsync(t);
        var expires = clock.GetUtcNow().AddMinutes(15);
        return new PresignedUploadModel(attachment.Id, await storage.CreateUploadUrlAsync(credentials, attachment.S3ObjectKey, contentType, expires, t), expires);
    }

    private async Task<SurveyAttachmentModel?> Complete(Guid surveyId, Guid attachmentId, string source, CancellationToken t)
    {
        var attachment = await repository.GetAttachmentAsync(attachmentId, true, t);
        if (attachment is null || attachment.SurveyId != surveyId || attachment.Source != source) return null;
        if (attachment.IsUploaded) return Map(attachment);
        var info = await storage.GetObjectInfoAsync(Credentials(await repository.GetAwsAsync(t)), attachment.S3ObjectKey, t)
            ?? throw new InvalidOperationException("The file has not reached storage yet.");
        UploadPolicy.EnsureStoredSize(info, attachment.DeclaredSizeBytes);
        attachment.MarkUploaded(info.SizeBytes); await repository.SaveChangesAsync(t); return Map(attachment);
    }

    private AwsStorageCredentials Credentials(TenantAwsConfiguration? x) => StorageCredentials.Resolve(storage, protector, x);

    private static SurveyAttachmentModel Map(SurveyAttachment x) => new(x.SerialNo, x.Id, x.SurveyId, x.Source, x.UploadedBy, x.OriginalFileName, x.ContentType, x.StoredSizeBytes ?? x.DeclaredSizeBytes, x.UploadedAtUtc);
}
