-- Move-type master, legacy lead migration, and default sales master data for SQL Server.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

CREATE TABLE [dbo].[MoveTypes] (
    [SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_MoveTypes] PRIMARY KEY,
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [TenantId] UNIQUEIDENTIFIER NOT NULL,
    [Code] NVARCHAR(40) NOT NULL,
    [Name] NVARCHAR(120) NOT NULL,
    [DisplayOrder] INT NOT NULL,
    [Description] NVARCHAR(500) NULL,
    [IsActive] BIT NOT NULL,
    [CreatedAtUtc] DATETIMEOFFSET NOT NULL,
    [UpdatedAtUtc] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [FK_MoveTypes_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id])
);
CREATE UNIQUE INDEX [UX_MoveTypes_Id] ON [dbo].[MoveTypes]([Id]);
CREATE UNIQUE INDEX [UX_MoveTypes_Tenant_Code] ON [dbo].[MoveTypes]([TenantId],[Code]);

DECLARE @now DATETIMEOFFSET = SYSUTCDATETIME();

INSERT INTO [dbo].[LeadStatuses] ([Id],[TenantId],[Code],[Name],[DisplayOrder],[Color],[IsClosed],[IsActive],[CreatedAtUtc],[UpdatedAtUtc])
SELECT NEWID(), t.[Id], d.[Code], d.[Name], d.[DisplayOrder], d.[Color], d.[IsClosed], 1, @now, @now
FROM [dbo].[Tenants] t
CROSS JOIN (VALUES
 ('NEW','New enquiry',10,'#1677ff',0), ('CONTACTED','Contacted',20,'#13c2c2',0),
 ('SURVEY','Survey scheduled',30,'#722ed1',0), ('QUOTED','Quotation sent',40,'#fa8c16',0),
 ('WON','Accepted',50,'#52c41a',1), ('LOST','Rejected',60,'#ff4d4f',1)
) d([Code],[Name],[DisplayOrder],[Color],[IsClosed])
WHERE NOT EXISTS (SELECT 1 FROM [dbo].[LeadStatuses] x WHERE x.[TenantId]=t.[Id] AND x.[Code]=d.[Code]);

INSERT INTO [dbo].[FollowUpStatuses] ([Id],[TenantId],[Code],[Name],[DisplayOrder],[Color],[IsCompleted],[IsActive],[CreatedAtUtc],[UpdatedAtUtc])
SELECT NEWID(), t.[Id], d.[Code], d.[Name], d.[DisplayOrder], d.[Color], d.[IsCompleted], 1, @now, @now
FROM [dbo].[Tenants] t
CROSS JOIN (VALUES
 ('PLANNED','Planned',10,'#1677ff',0), ('CONTACTED','Contacted',20,'#13c2c2',1),
 ('NO_ANSWER','No answer',30,'#faad14',1), ('RESCHEDULED','Rescheduled',40,'#722ed1',1),
 ('COMPLETED','Completed',50,'#52c41a',1)
) d([Code],[Name],[DisplayOrder],[Color],[IsCompleted])
WHERE NOT EXISTS (SELECT 1 FROM [dbo].[FollowUpStatuses] x WHERE x.[TenantId]=t.[Id] AND x.[Code]=d.[Code]);

INSERT INTO [dbo].[MoveTypes] ([Id],[TenantId],[Code],[Name],[DisplayOrder],[Description],[IsActive],[CreatedAtUtc],[UpdatedAtUtc])
SELECT NEWID(), t.[Id], d.[Code], d.[Name], d.[DisplayOrder], d.[Description], 1, @now, @now
FROM [dbo].[Tenants] t
CROSS JOIN (VALUES
 ('HOUSEHOLD','Household move',10,'Residential household relocation'),
 ('OFFICE','Office move',20,'Office and commercial relocation'),
 ('VEHICLE','Vehicle transport',30,'Car and two-wheeler transportation'),
 ('INTERNATIONAL','International move',40,'International household or office relocation'),
 ('STORAGE','Storage only',50,'Warehouse storage without an immediate move')
) d([Code],[Name],[DisplayOrder],[Description]);

INSERT INTO [dbo].[MoveTypes] ([Id],[TenantId],[Code],[Name],[DisplayOrder],[Description],[IsActive],[CreatedAtUtc],[UpdatedAtUtc])
SELECT NEWID(), x.[TenantId], CONCAT('LEGACY_', x.[rn]), x.[MoveType], 100 + x.[rn], 'Migrated from an existing sales lead', 1, @now, @now
FROM (
    SELECT DISTINCT l.[TenantId], l.[MoveType], DENSE_RANK() OVER (PARTITION BY l.[TenantId] ORDER BY l.[MoveType]) rn
    FROM [dbo].[SalesLeads] l
) x
WHERE NOT EXISTS (SELECT 1 FROM [dbo].[MoveTypes] m WHERE m.[TenantId]=x.[TenantId] AND LOWER(m.[Name])=LOWER(x.[MoveType]));

ALTER TABLE [dbo].[SalesLeads] ADD [MoveTypeId] UNIQUEIDENTIFIER NULL;
UPDATE l SET [MoveTypeId] = m.[Id]
FROM [dbo].[SalesLeads] l
JOIN [dbo].[MoveTypes] m ON m.[TenantId]=l.[TenantId] AND LOWER(m.[Name])=LOWER(l.[MoveType]);
ALTER TABLE [dbo].[SalesLeads] ALTER COLUMN [MoveTypeId] UNIQUEIDENTIFIER NOT NULL;
ALTER TABLE [dbo].[SalesLeads] ADD CONSTRAINT [FK_SalesLeads_MoveTypes] FOREIGN KEY ([MoveTypeId]) REFERENCES [dbo].[MoveTypes]([Id]);
ALTER TABLE [dbo].[SalesLeads] DROP COLUMN [MoveType];

COMMIT TRANSACTION;
