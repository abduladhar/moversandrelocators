using Movers.Domain.Configuration;

namespace Movers.Services.Aws;

public interface IAwsConfigurationRepository
{
    Task<TenantAwsConfiguration?> GetAsync(bool trackChanges, CancellationToken token);
    void Add(TenantAwsConfiguration configuration);
    Task SaveChangesAsync(CancellationToken token);
}
