-- Packing module for SQL Server: jobs, crew, labelled boxes, box items, material usage and income/expense.
-- The API also applies this idempotently at startup (PackingSchema).
IF OBJECT_ID(N'dbo.PackingJobs', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PackingJobs] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PackingJobs] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [JobNumber] NVARCHAR(40) NOT NULL, [PickupId] UNIQUEIDENTIFIER NULL, [QuotationId] UNIQUEIDENTIFIER NULL, [SalesLeadId] UNIQUEIDENTIFIER NULL, [CustomerName] NVARCHAR(160) NOT NULL, [Phone] NVARCHAR(40) NOT NULL, [Email] NVARCHAR(254) NULL, [Address] NVARCHAR(500) NOT NULL, [ScheduledAtUtc] DATETIMEOFFSET NOT NULL, [Status] NVARCHAR(20) NOT NULL, [Notes] NVARCHAR(2000) NULL, [StartedAtUtc] DATETIMEOFFSET NULL, [CompletedAtUtc] DATETIMEOFFSET NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL, [UpdatedAtUtc] DATETIMEOFFSET NOT NULL, [Version] UNIQUEIDENTIFIER NOT NULL,
        CONSTRAINT [FK_PackingJobs_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PackingJobs_Pickups] FOREIGN KEY ([PickupId]) REFERENCES [dbo].[Pickups]([Id]), CONSTRAINT [FK_PackingJobs_Quotations] FOREIGN KEY ([QuotationId]) REFERENCES [dbo].[Quotations]([Id]), CONSTRAINT [FK_PackingJobs_SalesLeads] FOREIGN KEY ([SalesLeadId]) REFERENCES [dbo].[SalesLeads]([Id]));
    CREATE UNIQUE INDEX [IX_PackingJobs_Id] ON [dbo].[PackingJobs]([Id]);
    CREATE UNIQUE INDEX [IX_PackingJobs_TenantId_JobNumber] ON [dbo].[PackingJobs]([TenantId],[JobNumber]);
    CREATE INDEX [IX_PackingJobs_TenantId] ON [dbo].[PackingJobs]([TenantId]);
END
GO
IF OBJECT_ID(N'dbo.PackingJobCrew', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PackingJobCrew] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PackingJobCrew] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PackingJobId] UNIQUEIDENTIFIER NOT NULL, [EmployeeId] UNIQUEIDENTIFIER NOT NULL, [Role] NVARCHAR(80) NOT NULL,
        CONSTRAINT [FK_PackingJobCrew_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PackingJobCrew_PackingJobs] FOREIGN KEY ([PackingJobId]) REFERENCES [dbo].[PackingJobs]([Id]) ON DELETE CASCADE, CONSTRAINT [FK_PackingJobCrew_Employees] FOREIGN KEY ([EmployeeId]) REFERENCES [dbo].[Employees]([Id]));
    CREATE UNIQUE INDEX [IX_PackingJobCrew_Id] ON [dbo].[PackingJobCrew]([Id]);
    CREATE INDEX [IX_PackingJobCrew_PackingJobId] ON [dbo].[PackingJobCrew]([PackingJobId]);
    CREATE INDEX [IX_PackingJobCrew_TenantId] ON [dbo].[PackingJobCrew]([TenantId]);
END
IF OBJECT_ID(N'dbo.PackingJobBoxes', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PackingJobBoxes] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PackingJobBoxes] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PackingJobId] UNIQUEIDENTIFIER NOT NULL, [BoxTypeId] UNIQUEIDENTIFIER NOT NULL, [TrackingNumber] NVARCHAR(80) NOT NULL, [RoomName] NVARCHAR(120) NULL, [IsFragile] BIT NOT NULL, [Notes] NVARCHAR(500) NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL, [LabelPrintedAtUtc] DATETIMEOFFSET NULL, [LabelPrintCount] INT NOT NULL,
        CONSTRAINT [FK_PackingJobBoxes_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PackingJobBoxes_PackingJobs] FOREIGN KEY ([PackingJobId]) REFERENCES [dbo].[PackingJobs]([Id]) ON DELETE CASCADE, CONSTRAINT [FK_PackingJobBoxes_BoxTypes] FOREIGN KEY ([BoxTypeId]) REFERENCES [dbo].[BoxTypes]([Id]));
    CREATE UNIQUE INDEX [IX_PackingJobBoxes_Id] ON [dbo].[PackingJobBoxes]([Id]);
    CREATE UNIQUE INDEX [IX_PackingJobBoxes_TenantId_TrackingNumber] ON [dbo].[PackingJobBoxes]([TenantId],[TrackingNumber]);
    CREATE INDEX [IX_PackingJobBoxes_PackingJobId] ON [dbo].[PackingJobBoxes]([PackingJobId]);
