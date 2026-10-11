using Microsoft.EntityFrameworkCore;
namespace Movers.DAL.Persistence;

/// <summary>Idempotent upgrade for pickup collection: the packing jobs a pickup collects, the status of each
/// expected box, the audit trail behind it and the warehouse approval that closes it (script 026).</summary>
public static class PickupCollectionSchema
{
    public static async Task Apply(MoversDbContext db)
    {
        if (db.Database.IsSqlServer()) { foreach (var batch in System.Text.RegularExpressions.Regex.Split(SqlServer, @"^\s*GO\s*$", System.Text.RegularExpressions.RegexOptions.Multiline)) await db.Database.ExecuteSqlRawAsync(batch); }
        else if (db.Database.IsNpgsql()) await db.Database.ExecuteSqlRawAsync(PostgreSql);
        // SQLite is only used for fresh test databases, which EnsureCreated builds from the current model.
    }

    public const string SqlServer = """
        IF OBJECT_ID(N'dbo.PickupPackingJobs', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[PickupPackingJobs] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PickupPackingJobs] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PickupId] UNIQUEIDENTIFIER NOT NULL, [PackingJobId] UNIQUEIDENTIFIER NOT NULL, [LinkedAtUtc] DATETIMEOFFSET NOT NULL, [LinkedBy] NVARCHAR(254) NOT NULL,
                CONSTRAINT [FK_PickupPackingJobs_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
                CONSTRAINT [FK_PickupPackingJobs_Pickups] FOREIGN KEY ([PickupId]) REFERENCES [dbo].[Pickups]([Id]) ON DELETE CASCADE,
                CONSTRAINT [FK_PickupPackingJobs_PackingJobs] FOREIGN KEY ([PackingJobId]) REFERENCES [dbo].[PackingJobs]([Id]));
            CREATE UNIQUE INDEX [IX_PickupPackingJobs_Id] ON [dbo].[PickupPackingJobs]([Id]);
            CREATE UNIQUE INDEX [IX_PickupPackingJobs_Pickup_Job] ON [dbo].[PickupPackingJobs]([PickupId],[PackingJobId]);
            CREATE INDEX [IX_PickupPackingJobs_Job] ON [dbo].[PickupPackingJobs]([PackingJobId]);
        END
        GO
        IF OBJECT_ID(N'dbo.PickupBoxPicks', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[PickupBoxPicks] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PickupBoxPicks] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PickupId] UNIQUEIDENTIFIER NOT NULL, [Source] NVARCHAR(20) NOT NULL, [BoxId] UNIQUEIDENTIFIER NOT NULL, [TrackingNumber] NVARCHAR(80) NOT NULL, [PackingJobId] UNIQUEIDENTIFIER NULL, [Status] NVARCHAR(20) NOT NULL, [StatusAtUtc] DATETIMEOFFSET NULL, [StatusBy] NVARCHAR(254) NULL, [Method] NVARCHAR(20) NULL, [StatusReason] NVARCHAR(500) NULL, [Version] UNIQUEIDENTIFIER NOT NULL,
                CONSTRAINT [FK_PickupBoxPicks_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
                CONSTRAINT [FK_PickupBoxPicks_Pickups] FOREIGN KEY ([PickupId]) REFERENCES [dbo].[Pickups]([Id]) ON DELETE CASCADE);
            CREATE UNIQUE INDEX [IX_PickupBoxPicks_Id] ON [dbo].[PickupBoxPicks]([Id]);
            CREATE UNIQUE INDEX [IX_PickupBoxPicks_Pickup_Box] ON [dbo].[PickupBoxPicks]([PickupId],[Source],[BoxId]);
            CREATE INDEX [IX_PickupBoxPicks_Tracking] ON [dbo].[PickupBoxPicks]([TenantId],[TrackingNumber]);
            CREATE INDEX [IX_PickupBoxPicks_Pickup_Status] ON [dbo].[PickupBoxPicks]([PickupId],[Status]);
        END
        GO
        IF OBJECT_ID(N'dbo.PickupBoxPickEvents', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[PickupBoxPickEvents] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PickupBoxPickEvents] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PickupId] UNIQUEIDENTIFIER NOT NULL, [Source] NVARCHAR(20) NOT NULL, [BoxId] UNIQUEIDENTIFIER NOT NULL, [TrackingNumber] NVARCHAR(80) NOT NULL, [FromStatus] NVARCHAR(20) NOT NULL, [ToStatus] NVARCHAR(20) NOT NULL, [Method] NVARCHAR(20) NOT NULL, [OccurredAtUtc] DATETIMEOFFSET NOT NULL, [Actor] NVARCHAR(254) NOT NULL, [Notes] NVARCHAR(500) NULL,
                CONSTRAINT [FK_PickupBoxPickEvents_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
                CONSTRAINT [FK_PickupBoxPickEvents_Pickups] FOREIGN KEY ([PickupId]) REFERENCES [dbo].[Pickups]([Id]) ON DELETE CASCADE);
            CREATE UNIQUE INDEX [IX_PickupBoxPickEvents_Id] ON [dbo].[PickupBoxPickEvents]([Id]);
            CREATE INDEX [IX_PickupBoxPickEvents_Pickup_Box] ON [dbo].[PickupBoxPickEvents]([PickupId],[Source],[BoxId],[OccurredAtUtc]);
        END
        GO
        IF OBJECT_ID(N'dbo.PickupCollectionApprovals', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[PickupCollectionApprovals] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PickupCollectionApprovals] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PickupId] UNIQUEIDENTIFIER NOT NULL, [WarehouseId] UNIQUEIDENTIFIER NULL, [PickedCount] INT NOT NULL, [MissingCount] INT NOT NULL, [ExcludedCount] INT NOT NULL, [ApprovedAtUtc] DATETIMEOFFSET NOT NULL, [ApprovedBy] NVARCHAR(254) NOT NULL, [Notes] NVARCHAR(500) NULL, [ReopenedAtUtc] DATETIMEOFFSET NULL, [ReopenedBy] NVARCHAR(254) NULL, [ReopenReason] NVARCHAR(500) NULL,
                CONSTRAINT [FK_PickupCollectionApprovals_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
                CONSTRAINT [FK_PickupCollectionApprovals_Pickups] FOREIGN KEY ([PickupId]) REFERENCES [dbo].[Pickups]([Id]) ON DELETE CASCADE,
                CONSTRAINT [FK_PickupCollectionApprovals_Warehouses] FOREIGN KEY ([WarehouseId]) REFERENCES [dbo].[Warehouses]([Id]));
            CREATE UNIQUE INDEX [IX_PickupCollectionApprovals_Id] ON [dbo].[PickupCollectionApprovals]([Id]);
            CREATE INDEX [IX_PickupCollectionApprovals_Pickup] ON [dbo].[PickupCollectionApprovals]([PickupId],[ApprovedAtUtc]);
        END
        GO
        -- A database created by the first cut of this script has IsPicked / Action instead of the status model.
        -- The CREATE guards above skip an existing table, so the columns are added here.
        IF OBJECT_ID(N'dbo.PickupBoxPicks', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.PickupBoxPicks', N'Status') IS NULL
            ALTER TABLE [dbo].[PickupBoxPicks] ADD [Status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_PickupBoxPicks_Status] DEFAULT 'PENDING',
                [StatusAtUtc] DATETIMEOFFSET NULL, [StatusBy] NVARCHAR(254) NULL, [StatusReason] NVARCHAR(500) NULL;
        GO
        -- Dynamic SQL on purpose: SQL Server binds column names when it compiles the batch, not when the IF is
        -- evaluated, so naming a dropped column here would fail the batch on every later run.
        IF COL_LENGTH(N'dbo.PickupBoxPicks', N'IsPicked') IS NOT NULL
        BEGIN
            EXEC sp_executesql N'UPDATE [dbo].[PickupBoxPicks] SET [Status] = CASE WHEN [IsPicked] = 1 THEN ''PICKED'' ELSE ''PENDING'' END, [StatusAtUtc] = [PickedAtUtc], [StatusBy] = [PickedBy];';
            EXEC sp_executesql N'ALTER TABLE [dbo].[PickupBoxPicks] DROP COLUMN [IsPicked], [PickedAtUtc], [PickedBy];';
        END
        GO
        IF OBJECT_ID(N'dbo.PickupBoxPickEvents', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.PickupBoxPickEvents', N'ToStatus') IS NULL
            ALTER TABLE [dbo].[PickupBoxPickEvents] ADD [FromStatus] NVARCHAR(20) NOT NULL CONSTRAINT [DF_PickupBoxPickEvents_FromStatus] DEFAULT '',
                [ToStatus] NVARCHAR(20) NOT NULL CONSTRAINT [DF_PickupBoxPickEvents_ToStatus] DEFAULT 'PENDING';
        GO
        IF COL_LENGTH(N'dbo.PickupBoxPickEvents', N'Action') IS NOT NULL
        BEGIN
            EXEC sp_executesql N'UPDATE [dbo].[PickupBoxPickEvents] SET [ToStatus] = CASE WHEN [Action] = ''PICKED'' THEN ''PICKED'' ELSE ''PENDING'' END;';
            EXEC sp_executesql N'ALTER TABLE [dbo].[PickupBoxPickEvents] DROP COLUMN [Action];';
        END
        GO
        IF COL_LENGTH(N'dbo.PickupBoxPicks', N'Condition') IS NULL
            ALTER TABLE [dbo].[PickupBoxPicks] ADD [Condition] NVARCHAR(20) NOT NULL CONSTRAINT [DF_PickupBoxPicks_Condition] DEFAULT 'NOT_CHECKED',
                [ConditionNotes] NVARCHAR(1000) NULL, [ConditionAtUtc] DATETIMEOFFSET NULL, [ConditionBy] NVARCHAR(254) NULL;
        GO
        IF COL_LENGTH(N'dbo.PickupBoxPicks', N'AddedBy') IS NULL
            ALTER TABLE [dbo].[PickupBoxPicks] ADD [AddedBy] NVARCHAR(254) NOT NULL CONSTRAINT [DF_PickupBoxPicks_AddedBy] DEFAULT '',
                [AddedAtUtc] DATETIMEOFFSET NOT NULL CONSTRAINT [DF_PickupBoxPicks_AddedAtUtc] DEFAULT SYSDATETIMEOFFSET();
        GO
        IF COL_LENGTH(N'dbo.PickupAttachments', N'BoxId') IS NULL
            ALTER TABLE [dbo].[PickupAttachments] ADD [BoxSource] NVARCHAR(20) NULL, [BoxId] UNIQUEIDENTIFIER NULL;
        GO
        IF COL_LENGTH(N'dbo.PickupAttachments', N'BoxId') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PickupAttachments_Box')
            CREATE INDEX [IX_PickupAttachments_Box] ON [dbo].[PickupAttachments]([PickupId],[BoxSource],[BoxId]);
        """;

