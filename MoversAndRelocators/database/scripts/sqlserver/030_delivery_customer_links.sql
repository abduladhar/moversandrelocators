-- Delivery customer links for SQL Server: confirm the delivery date and share the location per delivery note.
-- The API also applies this idempotently at startup (DeliverySchema).
IF COL_LENGTH(N'dbo.DeliveryNotes', N'DateResponse') IS NULL
    ALTER TABLE [dbo].[DeliveryNotes] ADD [DateResponse] NVARCHAR(20) NULL, [PreferredAtUtc] DATETIMEOFFSET NULL, [DateRespondedAtUtc] DATETIMEOFFSET NULL, [DateRespondedForUtc] DATETIMEOFFSET NULL, [Latitude] DECIMAL(9,6) NULL, [Longitude] DECIMAL(9,6) NULL, [LocationNotes] NVARCHAR(500) NULL, [LocationSharedAtUtc] DATETIMEOFFSET NULL;
GO
IF OBJECT_ID(N'dbo.DeliveryNoteLinks', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[DeliveryNoteLinks] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_DeliveryNoteLinks] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [DeliveryJobId] UNIQUEIDENTIFIER NOT NULL, [DeliveryNoteId] UNIQUEIDENTIFIER NOT NULL, [Purpose] NVARCHAR(20) NOT NULL, [TokenHash] NVARCHAR(64) NOT NULL, [ExpiresAtUtc] DATETIMEOFFSET NOT NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL,
        CONSTRAINT [FK_DeliveryNoteLinks_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_DeliveryNoteLinks_DeliveryJobs] FOREIGN KEY ([DeliveryJobId]) REFERENCES [dbo].[DeliveryJobs]([Id]) ON DELETE CASCADE, CONSTRAINT [FK_DeliveryNoteLinks_DeliveryNotes] FOREIGN KEY ([DeliveryNoteId]) REFERENCES [dbo].[DeliveryNotes]([Id]));
    CREATE UNIQUE INDEX [IX_DeliveryNoteLinks_Id] ON [dbo].[DeliveryNoteLinks]([Id]);
    CREATE UNIQUE INDEX [IX_DeliveryNoteLinks_TokenHash] ON [dbo].[DeliveryNoteLinks]([TokenHash]);
    CREATE INDEX [IX_DeliveryNoteLinks_DeliveryNoteId] ON [dbo].[DeliveryNoteLinks]([DeliveryNoteId]);
    CREATE INDEX [IX_DeliveryNoteLinks_TenantId] ON [dbo].[DeliveryNoteLinks]([TenantId]);
END
GO
