-- The customer's answer on each sales-lead inventory line, from the inventory link shared with them. The API also applies this at startup (LeadInventorySchema).
IF COL_LENGTH(N'dbo.SalesLeadInventoryItems', N'CustomerStatus') IS NULL ALTER TABLE [dbo].[SalesLeadInventoryItems] ADD [CustomerStatus] NVARCHAR(20) NOT NULL CONSTRAINT [DF_SalesLeadInventoryItems_CustomerStatus] DEFAULT 'PENDING';
IF COL_LENGTH(N'dbo.SalesLeadInventoryItems', N'CustomerNote') IS NULL ALTER TABLE [dbo].[SalesLeadInventoryItems] ADD [CustomerNote] NVARCHAR(500) NULL;
IF COL_LENGTH(N'dbo.SalesLeadInventoryItems', N'CustomerDecidedAtUtc') IS NULL ALTER TABLE [dbo].[SalesLeadInventoryItems] ADD [CustomerDecidedAtUtc] DATETIMEOFFSET NULL;
