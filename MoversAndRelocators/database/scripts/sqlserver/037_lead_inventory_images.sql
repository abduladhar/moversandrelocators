-- Optional picture on a sales-lead inventory line (the lead photo or the video frame the AI picked) and where the item is in it. The API also applies this at startup (LeadInventorySchema).
IF COL_LENGTH(N'dbo.SalesLeadInventoryItems', N'ImageKey') IS NULL ALTER TABLE [dbo].[SalesLeadInventoryItems] ADD [ImageKey] NVARCHAR(500) NULL;
IF COL_LENGTH(N'dbo.SalesLeadInventoryItems', N'ImageMark') IS NULL ALTER TABLE [dbo].[SalesLeadInventoryItems] ADD [ImageMark] NVARCHAR(40) NULL;
