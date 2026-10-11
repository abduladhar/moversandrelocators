using Movers.Domain.Configuration;
using Movers.Domain.Sales;
using Movers.Domain.Tenants;

namespace Movers.Services.Sales;

public sealed record PublicUploadResolution(Tenant Tenant, SalesLead Lead, SalesLeadUploadLink Link, TenantAwsConfiguration? Aws);

public interface ILeadUploadRepository
{
    Task<SalesLead?> GetLeadAsync(Guid id, CancellationToken token);
    Task<TenantAwsConfiguration?> GetAwsAsync(CancellationToken token);
    Task<IReadOnlyList<SalesLeadUploadLink>> ListLinksAsync(Guid leadId, CancellationToken token);
    Task<IReadOnlyList<SalesLeadAttachment>> ListAttachmentsAsync(Guid leadId, CancellationToken token);
    Task<SalesLeadUploadLink?> GetLinkAsync(Guid id, bool track, CancellationToken token);
    Task<SalesLeadAttachment?> GetAttachmentAsync(Guid id, bool track, CancellationToken token);
    Task<PublicUploadResolution?> ResolvePublicAsync(string tokenHash, CancellationToken token);
    void AddLink(SalesLeadUploadLink link);
    void AddAttachment(SalesLeadAttachment attachment);
    Task SaveChangesAsync(CancellationToken token);
}
