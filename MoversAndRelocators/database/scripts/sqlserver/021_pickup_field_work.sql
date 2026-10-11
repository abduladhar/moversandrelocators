-- Pickup field work for SQL Server: sales lead link, trip clock, rooms and fragile boxes, box-recipe materials, crew expenses,
-- before/after packing photos, employee and customer sign-offs, and warehouses. The API also applies this idempotently at startup (PickupWorkSchema).
IF OBJECT_ID(N'dbo.Warehouses', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Warehouses] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_Warehouses] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [Code] NVARCHAR(40) NOT NULL, [Name] NVARCHAR(160) NOT NULL, [Address] NVARCHAR(500) NULL, [IsActive] BIT NOT NULL,
        CONSTRAINT [FK_Warehouses_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]));
    CREATE UNIQUE INDEX [IX_Warehouses_Id] ON [dbo].[Warehouses]([Id]);
    CREATE UNIQUE INDEX [IX_Warehouses_TenantId_Code] ON [dbo].[Warehouses]([TenantId],[Code]);
END
GO
IF COL_LENGTH(N'dbo.Pickups', N'SalesLeadId') IS NULL ALTER TABLE [dbo].[Pickups] ADD [SalesLeadId] UNIQUEIDENTIFIER NULL CONSTRAINT [FK_Pickups_SalesLeads] FOREIGN KEY REFERENCES [dbo].[SalesLeads]([Id]);
IF COL_LENGTH(N'dbo.Pickups', N'StartedAtUtc') IS NULL ALTER TABLE [dbo].[Pickups] ADD [StartedAtUtc] DATETIMEOFFSET NULL;
IF COL_LENGTH(N'dbo.Pickups', N'EndedAtUtc') IS NULL ALTER TABLE [dbo].[Pickups] ADD [EndedAtUtc] DATETIMEOFFSET NULL;
IF COL_LENGTH(N'dbo.Pickups', N'IsPaused') IS NULL ALTER TABLE [dbo].[Pickups] ADD [IsPaused] BIT NOT NULL CONSTRAINT [DF_Pickups_IsPaused] DEFAULT(0);
IF COL_LENGTH(N'dbo.Pickups', N'DistanceKm') IS NULL ALTER TABLE [dbo].[Pickups] ADD [DistanceKm] DECIMAL(10,2) NULL;
IF COL_LENGTH(N'dbo.PickupPackages', N'RoomName') IS NULL ALTER TABLE [dbo].[PickupPackages] ADD [RoomName] NVARCHAR(120) NULL;
IF COL_LENGTH(N'dbo.PickupPackages', N'IsFragile') IS NULL ALTER TABLE [dbo].[PickupPackages] ADD [IsFragile] BIT NOT NULL CONSTRAINT [DF_PickupPackages_IsFragile] DEFAULT(0);
IF COL_LENGTH(N'dbo.PickupPackageItems', N'RoomName') IS NULL ALTER TABLE [dbo].[PickupPackageItems] ADD [RoomName] NVARCHAR(120) NULL;
IF COL_LENGTH(N'dbo.PickupPackageItems', N'HouseholdItemId') IS NULL ALTER TABLE [dbo].[PickupPackageItems] ADD [HouseholdItemId] UNIQUEIDENTIFIER NULL;
IF COL_LENGTH(N'dbo.PickupMaterialUsages', N'IsBoxRecipe') IS NULL ALTER TABLE [dbo].[PickupMaterialUsages] ADD [IsBoxRecipe] BIT NOT NULL CONSTRAINT [DF_PickupMaterialUsages_IsBoxRecipe] DEFAULT(0);
IF COL_LENGTH(N'dbo.PackageHandovers', N'WarehouseId') IS NULL ALTER TABLE [dbo].[PackageHandovers] ADD [WarehouseId] UNIQUEIDENTIFIER NULL CONSTRAINT [FK_PackageHandovers_Warehouses] FOREIGN KEY REFERENCES [dbo].[Warehouses]([Id]);
IF OBJECT_ID(N'dbo.PickupTimeEvents', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PickupTimeEvents] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PickupTimeEvents] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PickupId] UNIQUEIDENTIFIER NOT NULL, [Type] NVARCHAR(20) NOT NULL, [OccurredAtUtc] DATETIMEOFFSET NOT NULL, [Reason] NVARCHAR(500) NULL, [RecordedBy] NVARCHAR(254) NOT NULL,
        CONSTRAINT [FK_PickupTimeEvents_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PickupTimeEvents_Pickups] FOREIGN KEY ([PickupId]) REFERENCES [dbo].[Pickups]([Id]) ON DELETE CASCADE);
    CREATE UNIQUE INDEX [IX_PickupTimeEvents_Id] ON [dbo].[PickupTimeEvents]([Id]);
    CREATE INDEX [IX_PickupTimeEvents_PickupId_SerialNo] ON [dbo].[PickupTimeEvents]([PickupId],[SerialNo]);
    CREATE INDEX [IX_PickupTimeEvents_TenantId] ON [dbo].[PickupTimeEvents]([TenantId]);
