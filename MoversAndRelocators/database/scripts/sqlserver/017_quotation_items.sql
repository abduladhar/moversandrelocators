-- Adds household items directly to quotations, including direct quotations without surveys.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
CREATE TABLE [dbo].[QuotationItems] (
    [SerialNo] INT IDENTITY(1,1) NOT NULL PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL UNIQUE,
    [TenantId] UNIQUEIDENTIFIER NOT NULL, [QuotationId] UNIQUEIDENTIFIER NOT NULL, [HouseholdItemId] UNIQUEIDENTIFIER NOT NULL,
    [RoomName] NVARCHAR(120) NOT NULL, [ItemName] NVARCHAR(160) NOT NULL, [Quantity] INT NOT NULL,
    [VolumePerUnitCbm] DECIMAL(12,3) NOT NULL, [Notes] NVARCHAR(500) NULL, [DisplayOrder] INT NOT NULL,
    CONSTRAINT [FK_QuotationItems_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
    CONSTRAINT [FK_QuotationItems_Quotations] FOREIGN KEY ([QuotationId]) REFERENCES [dbo].[Quotations]([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_QuotationItems_HouseholdItems] FOREIGN KEY ([HouseholdItemId]) REFERENCES [dbo].[HouseholdItems]([Id])
);
CREATE INDEX [IX_QuotationItems_TenantId] ON [dbo].[QuotationItems]([TenantId]);
CREATE INDEX [IX_QuotationItems_QuotationId_DisplayOrder] ON [dbo].[QuotationItems]([QuotationId], [DisplayOrder]);
COMMIT TRANSACTION;
