using Microsoft.EntityFrameworkCore;
namespace Movers.DAL.Persistence;

/// <summary>Idempotent upgrade that adds the packing module tables to existing databases (script 022).</summary>
public static class PackingSchema
{
    public static async Task Apply(MoversDbContext db)
    {
        if (db.Database.IsSqlServer()) { foreach (var batch in System.Text.RegularExpressions.Regex.Split(SqlServer, @"^\s*GO\s*$", System.Text.RegularExpressions.RegexOptions.Multiline)) await db.Database.ExecuteSqlRawAsync(batch); }
        else if (db.Database.IsNpgsql()) await db.Database.ExecuteSqlRawAsync(PostgreSql);
        // SQLite is only used for fresh test databases, which EnsureCreated builds from the current model.
    }

    public const string SqlServer = """
        IF OBJECT_ID(N'dbo.PackingJobs', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[PackingJobs] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PackingJobs] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [JobNumber] NVARCHAR(40) NOT NULL, [PickupId] UNIQUEIDENTIFIER NULL, [QuotationId] UNIQUEIDENTIFIER NULL, [SalesLeadId] UNIQUEIDENTIFIER NULL, [CustomerName] NVARCHAR(160) NOT NULL, [Phone] NVARCHAR(40) NOT NULL, [Email] NVARCHAR(254) NULL, [Address] NVARCHAR(500) NOT NULL, [ScheduledAtUtc] DATETIMEOFFSET NOT NULL, [Status] NVARCHAR(20) NOT NULL, [Notes] NVARCHAR(2000) NULL, [StartedAtUtc] DATETIMEOFFSET NULL, [CompletedAtUtc] DATETIMEOFFSET NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL, [UpdatedAtUtc] DATETIMEOFFSET NOT NULL, [Version] UNIQUEIDENTIFIER NOT NULL,
                CONSTRAINT [FK_PackingJobs_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PackingJobs_Pickups] FOREIGN KEY ([PickupId]) REFERENCES [dbo].[Pickups]([Id]), CONSTRAINT [FK_PackingJobs_Quotations] FOREIGN KEY ([QuotationId]) REFERENCES [dbo].[Quotations]([Id]), CONSTRAINT [FK_PackingJobs_SalesLeads] FOREIGN KEY ([SalesLeadId]) REFERENCES [dbo].[SalesLeads]([Id]));
            CREATE UNIQUE INDEX [IX_PackingJobs_Id] ON [dbo].[PackingJobs]([Id]);
            CREATE UNIQUE INDEX [IX_PackingJobs_TenantId_JobNumber] ON [dbo].[PackingJobs]([TenantId],[JobNumber]);
            CREATE INDEX [IX_PackingJobs_TenantId] ON [dbo].[PackingJobs]([TenantId]);
        END
        GO
        IF OBJECT_ID(N'dbo.PackingJobCrew', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[PackingJobCrew] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PackingJobCrew] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PackingJobId] UNIQUEIDENTIFIER NOT NULL, [EmployeeId] UNIQUEIDENTIFIER NOT NULL, [Role] NVARCHAR(80) NOT NULL,
                CONSTRAINT [FK_PackingJobCrew_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PackingJobCrew_PackingJobs] FOREIGN KEY ([PackingJobId]) REFERENCES [dbo].[PackingJobs]([Id]) ON DELETE CASCADE, CONSTRAINT [FK_PackingJobCrew_Employees] FOREIGN KEY ([EmployeeId]) REFERENCES [dbo].[Employees]([Id]));
            CREATE UNIQUE INDEX [IX_PackingJobCrew_Id] ON [dbo].[PackingJobCrew]([Id]);
            CREATE INDEX [IX_PackingJobCrew_PackingJobId] ON [dbo].[PackingJobCrew]([PackingJobId]);
            CREATE INDEX [IX_PackingJobCrew_TenantId] ON [dbo].[PackingJobCrew]([TenantId]);
        END
        IF OBJECT_ID(N'dbo.PackingJobBoxes', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[PackingJobBoxes] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PackingJobBoxes] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PackingJobId] UNIQUEIDENTIFIER NOT NULL, [BoxTypeId] UNIQUEIDENTIFIER NOT NULL, [TrackingNumber] NVARCHAR(80) NOT NULL, [RoomName] NVARCHAR(120) NULL, [IsFragile] BIT NOT NULL, [Notes] NVARCHAR(500) NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL, [LabelPrintedAtUtc] DATETIMEOFFSET NULL, [LabelPrintCount] INT NOT NULL, [CustomMaterials] BIT NOT NULL CONSTRAINT [DF_PackingJobBoxes_CustomMaterials] DEFAULT 0,
                CONSTRAINT [FK_PackingJobBoxes_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PackingJobBoxes_PackingJobs] FOREIGN KEY ([PackingJobId]) REFERENCES [dbo].[PackingJobs]([Id]) ON DELETE CASCADE, CONSTRAINT [FK_PackingJobBoxes_BoxTypes] FOREIGN KEY ([BoxTypeId]) REFERENCES [dbo].[BoxTypes]([Id]));
            CREATE UNIQUE INDEX [IX_PackingJobBoxes_Id] ON [dbo].[PackingJobBoxes]([Id]);
            CREATE UNIQUE INDEX [IX_PackingJobBoxes_TenantId_TrackingNumber] ON [dbo].[PackingJobBoxes]([TenantId],[TrackingNumber]);
            CREATE INDEX [IX_PackingJobBoxes_PackingJobId] ON [dbo].[PackingJobBoxes]([PackingJobId]);
        END
        GO
        IF OBJECT_ID(N'dbo.PackingJobBoxItems', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[PackingJobBoxItems] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PackingJobBoxItems] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PackingJobBoxId] UNIQUEIDENTIFIER NOT NULL, [ItemName] NVARCHAR(160) NOT NULL, [Quantity] INT NOT NULL, [Notes] NVARCHAR(500) NULL, [HouseholdItemId] UNIQUEIDENTIFIER NULL,
                CONSTRAINT [FK_PackingJobBoxItems_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PackingJobBoxItems_PackingJobBoxes] FOREIGN KEY ([PackingJobBoxId]) REFERENCES [dbo].[PackingJobBoxes]([Id]) ON DELETE CASCADE);
            CREATE UNIQUE INDEX [IX_PackingJobBoxItems_Id] ON [dbo].[PackingJobBoxItems]([Id]);
            CREATE INDEX [IX_PackingJobBoxItems_PackingJobBoxId] ON [dbo].[PackingJobBoxItems]([PackingJobBoxId]);
            CREATE INDEX [IX_PackingJobBoxItems_TenantId] ON [dbo].[PackingJobBoxItems]([TenantId]);
        END
        IF OBJECT_ID(N'dbo.PackingJobMaterials', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[PackingJobMaterials] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PackingJobMaterials] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PackingJobId] UNIQUEIDENTIFIER NOT NULL, [MaterialId] UNIQUEIDENTIFIER NOT NULL, [Quantity] DECIMAL(12,3) NOT NULL, [UnitCost] DECIMAL(20,4) NOT NULL, [IsBoxRecipe] BIT NOT NULL,
                CONSTRAINT [FK_PackingJobMaterials_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PackingJobMaterials_PackingJobs] FOREIGN KEY ([PackingJobId]) REFERENCES [dbo].[PackingJobs]([Id]) ON DELETE CASCADE, CONSTRAINT [FK_PackingJobMaterials_PackingMaterials] FOREIGN KEY ([MaterialId]) REFERENCES [dbo].[PackingMaterials]([Id]));
            CREATE UNIQUE INDEX [IX_PackingJobMaterials_Id] ON [dbo].[PackingJobMaterials]([Id]);
            CREATE INDEX [IX_PackingJobMaterials_PackingJobId] ON [dbo].[PackingJobMaterials]([PackingJobId]);
            CREATE INDEX [IX_PackingJobMaterials_TenantId] ON [dbo].[PackingJobMaterials]([TenantId]);
        END
        IF OBJECT_ID(N'dbo.PackingJobTransactions', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[PackingJobTransactions] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PackingJobTransactions] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PackingJobId] UNIQUEIDENTIFIER NOT NULL, [TransactionNumber] NVARCHAR(60) NOT NULL, [Type] NVARCHAR(20) NOT NULL, [Category] NVARCHAR(120) NOT NULL, [Amount] DECIMAL(20,4) NOT NULL, [PaymentMethod] NVARCHAR(40) NOT NULL, [Notes] NVARCHAR(500) NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL,
                CONSTRAINT [FK_PackingJobTransactions_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PackingJobTransactions_PackingJobs] FOREIGN KEY ([PackingJobId]) REFERENCES [dbo].[PackingJobs]([Id]) ON DELETE CASCADE);
            CREATE UNIQUE INDEX [IX_PackingJobTransactions_Id] ON [dbo].[PackingJobTransactions]([Id]);
            CREATE UNIQUE INDEX [IX_PackingJobTransactions_TenantId_TransactionNumber] ON [dbo].[PackingJobTransactions]([TenantId],[TransactionNumber]);
            CREATE INDEX [IX_PackingJobTransactions_PackingJobId] ON [dbo].[PackingJobTransactions]([PackingJobId]);
        END
        GO
        IF COL_LENGTH(N'dbo.PackingJobBoxes', N'CustomMaterials') IS NULL
            ALTER TABLE [dbo].[PackingJobBoxes] ADD [CustomMaterials] BIT NOT NULL CONSTRAINT [DF_PackingJobBoxes_CustomMaterials] DEFAULT 0;
        IF OBJECT_ID(N'dbo.PackingJobBoxMaterials', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[PackingJobBoxMaterials] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PackingJobBoxMaterials] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PackingJobBoxId] UNIQUEIDENTIFIER NOT NULL, [MaterialId] UNIQUEIDENTIFIER NOT NULL, [Quantity] DECIMAL(12,3) NOT NULL,
                CONSTRAINT [FK_PackingJobBoxMaterials_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PackingJobBoxMaterials_PackingJobBoxes] FOREIGN KEY ([PackingJobBoxId]) REFERENCES [dbo].[PackingJobBoxes]([Id]) ON DELETE CASCADE, CONSTRAINT [FK_PackingJobBoxMaterials_PackingMaterials] FOREIGN KEY ([MaterialId]) REFERENCES [dbo].[PackingMaterials]([Id]));
            CREATE UNIQUE INDEX [IX_PackingJobBoxMaterials_Id] ON [dbo].[PackingJobBoxMaterials]([Id]);
            CREATE INDEX [IX_PackingJobBoxMaterials_PackingJobBoxId] ON [dbo].[PackingJobBoxMaterials]([PackingJobBoxId]);
            CREATE INDEX [IX_PackingJobBoxMaterials_TenantId] ON [dbo].[PackingJobBoxMaterials]([TenantId]);
        END
        GO
        IF COL_LENGTH(N'dbo.PackingJobs', N'ScheduleConfirmedAtUtc') IS NULL
            ALTER TABLE [dbo].[PackingJobs] ADD [ScheduleConfirmedAtUtc] DATETIMEOFFSET NULL, [Latitude] DECIMAL(9,6) NULL, [Longitude] DECIMAL(9,6) NULL,
                [ItemsResponse] NVARCHAR(20) NULL, [ItemsResponderName] NVARCHAR(160) NULL, [ItemsResponseNotes] NVARCHAR(2000) NULL, [ItemsRespondedAtUtc] DATETIMEOFFSET NULL, [ItemsSnapshotHash] NVARCHAR(64) NULL, [ItemsSnapshotJson] NVARCHAR(MAX) NULL;
        IF COL_LENGTH(N'dbo.PackingJobs', N'LocationSharedAtUtc') IS NULL
            ALTER TABLE [dbo].[PackingJobs] ADD [LocationNotes] NVARCHAR(500) NULL, [LocationSharedAtUtc] DATETIMEOFFSET NULL;
        IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PackingJobs_ShareTokenHash' AND object_id = OBJECT_ID(N'dbo.PackingJobs'))
            DROP INDEX [IX_PackingJobs_ShareTokenHash] ON [dbo].[PackingJobs];
        GO
        IF COL_LENGTH(N'dbo.PackingJobs', N'ShareTokenHash') IS NOT NULL
            ALTER TABLE [dbo].[PackingJobs] DROP COLUMN [ShareTokenHash], [ShareExpiresAtUtc];
        IF OBJECT_ID(N'dbo.PackingJobLinks', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[PackingJobLinks] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PackingJobLinks] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PackingJobId] UNIQUEIDENTIFIER NOT NULL, [Purpose] NVARCHAR(20) NOT NULL, [TokenHash] NVARCHAR(64) NOT NULL, [ExpiresAtUtc] DATETIMEOFFSET NOT NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL,
                CONSTRAINT [FK_PackingJobLinks_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PackingJobLinks_PackingJobs] FOREIGN KEY ([PackingJobId]) REFERENCES [dbo].[PackingJobs]([Id]) ON DELETE CASCADE);
            CREATE UNIQUE INDEX [IX_PackingJobLinks_Id] ON [dbo].[PackingJobLinks]([Id]);
            CREATE UNIQUE INDEX [IX_PackingJobLinks_TokenHash] ON [dbo].[PackingJobLinks]([TokenHash]);
            CREATE INDEX [IX_PackingJobLinks_PackingJobId] ON [dbo].[PackingJobLinks]([PackingJobId]);
            CREATE INDEX [IX_PackingJobLinks_TenantId] ON [dbo].[PackingJobLinks]([TenantId]);
        END
        GO
        IF COL_LENGTH(N'dbo.PackingJobs', N'IsPaused') IS NULL
            ALTER TABLE [dbo].[PackingJobs] ADD [IsPaused] BIT NOT NULL CONSTRAINT [DF_PackingJobs_IsPaused] DEFAULT 0;
        IF OBJECT_ID(N'dbo.PackingJobTimeEvents', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[PackingJobTimeEvents] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PackingJobTimeEvents] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PackingJobId] UNIQUEIDENTIFIER NOT NULL, [Type] NVARCHAR(20) NOT NULL, [OccurredAtUtc] DATETIMEOFFSET NOT NULL, [Reason] NVARCHAR(500) NULL, [RecordedBy] NVARCHAR(254) NOT NULL,
                CONSTRAINT [FK_PackingJobTimeEvents_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PackingJobTimeEvents_PackingJobs] FOREIGN KEY ([PackingJobId]) REFERENCES [dbo].[PackingJobs]([Id]) ON DELETE CASCADE);
            CREATE UNIQUE INDEX [IX_PackingJobTimeEvents_Id] ON [dbo].[PackingJobTimeEvents]([Id]);
            CREATE INDEX [IX_PackingJobTimeEvents_PackingJobId] ON [dbo].[PackingJobTimeEvents]([PackingJobId]);
            CREATE INDEX [IX_PackingJobTimeEvents_TenantId] ON [dbo].[PackingJobTimeEvents]([TenantId]);
        END
        """;

