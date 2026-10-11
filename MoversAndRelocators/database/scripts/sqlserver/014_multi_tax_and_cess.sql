-- Tenant tax configuration, multiple taxes per quotation line, and cess calculations for SQL Server.
SET XACT_ABORT ON; BEGIN TRANSACTION;
CREATE TABLE [dbo].[TaxMasters] (
  [SerialNo] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,[Id] UNIQUEIDENTIFIER NOT NULL UNIQUE,[TenantId] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Tenants]([Id]),
  [Code] NVARCHAR(40) NOT NULL,[Name] NVARCHAR(160) NOT NULL,[Kind] NVARCHAR(20) NOT NULL,[CalculationBasis] NVARCHAR(30) NOT NULL,[Rate] DECIMAL(12,4) NOT NULL,
  [IsDefault] BIT NOT NULL,[Description] NVARCHAR(500) NULL,[IsActive] BIT NOT NULL,[CreatedAtUtc] DATETIMEOFFSET NOT NULL,[UpdatedAtUtc] DATETIMEOFFSET NOT NULL,
  CONSTRAINT [UX_TaxMasters_Tenant_Code] UNIQUE([TenantId],[Code]));
CREATE INDEX [IX_TaxMasters_Tenant] ON [dbo].[TaxMasters]([TenantId]);
CREATE TABLE [dbo].[QuotationLineTaxes] (
  [SerialNo] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,[Id] UNIQUEIDENTIFIER NOT NULL UNIQUE,[TenantId] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Tenants]([Id]),
  [QuotationLineId] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[QuotationLines]([Id]) ON DELETE CASCADE,[TaxMasterId] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[TaxMasters]([Id]),
  [Code] NVARCHAR(40) NOT NULL,[Name] NVARCHAR(160) NOT NULL,[Kind] NVARCHAR(20) NOT NULL,[CalculationBasis] NVARCHAR(30) NOT NULL,[Rate] DECIMAL(12,4) NOT NULL,[TaxableBase] DECIMAL(18,2) NOT NULL,[Amount] DECIMAL(18,2) NOT NULL);
CREATE INDEX [IX_QuotationLineTaxes_Tenant] ON [dbo].[QuotationLineTaxes]([TenantId]);
CREATE INDEX [IX_QuotationLineTaxes_Line] ON [dbo].[QuotationLineTaxes]([QuotationLineId],[SerialNo]);
INSERT INTO [dbo].[TaxMasters]([Id],[TenantId],[Code],[Name],[Kind],[CalculationBasis],[Rate],[IsDefault],[Description],[IsActive],[CreatedAtUtc],[UpdatedAtUtc])
SELECT NEWID(),t.[Id],d.Code,d.Name,d.Kind,d.Basis,d.Rate,d.IsDefault,d.Description,1,SYSDATETIMEOFFSET(),SYSDATETIMEOFFSET()
FROM [dbo].[Tenants] t CROSS JOIN (VALUES
('CGST_9','CGST 9%','TAX','TAXABLE_AMOUNT',9.0000,1,'Central Goods and Services Tax'),('SGST_9','SGST 9%','TAX','TAXABLE_AMOUNT',9.0000,1,'State Goods and Services Tax'),('IGST_18','IGST 18%','TAX','TAXABLE_AMOUNT',18.0000,0,'Integrated Goods and Services Tax'),('CESS_1','Cess 1%','CESS','TAXABLE_AMOUNT',1.0000,0,'Optional cess on taxable amount'),('CESS_ON_TAX_1','Cess 1% on tax','CESS','TAX_AMOUNT',1.0000,0,'Optional cess calculated on selected standard taxes')) d(Code,Name,Kind,Basis,Rate,IsDefault,Description)
WHERE NOT EXISTS(SELECT 1 FROM [dbo].[TaxMasters] x WHERE x.[TenantId]=t.[Id] AND x.[Code]=d.Code);
COMMIT TRANSACTION;
