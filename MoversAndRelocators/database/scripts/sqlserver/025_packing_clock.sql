-- Packing clock: start / pause (with reason) / resume / complete steps for working hours.
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
