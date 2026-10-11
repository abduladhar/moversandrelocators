-- Adds the pickup origin and delivery destination to quotations.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

ALTER TABLE [dbo].[Quotations] ADD [Origin] NVARCHAR(300) NULL, [Destination] NVARCHAR(300) NULL;

UPDATE q
SET [Origin] = COALESCE(l.[Origin], N''),
    [Destination] = COALESCE(l.[Destination], N'')
FROM [dbo].[Quotations] q
LEFT JOIN [dbo].[SalesLeads] l ON l.[Id] = q.[SalesLeadId];

ALTER TABLE [dbo].[Quotations] ALTER COLUMN [Origin] NVARCHAR(300) NOT NULL;
ALTER TABLE [dbo].[Quotations] ALTER COLUMN [Destination] NVARCHAR(300) NOT NULL;

COMMIT TRANSACTION;