END
IF OBJECT_ID(N'dbo.PickupExpenses', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PickupExpenses] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PickupExpenses] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PickupId] UNIQUEIDENTIFIER NOT NULL, [Category] NVARCHAR(30) NOT NULL, [Amount] DECIMAL(18,2) NOT NULL, [Currency] NVARCHAR(3) NOT NULL, [IncurredAtUtc] DATETIMEOFFSET NOT NULL, [PaidByEmployeeId] UNIQUEIDENTIFIER NULL, [Notes] NVARCHAR(500) NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL,
        CONSTRAINT [FK_PickupExpenses_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PickupExpenses_Pickups] FOREIGN KEY ([PickupId]) REFERENCES [dbo].[Pickups]([Id]) ON DELETE CASCADE, CONSTRAINT [FK_PickupExpenses_Employees] FOREIGN KEY ([PaidByEmployeeId]) REFERENCES [dbo].[Employees]([Id]));
    CREATE UNIQUE INDEX [IX_PickupExpenses_Id] ON [dbo].[PickupExpenses]([Id]);
    CREATE INDEX [IX_PickupExpenses_PickupId_SerialNo] ON [dbo].[PickupExpenses]([PickupId],[SerialNo]);
    CREATE INDEX [IX_PickupExpenses_TenantId] ON [dbo].[PickupExpenses]([TenantId]);
END
IF OBJECT_ID(N'dbo.PickupAttachments', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PickupAttachments] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PickupAttachments] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PickupId] UNIQUEIDENTIFIER NOT NULL, [Stage] NVARCHAR(20) NOT NULL, [RoomName] NVARCHAR(120) NULL, [UploadedBy] NVARCHAR(254) NOT NULL, [OriginalFileName] NVARCHAR(255) NOT NULL, [ContentType] NVARCHAR(150) NOT NULL, [DeclaredSizeBytes] BIGINT NOT NULL, [StoredSizeBytes] BIGINT NULL, [S3ObjectKey] NVARCHAR(700) NOT NULL, [IsUploaded] BIT NOT NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL, [UploadedAtUtc] DATETIMEOFFSET NULL,
        CONSTRAINT [FK_PickupAttachments_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PickupAttachments_Pickups] FOREIGN KEY ([PickupId]) REFERENCES [dbo].[Pickups]([Id]) ON DELETE CASCADE);
    CREATE UNIQUE INDEX [IX_PickupAttachments_Id] ON [dbo].[PickupAttachments]([Id]);
    CREATE INDEX [IX_PickupAttachments_PickupId_SerialNo] ON [dbo].[PickupAttachments]([PickupId],[SerialNo]);
    CREATE INDEX [IX_PickupAttachments_TenantId] ON [dbo].[PickupAttachments]([TenantId]);
END
IF OBJECT_ID(N'dbo.PickupSignoffs', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PickupSignoffs] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PickupSignoffs] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PickupId] UNIQUEIDENTIFIER NOT NULL, [Party] NVARCHAR(20) NOT NULL, [SignerName] NVARCHAR(160) NOT NULL, [EmployeeId] UNIQUEIDENTIFIER NULL, [Statement] NVARCHAR(1000) NOT NULL, [Remarks] NVARCHAR(1000) NULL, [SignaturePng] NVARCHAR(MAX) NOT NULL, [SignedAtUtc] DATETIMEOFFSET NOT NULL, [RecordedBy] NVARCHAR(254) NOT NULL,
        CONSTRAINT [FK_PickupSignoffs_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PickupSignoffs_Pickups] FOREIGN KEY ([PickupId]) REFERENCES [dbo].[Pickups]([Id]) ON DELETE CASCADE, CONSTRAINT [FK_PickupSignoffs_Employees] FOREIGN KEY ([EmployeeId]) REFERENCES [dbo].[Employees]([Id]));
    CREATE UNIQUE INDEX [IX_PickupSignoffs_Id] ON [dbo].[PickupSignoffs]([Id]);
    CREATE INDEX [IX_PickupSignoffs_PickupId_SerialNo] ON [dbo].[PickupSignoffs]([PickupId],[SerialNo]);
    CREATE INDEX [IX_PickupSignoffs_TenantId] ON [dbo].[PickupSignoffs]([TenantId]);
END
