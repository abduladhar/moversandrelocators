-- Survey trip tracking (pause/resume clock, distance, conducted-by employee) and survey expenses for SQL Server.
-- The API also applies this idempotently at startup (SurveyTripSchema).
SET XACT_ABORT ON; BEGIN TRANSACTION;
IF COL_LENGTH(N'dbo.Surveys', N'ConductedByEmployeeId') IS NULL ALTER TABLE [dbo].[Surveys] ADD [ConductedByEmployeeId] UNIQUEIDENTIFIER NULL CONSTRAINT [FK_Surveys_Employees_ConductedBy] FOREIGN KEY REFERENCES [dbo].[Employees]([Id]);
IF COL_LENGTH(N'dbo.Surveys', N'DistanceKm') IS NULL ALTER TABLE [dbo].[Surveys] ADD [DistanceKm] DECIMAL(10,2) NULL;
IF COL_LENGTH(N'dbo.Surveys', N'IsPaused') IS NULL ALTER TABLE [dbo].[Surveys] ADD [IsPaused] BIT NOT NULL CONSTRAINT [DF_Surveys_IsPaused] DEFAULT(0);
IF OBJECT_ID(N'dbo.SurveyTimeEvents', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SurveyTimeEvents] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_SurveyTimeEvents] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [SurveyId] UNIQUEIDENTIFIER NOT NULL, [Type] NVARCHAR(20) NOT NULL, [OccurredAtUtc] DATETIMEOFFSET NOT NULL, [Reason] NVARCHAR(500) NULL, [RecordedBy] NVARCHAR(254) NOT NULL,
        CONSTRAINT [FK_SurveyTimeEvents_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_SurveyTimeEvents_Surveys] FOREIGN KEY ([SurveyId]) REFERENCES [dbo].[Surveys]([Id]) ON DELETE CASCADE);
    CREATE UNIQUE INDEX [IX_SurveyTimeEvents_Id] ON [dbo].[SurveyTimeEvents]([Id]);
    CREATE INDEX [IX_SurveyTimeEvents_SurveyId_SerialNo] ON [dbo].[SurveyTimeEvents]([SurveyId],[SerialNo]);
    CREATE INDEX [IX_SurveyTimeEvents_TenantId] ON [dbo].[SurveyTimeEvents]([TenantId]);
END
IF OBJECT_ID(N'dbo.SurveyExpenses', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SurveyExpenses] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_SurveyExpenses] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [SurveyId] UNIQUEIDENTIFIER NOT NULL, [Category] NVARCHAR(30) NOT NULL, [Amount] DECIMAL(18,2) NOT NULL, [Currency] NVARCHAR(3) NOT NULL, [IncurredAtUtc] DATETIMEOFFSET NOT NULL, [PaidByEmployeeId] UNIQUEIDENTIFIER NULL, [Notes] NVARCHAR(500) NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL,
        CONSTRAINT [FK_SurveyExpenses_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_SurveyExpenses_Surveys] FOREIGN KEY ([SurveyId]) REFERENCES [dbo].[Surveys]([Id]) ON DELETE CASCADE, CONSTRAINT [FK_SurveyExpenses_Employees] FOREIGN KEY ([PaidByEmployeeId]) REFERENCES [dbo].[Employees]([Id]));
    CREATE UNIQUE INDEX [IX_SurveyExpenses_Id] ON [dbo].[SurveyExpenses]([Id]);
    CREATE INDEX [IX_SurveyExpenses_SurveyId_SerialNo] ON [dbo].[SurveyExpenses]([SurveyId],[SerialNo]);
    CREATE INDEX [IX_SurveyExpenses_TenantId] ON [dbo].[SurveyExpenses]([TenantId]);
END
COMMIT TRANSACTION;
