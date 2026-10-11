using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Configuration;
using Movers.Services.OpenAi;

namespace Movers.DAL.Configuration;

public sealed class OpenAiConfigurationRepository(MoversDbContext db) : IOpenAiConfigurationRepository
{
    public Task<TenantOpenAiConfiguration?> GetAsync(bool trackChanges, CancellationToken token) =>
        (trackChanges ? db.TenantOpenAiConfigurations : db.TenantOpenAiConfigurations.AsNoTracking())
        .SingleOrDefaultAsync(token);

    public void Add(TenantOpenAiConfiguration configuration) => db.TenantOpenAiConfigurations.Add(configuration);
    public async Task SaveChangesAsync(CancellationToken token) => await db.SaveChangesAsync(token);
}
