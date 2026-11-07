-- Management assistant (Ask Crateway): saved conversations, one per user and company. The API also applies this at startup (AssistantSchema).
-- On an old database run it before 034, which indexes it as a company table.
IF OBJECT_ID(N'dbo.AssistantConversations', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AssistantConversations] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_AssistantConversations] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [CompanyId] UNIQUEIDENTIFIER NULL,
        [UserId] UNIQUEIDENTIFIER NOT NULL, [Title] NVARCHAR(120) NOT NULL, [MessagesJson] NVARCHAR(MAX) NOT NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL, [UpdatedAtUtc] DATETIMEOFFSET NOT NULL,
        CONSTRAINT [FK_AssistantConversations_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]));
    CREATE UNIQUE INDEX [IX_AssistantConversations_Id] ON [dbo].[AssistantConversations]([Id]);
    CREATE INDEX [IX_AssistantConversations_TenantId_UserId] ON [dbo].[AssistantConversations]([TenantId], [UserId]);
    CREATE INDEX [IX_AssistantConversations_TenantId] ON [dbo].[AssistantConversations]([TenantId]);
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AssistantConversations_TenantId_CompanyId')
    CREATE INDEX [IX_AssistantConversations_TenantId_CompanyId] ON [dbo].[AssistantConversations]([TenantId], [CompanyId]);
