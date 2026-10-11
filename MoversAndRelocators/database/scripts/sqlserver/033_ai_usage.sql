-- OpenAI prices on the tenant settings and the AI usage log (tokens, audio minutes, approximate cost per run).
-- The API also applies this idempotently at startup (AiUsageSchema).
IF COL_LENGTH(N'dbo.TenantOpenAiConfigurations', N'InputPricePerMillion') IS NULL
    ALTER TABLE [dbo].[TenantOpenAiConfigurations] ADD [InputPricePerMillion] DECIMAL(18,6) NULL, [CachedInputPricePerMillion] DECIMAL(18,6) NULL, [OutputPricePerMillion] DECIMAL(18,6) NULL, [TranscriptionPricePerMinute] DECIMAL(18,6) NULL;
GO
IF OBJECT_ID(N'dbo.AiUsageRecords', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AiUsageRecords] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_AiUsageRecords] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [Feature] NVARCHAR(40) NOT NULL, [SalesLeadId] UNIQUEIDENTIFIER NULL, [AttachmentId] UNIQUEIDENTIFIER NULL, [Model] NVARCHAR(120) NOT NULL, [InputTokens] INT NOT NULL, [CachedInputTokens] INT NOT NULL, [OutputTokens] INT NOT NULL, [TranscriptionModel] NVARCHAR(120) NULL, [AudioSeconds] DECIMAL(12,1) NOT NULL, [VisionCost] DECIMAL(18,6) NULL, [TranscriptionCost] DECIMAL(18,6) NULL, [TotalCost] DECIMAL(18,6) NULL, [Currency] NVARCHAR(3) NOT NULL, [CreatedBy] NVARCHAR(254) NOT NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL,
        CONSTRAINT [FK_AiUsageRecords_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]));
    CREATE UNIQUE INDEX [IX_AiUsageRecords_Id] ON [dbo].[AiUsageRecords]([Id]);
    CREATE INDEX [IX_AiUsageRecords_SalesLeadId] ON [dbo].[AiUsageRecords]([SalesLeadId]);
    CREATE INDEX [IX_AiUsageRecords_TenantId] ON [dbo].[AiUsageRecords]([TenantId]);
END
