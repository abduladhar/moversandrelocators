using Microsoft.EntityFrameworkCore;
using Movers.DAL.Persistence;
using Movers.Services.Numbering;
namespace Movers.DAL.Numbering;

// Reservation is atomic and committed independently. Failed business saves can leave gaps;
// reserved numbers are never reused. No in-memory counters or MAX()+1 races.
public sealed class NumberSequenceRepository(MoversDbContext db) : INumberSequenceRepository
{
    public static Task Initialize(MoversDbContext db) => db.Database.ExecuteSqlRawAsync(
        db.Database.IsSqlServer()
        ? "IF OBJECT_ID(N'dbo.number_counters', N'U') IS NULL CREATE TABLE dbo.number_counters (tenant_id varchar(36) NOT NULL, series varchar(32) NOT NULL, next_value bigint NOT NULL, CONSTRAINT PK_number_counters PRIMARY KEY (tenant_id, series));"
        : "CREATE TABLE IF NOT EXISTS number_counters (tenant_id varchar(36) NOT NULL, series varchar(32) NOT NULL, next_value bigint NOT NULL, PRIMARY KEY (tenant_id, series));");

    public async Task<long> Next(Guid tenantId, string series, CancellationToken ct)
    {
        // A separate connection makes reservation independent of the business unit of work.
        var source = db.Database.GetDbConnection();
        await using var connection = (System.Data.Common.DbConnection)Activator.CreateInstance(source.GetType())!;
        connection.ConnectionString = db.Database.GetConnectionString()!;
        await connection.OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText = db.Database.IsSqlServer()
            ? "MERGE dbo.number_counters WITH (HOLDLOCK) AS target USING (SELECT @tenant AS tenant_id, @series AS series) AS source ON target.tenant_id=source.tenant_id AND target.series=source.series WHEN MATCHED THEN UPDATE SET next_value=target.next_value+1 WHEN NOT MATCHED THEN INSERT (tenant_id,series,next_value) VALUES (source.tenant_id,source.series,1) OUTPUT inserted.next_value;"
            : "INSERT INTO number_counters (tenant_id,series,next_value) VALUES (@tenant,@series,1) ON CONFLICT (tenant_id,series) DO UPDATE SET next_value=number_counters.next_value+1 RETURNING next_value;";
        var tenant = command.CreateParameter(); tenant.ParameterName = "@tenant"; tenant.Value = tenantId.ToString(); command.Parameters.Add(tenant);
        var kind = command.CreateParameter(); kind.ParameterName = "@series"; kind.Value = series; command.Parameters.Add(kind);
        return Convert.ToInt64(await command.ExecuteScalarAsync(ct));
    }
}