    public const string PostgreSql = """
        CREATE TABLE IF NOT EXISTS "PackingJobs" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "JobNumber" varchar(40) NOT NULL, "PickupId" uuid NULL REFERENCES "Pickups"("Id"), "QuotationId" uuid NULL REFERENCES "Quotations"("Id"), "SalesLeadId" uuid NULL REFERENCES "SalesLeads"("Id"), "CustomerName" varchar(160) NOT NULL, "Phone" varchar(40) NOT NULL, "Email" varchar(254) NULL, "Address" varchar(500) NOT NULL, "ScheduledAtUtc" timestamp with time zone NOT NULL, "Status" varchar(20) NOT NULL, "Notes" varchar(2000) NULL, "StartedAtUtc" timestamp with time zone NULL, "CompletedAtUtc" timestamp with time zone NULL, "CreatedAtUtc" timestamp with time zone NOT NULL, "UpdatedAtUtc" timestamp with time zone NOT NULL, "Version" uuid NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PackingJobs_Id" ON "PackingJobs"("Id");
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PackingJobs_TenantId_JobNumber" ON "PackingJobs"("TenantId","JobNumber");
        CREATE INDEX IF NOT EXISTS "IX_PackingJobs_TenantId" ON "PackingJobs"("TenantId");
        CREATE TABLE IF NOT EXISTS "PackingJobCrew" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "PackingJobId" uuid NOT NULL REFERENCES "PackingJobs"("Id") ON DELETE CASCADE, "EmployeeId" uuid NOT NULL REFERENCES "Employees"("Id"), "Role" varchar(80) NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PackingJobCrew_Id" ON "PackingJobCrew"("Id");
        CREATE INDEX IF NOT EXISTS "IX_PackingJobCrew_PackingJobId" ON "PackingJobCrew"("PackingJobId");
        CREATE INDEX IF NOT EXISTS "IX_PackingJobCrew_TenantId" ON "PackingJobCrew"("TenantId");
        CREATE TABLE IF NOT EXISTS "PackingJobBoxes" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "PackingJobId" uuid NOT NULL REFERENCES "PackingJobs"("Id") ON DELETE CASCADE, "BoxTypeId" uuid NOT NULL REFERENCES "BoxTypes"("Id"), "TrackingNumber" varchar(80) NOT NULL, "RoomName" varchar(120) NULL, "IsFragile" boolean NOT NULL, "Notes" varchar(500) NULL, "CreatedAtUtc" timestamp with time zone NOT NULL, "LabelPrintedAtUtc" timestamp with time zone NULL, "LabelPrintCount" integer NOT NULL, "CustomMaterials" boolean NOT NULL DEFAULT FALSE);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PackingJobBoxes_Id" ON "PackingJobBoxes"("Id");
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PackingJobBoxes_TenantId_TrackingNumber" ON "PackingJobBoxes"("TenantId","TrackingNumber");
        CREATE INDEX IF NOT EXISTS "IX_PackingJobBoxes_PackingJobId" ON "PackingJobBoxes"("PackingJobId");
        CREATE TABLE IF NOT EXISTS "PackingJobBoxItems" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "PackingJobBoxId" uuid NOT NULL REFERENCES "PackingJobBoxes"("Id") ON DELETE CASCADE, "ItemName" varchar(160) NOT NULL, "Quantity" integer NOT NULL, "Notes" varchar(500) NULL, "HouseholdItemId" uuid NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PackingJobBoxItems_Id" ON "PackingJobBoxItems"("Id");
        CREATE INDEX IF NOT EXISTS "IX_PackingJobBoxItems_PackingJobBoxId" ON "PackingJobBoxItems"("PackingJobBoxId");
        CREATE INDEX IF NOT EXISTS "IX_PackingJobBoxItems_TenantId" ON "PackingJobBoxItems"("TenantId");
        CREATE TABLE IF NOT EXISTS "PackingJobMaterials" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "PackingJobId" uuid NOT NULL REFERENCES "PackingJobs"("Id") ON DELETE CASCADE, "MaterialId" uuid NOT NULL REFERENCES "PackingMaterials"("Id"), "Quantity" numeric(12,3) NOT NULL, "UnitCost" numeric(20,4) NOT NULL, "IsBoxRecipe" boolean NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PackingJobMaterials_Id" ON "PackingJobMaterials"("Id");
        CREATE INDEX IF NOT EXISTS "IX_PackingJobMaterials_PackingJobId" ON "PackingJobMaterials"("PackingJobId");
        CREATE INDEX IF NOT EXISTS "IX_PackingJobMaterials_TenantId" ON "PackingJobMaterials"("TenantId");
        CREATE TABLE IF NOT EXISTS "PackingJobTransactions" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "PackingJobId" uuid NOT NULL REFERENCES "PackingJobs"("Id") ON DELETE CASCADE, "TransactionNumber" varchar(60) NOT NULL, "Type" varchar(20) NOT NULL, "Category" varchar(120) NOT NULL, "Amount" numeric(20,4) NOT NULL, "PaymentMethod" varchar(40) NOT NULL, "Notes" varchar(500) NULL, "CreatedAtUtc" timestamp with time zone NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PackingJobTransactions_Id" ON "PackingJobTransactions"("Id");
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PackingJobTransactions_TenantId_TransactionNumber" ON "PackingJobTransactions"("TenantId","TransactionNumber");
        CREATE INDEX IF NOT EXISTS "IX_PackingJobTransactions_PackingJobId" ON "PackingJobTransactions"("PackingJobId");
        ALTER TABLE "PackingJobBoxes" ADD COLUMN IF NOT EXISTS "CustomMaterials" boolean NOT NULL DEFAULT FALSE;
        CREATE TABLE IF NOT EXISTS "PackingJobBoxMaterials" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "PackingJobBoxId" uuid NOT NULL REFERENCES "PackingJobBoxes"("Id") ON DELETE CASCADE, "MaterialId" uuid NOT NULL REFERENCES "PackingMaterials"("Id"), "Quantity" numeric(12,3) NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PackingJobBoxMaterials_Id" ON "PackingJobBoxMaterials"("Id");
        CREATE INDEX IF NOT EXISTS "IX_PackingJobBoxMaterials_PackingJobBoxId" ON "PackingJobBoxMaterials"("PackingJobBoxId");
        CREATE INDEX IF NOT EXISTS "IX_PackingJobBoxMaterials_TenantId" ON "PackingJobBoxMaterials"("TenantId");
        ALTER TABLE "PackingJobs" ADD COLUMN IF NOT EXISTS "ScheduleConfirmedAtUtc" timestamp with time zone NULL, ADD COLUMN IF NOT EXISTS "Latitude" numeric(9,6) NULL, ADD COLUMN IF NOT EXISTS "Longitude" numeric(9,6) NULL,
            ADD COLUMN IF NOT EXISTS "LocationNotes" varchar(500) NULL, ADD COLUMN IF NOT EXISTS "LocationSharedAtUtc" timestamp with time zone NULL,
            ADD COLUMN IF NOT EXISTS "ItemsResponse" varchar(20) NULL, ADD COLUMN IF NOT EXISTS "ItemsResponderName" varchar(160) NULL, ADD COLUMN IF NOT EXISTS "ItemsResponseNotes" varchar(2000) NULL, ADD COLUMN IF NOT EXISTS "ItemsRespondedAtUtc" timestamp with time zone NULL, ADD COLUMN IF NOT EXISTS "ItemsSnapshotHash" varchar(64) NULL, ADD COLUMN IF NOT EXISTS "ItemsSnapshotJson" text NULL;
        DROP INDEX IF EXISTS "IX_PackingJobs_ShareTokenHash";
        ALTER TABLE "PackingJobs" DROP COLUMN IF EXISTS "ShareTokenHash", DROP COLUMN IF EXISTS "ShareExpiresAtUtc";
        CREATE TABLE IF NOT EXISTS "PackingJobLinks" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "PackingJobId" uuid NOT NULL REFERENCES "PackingJobs"("Id") ON DELETE CASCADE, "Purpose" varchar(20) NOT NULL, "TokenHash" varchar(64) NOT NULL, "ExpiresAtUtc" timestamp with time zone NOT NULL, "CreatedAtUtc" timestamp with time zone NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PackingJobLinks_Id" ON "PackingJobLinks"("Id");
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PackingJobLinks_TokenHash" ON "PackingJobLinks"("TokenHash");
        CREATE INDEX IF NOT EXISTS "IX_PackingJobLinks_PackingJobId" ON "PackingJobLinks"("PackingJobId");
        CREATE INDEX IF NOT EXISTS "IX_PackingJobLinks_TenantId" ON "PackingJobLinks"("TenantId");
        ALTER TABLE "PackingJobs" ADD COLUMN IF NOT EXISTS "IsPaused" boolean NOT NULL DEFAULT FALSE;
        CREATE TABLE IF NOT EXISTS "PackingJobTimeEvents" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "PackingJobId" uuid NOT NULL REFERENCES "PackingJobs"("Id") ON DELETE CASCADE, "Type" varchar(20) NOT NULL, "OccurredAtUtc" timestamp with time zone NOT NULL, "Reason" varchar(500) NULL, "RecordedBy" varchar(254) NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PackingJobTimeEvents_Id" ON "PackingJobTimeEvents"("Id");
        CREATE INDEX IF NOT EXISTS "IX_PackingJobTimeEvents_PackingJobId" ON "PackingJobTimeEvents"("PackingJobId");
        CREATE INDEX IF NOT EXISTS "IX_PackingJobTimeEvents_TenantId" ON "PackingJobTimeEvents"("TenantId");
        """;
}
