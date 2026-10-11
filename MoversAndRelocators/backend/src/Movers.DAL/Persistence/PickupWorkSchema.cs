using Microsoft.EntityFrameworkCore;
namespace Movers.DAL.Persistence;

/// <summary>Idempotent upgrade for pickup field work: trip clock, rooms, box-recipe materials, crew expenses, stage photos, sign-offs and warehouses (script 021).</summary>
public static class PickupWorkSchema
{
    public static async Task Apply(MoversDbContext db)
    {
        // SQL Server runs Warehouses as its own batch because later statements reference it.
        if (db.Database.IsSqlServer()) { foreach (var batch in System.Text.RegularExpressions.Regex.Split(SqlServer, @"^\s*GO\s*$", System.Text.RegularExpressions.RegexOptions.Multiline)) await db.Database.ExecuteSqlRawAsync(batch); }
        else if (db.Database.IsNpgsql()) await db.Database.ExecuteSqlRawAsync(PostgreSql);
        // SQLite is only used for fresh test databases, which EnsureCreated builds from the current model.
    }

    public const string SqlServer = """
        IF OBJECT_ID(N'dbo.Warehouses', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[Warehouses] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_Warehouses] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [Code] NVARCHAR(40) NOT NULL, [Name] NVARCHAR(160) NOT NULL, [Address] NVARCHAR(500) NULL, [IsActive] BIT NOT NULL,
                CONSTRAINT [FK_Warehouses_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]));
            CREATE UNIQUE INDEX [IX_Warehouses_Id] ON [dbo].[Warehouses]([Id]);
            CREATE UNIQUE INDEX [IX_Warehouses_TenantId_Code] ON [dbo].[Warehouses]([TenantId],[Code]);
        END
        GO
        IF COL_LENGTH(N'dbo.Pickups', N'SalesLeadId') IS NULL ALTER TABLE [dbo].[Pickups] ADD [SalesLeadId] UNIQUEIDENTIFIER NULL CONSTRAINT [FK_Pickups_SalesLeads] FOREIGN KEY REFERENCES [dbo].[SalesLeads]([Id]);
        IF COL_LENGTH(N'dbo.Pickups', N'StartedAtUtc') IS NULL ALTER TABLE [dbo].[Pickups] ADD [StartedAtUtc] DATETIMEOFFSET NULL;
        IF COL_LENGTH(N'dbo.Pickups', N'EndedAtUtc') IS NULL ALTER TABLE [dbo].[Pickups] ADD [EndedAtUtc] DATETIMEOFFSET NULL;
        IF COL_LENGTH(N'dbo.Pickups', N'IsPaused') IS NULL ALTER TABLE [dbo].[Pickups] ADD [IsPaused] BIT NOT NULL CONSTRAINT [DF_Pickups_IsPaused] DEFAULT(0);
        IF COL_LENGTH(N'dbo.Pickups', N'DistanceKm') IS NULL ALTER TABLE [dbo].[Pickups] ADD [DistanceKm] DECIMAL(10,2) NULL;
        IF COL_LENGTH(N'dbo.PickupPackages', N'RoomName') IS NULL ALTER TABLE [dbo].[PickupPackages] ADD [RoomName] NVARCHAR(120) NULL;
        IF COL_LENGTH(N'dbo.PickupPackages', N'IsFragile') IS NULL ALTER TABLE [dbo].[PickupPackages] ADD [IsFragile] BIT NOT NULL CONSTRAINT [DF_PickupPackages_IsFragile] DEFAULT(0);
        IF COL_LENGTH(N'dbo.PickupPackageItems', N'RoomName') IS NULL ALTER TABLE [dbo].[PickupPackageItems] ADD [RoomName] NVARCHAR(120) NULL;
        IF COL_LENGTH(N'dbo.PickupPackageItems', N'HouseholdItemId') IS NULL ALTER TABLE [dbo].[PickupPackageItems] ADD [HouseholdItemId] UNIQUEIDENTIFIER NULL;
        IF COL_LENGTH(N'dbo.PickupMaterialUsages', N'IsBoxRecipe') IS NULL ALTER TABLE [dbo].[PickupMaterialUsages] ADD [IsBoxRecipe] BIT NOT NULL CONSTRAINT [DF_PickupMaterialUsages_IsBoxRecipe] DEFAULT(0);
        IF COL_LENGTH(N'dbo.PackageHandovers', N'WarehouseId') IS NULL ALTER TABLE [dbo].[PackageHandovers] ADD [WarehouseId] UNIQUEIDENTIFIER NULL CONSTRAINT [FK_PackageHandovers_Warehouses] FOREIGN KEY REFERENCES [dbo].[Warehouses]([Id]);
        IF OBJECT_ID(N'dbo.PickupTimeEvents', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[PickupTimeEvents] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PickupTimeEvents] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PickupId] UNIQUEIDENTIFIER NOT NULL, [Type] NVARCHAR(20) NOT NULL, [OccurredAtUtc] DATETIMEOFFSET NOT NULL, [Reason] NVARCHAR(500) NULL, [RecordedBy] NVARCHAR(254) NOT NULL,
                CONSTRAINT [FK_PickupTimeEvents_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PickupTimeEvents_Pickups] FOREIGN KEY ([PickupId]) REFERENCES [dbo].[Pickups]([Id]) ON DELETE CASCADE);
            CREATE UNIQUE INDEX [IX_PickupTimeEvents_Id] ON [dbo].[PickupTimeEvents]([Id]);
            CREATE INDEX [IX_PickupTimeEvents_PickupId_SerialNo] ON [dbo].[PickupTimeEvents]([PickupId],[SerialNo]);
            CREATE INDEX [IX_PickupTimeEvents_TenantId] ON [dbo].[PickupTimeEvents]([TenantId]);
        END
        IF OBJECT_ID(N'dbo.PickupExpenses', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[PickupExpenses] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PickupExpenses] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PickupId] UNIQUEIDENTIFIER NOT NULL, [Category] NVARCHAR(30) NOT NULL, [Amount] DECIMAL(18,2) NOT NULL, [Currency] NVARCHAR(3) NOT NULL, [IncurredAtUtc] DATETIMEOFFSET NOT NULL, [PaidByEmployeeId] UNIQUEIDENTIFIER NULL, [Notes] NVARCHAR(500) NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL,
                CONSTRAINT [FK_PickupExpenses_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PickupExpenses_Pickups] FOREIGN KEY ([PickupId]) REFERENCES [dbo].[Pickups]([Id]) ON DELETE CASCADE, CONSTRAINT [FK_PickupExpenses_Employees] FOREIGN KEY ([PaidByEmployeeId]) REFERENCES [dbo].[Employees]([Id]));
            CREATE UNIQUE INDEX [IX_PickupExpenses_Id] ON [dbo].[PickupExpenses]([Id]);
            CREATE INDEX [IX_PickupExpenses_PickupId_SerialNo] ON [dbo].[PickupExpenses]([PickupId],[SerialNo]);
            CREATE INDEX [IX_PickupExpenses_TenantId] ON [dbo].[PickupExpenses]([TenantId]);
        END
        IF OBJECT_ID(N'dbo.PickupAttachments', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[PickupAttachments] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PickupAttachments] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PickupId] UNIQUEIDENTIFIER NOT NULL, [Stage] NVARCHAR(20) NOT NULL, [RoomName] NVARCHAR(120) NULL, [UploadedBy] NVARCHAR(254) NOT NULL, [OriginalFileName] NVARCHAR(255) NOT NULL, [ContentType] NVARCHAR(150) NOT NULL, [DeclaredSizeBytes] BIGINT NOT NULL, [StoredSizeBytes] BIGINT NULL, [S3ObjectKey] NVARCHAR(700) NOT NULL, [IsUploaded] BIT NOT NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL, [UploadedAtUtc] DATETIMEOFFSET NULL,
                CONSTRAINT [FK_PickupAttachments_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PickupAttachments_Pickups] FOREIGN KEY ([PickupId]) REFERENCES [dbo].[Pickups]([Id]) ON DELETE CASCADE);
            CREATE UNIQUE INDEX [IX_PickupAttachments_Id] ON [dbo].[PickupAttachments]([Id]);
            CREATE INDEX [IX_PickupAttachments_PickupId_SerialNo] ON [dbo].[PickupAttachments]([PickupId],[SerialNo]);
            CREATE INDEX [IX_PickupAttachments_TenantId] ON [dbo].[PickupAttachments]([TenantId]);
        END
        IF OBJECT_ID(N'dbo.PickupSignoffs', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[PickupSignoffs] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PickupSignoffs] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PickupId] UNIQUEIDENTIFIER NOT NULL, [Party] NVARCHAR(20) NOT NULL, [SignerName] NVARCHAR(160) NOT NULL, [EmployeeId] UNIQUEIDENTIFIER NULL, [Statement] NVARCHAR(1000) NOT NULL, [Remarks] NVARCHAR(1000) NULL, [SignaturePng] NVARCHAR(MAX) NOT NULL, [SignedAtUtc] DATETIMEOFFSET NOT NULL, [RecordedBy] NVARCHAR(254) NOT NULL,
                CONSTRAINT [FK_PickupSignoffs_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PickupSignoffs_Pickups] FOREIGN KEY ([PickupId]) REFERENCES [dbo].[Pickups]([Id]) ON DELETE CASCADE, CONSTRAINT [FK_PickupSignoffs_Employees] FOREIGN KEY ([EmployeeId]) REFERENCES [dbo].[Employees]([Id]));
            CREATE UNIQUE INDEX [IX_PickupSignoffs_Id] ON [dbo].[PickupSignoffs]([Id]);
            CREATE INDEX [IX_PickupSignoffs_PickupId_SerialNo] ON [dbo].[PickupSignoffs]([PickupId],[SerialNo]);
            CREATE INDEX [IX_PickupSignoffs_TenantId] ON [dbo].[PickupSignoffs]([TenantId]);
        END
        """;

