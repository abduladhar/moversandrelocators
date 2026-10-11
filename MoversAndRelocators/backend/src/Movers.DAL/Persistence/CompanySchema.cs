using System.Text;
using Microsoft.EntityFrameworkCore;

namespace Movers.DAL.Persistence;

/// <summary>
/// Idempotent upgrade (script 034): companies inside a tenant. Adds the Companies table, Users.CompanyId and a CompanyId
/// on every company table; gives each existing tenant a default company (MAIN) that receives all existing records.
/// Existing users join that company, except tenant administrators, who become tenant users and can switch companies.
/// Masters get an optional CompanyId and stay shared (no company) until someone marks one for a single company.
/// </summary>
public static class CompanySchema
{
    /// <summary>Tables of company records (everything tenant-owned except the shared masters). Kept in step with the model by a test.</summary>
    public static readonly string[] CompanyTables =
    [
        "AiUsageRecords", "BillingRecords", "DeliveryItems", "DeliveryJobCrew", "DeliveryJobs", "DeliveryJobTimeEvents", "DeliveryJobTransactions",
        "DeliveryNoteLinks", "DeliveryNotes", "ExpenseAttachments", "JobCargo", "JobExpenses", "JournalEntries", "JournalLines", "LabourEntries",
        "LeadFollowUps", "PackageHandovers", "PackingConfirmations", "PackingJobBoxes", "PackingJobBoxItems", "PackingJobBoxMaterials",
        "PackingJobCrew", "PackingJobLinks", "PackingJobMaterials", "PackingJobs", "PackingJobTimeEvents", "PackingJobTransactions",
        "PickupAssignments", "PickupAttachments", "PickupBoxPickEvents", "PickupBoxPicks", "PickupCollectionApprovals", "PickupExpenses",
        "PickupMaterialUsages", "PickupPackageItems", "PickupPackages", "PickupPackingJobs", "Pickups", "PickupSignoffs", "PickupTimeEvents",
        "PickupTransactions", "QuotationItems", "QuotationLines", "QuotationLineTaxes", "QuotationRequoteRequests", "Quotations",
        "SalesLeadAttachments", "SalesLeadInventoryItems", "SalesLeads", "SalesLeadUploadLinks", "ShipmentClaims", "SurveyAttachments",
        "SurveyExpenses", "SurveyExtraMaterials", "SurveyItems", "SurveyRooms", "Surveys", "SurveyTimeEvents", "TransportJobs",
        "TransportTrips", "TripAllocations", "WarehouseAttachments", "WarehouseReceipts"
    ];

    /// <summary>Masters: shared (no company) or one company only. They get the column but are never backfilled.</summary>
    public static readonly string[] OptionalCompanyTables =
    [
        "BoxTypes", "BusinessMasters", "ChargeMasters", "Designations", "Employees", "FollowUpStatuses", "HouseholdItems", "LeadStatuses",
        "MoveTypes", "PackingMaterials", "PickupStatuses", "TaxMasters", "Teams", "Vehicles", "Warehouses"
    ];

    public static async Task Apply(MoversDbContext db)
    {
        if (db.Database.IsSqlServer()) { foreach (var batch in System.Text.RegularExpressions.Regex.Split(SqlServer, @"^\s*GO\s*$", System.Text.RegularExpressions.RegexOptions.Multiline)) if (!string.IsNullOrWhiteSpace(batch)) await db.Database.ExecuteSqlRawAsync(batch); }
        else if (db.Database.IsNpgsql()) await db.Database.ExecuteSqlRawAsync(PostgreSql);
        // SQLite is only used for fresh test databases, which EnsureCreated builds from the current model.
    }

    private static string SharedKinds => string.Join(", ", MoversDbContext.SharedBillingKinds.Order().Select(x => "'" + x + "'"));

