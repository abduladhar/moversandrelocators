-- One encrypted OpenAI profile per tenant for Microsoft SQL Server.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

CREATE TABLE [dbo].[TenantOpenAiConfigurations] (
    [SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_TenantOpenAiConfigurations] PRIMARY KEY,
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [TenantId] UNIQUEIDENTIFIER NOT NULL,
    [EncryptedApiKey] NVARCHAR(1000) NOT NULL,
    [ApiKeyLastFour] NVARCHAR(4) NOT NULL,
    [ExtractionModel] NVARCHAR(120) NOT NULL,
    [TranscriptionModel] NVARCHAR(120) NOT NULL,
    [CreatedAtUtc] DATETIMEOFFSET NOT NULL,
    [UpdatedAtUtc] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [FK_TenantOpenAiConfigurations_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id])
);

CREATE UNIQUE INDEX [UX_TenantOpenAiConfigurations_Id] ON [dbo].[TenantOpenAiConfigurations]([Id]);
CREATE UNIQUE INDEX [UX_TenantOpenAiConfigurations_Tenant] ON [dbo].[TenantOpenAiConfigurations]([TenantId]);

COMMIT TRANSACTION;
