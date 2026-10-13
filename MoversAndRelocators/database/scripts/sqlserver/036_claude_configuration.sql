-- One encrypted Claude (Anthropic) profile per tenant, used for AI inventory extraction. The API also applies this idempotently at startup (ClaudeSchema).
IF OBJECT_ID(N'dbo.TenantClaudeConfigurations', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TenantClaudeConfigurations] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_TenantClaudeConfigurations] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [EncryptedApiKey] NVARCHAR(1000) NOT NULL, [ApiKeyLastFour] NVARCHAR(4) NOT NULL, [ExtractionModel] NVARCHAR(120) NOT NULL, [Effort] NVARCHAR(20) NOT NULL, [InputPricePerMillion] DECIMAL(18,6) NULL, [CachedInputPricePerMillion] DECIMAL(18,6) NULL, [OutputPricePerMillion] DECIMAL(18,6) NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL, [UpdatedAtUtc] DATETIMEOFFSET NOT NULL,
        CONSTRAINT [FK_TenantClaudeConfigurations_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]));
    CREATE UNIQUE INDEX [UX_TenantClaudeConfigurations_Id] ON [dbo].[TenantClaudeConfigurations]([Id]);
    CREATE UNIQUE INDEX [UX_TenantClaudeConfigurations_Tenant] ON [dbo].[TenantClaudeConfigurations]([TenantId]);
END
