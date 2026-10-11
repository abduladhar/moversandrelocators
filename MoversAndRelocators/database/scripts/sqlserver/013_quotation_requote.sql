-- Customer-visible survey inventory and requote requests for SQL Server.
SET XACT_ABORT ON; BEGIN TRANSACTION;
ALTER TABLE [dbo].[Quotations] ADD [IncludeSurveyItems] BIT NOT NULL CONSTRAINT [DF_Quotations_IncludeSurveyItems] DEFAULT(0);
CREATE TABLE [dbo].[QuotationRequoteRequests] (
  [SerialNo] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  [Id] UNIQUEIDENTIFIER NOT NULL UNIQUE,
  [TenantId] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Tenants]([Id]),
  [QuotationId] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Quotations]([Id]) ON DELETE CASCADE,
  [ItemsJson] NVARCHAR(MAX) NOT NULL,
  [CustomerNotes] NVARCHAR(2000) NULL,
  [CreatedAtUtc] DATETIMEOFFSET NOT NULL);
CREATE INDEX [IX_QuotationRequoteRequests_Tenant] ON [dbo].[QuotationRequoteRequests]([TenantId]);
CREATE INDEX [IX_QuotationRequoteRequests_Quotation] ON [dbo].[QuotationRequoteRequests]([QuotationId],[SerialNo] DESC);
COMMIT TRANSACTION;