END
GO
IF OBJECT_ID(N'dbo.PackingJobBoxItems', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PackingJobBoxItems] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PackingJobBoxItems] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PackingJobBoxId] UNIQUEIDENTIFIER NOT NULL, [ItemName] NVARCHAR(160) NOT NULL, [Quantity] INT NOT NULL, [Notes] NVARCHAR(500) NULL, [HouseholdItemId] UNIQUEIDENTIFIER NULL,
        CONSTRAINT [FK_PackingJobBoxItems_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PackingJobBoxItems_PackingJobBoxes] FOREIGN KEY ([PackingJobBoxId]) REFERENCES [dbo].[PackingJobBoxes]([Id]) ON DELETE CASCADE);
    CREATE UNIQUE INDEX [IX_PackingJobBoxItems_Id] ON [dbo].[PackingJobBoxItems]([Id]);
    CREATE INDEX [IX_PackingJobBoxItems_PackingJobBoxId] ON [dbo].[PackingJobBoxItems]([PackingJobBoxId]);
    CREATE INDEX [IX_PackingJobBoxItems_TenantId] ON [dbo].[PackingJobBoxItems]([TenantId]);
END
IF OBJECT_ID(N'dbo.PackingJobMaterials', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PackingJobMaterials] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PackingJobMaterials] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PackingJobId] UNIQUEIDENTIFIER NOT NULL, [MaterialId] UNIQUEIDENTIFIER NOT NULL, [Quantity] DECIMAL(12,3) NOT NULL, [UnitCost] DECIMAL(20,4) NOT NULL, [IsBoxRecipe] BIT NOT NULL,
        CONSTRAINT [FK_PackingJobMaterials_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PackingJobMaterials_PackingJobs] FOREIGN KEY ([PackingJobId]) REFERENCES [dbo].[PackingJobs]([Id]) ON DELETE CASCADE, CONSTRAINT [FK_PackingJobMaterials_PackingMaterials] FOREIGN KEY ([MaterialId]) REFERENCES [dbo].[PackingMaterials]([Id]));
    CREATE UNIQUE INDEX [IX_PackingJobMaterials_Id] ON [dbo].[PackingJobMaterials]([Id]);
    CREATE INDEX [IX_PackingJobMaterials_PackingJobId] ON [dbo].[PackingJobMaterials]([PackingJobId]);
    CREATE INDEX [IX_PackingJobMaterials_TenantId] ON [dbo].[PackingJobMaterials]([TenantId]);
END
IF OBJECT_ID(N'dbo.PackingJobTransactions', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PackingJobTransactions] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PackingJobTransactions] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PackingJobId] UNIQUEIDENTIFIER NOT NULL, [TransactionNumber] NVARCHAR(60) NOT NULL, [Type] NVARCHAR(20) NOT NULL, [Category] NVARCHAR(120) NOT NULL, [Amount] DECIMAL(20,4) NOT NULL, [PaymentMethod] NVARCHAR(40) NOT NULL, [Notes] NVARCHAR(500) NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL,
        CONSTRAINT [FK_PackingJobTransactions_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PackingJobTransactions_PackingJobs] FOREIGN KEY ([PackingJobId]) REFERENCES [dbo].[PackingJobs]([Id]) ON DELETE CASCADE);
    CREATE UNIQUE INDEX [IX_PackingJobTransactions_Id] ON [dbo].[PackingJobTransactions]([Id]);
    CREATE UNIQUE INDEX [IX_PackingJobTransactions_TenantId_TransactionNumber] ON [dbo].[PackingJobTransactions]([TenantId],[TransactionNumber]);
    CREATE INDEX [IX_PackingJobTransactions_PackingJobId] ON [dbo].[PackingJobTransactions]([PackingJobId]);
END
