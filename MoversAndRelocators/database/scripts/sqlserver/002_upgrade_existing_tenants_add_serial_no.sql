-- One-time SQL Server upgrade for databases created before SerialNo existed.

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'dbo.Tenants', N'SerialNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Tenants] ADD [SerialNo] INT IDENTITY(1,1) NOT NULL;

    IF EXISTS (
        SELECT 1 FROM sys.key_constraints
        WHERE [name] = N'PK_Tenants' AND [parent_object_id] = OBJECT_ID(N'dbo.Tenants')
    )
        ALTER TABLE [dbo].[Tenants] DROP CONSTRAINT [PK_Tenants];

    ALTER TABLE [dbo].[Tenants]
        ADD CONSTRAINT [PK_Tenants] PRIMARY KEY CLUSTERED ([SerialNo]);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'UX_Tenants_Id' AND [object_id] = OBJECT_ID(N'dbo.Tenants'))
    CREATE UNIQUE INDEX [UX_Tenants_Id] ON [dbo].[Tenants] ([Id]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'UX_Tenants_Slug' AND [object_id] = OBJECT_ID(N'dbo.Tenants'))
    CREATE UNIQUE INDEX [UX_Tenants_Slug] ON [dbo].[Tenants] ([Slug]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_Tenants_Latest' AND [object_id] = OBJECT_ID(N'dbo.Tenants'))
    CREATE INDEX [IX_Tenants_Latest] ON [dbo].[Tenants] ([SerialNo] DESC);

COMMIT TRANSACTION;
