-- Delivery module for SQL Server: runs, trip clock, crew, customer delivery notes with signatures, packages and money.
-- The API also applies this idempotently at startup (DeliverySchema).
IF OBJECT_ID(N'dbo.DeliveryJobs', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[DeliveryJobs] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_DeliveryJobs] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [DeliveryNumber] NVARCHAR(40) NOT NULL, [ScheduledAtUtc] DATETIMEOFFSET NOT NULL, [DurationMinutes] INT NOT NULL, [Status] NVARCHAR(20) NOT NULL, [Notes] NVARCHAR(2000) NULL, [VehicleId] UNIQUEIDENTIFIER NULL, [DriverEmployeeId] UNIQUEIDENTIFIER NULL, [StartedAtUtc] DATETIMEOFFSET NULL, [CompletedAtUtc] DATETIMEOFFSET NULL, [IsPaused] BIT NOT NULL, [DistanceKm] DECIMAL(9,2) NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL, [UpdatedAtUtc] DATETIMEOFFSET NOT NULL, [Version] UNIQUEIDENTIFIER NOT NULL,
        CONSTRAINT [FK_DeliveryJobs_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_DeliveryJobs_Vehicles] FOREIGN KEY ([VehicleId]) REFERENCES [dbo].[Vehicles]([Id]), CONSTRAINT [FK_DeliveryJobs_Employees] FOREIGN KEY ([DriverEmployeeId]) REFERENCES [dbo].[Employees]([Id]));
    CREATE UNIQUE INDEX [IX_DeliveryJobs_Id] ON [dbo].[DeliveryJobs]([Id]);
    CREATE UNIQUE INDEX [IX_DeliveryJobs_TenantId_DeliveryNumber] ON [dbo].[DeliveryJobs]([TenantId],[DeliveryNumber]);
    CREATE INDEX [IX_DeliveryJobs_TenantId] ON [dbo].[DeliveryJobs]([TenantId]);
END
GO
IF OBJECT_ID(N'dbo.DeliveryJobTimeEvents', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[DeliveryJobTimeEvents] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_DeliveryJobTimeEvents] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [DeliveryJobId] UNIQUEIDENTIFIER NOT NULL, [Type] NVARCHAR(20) NOT NULL, [OccurredAtUtc] DATETIMEOFFSET NOT NULL, [Reason] NVARCHAR(500) NULL, [RecordedBy] NVARCHAR(254) NOT NULL,
        CONSTRAINT [FK_DeliveryJobTimeEvents_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_DeliveryJobTimeEvents_DeliveryJobs] FOREIGN KEY ([DeliveryJobId]) REFERENCES [dbo].[DeliveryJobs]([Id]) ON DELETE CASCADE);
    CREATE UNIQUE INDEX [IX_DeliveryJobTimeEvents_Id] ON [dbo].[DeliveryJobTimeEvents]([Id]);
    CREATE INDEX [IX_DeliveryJobTimeEvents_DeliveryJobId] ON [dbo].[DeliveryJobTimeEvents]([DeliveryJobId]);
    CREATE INDEX [IX_DeliveryJobTimeEvents_TenantId] ON [dbo].[DeliveryJobTimeEvents]([TenantId]);
END
GO
IF OBJECT_ID(N'dbo.DeliveryJobCrew', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[DeliveryJobCrew] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_DeliveryJobCrew] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [DeliveryJobId] UNIQUEIDENTIFIER NOT NULL, [EmployeeId] UNIQUEIDENTIFIER NOT NULL, [Role] NVARCHAR(80) NOT NULL, [TeamId] UNIQUEIDENTIFIER NULL, [TeamName] NVARCHAR(120) NULL, [AssignedAtUtc] DATETIMEOFFSET NOT NULL,
        CONSTRAINT [FK_DeliveryJobCrew_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_DeliveryJobCrew_DeliveryJobs] FOREIGN KEY ([DeliveryJobId]) REFERENCES [dbo].[DeliveryJobs]([Id]) ON DELETE CASCADE, CONSTRAINT [FK_DeliveryJobCrew_Employees] FOREIGN KEY ([EmployeeId]) REFERENCES [dbo].[Employees]([Id]));
    CREATE UNIQUE INDEX [IX_DeliveryJobCrew_Id] ON [dbo].[DeliveryJobCrew]([Id]);
    CREATE INDEX [IX_DeliveryJobCrew_DeliveryJobId] ON [dbo].[DeliveryJobCrew]([DeliveryJobId]);
    CREATE INDEX [IX_DeliveryJobCrew_TenantId] ON [dbo].[DeliveryJobCrew]([TenantId]);