    public const string PostgreSql = """
        CREATE TABLE IF NOT EXISTS "PickupPackingJobs" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "PickupId" uuid NOT NULL REFERENCES "Pickups"("Id") ON DELETE CASCADE, "PackingJobId" uuid NOT NULL REFERENCES "PackingJobs"("Id"), "LinkedAtUtc" timestamp with time zone NOT NULL, "LinkedBy" varchar(254) NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PickupPackingJobs_Id" ON "PickupPackingJobs"("Id");
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PickupPackingJobs_Pickup_Job" ON "PickupPackingJobs"("PickupId","PackingJobId");
        CREATE INDEX IF NOT EXISTS "IX_PickupPackingJobs_Job" ON "PickupPackingJobs"("PackingJobId");

        CREATE TABLE IF NOT EXISTS "PickupBoxPicks" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "PickupId" uuid NOT NULL REFERENCES "Pickups"("Id") ON DELETE CASCADE, "Source" varchar(20) NOT NULL, "BoxId" uuid NOT NULL, "TrackingNumber" varchar(80) NOT NULL, "PackingJobId" uuid NULL, "Status" varchar(20) NOT NULL, "StatusAtUtc" timestamp with time zone NULL, "StatusBy" varchar(254) NULL, "Method" varchar(20) NULL, "StatusReason" varchar(500) NULL, "Version" uuid NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PickupBoxPicks_Id" ON "PickupBoxPicks"("Id");
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PickupBoxPicks_Pickup_Box" ON "PickupBoxPicks"("PickupId","Source","BoxId");
        CREATE INDEX IF NOT EXISTS "IX_PickupBoxPicks_Tracking" ON "PickupBoxPicks"("TenantId","TrackingNumber");
        CREATE INDEX IF NOT EXISTS "IX_PickupBoxPicks_Pickup_Status" ON "PickupBoxPicks"("PickupId","Status");

        CREATE TABLE IF NOT EXISTS "PickupBoxPickEvents" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "PickupId" uuid NOT NULL REFERENCES "Pickups"("Id") ON DELETE CASCADE, "Source" varchar(20) NOT NULL, "BoxId" uuid NOT NULL, "TrackingNumber" varchar(80) NOT NULL, "FromStatus" varchar(20) NOT NULL, "ToStatus" varchar(20) NOT NULL, "Method" varchar(20) NOT NULL, "OccurredAtUtc" timestamp with time zone NOT NULL, "Actor" varchar(254) NOT NULL, "Notes" varchar(500) NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PickupBoxPickEvents_Id" ON "PickupBoxPickEvents"("Id");
        CREATE INDEX IF NOT EXISTS "IX_PickupBoxPickEvents_Pickup_Box" ON "PickupBoxPickEvents"("PickupId","Source","BoxId","OccurredAtUtc");

        CREATE TABLE IF NOT EXISTS "PickupCollectionApprovals" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "PickupId" uuid NOT NULL REFERENCES "Pickups"("Id") ON DELETE CASCADE, "WarehouseId" uuid NULL REFERENCES "Warehouses"("Id"), "PickedCount" integer NOT NULL, "MissingCount" integer NOT NULL, "ExcludedCount" integer NOT NULL, "ApprovedAtUtc" timestamp with time zone NOT NULL, "ApprovedBy" varchar(254) NOT NULL, "Notes" varchar(500) NULL, "ReopenedAtUtc" timestamp with time zone NULL, "ReopenedBy" varchar(254) NULL, "ReopenReason" varchar(500) NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_PickupCollectionApprovals_Id" ON "PickupCollectionApprovals"("Id");
        CREATE INDEX IF NOT EXISTS "IX_PickupCollectionApprovals_Pickup" ON "PickupCollectionApprovals"("PickupId","ApprovedAtUtc");

        -- A database created by the first cut of this script has IsPicked / Action instead of the status model.
        -- The CREATE guards above skip an existing table, so the columns are added here.
        ALTER TABLE "PickupBoxPicks" ADD COLUMN IF NOT EXISTS "Status" varchar(20) NOT NULL DEFAULT 'PENDING';
        ALTER TABLE "PickupBoxPicks" ADD COLUMN IF NOT EXISTS "StatusAtUtc" timestamp with time zone NULL;
        ALTER TABLE "PickupBoxPicks" ADD COLUMN IF NOT EXISTS "StatusBy" varchar(254) NULL;
        ALTER TABLE "PickupBoxPicks" ADD COLUMN IF NOT EXISTS "StatusReason" varchar(500) NULL;
        ALTER TABLE "PickupBoxPickEvents" ADD COLUMN IF NOT EXISTS "FromStatus" varchar(20) NOT NULL DEFAULT '';
        ALTER TABLE "PickupBoxPickEvents" ADD COLUMN IF NOT EXISTS "ToStatus" varchar(20) NOT NULL DEFAULT 'PENDING';
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'PickupBoxPicks' AND column_name = 'IsPicked') THEN
                UPDATE "PickupBoxPicks" SET "Status" = CASE WHEN "IsPicked" THEN 'PICKED' ELSE 'PENDING' END,
                    "StatusAtUtc" = "PickedAtUtc", "StatusBy" = "PickedBy";
                ALTER TABLE "PickupBoxPicks" DROP COLUMN "IsPicked", DROP COLUMN "PickedAtUtc", DROP COLUMN "PickedBy";
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'PickupBoxPickEvents' AND column_name = 'Action') THEN
                UPDATE "PickupBoxPickEvents" SET "ToStatus" = CASE WHEN "Action" = 'PICKED' THEN 'PICKED' ELSE 'PENDING' END;
                ALTER TABLE "PickupBoxPickEvents" DROP COLUMN "Action";
            END IF;
        END $$;

        ALTER TABLE "PickupBoxPicks" ADD COLUMN IF NOT EXISTS "Condition" varchar(20) NOT NULL DEFAULT 'NOT_CHECKED';
        ALTER TABLE "PickupBoxPicks" ADD COLUMN IF NOT EXISTS "ConditionNotes" varchar(1000) NULL;
        ALTER TABLE "PickupBoxPicks" ADD COLUMN IF NOT EXISTS "ConditionAtUtc" timestamp with time zone NULL;
        ALTER TABLE "PickupBoxPicks" ADD COLUMN IF NOT EXISTS "ConditionBy" varchar(254) NULL;
        ALTER TABLE "PickupBoxPicks" ADD COLUMN IF NOT EXISTS "AddedBy" varchar(254) NOT NULL DEFAULT '';
        ALTER TABLE "PickupBoxPicks" ADD COLUMN IF NOT EXISTS "AddedAtUtc" timestamp with time zone NOT NULL DEFAULT now();
        ALTER TABLE "PickupAttachments" ADD COLUMN IF NOT EXISTS "BoxSource" varchar(20) NULL;
        ALTER TABLE "PickupAttachments" ADD COLUMN IF NOT EXISTS "BoxId" uuid NULL;
        CREATE INDEX IF NOT EXISTS "IX_PickupAttachments_Box" ON "PickupAttachments"("PickupId","BoxSource","BoxId");
        """;
}
