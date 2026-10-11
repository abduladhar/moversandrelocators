using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Domain.Configuration;
using Movers.Services.Aws;

namespace Movers.DAL.Configuration;

public sealed class AwsConfigurationRepository(MoversDbContext db) : IAwsConfigurationRepository
{
    public Task<TenantAwsConfiguration?> GetAsync(bool trackChanges, CancellationToken token) =>
        (trackChanges ? db.TenantAwsConfigurations : db.TenantAwsConfigurations.AsNoTracking())
        .SingleOrDefaultAsync(token);

    public void Add(TenantAwsConfiguration configuration) => db.TenantAwsConfigurations.Add(configuration);
    public async Task SaveChangesAsync(CancellationToken token) => await db.SaveChangesAsync(token);
}
