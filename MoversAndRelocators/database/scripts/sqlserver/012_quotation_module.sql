-- Employee-linked users, salesman visibility, quotation workflow, charge master, and starter charges for SQL Server.
SET XACT_ABORT ON; BEGIN TRANSACTION;

ALTER TABLE [dbo].[Designations] ADD [IsSalesman] BIT NOT NULL CONSTRAINT [DF_Designations_IsSalesman] DEFAULT(0);
ALTER TABLE [dbo].[Users] ADD [EmployeeId] UNIQUEIDENTIFIER NULL;
ALTER TABLE [dbo].[Users] ADD CONSTRAINT [FK_Users_Employees_EmployeeId] FOREIGN KEY([EmployeeId]) REFERENCES [dbo].[Employees]([Id]);
CREATE UNIQUE INDEX [UX_Users_EmployeeId] ON [dbo].[Users]([EmployeeId]) WHERE [EmployeeId] IS NOT NULL;

CREATE TABLE [dbo].[ChargeMasters] (
  [SerialNo] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,[Id] UNIQUEIDENTIFIER NOT NULL UNIQUE,[TenantId] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Tenants]([Id]),
  [Code] NVARCHAR(40) NOT NULL,[Name] NVARCHAR(160) NOT NULL,[Unit] NVARCHAR(40) NOT NULL,[DefaultRate] DECIMAL(18,2) NOT NULL,[TaxPercent] DECIMAL(7,3) NOT NULL,
  [Description] NVARCHAR(500) NULL,[IsActive] BIT NOT NULL,[CreatedAtUtc] DATETIMEOFFSET NOT NULL,[UpdatedAtUtc] DATETIMEOFFSET NOT NULL,
  CONSTRAINT [UX_ChargeMasters_Tenant_Code] UNIQUE([TenantId],[Code]));
CREATE INDEX [IX_ChargeMasters_Tenant] ON [dbo].[ChargeMasters]([TenantId]);

CREATE TABLE [dbo].[Quotations] (
  [SerialNo] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,[Id] UNIQUEIDENTIFIER NOT NULL UNIQUE,[TenantId] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Tenants]([Id]),
  [QuotationNumber] NVARCHAR(40) NOT NULL,[SurveyId] UNIQUEIDENTIFIER NULL REFERENCES [dbo].[Surveys]([Id]),[SalesLeadId] UNIQUEIDENTIFIER NULL REFERENCES [dbo].[SalesLeads]([Id]),
  [CustomerName] NVARCHAR(160) NOT NULL,[Phone] NVARCHAR(40) NOT NULL,[Email] NVARCHAR(254) NULL,[AssignedEmployeeId] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Employees]([Id]),
  [Currency] NVARCHAR(3) NOT NULL,[ValidUntil] DATE NOT NULL,[Terms] NVARCHAR(4000) NULL,[Notes] NVARCHAR(2000) NULL,[Status] NVARCHAR(30) NOT NULL,
  [Subtotal] DECIMAL(18,2) NOT NULL,[DiscountTotal] DECIMAL(18,2) NOT NULL,[TaxTotal] DECIMAL(18,2) NOT NULL,[GrandTotal] DECIMAL(18,2) NOT NULL,
  [ShareTokenHash] NVARCHAR(64) NULL,[ShareExpiresAtUtc] DATETIMEOFFSET NULL,[SentAtUtc] DATETIMEOFFSET NULL,[RespondedAtUtc] DATETIMEOFFSET NULL,[RejectionReason] NVARCHAR(1000) NULL,
  [CreatedAtUtc] DATETIMEOFFSET NOT NULL,[UpdatedAtUtc] DATETIMEOFFSET NOT NULL,CONSTRAINT [UX_Quotations_Tenant_Number] UNIQUE([TenantId],[QuotationNumber]));
CREATE UNIQUE INDEX [UX_Quotations_ShareToken] ON [dbo].[Quotations]([ShareTokenHash]) WHERE [ShareTokenHash] IS NOT NULL;
CREATE INDEX [IX_Quotations_Tenant_Latest] ON [dbo].[Quotations]([TenantId],[SerialNo] DESC);
CREATE INDEX [IX_Quotations_Assignee] ON [dbo].[Quotations]([TenantId],[AssignedEmployeeId],[SerialNo] DESC);

CREATE TABLE [dbo].[QuotationLines] (
  [SerialNo] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,[Id] UNIQUEIDENTIFIER NOT NULL UNIQUE,[TenantId] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Tenants]([Id]),
  [QuotationId] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Quotations]([Id]) ON DELETE CASCADE,[ChargeMasterId] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[ChargeMasters]([Id]),
  [Description] NVARCHAR(500) NOT NULL,[Quantity] DECIMAL(12,3) NOT NULL,[Unit] NVARCHAR(40) NOT NULL,[Rate] DECIMAL(18,2) NOT NULL,
  [DiscountPercent] DECIMAL(7,3) NOT NULL,[DiscountAmount] DECIMAL(18,2) NOT NULL,[TaxPercent] DECIMAL(7,3) NOT NULL,[TaxAmount] DECIMAL(18,2) NOT NULL,[LineTotal] DECIMAL(18,2) NOT NULL,[DisplayOrder] INT NOT NULL);
CREATE INDEX [IX_QuotationLines_Quotation] ON [dbo].[QuotationLines]([QuotationId],[DisplayOrder]);

INSERT INTO [dbo].[ChargeMasters]([Id],[TenantId],[Code],[Name],[Unit],[DefaultRate],[TaxPercent],[Description],[IsActive],[CreatedAtUtc],[UpdatedAtUtc])
SELECT NEWID(),t.[Id],d.Code,d.Name,d.Unit,d.Rate,d.Tax,d.Description,1,SYSDATETIMEOFFSET(),SYSDATETIMEOFFSET()
FROM [dbo].[Tenants] t CROSS JOIN (VALUES
('SURVEY','Survey service','service',750.00,18.000,'On-site or remote survey fee'),
('PACKING','Packing service','cbm',550.00,18.000,'Packing labour and handling'),
('TRANSPORT','Transportation','trip',15000.00,18.000,'Origin to destination transportation'),
('LOADING','Loading labour','service',3500.00,18.000,'Loading crew charge'),
('UNLOADING','Unloading labour','service',3500.00,18.000,'Unloading crew charge'),
('STORAGE','Warehouse storage','day',650.00,18.000,'Per-day storage charge'),
('INSURANCE','Transit insurance','service',2500.00,18.000,'Transit risk coverage')) d(Code,Name,Unit,Rate,Tax,Description)
WHERE NOT EXISTS(SELECT 1 FROM [dbo].[ChargeMasters] x WHERE x.[TenantId]=t.[Id] AND x.[Code]=d.Code);

COMMIT TRANSACTION;
