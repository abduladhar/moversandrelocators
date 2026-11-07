using Microsoft.EntityFrameworkCore;
namespace Movers.DAL.Persistence;

/// <summary>Idempotent upgrade: an index to read one record's audit history quickly, used by My Tasks history (script 041).</summary>
public static class AuditHistorySchema
{
    public static async Task Apply(MoversDbContext db)
    {
        if (db.Database.IsSqlServer()) await db.Database.ExecuteSqlRawAsync(SqlServer);
        else if (db.Database.IsNpgsql()) await db.Database.ExecuteSqlRawAsync(PostgreSql);
        // SQLite is only used for fresh test databases, which EnsureCreated builds from the current model.
    }

    public const string SqlServer = """
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AuditLogs_TenantId_EntityType_EntityId' AND object_id = OBJECT_ID(N'dbo.AuditLogs'))
            CREATE INDEX [IX_AuditLogs_TenantId_EntityType_EntityId] ON [dbo].[AuditLogs]([TenantId], [EntityType], [EntityId]);
        """;

    public const string PostgreSql = """
        CREATE INDEX IF NOT EXISTS "IX_AuditLogs_TenantId_EntityType_EntityId" ON "AuditLogs"("TenantId", "EntityType", "EntityId");
        """;
}
