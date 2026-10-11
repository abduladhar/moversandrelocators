namespace Movers.Services.Sales;

public interface ILeadUploadService
{
    Task<GeneratedUploadLinkModel> GenerateLinkAsync(Guid leadId, int validDays, CancellationToken token, string? requestedItems = null, string? description = null);
    Task SaveCustomerDetailsAsync(string token, string? items, string? description, CancellationToken ct);
    Task<IReadOnlyList<UploadLinkModel>> ListLinksAsync(Guid leadId, CancellationToken token);
    Task<UploadLinkModel?> RevokeLinkAsync(Guid leadId, Guid id, CancellationToken token);
    Task<IReadOnlyList<AttachmentModel>> ListAttachmentsAsync(Guid leadId, CancellationToken token);
    Task<PublicUploadInfoModel?> GetPublicInfoAsync(string token, CancellationToken cancellationToken);
    Task<PresignedUploadModel> CreateUploadAsync(string token, UploadRequestModel request, CancellationToken cancellationToken);
    Task<AttachmentModel?> CompleteUploadAsync(string token, Guid attachmentId, CancellationToken cancellationToken);
    Task<string?> CreateDownloadUrlAsync(Guid leadId, Guid attachmentId, CancellationToken cancellationToken);
}
