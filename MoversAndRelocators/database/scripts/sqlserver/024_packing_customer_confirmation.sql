-- Packing job customer confirmations: one link per purpose (date, location, packed items) and the customer responses.
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
