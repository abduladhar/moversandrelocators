using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Configuration;
using Movers.Domain.Sales;
using Movers.Services.Sales;

namespace Movers.DAL.Sales;

public sealed class LeadUploadRepository(MoversDbContext db) : ILeadUploadRepository
{
    public Task<SalesLead?> GetLeadAsync(Guid id, CancellationToken token) => db.SalesLeads.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, token);
    public Task<TenantAwsConfiguration?> GetAwsAsync(CancellationToken token) => db.TenantAwsConfigurations.AsNoTracking().SingleOrDefaultAsync(token);
    public async Task<IReadOnlyList<SalesLeadUploadLink>> ListLinksAsync(Guid leadId, CancellationToken token) => await db.SalesLeadUploadLinks.AsNoTracking().Where(x => x.SalesLeadId == leadId).OrderByDescending(x => x.SerialNo).ToListAsync(token);
    public async Task<IReadOnlyList<SalesLeadAttachment>> ListAttachmentsAsync(Guid leadId, CancellationToken token) => await db.SalesLeadAttachments.AsNoTracking().Where(x => x.SalesLeadId == leadId && x.IsUploaded).OrderByDescending(x => x.SerialNo).ToListAsync(token);
    public Task<SalesLeadUploadLink?> GetLinkAsync(Guid id, bool track, CancellationToken token) => (track ? db.SalesLeadUploadLinks : db.SalesLeadUploadLinks.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, token);
    public Task<SalesLeadAttachment?> GetAttachmentAsync(Guid id, bool track, CancellationToken token) => (track ? db.SalesLeadAttachments : db.SalesLeadAttachments.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == id, token);
    public async Task<PublicUploadResolution?> ResolvePublicAsync(string tokenHash, CancellationToken token)
    {
        var link = await db.SalesLeadUploadLinks.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.TokenHash == tokenHash, token);
        if (link is null) return null;
        var tenant = await db.Tenants.AsNoTracking().SingleOrDefaultAsync(x => x.Id == link.TenantId && x.IsActive, token);
        var lead = await db.SalesLeads.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == link.SalesLeadId && x.TenantId == link.TenantId && x.IsActive, token);
        var aws = await db.TenantAwsConfigurations.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.TenantId == link.TenantId, token);
        return tenant is null || lead is null ? null : new(tenant, lead, link, aws);
    }
    public void AddLink(SalesLeadUploadLink link) => db.SalesLeadUploadLinks.Add(link);
    public void AddAttachment(SalesLeadAttachment attachment) => db.SalesLeadAttachments.Add(attachment);
    public async Task SaveChangesAsync(CancellationToken token) => await db.SaveChangesAsync(token);
}
