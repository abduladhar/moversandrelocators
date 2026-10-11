using Microsoft.EntityFrameworkCore;
namespace Movers.DAL.Persistence;
public static class LeadMediaSchema
{
    public static async Task Apply(MoversDbContext db)
    {
        foreach (var (table, column) in new[] {
            ("SalesLeadUploadLinks", "RequestedItems"), ("SalesLeadUploadLinks", "Description"),
            ("SalesLeadUploadLinks", "CustomerItems"), ("SalesLeadUploadLinks", "CustomerDescription"),
            ("SalesLeadAttachments", "ExtractionJson"), ("Quotations", "RevisedFromNumber"), ("Quotations", "RevisionReason") })
        {
            if (db.Database.IsSqlServer())
                await db.Database.ExecuteSqlRawAsync($"IF COL_LENGTH(N'dbo.{table}', N'{column}') IS NULL ALTER TABLE [dbo].[{table}] ADD [{column}] nvarchar(max) NULL;");
            else if (db.Database.IsNpgsql())
                await db.Database.ExecuteSqlRawAsync($"ALTER TABLE \"{table}\" ADD COLUMN IF NOT EXISTS \"{column}\" text NULL;");
            else
            {
                await db.Database.OpenConnectionAsync();
                try {
                    await using var command = db.Database.GetDbConnection().CreateCommand();
                    command.CommandText = $"PRAGMA table_info(\"{table}\");";
                    bool exists = false;
                    await using (var reader = await command.ExecuteReaderAsync())
                        while (await reader.ReadAsync()) if (reader.GetString(1) == column) exists = true;
                    if (!exists) await db.Database.ExecuteSqlRawAsync($"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" TEXT NULL;");
                } finally { await db.Database.CloseConnectionAsync(); }
            }
        }
    }
}
