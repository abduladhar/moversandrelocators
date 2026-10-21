-- Customer reply tracking: what is awaited from the customer on shared links, what they answered, and when the office handled it.
-- The API also applies this at startup (CustomerReplySchema). On an old database run the table part before 034, which indexes it as a company table;
-- the backfill reads Quotations/Surveys.CompanyId, so it runs after 034.
IF OBJECT_ID(N'dbo.CustomerReplies', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[CustomerReplies] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_CustomerReplies] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [CompanyId] UNIQUEIDENTIFIER NULL,
        [RecordType] NVARCHAR(30) NOT NULL, [RecordId] UNIQUEIDENTIFIER NOT NULL, [SharedAtUtc] DATETIMEOFFSET NULL, [ExpiresAtUtc] DATETIMEOFFSET NULL, [RepliedAtUtc] DATETIMEOFFSET NULL,
        [ReplyKind] NVARCHAR(40) NULL, [ReplyNote] NVARCHAR(500) NULL, [HandledAtUtc] DATETIMEOFFSET NULL, [HandledBy] NVARCHAR(320) NULL,
        CONSTRAINT [FK_CustomerReplies_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]));
    CREATE UNIQUE INDEX [IX_CustomerReplies_Id] ON [dbo].[CustomerReplies]([Id]);
    CREATE UNIQUE INDEX [IX_CustomerReplies_TenantId_RecordType_RecordId] ON [dbo].[CustomerReplies]([TenantId], [RecordType], [RecordId]);
    CREATE INDEX [IX_CustomerReplies_TenantId] ON [dbo].[CustomerReplies]([TenantId]);
END
GO
-- Records already waiting on the customer (only adds rows for records that have none, so it can be run again).
INSERT INTO [dbo].[CustomerReplies] ([Id], [TenantId], [CompanyId], [RecordType], [RecordId], [SharedAtUtc], [ExpiresAtUtc])
SELECT NEWID(), q.[TenantId], q.[CompanyId], N'QUOTATION', q.[Id], q.[SentAtUtc], q.[ShareExpiresAtUtc] FROM [dbo].[Quotations] q
WHERE q.[Status] = N'SENT' AND q.[SentAtUtc] IS NOT NULL AND q.[ShareExpiresAtUtc] > SYSDATETIMEOFFSET() AND NOT EXISTS (SELECT 1 FROM [dbo].[CustomerReplies] c WHERE c.[RecordId] = q.[Id]);
INSERT INTO [dbo].[CustomerReplies] ([Id], [TenantId], [CompanyId], [RecordType], [RecordId], [RepliedAtUtc], [ReplyKind])
SELECT NEWID(), q.[TenantId], q.[CompanyId], N'QUOTATION', q.[Id], ISNULL(q.[RespondedAtUtc], SYSDATETIMEOFFSET()), N'QUOTATION_REQUOTE' FROM [dbo].[Quotations] q
WHERE q.[Status] = N'REQUOTE_REQUESTED' AND EXISTS (SELECT 1 FROM [dbo].[QuotationRequoteRequests] r WHERE r.[QuotationId] = q.[Id] AND r.[AppliedAtUtc] IS NULL) AND NOT EXISTS (SELECT 1 FROM [dbo].[CustomerReplies] c WHERE c.[RecordId] = q.[Id]);
INSERT INTO [dbo].[CustomerReplies] ([Id], [TenantId], [CompanyId], [RecordType], [RecordId], [RepliedAtUtc], [ReplyKind])
SELECT NEWID(), s.[TenantId], s.[CompanyId], N'SURVEY', s.[Id], s.[CustomerChangeRequestedAtUtc], N'SURVEY_CHANGES' FROM [dbo].[Surveys] s
WHERE s.[CustomerChangeRequestJson] IS NOT NULL AND s.[CustomerChangeRequestedAtUtc] IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[CustomerReplies] c WHERE c.[RecordId] = s.[Id]);
INSERT INTO [dbo].[CustomerReplies] ([Id], [TenantId], [CompanyId], [RecordType], [RecordId], [SharedAtUtc], [ExpiresAtUtc])
SELECT NEWID(), s.[TenantId], s.[CompanyId], N'SURVEY', s.[Id], SYSDATETIMEOFFSET(), s.[ConfirmationExpiresAtUtc] FROM [dbo].[Surveys] s
WHERE s.[ConfirmationExpiresAtUtc] > SYSDATETIMEOFFSET() AND s.[ScheduleConfirmedAtUtc] IS NULL AND s.[ItemsConfirmedAtUtc] IS NULL AND s.[CustomerChangeRequestJson] IS NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[CustomerReplies] c WHERE c.[RecordId] = s.[Id]);
