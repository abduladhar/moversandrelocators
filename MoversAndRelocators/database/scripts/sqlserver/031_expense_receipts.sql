-- Expense receipts: photos or documents attached to survey, pickup, packing, delivery, operations and cash expenses.
-- The API also applies this idempotently at startup (ExpenseAttachmentSchema).
IF OBJECT_ID(N'dbo.ExpenseAttachments', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ExpenseAttachments] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_ExpenseAttachments] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [Kind] NVARCHAR(20) NOT NULL, [ExpenseId] UNIQUEIDENTIFIER NOT NULL, [OriginalFileName] NVARCHAR(180) NOT NULL, [ContentType] NVARCHAR(160) NOT NULL, [DeclaredSizeBytes] BIGINT NOT NULL, [StoredSizeBytes] BIGINT NULL, [ObjectKey] NVARCHAR(700) NOT NULL, [IsUploaded] BIT NOT NULL, [IsDeleted] BIT NOT NULL, [UploadedBy] NVARCHAR(254) NOT NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL, [UploadedAtUtc] DATETIMEOFFSET NULL,
        CONSTRAINT [FK_ExpenseAttachments_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]));
    CREATE UNIQUE INDEX [IX_ExpenseAttachments_Id] ON [dbo].[ExpenseAttachments]([Id]);
    CREATE INDEX [IX_ExpenseAttachments_TenantId_ExpenseId] ON [dbo].[ExpenseAttachments]([TenantId],[ExpenseId]);
END
