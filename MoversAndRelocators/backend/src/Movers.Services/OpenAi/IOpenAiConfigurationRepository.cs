using Movers.Domain.Configuration;

namespace Movers.Services.OpenAi;

public interface IOpenAiConfigurationRepository
{
    Task<TenantOpenAiConfiguration?> GetAsync(bool trackChanges, CancellationToken token);
    void Add(TenantOpenAiConfiguration configuration);
    Task SaveChangesAsync(CancellationToken token);
}
