using Microsoft.EntityFrameworkCore;
namespace Movers.DAL.Persistence;

/// <summary>Idempotent upgrade for crew scheduling: the supervisor that replaces a team's leader, and the
/// duration a pickup or packing job occupies its crew for, so a double booking can be detected (script 028).</summary>
public static class CrewScheduleSchema
{
    public static async Task Apply(MoversDbContext db)
    {
        if (db.Database.IsSqlServer()) { foreach (var batch in System.Text.RegularExpressions.Regex.Split(SqlServer, @"^\s*GO\s*$", System.Text.RegularExpressions.RegexOptions.Multiline)) await db.Database.ExecuteSqlRawAsync(batch); }
        else if (db.Database.IsNpgsql()) await db.Database.ExecuteSqlRawAsync(PostgreSql);
        // SQLite is only used for fresh test databases, which EnsureCreated builds from the current model.
    }

    public const string SqlServer = """
        IF COL_LENGTH(N'dbo.Teams', N'SupervisorEmployeeId') IS NULL
            ALTER TABLE [dbo].[Teams] ADD [SupervisorEmployeeId] UNIQUEIDENTIFIER NULL
                CONSTRAINT [FK_Teams_Supervisor] FOREIGN KEY REFERENCES [dbo].[Employees]([Id]);
        GO
        -- Carry the old team leader across, then leave the column behind rather than dropping a populated one.
        IF COL_LENGTH(N'dbo.Teams', N'LeaderEmployeeId') IS NOT NULL
            EXEC sp_executesql N'UPDATE [dbo].[Teams] SET [SupervisorEmployeeId] = [LeaderEmployeeId] WHERE [SupervisorEmployeeId] IS NULL AND [LeaderEmployeeId] IS NOT NULL;';
        GO
        IF COL_LENGTH(N'dbo.Pickups', N'DurationMinutes') IS NULL
            ALTER TABLE [dbo].[Pickups] ADD [DurationMinutes] INT NOT NULL CONSTRAINT [DF_Pickups_DurationMinutes] DEFAULT 240;
        GO
        IF COL_LENGTH(N'dbo.PackingJobs', N'DurationMinutes') IS NULL
            ALTER TABLE [dbo].[PackingJobs] ADD [DurationMinutes] INT NOT NULL CONSTRAINT [DF_PackingJobs_DurationMinutes] DEFAULT 240;
        GO
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pickups_Scheduled')
            CREATE INDEX [IX_Pickups_Scheduled] ON [dbo].[Pickups]([TenantId],[ScheduledAtUtc]);
        GO
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PackingJobs_Scheduled')
            CREATE INDEX [IX_PackingJobs_Scheduled] ON [dbo].[PackingJobs]([TenantId],[ScheduledAtUtc]);
        """;

    public const string PostgreSql = """
        ALTER TABLE "Teams" ADD COLUMN IF NOT EXISTS "SupervisorEmployeeId" uuid NULL REFERENCES "Employees"("Id");
        ALTER TABLE "Pickups" ADD COLUMN IF NOT EXISTS "DurationMinutes" integer NOT NULL DEFAULT 240;
        ALTER TABLE "PackingJobs" ADD COLUMN IF NOT EXISTS "DurationMinutes" integer NOT NULL DEFAULT 240;
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Teams' AND column_name = 'LeaderEmployeeId') THEN
                UPDATE "Teams" SET "SupervisorEmployeeId" = "LeaderEmployeeId" WHERE "SupervisorEmployeeId" IS NULL AND "LeaderEmployeeId" IS NOT NULL;
            END IF;
        END $$;
        CREATE INDEX IF NOT EXISTS "IX_Pickups_Scheduled" ON "Pickups"("TenantId","ScheduledAtUtc");
        CREATE INDEX IF NOT EXISTS "IX_PackingJobs_Scheduled" ON "PackingJobs"("TenantId","ScheduledAtUtc");
        """;
}