    public const string PostgreSql = """
        CREATE TABLE IF NOT EXISTS "Warehouses" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "Code" varchar(40) NOT NULL, "Name" varchar(160) NOT NULL, "Address" varchar(500) NULL, "IsActive" boolean NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_Warehouses_Id" ON "Warehouses"("Id");
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_Warehouses_TenantId_Code" ON "Warehouses"("TenantId","Code");
        ALTER TABLE "Pickups" ADD COLUMN IF NOT EXISTS "SalesLeadId" uuid NULL REFERENCES "SalesLeads"("Id");
        ALTER TABLE "Pickups" ADD COLUMN IF NOT EXISTS "StartedAtUtc" timestamp with time zone NULL;
        ALTER TABLE "Pickups" ADD COLUMN IF NOT EXISTS "EndedAtUtc" timestamp with time zone NULL;
        ALTER TABLE "Pickups" ADD COLUMN IF NOT EXISTS "IsPaused" boolean NOT NULL DEFAULT FALSE;
        ALTER TABLE "Pickups" ADD COLUMN IF NOT EXISTS "DistanceKm" numeric(10,2) NULL;
        ALTER TABLE "PickupPackages" ADD COLUMN IF NOT EXISTS "RoomName" varchar(120) NULL;
        ALTER TABLE "PickupPackages" ADD COLUMN IF NOT EXISTS "IsFragile" boolean NOT NULL DEFAULT FALSE;
        ALTER TABLE "PickupPackageItems" ADD COLUMN IF NOT EXISTS "RoomName" varchar(120) NULL;
        ALTER TABLE "PickupPackageItems" ADD COLUMN IF NOT EXISTS "HouseholdItemId" uuid NULL;
        ALTER TABLE "PickupMaterialUsages" ADD COLUMN IF NOT EXISTS "IsBoxRecipe" boolean NOT NULL DEFAULT FALSE;
        ALTER TABLE "PackageHandovers" ADD COLUMN IF NOT EXISTS "WarehouseId" uuid NULL REFERENCES "Warehouses"("Id");
        CREATE TABLE IF NOT EXISTS "PickupTimeEvents" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "PickupId" uuid NOT NULL REFERENCES "Pickups"("Id") ON DELETE CASCADE, "Type" varchar(20) NOT NULL, "OccurredAtUtc" timestamp with time zone NOT NULL, "Reason" varchar(500) NULL, "RecordedBy" varchar(254) NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PickupTimeEvents_Id" ON "PickupTimeEvents"("Id");
        CREATE INDEX IF NOT EXISTS "IX_PickupTimeEvents_PickupId_SerialNo" ON "PickupTimeEvents"("PickupId","SerialNo");
        CREATE TABLE IF NOT EXISTS "PickupExpenses" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "PickupId" uuid NOT NULL REFERENCES "Pickups"("Id") ON DELETE CASCADE, "Category" varchar(30) NOT NULL, "Amount" numeric(18,2) NOT NULL, "Currency" varchar(3) NOT NULL, "IncurredAtUtc" timestamp with time zone NOT NULL, "PaidByEmployeeId" uuid NULL REFERENCES "Employees"("Id"), "Notes" varchar(500) NULL, "CreatedAtUtc" timestamp with time zone NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PickupExpenses_Id" ON "PickupExpenses"("Id");
        CREATE INDEX IF NOT EXISTS "IX_PickupExpenses_PickupId_SerialNo" ON "PickupExpenses"("PickupId","SerialNo");
        CREATE TABLE IF NOT EXISTS "PickupAttachments" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "PickupId" uuid NOT NULL REFERENCES "Pickups"("Id") ON DELETE CASCADE, "Stage" varchar(20) NOT NULL, "RoomName" varchar(120) NULL, "UploadedBy" varchar(254) NOT NULL, "OriginalFileName" varchar(255) NOT NULL, "ContentType" varchar(150) NOT NULL, "DeclaredSizeBytes" bigint NOT NULL, "StoredSizeBytes" bigint NULL, "S3ObjectKey" varchar(700) NOT NULL, "IsUploaded" boolean NOT NULL, "CreatedAtUtc" timestamp with time zone NOT NULL, "UploadedAtUtc" timestamp with time zone NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PickupAttachments_Id" ON "PickupAttachments"("Id");
        CREATE INDEX IF NOT EXISTS "IX_PickupAttachments_PickupId_SerialNo" ON "PickupAttachments"("PickupId","SerialNo");
        CREATE TABLE IF NOT EXISTS "PickupSignoffs" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "PickupId" uuid NOT NULL REFERENCES "Pickups"("Id") ON DELETE CASCADE, "Party" varchar(20) NOT NULL, "SignerName" varchar(160) NOT NULL, "EmployeeId" uuid NULL REFERENCES "Employees"("Id"), "Statement" varchar(1000) NOT NULL, "Remarks" varchar(1000) NULL, "SignaturePng" text NOT NULL, "SignedAtUtc" timestamp with time zone NOT NULL, "RecordedBy" varchar(254) NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PickupSignoffs_Id" ON "PickupSignoffs"("Id");
        CREATE INDEX IF NOT EXISTS "IX_PickupSignoffs_PickupId_SerialNo" ON "PickupSignoffs"("PickupId","SerialNo");
        """;
}
