-- Crew management: teams, membership history, and the team snapshot held on each packing and pickup assignment.
IF OBJECT_ID(N'dbo.Teams', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Teams] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_Teams] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [Code] NVARCHAR(40) NOT NULL, [Name] NVARCHAR(160) NOT NULL, [Kind] NVARCHAR(20) NOT NULL, [LeaderEmployeeId] UNIQUEIDENTIFIER NULL, [Notes] NVARCHAR(1000) NULL, [IsActive] BIT NOT NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL, [UpdatedAtUtc] DATETIMEOFFSET NOT NULL, [Version] UNIQUEIDENTIFIER NOT NULL,
        CONSTRAINT [FK_Teams_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_Teams_Employees] FOREIGN KEY ([LeaderEmployeeId]) REFERENCES [dbo].[Employees]([Id]));
    CREATE UNIQUE INDEX [IX_Teams_Id] ON [dbo].[Teams]([Id]);
    CREATE UNIQUE INDEX [IX_Teams_TenantId_Code] ON [dbo].[Teams]([TenantId],[Code]);
END
GO
IF OBJECT_ID(N'dbo.TeamMemberships', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TeamMemberships] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_TeamMemberships] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [TeamId] UNIQUEIDENTIFIER NOT NULL, [EmployeeId] UNIQUEIDENTIFIER NOT NULL, [Role] NVARCHAR(60) NOT NULL, [JoinedAtUtc] DATETIMEOFFSET NOT NULL, [LeftAtUtc] DATETIMEOFFSET NULL, [RecordedBy] NVARCHAR(254) NOT NULL, [LeaveReason] NVARCHAR(500) NULL,
        CONSTRAINT [FK_TeamMemberships_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_TeamMemberships_Teams] FOREIGN KEY ([TeamId]) REFERENCES [dbo].[Teams]([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_TeamMemberships_Employees] FOREIGN KEY ([EmployeeId]) REFERENCES [dbo].[Employees]([Id]));
    CREATE UNIQUE INDEX [IX_TeamMemberships_Id] ON [dbo].[TeamMemberships]([Id]);
    CREATE INDEX [IX_TeamMemberships_Team] ON [dbo].[TeamMemberships]([TeamId],[LeftAtUtc]);
    CREATE INDEX [IX_TeamMemberships_Employee] ON [dbo].[TeamMemberships]([EmployeeId],[LeftAtUtc]);
END
GO
IF COL_LENGTH(N'dbo.PickupAssignments', N'TeamId') IS NULL
    ALTER TABLE [dbo].[PickupAssignments] ADD [TeamId] UNIQUEIDENTIFIER NULL, [TeamName] NVARCHAR(160) NULL,
        [AssignedAtUtc] DATETIMEOFFSET NOT NULL CONSTRAINT [DF_PickupAssignments_AssignedAtUtc] DEFAULT SYSDATETIMEOFFSET();
GO
IF COL_LENGTH(N'dbo.PackingJobCrew', N'TeamId') IS NULL
    ALTER TABLE [dbo].[PackingJobCrew] ADD [TeamId] UNIQUEIDENTIFIER NULL, [TeamName] NVARCHAR(160) NULL,
        [AssignedAtUtc] DATETIMEOFFSET NOT NULL CONSTRAINT [DF_PackingJobCrews_AssignedAtUtc] DEFAULT SYSDATETIMEOFFSET();
GO
IF COL_LENGTH(N'dbo.PickupAssignments', N'TeamId') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PickupAssignments_Team')
    CREATE INDEX [IX_PickupAssignments_Team] ON [dbo].[PickupAssignments]([TeamId]);
GO
IF COL_LENGTH(N'dbo.PackingJobCrew', N'TeamId') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PackingJobCrews_Team')
    CREATE INDEX [IX_PackingJobCrews_Team] ON [dbo].[PackingJobCrew]([TeamId]);