END
GO
IF OBJECT_ID(N'dbo.DeliveryNotes', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[DeliveryNotes] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_DeliveryNotes] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [DeliveryJobId] UNIQUEIDENTIFIER NOT NULL, [NoteNumber] NVARCHAR(40) NOT NULL, [CustomerName] NVARCHAR(160) NOT NULL, [ContactName] NVARCHAR(160) NULL, [Phone] NVARCHAR(40) NULL, [Address] NVARCHAR(500) NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL, [SignerName] NVARCHAR(160) NULL, [SignaturePng] NVARCHAR(MAX) NULL, [Remarks] NVARCHAR(1000) NULL, [SignedAtUtc] DATETIMEOFFSET NULL, [SignedBy] NVARCHAR(254) NULL, [SignedItemsJson] NVARCHAR(MAX) NULL,
        CONSTRAINT [FK_DeliveryNotes_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_DeliveryNotes_DeliveryJobs] FOREIGN KEY ([DeliveryJobId]) REFERENCES [dbo].[DeliveryJobs]([Id]) ON DELETE CASCADE);
    CREATE UNIQUE INDEX [IX_DeliveryNotes_Id] ON [dbo].[DeliveryNotes]([Id]);
    CREATE UNIQUE INDEX [IX_DeliveryNotes_TenantId_NoteNumber] ON [dbo].[DeliveryNotes]([TenantId],[NoteNumber]);
    CREATE INDEX [IX_DeliveryNotes_DeliveryJobId] ON [dbo].[DeliveryNotes]([DeliveryJobId]);
END
GO
IF OBJECT_ID(N'dbo.DeliveryItems', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[DeliveryItems] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_DeliveryItems] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [DeliveryJobId] UNIQUEIDENTIFIER NOT NULL, [DeliveryNoteId] UNIQUEIDENTIFIER NOT NULL, [BoxId] UNIQUEIDENTIFIER NOT NULL, [Source] NVARCHAR(20) NOT NULL, [TransportJobId] UNIQUEIDENTIFIER NULL, [PickupId] UNIQUEIDENTIFIER NULL, [TrackingNumber] NVARCHAR(80) NOT NULL, [Description] NVARCHAR(160) NOT NULL, [Contents] NVARCHAR(2000) NOT NULL, [WarehouseId] UNIQUEIDENTIFIER NULL, [Location] NVARCHAR(500) NOT NULL, [Reference] NVARCHAR(80) NOT NULL, [Status] NVARCHAR(20) NOT NULL, [LoadedAtUtc] DATETIMEOFFSET NOT NULL, [LoadedBy] NVARCHAR(254) NOT NULL, [StatusAtUtc] DATETIMEOFFSET NULL, [ReceivedBy] NVARCHAR(160) NULL, [Notes] NVARCHAR(500) NULL, [UpdatedBy] NVARCHAR(254) NULL,
        CONSTRAINT [FK_DeliveryItems_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_DeliveryItems_DeliveryJobs] FOREIGN KEY ([DeliveryJobId]) REFERENCES [dbo].[DeliveryJobs]([Id]) ON DELETE CASCADE, CONSTRAINT [FK_DeliveryItems_DeliveryNotes] FOREIGN KEY ([DeliveryNoteId]) REFERENCES [dbo].[DeliveryNotes]([Id]));
    CREATE UNIQUE INDEX [IX_DeliveryItems_Id] ON [dbo].[DeliveryItems]([Id]);
    CREATE INDEX [IX_DeliveryItems_BoxId] ON [dbo].[DeliveryItems]([BoxId]);
    CREATE INDEX [IX_DeliveryItems_DeliveryJobId] ON [dbo].[DeliveryItems]([DeliveryJobId]);
    CREATE INDEX [IX_DeliveryItems_DeliveryNoteId] ON [dbo].[DeliveryItems]([DeliveryNoteId]);
    CREATE INDEX [IX_DeliveryItems_TenantId] ON [dbo].[DeliveryItems]([TenantId]);
END
GO
IF OBJECT_ID(N'dbo.DeliveryJobTransactions', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[DeliveryJobTransactions] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_DeliveryJobTransactions] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [DeliveryJobId] UNIQUEIDENTIFIER NOT NULL, [DeliveryNoteId] UNIQUEIDENTIFIER NULL, [TransactionNumber] NVARCHAR(60) NOT NULL, [Type] NVARCHAR(20) NOT NULL, [Category] NVARCHAR(120) NOT NULL, [Amount] DECIMAL(20,4) NOT NULL, [PaymentMethod] NVARCHAR(40) NOT NULL, [Notes] NVARCHAR(500) NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL,
        CONSTRAINT [FK_DeliveryJobTransactions_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_DeliveryJobTransactions_DeliveryJobs] FOREIGN KEY ([DeliveryJobId]) REFERENCES [dbo].[DeliveryJobs]([Id]) ON DELETE CASCADE, CONSTRAINT [FK_DeliveryJobTransactions_DeliveryNotes] FOREIGN KEY ([DeliveryNoteId]) REFERENCES [dbo].[DeliveryNotes]([Id]));
    CREATE UNIQUE INDEX [IX_DeliveryJobTransactions_Id] ON [dbo].[DeliveryJobTransactions]([Id]);
    CREATE UNIQUE INDEX [IX_DeliveryJobTransactions_TenantId_TransactionNumber] ON [dbo].[DeliveryJobTransactions]([TenantId],[TransactionNumber]);
    CREATE INDEX [IX_DeliveryJobTransactions_DeliveryJobId] ON [dbo].[DeliveryJobTransactions]([DeliveryJobId]);
END
GO