    public static string SqlServer
    {
        get
        {
            var sql = new StringBuilder("""
                IF OBJECT_ID(N'dbo.Companies', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[Companies] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_Companies] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL,
                        [Code] NVARCHAR(20) NOT NULL, [Name] NVARCHAR(160) NOT NULL, [LegalName] NVARCHAR(200) NULL, [TaxNumber] NVARCHAR(40) NULL, [Address] NVARCHAR(500) NULL,
                        [Phone] NVARCHAR(40) NULL, [Email] NVARCHAR(254) NULL, [Website] NVARCHAR(200) NULL, [NumberCode] NVARCHAR(10) NULL, [IsDefault] BIT NOT NULL, [IsActive] BIT NOT NULL,
                        [CreatedAtUtc] DATETIMEOFFSET NOT NULL, [UpdatedAtUtc] DATETIMEOFFSET NOT NULL,
                        CONSTRAINT [FK_Companies_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]));
                    CREATE UNIQUE INDEX [IX_Companies_Id] ON [dbo].[Companies]([Id]);
                    CREATE UNIQUE INDEX [IX_Companies_TenantId_Code] ON [dbo].[Companies]([TenantId], [Code]);
                    CREATE INDEX [IX_Companies_TenantId] ON [dbo].[Companies]([TenantId]);
                END
                GO
                IF COL_LENGTH(N'dbo.Users', N'CompanyId') IS NULL ALTER TABLE [dbo].[Users] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
                GO
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Users_CompanyId' AND object_id = OBJECT_ID(N'dbo.Users')) CREATE INDEX [IX_Users_CompanyId] ON [dbo].[Users]([CompanyId]);
                GO

                """);
            foreach (var table in CompanyTables.Concat(OptionalCompanyTables))
                sql.Append($"""
                    IF COL_LENGTH(N'dbo.{table}', N'CompanyId') IS NULL ALTER TABLE [dbo].[{table}] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
                    GO
                    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_{table}_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.{table}')) CREATE INDEX [IX_{table}_TenantId_CompanyId] ON [dbo].[{table}]([TenantId], [CompanyId]);
                    GO

                    """);
            sql.Append("""
                -- A default company for every tenant that has none; that tenant's users join it, except tenant administrators.
                DECLARE @created TABLE ([TenantId] UNIQUEIDENTIFIER NOT NULL, [CompanyId] UNIQUEIDENTIFIER NOT NULL);
                INSERT INTO [dbo].[Companies] ([Id], [TenantId], [Code], [Name], [Address], [Phone], [Email], [IsDefault], [IsActive], [CreatedAtUtc], [UpdatedAtUtc])
                OUTPUT inserted.[TenantId], inserted.[Id] INTO @created
                SELECT NEWID(), t.[Id], N'MAIN', t.[Name], t.[Address], t.[Phone], t.[ContactEmail], 1, 1, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET()
                FROM [dbo].[Tenants] t WHERE NOT EXISTS (SELECT 1 FROM [dbo].[Companies] c WHERE c.[TenantId] = t.[Id]);
                UPDATE u SET u.[CompanyId] = n.[CompanyId] FROM [dbo].[Users] u JOIN @created n ON n.[TenantId] = u.[TenantId]
                WHERE NOT EXISTS (SELECT 1 FROM [dbo].[UserRoles] ur JOIN [dbo].[Roles] r ON r.[Id] = ur.[RoleId] WHERE ur.[UserId] = u.[Id] AND r.[Code] = N'TENANT_ADMIN');
                GO

                """);
            foreach (var table in CompanyTables)
                sql.Append($"""
                    UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[{table}] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
                    WHERE x.[CompanyId] IS NULL{(table == "BillingRecords" ? $" AND x.[Kind] NOT IN ({SharedKinds})" : "")};
                    GO

                    """);
            return sql.ToString();
        }
    }

    public static string PostgreSql
    {
        get
        {
            var sql = new StringBuilder("""
                CREATE TABLE IF NOT EXISTS "Companies" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"),
                    "Code" varchar(20) NOT NULL, "Name" varchar(160) NOT NULL, "LegalName" varchar(200) NULL, "TaxNumber" varchar(40) NULL, "Address" varchar(500) NULL, "Phone" varchar(40) NULL,
                    "Email" varchar(254) NULL, "Website" varchar(200) NULL, "NumberCode" varchar(10) NULL, "IsDefault" boolean NOT NULL, "IsActive" boolean NOT NULL,
                    "CreatedAtUtc" timestamp with time zone NOT NULL, "UpdatedAtUtc" timestamp with time zone NOT NULL);
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Companies_Id" ON "Companies"("Id");
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Companies_TenantId_Code" ON "Companies"("TenantId", "Code");
                CREATE INDEX IF NOT EXISTS "IX_Companies_TenantId" ON "Companies"("TenantId");
                ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "CompanyId" uuid NULL;
                CREATE INDEX IF NOT EXISTS "IX_Users_CompanyId" ON "Users"("CompanyId");

                """);
            foreach (var table in CompanyTables.Concat(OptionalCompanyTables))
                sql.Append($"""
                    ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "CompanyId" uuid NULL;
                    CREATE INDEX IF NOT EXISTS "IX_{table}_TenantId_CompanyId" ON "{table}"("TenantId", "CompanyId");

                    """);
            sql.Append("""
                WITH created AS (
                    INSERT INTO "Companies" ("Id", "TenantId", "Code", "Name", "Address", "Phone", "Email", "IsDefault", "IsActive", "CreatedAtUtc", "UpdatedAtUtc")
                    SELECT gen_random_uuid(), t."Id", 'MAIN', t."Name", t."Address", t."Phone", t."ContactEmail", true, true, now(), now()
                    FROM "Tenants" t WHERE NOT EXISTS (SELECT 1 FROM "Companies" c WHERE c."TenantId" = t."Id")
                    RETURNING "TenantId", "Id")
                UPDATE "Users" u SET "CompanyId" = created."Id" FROM created WHERE created."TenantId" = u."TenantId"
                    AND NOT EXISTS (SELECT 1 FROM "UserRoles" ur JOIN "Roles" r ON r."Id" = ur."RoleId" WHERE ur."UserId" = u."Id" AND r."Code" = 'TENANT_ADMIN');

                """);
            foreach (var table in CompanyTables)
                sql.Append($"""
                    UPDATE "{table}" x SET "CompanyId" = c."Id" FROM "Companies" c WHERE c."TenantId" = x."TenantId" AND c."IsDefault" AND x."CompanyId" IS NULL{(table == "BillingRecords" ? $" AND x.\"Kind\" NOT IN ({SharedKinds})" : "")};

                    """);
            return sql.ToString();
        }
    }
}
