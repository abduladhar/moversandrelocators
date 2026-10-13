using Microsoft.EntityFrameworkCore;
namespace Movers.DAL.Persistence;

/// <summary>Idempotent upgrade (script 035): who paid each packing and delivery expense, for the employee expense report.</summary>
public static class EmployeeExpenseSchema
{
    public static async Task Apply(MoversDbContext db)
    {
        if (db.Database.IsSqlServer()) { foreach (var batch in System.Text.RegularExpressions.Regex.Split(SqlServer, @"^\s*GO\s*$", System.Text.RegularExpressions.RegexOptions.Multiline)) if (!string.IsNullOrWhiteSpace(batch)) await db.Database.ExecuteSqlRawAsync(batch); }
        else if (db.Database.IsNpgsql()) await db.Database.ExecuteSqlRawAsync(PostgreSql);
        // SQLite is only used for fresh test databases, which EnsureCreated builds from the current model.
    }

    public const string SqlServer = """
        IF COL_LENGTH(N'dbo.PackingJobTransactions', N'PaidByEmployeeId') IS NULL ALTER TABLE [dbo].[PackingJobTransactions] ADD [PaidByEmployeeId] UNIQUEIDENTIFIER NULL;
        GO
        IF COL_LENGTH(N'dbo.DeliveryJobTransactions', N'PaidByEmployeeId') IS NULL ALTER TABLE [dbo].[DeliveryJobTransactions] ADD [PaidByEmployeeId] UNIQUEIDENTIFIER NULL;
        GO
        """;

    public const string PostgreSql = """
        ALTER TABLE "PackingJobTransactions" ADD COLUMN IF NOT EXISTS "PaidByEmployeeId" uuid NULL;
        ALTER TABLE "DeliveryJobTransactions" ADD COLUMN IF NOT EXISTS "PaidByEmployeeId" uuid NULL;
        """;
}
