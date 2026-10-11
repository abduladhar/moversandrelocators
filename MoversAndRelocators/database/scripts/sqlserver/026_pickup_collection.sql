-- Pickup collection: packing jobs on a pickup, each box status and condition, box media, the audit trail and the warehouse approval.
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
