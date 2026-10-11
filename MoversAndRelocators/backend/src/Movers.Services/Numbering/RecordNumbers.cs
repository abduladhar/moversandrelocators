using Movers.Services.Tenancy;
namespace Movers.Services.Numbering;
public interface INumberSequenceRepository { Task<long> Next(Guid tenantId, string series, CancellationToken ct); }
public interface IRecordNumbers
{
    /// <summary>Document numbers (quotations, jobs, invoices): each company has its own series, marked by its number code.</summary>
    Task<string> Next(string prefix, CancellationToken ct);
    /// <summary>Codes of masters shared by every company of the tenant (employees, customers, charges).</summary>
    Task<string> NextShared(string prefix, CancellationToken ct);
}
public sealed class RecordNumbers(INumberSequenceRepository repository, ITenantContext tenant, TimeProvider clock) : IRecordNumbers
{
    public Task<string> Next(string prefix, CancellationToken ct) =>
        Reserve(tenant.Company?.NumberCode is { Length: > 0 } code ? $"{prefix}-{code}" : prefix, ct);

    public Task<string> NextShared(string prefix, CancellationToken ct) => Reserve(prefix, ct);

    private async Task<string> Reserve(string prefix, CancellationToken ct)
    {
        var series = $"{prefix}-{clock.GetUtcNow():yyyyMMdd}";
        var value = await repository.Next(tenant.TenantId, series, ct);
        return $"{series}-{value:D6}";
    }
}
