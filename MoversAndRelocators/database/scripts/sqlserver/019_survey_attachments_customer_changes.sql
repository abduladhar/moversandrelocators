-- Survey attachments (customer link and staff uploads) and customer inventory change requests for SQL Server.
-- The API also applies this idempotently at startup (SurveyMediaSchema).
SET XACT_ABORT ON; BEGIN TRANSACTION;
IF COL_LENGTH(N'dbo.Surveys', N'CustomerChangeRequestJson') IS NULL ALTER TABLE [dbo].[Surveys] ADD [CustomerChangeRequestJson] NVARCHAR(MAX) NULL;
IF COL_LENGTH(N'dbo.Surveys', N'CustomerChangeRequestedAtUtc') IS NULL ALTER TABLE [dbo].[Surveys] ADD [CustomerChangeRequestedAtUtc] DATETIMEOFFSET NULL;
IF OBJECT_ID(N'dbo.SurveyAttachments', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SurveyAttachments] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_SurveyAttachments] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [SurveyId] UNIQUEIDENTIFIER NOT NULL, [Source] NVARCHAR(20) NOT NULL, [UploadedBy] NVARCHAR(160) NOT NULL, [OriginalFileName] NVARCHAR(255) NOT NULL, [ContentType] NVARCHAR(150) NOT NULL, [DeclaredSizeBytes] BIGINT NOT NULL, [StoredSizeBytes] BIGINT NULL, [S3ObjectKey] NVARCHAR(700) NOT NULL, [IsUploaded] BIT NOT NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL, [UploadedAtUtc] DATETIMEOFFSET NULL,
        CONSTRAINT [FK_SurveyAttachments_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_SurveyAttachments_Surveys] FOREIGN KEY ([SurveyId]) REFERENCES [dbo].[Surveys]([Id]) ON DELETE CASCADE);
    CREATE UNIQUE INDEX [IX_SurveyAttachments_Id] ON [dbo].[SurveyAttachments]([Id]);
    CREATE INDEX [IX_SurveyAttachments_SurveyId_SerialNo] ON [dbo].[SurveyAttachments]([SurveyId],[SerialNo]);
    CREATE INDEX [IX_SurveyAttachments_TenantId] ON [dbo].[SurveyAttachments]([TenantId]);
END
COMMIT TRANSACTION;
