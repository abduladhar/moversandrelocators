-- Sales lead expected inventory: items and boxes (from AI video extraction or staff), with CBM and fragile flags.
-- The API also applies this idempotently at startup (LeadInventorySchema).
IF OBJECT_ID(N'dbo.SalesLeadInventoryItems', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SalesLeadInventoryItems] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_SalesLeadInventoryItems] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [SalesLeadId] UNIQUEIDENTIFIER NOT NULL, [Kind] NVARCHAR(10) NOT NULL, [Room] NVARCHAR(80) NULL, [Name] NVARCHAR(160) NOT NULL, [Quantity] INT NOT NULL, [UnitCbm] DECIMAL(12,3) NOT NULL, [Fragile] BIT NOT NULL, [Handling] NVARCHAR(300) NULL, [Notes] NVARCHAR(1000) NULL, [SourceAttachmentId] UNIQUEIDENTIFIER NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL,
        CONSTRAINT [FK_SalesLeadInventoryItems_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_SalesLeadInventoryItems_SalesLeads] FOREIGN KEY ([SalesLeadId]) REFERENCES [dbo].[SalesLeads]([Id]) ON DELETE CASCADE);
    CREATE UNIQUE INDEX [IX_SalesLeadInventoryItems_Id] ON [dbo].[SalesLeadInventoryItems]([Id]);
    CREATE INDEX [IX_SalesLeadInventoryItems_SalesLeadId] ON [dbo].[SalesLeadInventoryItems]([SalesLeadId]);
    CREATE INDEX [IX_SalesLeadInventoryItems_TenantId] ON [dbo].[SalesLeadInventoryItems]([TenantId]);
END
