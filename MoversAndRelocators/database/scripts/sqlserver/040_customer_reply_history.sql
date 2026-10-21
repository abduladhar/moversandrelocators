-- Customer reply tracking, part 2: how the office acted on a reply (with a note) and the history of every step.
-- The API also applies this at startup (CustomerReplySchema). Run after 039. The history backfill only adds steps for records that have none.
IF COL_LENGTH(N'dbo.CustomerReplies', N'HandledAction') IS NULL ALTER TABLE [dbo].[CustomerReplies] ADD [HandledAction] NVARCHAR(40) NULL;
IF COL_LENGTH(N'dbo.CustomerReplies', N'HandledNote') IS NULL ALTER TABLE [dbo].[CustomerReplies] ADD [HandledNote] NVARCHAR(500) NULL;
IF OBJECT_ID(N'dbo.CustomerReplyEvents', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[CustomerReplyEvents] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_CustomerReplyEvents] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [CompanyId] UNIQUEIDENTIFIER NULL,
        [RecordType] NVARCHAR(30) NOT NULL, [RecordId] UNIQUEIDENTIFIER NOT NULL, [Event] NVARCHAR(20) NOT NULL, [Detail] NVARCHAR(40) NULL, [Note] NVARCHAR(500) NULL, [Actor] NVARCHAR(200) NOT NULL,
        [AtUtc] DATETIMEOFFSET NOT NULL, [ExpiresAtUtc] DATETIMEOFFSET NULL,
        CONSTRAINT [FK_CustomerReplyEvents_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]));
    CREATE UNIQUE INDEX [IX_CustomerReplyEvents_Id] ON [dbo].[CustomerReplyEvents]([Id]);
    CREATE INDEX [IX_CustomerReplyEvents_TenantId_RecordType_RecordId] ON [dbo].[CustomerReplyEvents]([TenantId], [RecordType], [RecordId]);
    CREATE INDEX [IX_CustomerReplyEvents_TenantId] ON [dbo].[CustomerReplyEvents]([TenantId]);
END
GO
-- History for records tracked before it existed: what the state row knows (one statement, so a record gets all its steps at once).
INSERT INTO [dbo].[CustomerReplyEvents] ([Id], [TenantId], [CompanyId], [RecordType], [RecordId], [Event], [Detail], [Note], [Actor], [AtUtc], [ExpiresAtUtc])
SELECT NEWID(), r.[TenantId], r.[CompanyId], r.[RecordType], r.[RecordId], e.[Event], e.[Detail], e.[Note], e.[Actor], e.[AtUtc], e.[ExpiresAtUtc]
FROM [dbo].[CustomerReplies] r
CROSS APPLY (VALUES (N'SHARED', NULL, NULL, N'System', r.[SharedAtUtc], r.[ExpiresAtUtc]), (N'REPLIED', r.[ReplyKind], r.[ReplyNote], N'CUSTOMER', r.[RepliedAtUtc], NULL),
    (N'ACTION_TAKEN', ISNULL(r.[HandledAction], N'MARKED'), r.[HandledNote], ISNULL(r.[HandledBy], N'System'), r.[HandledAtUtc], NULL)) e([Event], [Detail], [Note], [Actor], [AtUtc], [ExpiresAtUtc])
WHERE e.[AtUtc] IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[CustomerReplyEvents] x WHERE x.[RecordId] = r.[RecordId]);
