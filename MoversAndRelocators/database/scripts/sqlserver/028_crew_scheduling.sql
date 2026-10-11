-- Crew scheduling: supervisor replaces the team leader, and pickups and packing jobs carry a duration.
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
