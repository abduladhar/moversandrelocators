using Movers.Services.Tenancy;
namespace Movers.Services.Numbering;
public interface INumberSequenceRepository { Task<long> Next(Guid tenantId, string series, CancellationToken ct); }
public interface IRecordNumbers { Task<string> Next(string prefix, CancellationToken ct); }
public sealed class RecordNumbers(INumberSequenceRepository repository, ITenantContext tenant, TimeProvider clock) : IRecordNumbers
{
    public async Task<string> Next(string prefix, CancellationToken ct)
    {
        var series = $"{prefix}-{clock.GetUtcNow():yyyyMMdd}";
        var value = await repository.Next(tenant.TenantId, series, ct);
        return $"{series}-{value:D6}";
    }
}
