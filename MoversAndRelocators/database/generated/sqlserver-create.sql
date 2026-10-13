CREATE TABLE [BillingRecords] (
    [SerialNo] int NOT NULL IDENTITY,
    [Kind] nvarchar(20) NOT NULL,
    [Number] nvarchar(40) NOT NULL,
    [RequestId] uniqueidentifier NOT NULL,
    [RequestHash] nvarchar(64) NOT NULL,
    [Payload] nvarchar(max) NOT NULL,
    [Version] uniqueidentifier NOT NULL,
    [JournalId] uniqueidentifier NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_BillingRecords] PRIMARY KEY ([SerialNo])
);
GO


CREATE TABLE [BusinessMasters] (
    [SerialNo] int NOT NULL IDENTITY,
    [Kind] nvarchar(30) NOT NULL,
    [Code] nvarchar(40) NOT NULL,
    [Payload] nvarchar(max) NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_BusinessMasters] PRIMARY KEY ([SerialNo])
);
GO


CREATE TABLE [JobCargo] (
    [SerialNo] int NOT NULL IDENTITY,
    [JobId] uniqueidentifier NOT NULL,
    [BoxId] uniqueidentifier NOT NULL,
    [PickupId] uniqueidentifier NULL,
    [IsActive] bit NOT NULL,
    [SnapshotJson] nvarchar(max) NOT NULL,
    [LoadedBy] nvarchar(160) NOT NULL,
    [LoadedAtUtc] datetimeoffset NOT NULL,
    [UnloadedAtUtc] datetimeoffset NULL,
    [UnloadedBy] nvarchar(320) NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_JobCargo] PRIMARY KEY ([SerialNo])
);
GO


CREATE TABLE [Permissions] (
    [SerialNo] int NOT NULL IDENTITY,
    [Code] nvarchar(120) NOT NULL,
    [Name] nvarchar(160) NOT NULL,
    [Module] nvarchar(80) NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_Permissions] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_Permissions_Id] UNIQUE ([Id])
);
GO


CREATE TABLE [PickupBoxPickEvents] (
    [SerialNo] int NOT NULL IDENTITY,
    [PickupId] uniqueidentifier NOT NULL,
    [Source] nvarchar(max) NOT NULL,
    [BoxId] uniqueidentifier NOT NULL,
    [TrackingNumber] nvarchar(max) NOT NULL,
    [FromStatus] nvarchar(max) NOT NULL,
    [ToStatus] nvarchar(max) NOT NULL,
    [Method] nvarchar(max) NOT NULL,
    [OccurredAtUtc] datetimeoffset NOT NULL,
    [Actor] nvarchar(max) NOT NULL,
    [Notes] nvarchar(max) NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PickupBoxPickEvents] PRIMARY KEY ([SerialNo])
);
GO


CREATE TABLE [PickupBoxPicks] (
    [SerialNo] int NOT NULL IDENTITY,
    [PickupId] uniqueidentifier NOT NULL,
    [Source] nvarchar(max) NOT NULL,
    [BoxId] uniqueidentifier NOT NULL,
    [TrackingNumber] nvarchar(max) NOT NULL,
    [PackingJobId] uniqueidentifier NULL,
    [AddedBy] nvarchar(max) NOT NULL,
    [AddedAtUtc] datetimeoffset NOT NULL,
    [Status] nvarchar(max) NOT NULL,
    [StatusAtUtc] datetimeoffset NULL,
    [StatusBy] nvarchar(max) NULL,
    [Method] nvarchar(max) NULL,
    [StatusReason] nvarchar(max) NULL,
    [Condition] nvarchar(max) NOT NULL,
    [ConditionNotes] nvarchar(max) NULL,
    [ConditionAtUtc] datetimeoffset NULL,
    [ConditionBy] nvarchar(max) NULL,
    [Version] uniqueidentifier NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PickupBoxPicks] PRIMARY KEY ([SerialNo])
);
GO


CREATE TABLE [PickupCollectionApprovals] (
    [SerialNo] int NOT NULL IDENTITY,
    [PickupId] uniqueidentifier NOT NULL,
    [WarehouseId] uniqueidentifier NULL,
    [PickedCount] int NOT NULL,
    [MissingCount] int NOT NULL,
    [ExcludedCount] int NOT NULL,
    [ApprovedAtUtc] datetimeoffset NOT NULL,
    [ApprovedBy] nvarchar(max) NOT NULL,
    [Notes] nvarchar(max) NULL,
    [ReopenedAtUtc] datetimeoffset NULL,
    [ReopenedBy] nvarchar(max) NULL,
    [ReopenReason] nvarchar(max) NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PickupCollectionApprovals] PRIMARY KEY ([SerialNo])
);
GO


CREATE TABLE [PickupPackingJobs] (
    [SerialNo] int NOT NULL IDENTITY,
    [PickupId] uniqueidentifier NOT NULL,
    [PackingJobId] uniqueidentifier NOT NULL,
    [LinkedAtUtc] datetimeoffset NOT NULL,
    [LinkedBy] nvarchar(max) NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PickupPackingJobs] PRIMARY KEY ([SerialNo])
);
GO


CREATE TABLE [PickupStatuses] (
    [SerialNo] int NOT NULL IDENTITY,
    [Code] nvarchar(40) NOT NULL,
    [Name] nvarchar(120) NOT NULL,
    [DisplayOrder] int NOT NULL,
    [Color] nvarchar(30) NULL,
    [IsCompleted] bit NOT NULL,
    [IsActive] bit NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PickupStatuses] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_PickupStatuses_Id] UNIQUE ([Id])
);
GO


CREATE TABLE [TeamMemberships] (
    [SerialNo] int NOT NULL IDENTITY,
    [TeamId] uniqueidentifier NOT NULL,
    [EmployeeId] uniqueidentifier NOT NULL,
    [Role] nvarchar(max) NOT NULL,
    [JoinedAtUtc] datetimeoffset NOT NULL,
    [LeftAtUtc] datetimeoffset NULL,
    [RecordedBy] nvarchar(max) NOT NULL,
    [LeaveReason] nvarchar(max) NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_TeamMemberships] PRIMARY KEY ([SerialNo])
);
GO


CREATE TABLE [Teams] (
    [SerialNo] int NOT NULL IDENTITY,
    [Code] nvarchar(max) NOT NULL,
    [Name] nvarchar(max) NOT NULL,
    [Kind] nvarchar(max) NOT NULL,
    [SupervisorEmployeeId] uniqueidentifier NULL,
    [Notes] nvarchar(max) NULL,
    [IsActive] bit NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [Version] uniqueidentifier NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_Teams] PRIMARY KEY ([SerialNo])
);
GO


CREATE TABLE [Tenants] (
    [SerialNo] int NOT NULL IDENTITY,
    [Name] nvarchar(160) NOT NULL,
    [Slug] nvarchar(80) NOT NULL,
    [ContactEmail] nvarchar(254) NULL,
    [Phone] nvarchar(40) NULL,
    [Address] nvarchar(500) NULL,
    [IsActive] bit NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_Tenants] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_Tenants_Id] UNIQUE ([Id])
);
GO


CREATE TABLE [TransportJobs] (
    [SerialNo] int NOT NULL IDENTITY,
    [JobNumber] nvarchar(40) NOT NULL,
    [RequestId] uniqueidentifier NOT NULL,
    [RequestHash] nvarchar(64) NOT NULL,
    [DetailsJson] nvarchar(max) NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [Version] uniqueidentifier NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [DepartedAtUtc] datetimeoffset NULL,
    [ArrivedAtUtc] datetimeoffset NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_TransportJobs] PRIMARY KEY ([SerialNo])
);
GO


CREATE TABLE [Vehicles] (
    [SerialNo] int NOT NULL IDENTITY,
    [RegistrationNumber] nvarchar(40) NOT NULL,
    [Name] nvarchar(120) NOT NULL,
    [Type] nvarchar(80) NOT NULL,
    [CapacityCbm] decimal(12,3) NOT NULL,
    [DriverName] nvarchar(120) NULL,
    [DriverPhone] nvarchar(40) NULL,
    [IsActive] bit NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_Vehicles] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_Vehicles_Id] UNIQUE ([Id])
);
GO


CREATE TABLE [WarehouseAttachments] (
    [SerialNo] int NOT NULL IDENTITY,
    [ReceiptId] uniqueidentifier NOT NULL,
    [OriginalFileName] nvarchar(180) NOT NULL,
    [ContentType] nvarchar(150) NOT NULL,
    [DeclaredSizeBytes] bigint NOT NULL,
    [StoredSizeBytes] bigint NULL,
    [ObjectKey] nvarchar(700) NOT NULL,
    [UploadedBy] nvarchar(320) NOT NULL,
    [IsUploaded] bit NOT NULL,
    [IsDeleted] bit NOT NULL,
    [UploadedAtUtc] datetimeoffset NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_WarehouseAttachments] PRIMARY KEY ([SerialNo])
);
GO


CREATE TABLE [WarehouseReceipts] (
    [SerialNo] int NOT NULL IDENTITY,
    [RequestId] uniqueidentifier NOT NULL,
    [RequestHash] nvarchar(64) NOT NULL,
    [ReceiptNumber] nvarchar(40) NOT NULL,
    [Source] nvarchar(16) NOT NULL,
    [WarehouseId] uniqueidentifier NOT NULL,
    [PickupId] uniqueidentifier NULL,
    [ReceivedAtUtc] datetimeoffset NOT NULL,
    [ActorId] uniqueidentifier NOT NULL,
    [SnapshotJson] nvarchar(max) NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_WarehouseReceipts] PRIMARY KEY ([SerialNo])
);
GO


CREATE TABLE [AiUsageRecords] (
    [SerialNo] int NOT NULL IDENTITY,
    [Feature] nvarchar(40) NOT NULL,
    [SalesLeadId] uniqueidentifier NULL,
    [AttachmentId] uniqueidentifier NULL,
    [Model] nvarchar(120) NOT NULL,
    [InputTokens] int NOT NULL,
    [CachedInputTokens] int NOT NULL,
    [OutputTokens] int NOT NULL,
    [TranscriptionModel] nvarchar(120) NULL,
    [AudioSeconds] decimal(12,1) NOT NULL,
    [VisionCost] decimal(18,6) NULL,
    [TranscriptionCost] decimal(18,6) NULL,
    [TotalCost] decimal(18,6) NULL,
    [Currency] nvarchar(3) NOT NULL,
    [CreatedBy] nvarchar(254) NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_AiUsageRecords] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_AiUsageRecords_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [BoxTypes] (
    [SerialNo] int NOT NULL IDENTITY,
    [Code] nvarchar(40) NOT NULL,
    [Name] nvarchar(160) NOT NULL,
    [CapacityCbm] decimal(12,3) NOT NULL,
    [Description] nvarchar(500) NULL,
    [IsActive] bit NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_BoxTypes] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_BoxTypes_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_BoxTypes_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [ChargeMasters] (
    [SerialNo] int NOT NULL IDENTITY,
    [Code] nvarchar(40) NOT NULL,
    [Name] nvarchar(160) NOT NULL,
    [Unit] nvarchar(40) NOT NULL,
    [DefaultRate] decimal(20,4) NOT NULL,
    [TaxPercent] decimal(7,3) NOT NULL,
    [Description] nvarchar(500) NULL,
    [IsActive] bit NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_ChargeMasters] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_ChargeMasters_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_ChargeMasters_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [Companies] (
    [SerialNo] int NOT NULL IDENTITY,
    [Code] nvarchar(20) NOT NULL,
    [Name] nvarchar(160) NOT NULL,
    [LegalName] nvarchar(200) NULL,
    [TaxNumber] nvarchar(40) NULL,
    [Address] nvarchar(500) NULL,
    [Phone] nvarchar(40) NULL,
    [Email] nvarchar(254) NULL,
    [Website] nvarchar(200) NULL,
    [NumberCode] nvarchar(10) NULL,
    [IsDefault] bit NOT NULL,
    [IsActive] bit NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_Companies] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_Companies_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [Designations] (
    [SerialNo] int NOT NULL IDENTITY,
    [Code] nvarchar(40) NOT NULL,
    [Name] nvarchar(120) NOT NULL,
    [Level] int NOT NULL,
    [Description] nvarchar(500) NULL,
    [IsActive] bit NOT NULL,
    [IsSalesman] bit NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_Designations] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_Designations_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_Designations_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [ExpenseAttachments] (
    [SerialNo] int NOT NULL IDENTITY,
    [Kind] nvarchar(20) NOT NULL,
    [ExpenseId] uniqueidentifier NOT NULL,
    [OriginalFileName] nvarchar(180) NOT NULL,
    [ContentType] nvarchar(160) NOT NULL,
    [DeclaredSizeBytes] bigint NOT NULL,
    [StoredSizeBytes] bigint NULL,
    [ObjectKey] nvarchar(700) NOT NULL,
    [IsUploaded] bit NOT NULL,
    [IsDeleted] bit NOT NULL,
    [UploadedBy] nvarchar(254) NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UploadedAtUtc] datetimeoffset NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_ExpenseAttachments] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_ExpenseAttachments_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [FollowUpStatuses] (
    [SerialNo] int NOT NULL IDENTITY,
    [Code] nvarchar(40) NOT NULL,
    [Name] nvarchar(120) NOT NULL,
    [DisplayOrder] int NOT NULL,
    [Color] nvarchar(20) NULL,
    [IsCompleted] bit NOT NULL,
    [IsActive] bit NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_FollowUpStatuses] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_FollowUpStatuses_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_FollowUpStatuses_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [HouseholdItems] (
    [SerialNo] int NOT NULL IDENTITY,
    [Code] nvarchar(40) NOT NULL,
    [Name] nvarchar(160) NOT NULL,
    [VolumeCbm] decimal(12,3) NOT NULL,
    [Description] nvarchar(500) NULL,
    [IsActive] bit NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_HouseholdItems] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_HouseholdItems_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_HouseholdItems_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [LeadStatuses] (
    [SerialNo] int NOT NULL IDENTITY,
    [Code] nvarchar(40) NOT NULL,
    [Name] nvarchar(120) NOT NULL,
    [DisplayOrder] int NOT NULL,
    [Color] nvarchar(20) NULL,
    [IsClosed] bit NOT NULL,
    [IsActive] bit NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_LeadStatuses] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_LeadStatuses_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_LeadStatuses_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [MoveTypes] (
    [SerialNo] int NOT NULL IDENTITY,
    [Code] nvarchar(40) NOT NULL,
    [Name] nvarchar(120) NOT NULL,
    [DisplayOrder] int NOT NULL,
    [Description] nvarchar(500) NULL,
    [IsActive] bit NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_MoveTypes] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_MoveTypes_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_MoveTypes_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PackingMaterials] (
    [SerialNo] int NOT NULL IDENTITY,
    [Code] nvarchar(40) NOT NULL,
    [Name] nvarchar(160) NOT NULL,
    [Unit] nvarchar(40) NOT NULL,
    [CurrentUnitCost] decimal(20,4) NOT NULL,
    [Description] nvarchar(500) NULL,
    [IsActive] bit NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PackingMaterials] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_PackingMaterials_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_PackingMaterials_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [Roles] (
    [SerialNo] int NOT NULL IDENTITY,
    [TenantId] uniqueidentifier NULL,
    [Name] nvarchar(120) NOT NULL,
    [Code] nvarchar(80) NOT NULL,
    [IsSystemRole] bit NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_Roles] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_Roles_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_Roles_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [SavedReports] (
    [SerialNo] int NOT NULL IDENTITY,
    [Name] nvarchar(160) NOT NULL,
    [ColumnsJson] nvarchar(2000) NOT NULL,
    [SortBy] nvarchar(160) NOT NULL,
    [Version] uniqueidentifier NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_SavedReports] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_SavedReports_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [TaxMasters] (
    [SerialNo] int NOT NULL IDENTITY,
    [Code] nvarchar(40) NOT NULL,
    [Name] nvarchar(160) NOT NULL,
    [Kind] nvarchar(20) NOT NULL,
    [CalculationBasis] nvarchar(30) NOT NULL,
    [Rate] decimal(12,4) NOT NULL,
    [IsDefault] bit NOT NULL,
    [Description] nvarchar(500) NULL,
    [IsActive] bit NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_TaxMasters] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_TaxMasters_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_TaxMasters_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [TenantAwsConfigurations] (
    [SerialNo] int NOT NULL IDENTITY,
    [Region] nvarchar(60) NOT NULL,
    [BucketName] nvarchar(63) NOT NULL,
    [EncryptedAccessKey] nvarchar(1000) NOT NULL,
    [AccessKeyLastFour] nvarchar(4) NOT NULL,
    [EncryptedSecretKey] nvarchar(1000) NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_TenantAwsConfigurations] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_TenantAwsConfigurations_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [TenantOpenAiConfigurations] (
    [SerialNo] int NOT NULL IDENTITY,
    [EncryptedApiKey] nvarchar(1000) NOT NULL,
    [ApiKeyLastFour] nvarchar(4) NOT NULL,
    [ExtractionModel] nvarchar(120) NOT NULL,
    [TranscriptionModel] nvarchar(120) NOT NULL,
    [InputPricePerMillion] decimal(18,6) NULL,
    [CachedInputPricePerMillion] decimal(18,6) NULL,
    [OutputPricePerMillion] decimal(18,6) NULL,
    [TranscriptionPricePerMinute] decimal(18,6) NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_TenantOpenAiConfigurations] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_TenantOpenAiConfigurations_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [Warehouses] (
    [SerialNo] int NOT NULL IDENTITY,
    [Code] nvarchar(40) NOT NULL,
    [Name] nvarchar(160) NOT NULL,
    [Address] nvarchar(500) NULL,
    [IsActive] bit NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_Warehouses] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_Warehouses_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_Warehouses_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [TransportTrips] (
    [SerialNo] int NOT NULL IDENTITY,
    [Number] nvarchar(160) NOT NULL,
    [VehicleId] uniqueidentifier NOT NULL,
    [VehicleNumber] nvarchar(160) NOT NULL,
    [Origin] nvarchar(500) NOT NULL,
    [Destination] nvarchar(500) NOT NULL,
    [StartedAtUtc] datetimeoffset NOT NULL,
    [CompletedAtUtc] datetimeoffset NULL,
    [StartOdometer] decimal(18,2) NOT NULL,
    [EndOdometer] decimal(18,2) NULL,
    [Kilometres] decimal(18,2) NOT NULL,
    [KmPerLitre] decimal(18,2) NOT NULL,
    [FuelPricePerLitre] decimal(18,2) NOT NULL,
    [FuelCost] decimal(18,2) NOT NULL,
    [OtherCost] decimal(18,2) NOT NULL,
    [Currency] nvarchar(160) NOT NULL,
    [Status] nvarchar(160) NOT NULL,
    [Version] uniqueidentifier NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_TransportTrips] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_TransportTrips_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_TransportTrips_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_TransportTrips_Vehicles_VehicleId] FOREIGN KEY ([VehicleId]) REFERENCES [Vehicles] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [Employees] (
    [SerialNo] int NOT NULL IDENTITY,
    [EmployeeNumber] nvarchar(40) NOT NULL,
    [FirstName] nvarchar(100) NOT NULL,
    [LastName] nvarchar(100) NOT NULL,
    [WorkEmail] nvarchar(254) NULL,
    [Phone] nvarchar(40) NULL,
    [JoiningDate] date NOT NULL,
    [DesignationId] uniqueidentifier NOT NULL,
    [ReportsToEmployeeId] uniqueidentifier NULL,
    [IsActive] bit NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_Employees] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_Employees_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_Employees_Designations_DesignationId] FOREIGN KEY ([DesignationId]) REFERENCES [Designations] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Employees_Employees_ReportsToEmployeeId] FOREIGN KEY ([ReportsToEmployeeId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Employees_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [BoxTypeMaterials] (
    [SerialNo] int NOT NULL IDENTITY,
    [BoxTypeId] uniqueidentifier NOT NULL,
    [MaterialId] uniqueidentifier NOT NULL,
    [Quantity] decimal(12,3) NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_BoxTypeMaterials] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_BoxTypeMaterials_BoxTypes_BoxTypeId] FOREIGN KEY ([BoxTypeId]) REFERENCES [BoxTypes] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_BoxTypeMaterials_PackingMaterials_MaterialId] FOREIGN KEY ([MaterialId]) REFERENCES [PackingMaterials] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_BoxTypeMaterials_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [RolePermissions] (
    [SerialNo] int NOT NULL IDENTITY,
    [RoleId] uniqueidentifier NOT NULL,
    [PermissionId] uniqueidentifier NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_RolePermissions] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_RolePermissions_Permissions_PermissionId] FOREIGN KEY ([PermissionId]) REFERENCES [Permissions] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_RolePermissions_Roles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [Roles] ([Id]) ON DELETE CASCADE
);
GO


CREATE TABLE [DeliveryJobs] (
    [SerialNo] int NOT NULL IDENTITY,
    [DeliveryNumber] nvarchar(40) NOT NULL,
    [ScheduledAtUtc] datetimeoffset NOT NULL,
    [DurationMinutes] int NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [Notes] nvarchar(2000) NULL,
    [VehicleId] uniqueidentifier NULL,
    [DriverEmployeeId] uniqueidentifier NULL,
    [StartedAtUtc] datetimeoffset NULL,
    [CompletedAtUtc] datetimeoffset NULL,
    [IsPaused] bit NOT NULL,
    [DistanceKm] decimal(9,2) NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [Version] uniqueidentifier NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_DeliveryJobs] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_DeliveryJobs_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_DeliveryJobs_Employees_DriverEmployeeId] FOREIGN KEY ([DriverEmployeeId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_DeliveryJobs_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_DeliveryJobs_Vehicles_VehicleId] FOREIGN KEY ([VehicleId]) REFERENCES [Vehicles] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [SalesLeads] (
    [SerialNo] int NOT NULL IDENTITY,
    [LeadNumber] nvarchar(40) NOT NULL,
    [CustomerName] nvarchar(160) NOT NULL,
    [Phone] nvarchar(40) NOT NULL,
    [Email] nvarchar(254) NULL,
    [Source] nvarchar(100) NULL,
    [MoveTypeId] uniqueidentifier NOT NULL,
    [Origin] nvarchar(300) NOT NULL,
    [Destination] nvarchar(300) NOT NULL,
    [ExpectedMoveDate] date NULL,
    [StatusId] uniqueidentifier NOT NULL,
    [AssignedEmployeeId] uniqueidentifier NULL,
    [Notes] nvarchar(2000) NULL,
    [IsActive] bit NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_SalesLeads] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_SalesLeads_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_SalesLeads_Employees_AssignedEmployeeId] FOREIGN KEY ([AssignedEmployeeId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_SalesLeads_LeadStatuses_StatusId] FOREIGN KEY ([StatusId]) REFERENCES [LeadStatuses] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_SalesLeads_MoveTypes_MoveTypeId] FOREIGN KEY ([MoveTypeId]) REFERENCES [MoveTypes] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_SalesLeads_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [Users] (
    [SerialNo] int NOT NULL IDENTITY,
    [TenantId] uniqueidentifier NULL,
    [FullName] nvarchar(160) NOT NULL,
    [Email] nvarchar(254) NOT NULL,
    [NormalizedEmail] nvarchar(254) NOT NULL,
    [PasswordHash] nvarchar(600) NOT NULL,
    [EmployeeId] uniqueidentifier NULL,
    [IsActive] bit NOT NULL,
    [LastLoginAtUtc] datetimeoffset NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    [Id] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_Users] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_Users_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_Users_Employees_EmployeeId] FOREIGN KEY ([EmployeeId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Users_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [DeliveryJobCrew] (
    [SerialNo] int NOT NULL IDENTITY,
    [DeliveryJobId] uniqueidentifier NOT NULL,
    [EmployeeId] uniqueidentifier NOT NULL,
    [Role] nvarchar(80) NOT NULL,
    [TeamId] uniqueidentifier NULL,
    [TeamName] nvarchar(120) NULL,
    [AssignedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_DeliveryJobCrew] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_DeliveryJobCrew_DeliveryJobs_DeliveryJobId] FOREIGN KEY ([DeliveryJobId]) REFERENCES [DeliveryJobs] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_DeliveryJobCrew_Employees_EmployeeId] FOREIGN KEY ([EmployeeId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_DeliveryJobCrew_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [DeliveryJobTimeEvents] (
    [SerialNo] int NOT NULL IDENTITY,
    [DeliveryJobId] uniqueidentifier NOT NULL,
    [Type] nvarchar(20) NOT NULL,
    [OccurredAtUtc] datetimeoffset NOT NULL,
    [Reason] nvarchar(500) NULL,
    [RecordedBy] nvarchar(254) NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_DeliveryJobTimeEvents] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_DeliveryJobTimeEvents_DeliveryJobs_DeliveryJobId] FOREIGN KEY ([DeliveryJobId]) REFERENCES [DeliveryJobs] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_DeliveryJobTimeEvents_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [DeliveryNotes] (
    [SerialNo] int NOT NULL IDENTITY,
    [DeliveryJobId] uniqueidentifier NOT NULL,
    [NoteNumber] nvarchar(40) NOT NULL,
    [CustomerName] nvarchar(160) NOT NULL,
    [ContactName] nvarchar(160) NULL,
    [Phone] nvarchar(40) NULL,
    [Address] nvarchar(500) NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [SignerName] nvarchar(160) NULL,
    [SignaturePng] nvarchar(max) NULL,
    [Remarks] nvarchar(1000) NULL,
    [SignedAtUtc] datetimeoffset NULL,
    [SignedBy] nvarchar(254) NULL,
    [SignedItemsJson] nvarchar(max) NULL,
    [DateResponse] nvarchar(20) NULL,
    [PreferredAtUtc] datetimeoffset NULL,
    [DateRespondedAtUtc] datetimeoffset NULL,
    [DateRespondedForUtc] datetimeoffset NULL,
    [Latitude] decimal(9,6) NULL,
    [Longitude] decimal(9,6) NULL,
    [LocationNotes] nvarchar(500) NULL,
    [LocationSharedAtUtc] datetimeoffset NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_DeliveryNotes] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_DeliveryNotes_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_DeliveryNotes_DeliveryJobs_DeliveryJobId] FOREIGN KEY ([DeliveryJobId]) REFERENCES [DeliveryJobs] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_DeliveryNotes_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [LeadFollowUps] (
    [SerialNo] int NOT NULL IDENTITY,
    [SalesLeadId] uniqueidentifier NOT NULL,
    [ScheduledAtUtc] datetimeoffset NOT NULL,
    [StatusId] uniqueidentifier NOT NULL,
    [Notes] nvarchar(2000) NOT NULL,
    [NextFollowUpAtUtc] datetimeoffset NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_LeadFollowUps] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_LeadFollowUps_FollowUpStatuses_StatusId] FOREIGN KEY ([StatusId]) REFERENCES [FollowUpStatuses] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LeadFollowUps_SalesLeads_SalesLeadId] FOREIGN KEY ([SalesLeadId]) REFERENCES [SalesLeads] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LeadFollowUps_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [SalesLeadInventoryItems] (
    [SerialNo] int NOT NULL IDENTITY,
    [SalesLeadId] uniqueidentifier NOT NULL,
    [Kind] nvarchar(10) NOT NULL,
    [Room] nvarchar(80) NULL,
    [Name] nvarchar(160) NOT NULL,
    [Quantity] int NOT NULL,
    [UnitCbm] decimal(12,3) NOT NULL,
    [Fragile] bit NOT NULL,
    [Handling] nvarchar(300) NULL,
    [Notes] nvarchar(1000) NULL,
    [SourceAttachmentId] uniqueidentifier NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_SalesLeadInventoryItems] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_SalesLeadInventoryItems_SalesLeads_SalesLeadId] FOREIGN KEY ([SalesLeadId]) REFERENCES [SalesLeads] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_SalesLeadInventoryItems_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [SalesLeadUploadLinks] (
    [SerialNo] int NOT NULL IDENTITY,
    [SalesLeadId] uniqueidentifier NOT NULL,
    [TokenHash] nvarchar(64) NOT NULL,
    [ExpiresAtUtc] datetimeoffset NOT NULL,
    [IsActive] bit NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [RequestedItems] nvarchar(max) NULL,
    [Description] nvarchar(max) NULL,
    [CustomerItems] nvarchar(max) NULL,
    [CustomerDescription] nvarchar(max) NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_SalesLeadUploadLinks] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_SalesLeadUploadLinks_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_SalesLeadUploadLinks_SalesLeads_SalesLeadId] FOREIGN KEY ([SalesLeadId]) REFERENCES [SalesLeads] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_SalesLeadUploadLinks_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [Surveys] (
    [SerialNo] int NOT NULL IDENTITY,
    [SurveyNumber] nvarchar(40) NOT NULL,
    [SalesLeadId] uniqueidentifier NULL,
    [CustomerName] nvarchar(160) NOT NULL,
    [Phone] nvarchar(40) NOT NULL,
    [Email] nvarchar(254) NULL,
    [AssignedEmployeeId] uniqueidentifier NOT NULL,
    [ScheduledAtUtc] datetimeoffset NOT NULL,
    [Address] nvarchar(600) NOT NULL,
    [Latitude] decimal(10,7) NULL,
    [Longitude] decimal(10,7) NULL,
    [Status] nvarchar(30) NOT NULL,
    [Notes] nvarchar(2000) NULL,
    [StartedAtUtc] datetimeoffset NULL,
    [EndedAtUtc] datetimeoffset NULL,
    [ScheduleConfirmedAtUtc] datetimeoffset NULL,
    [ItemsConfirmedAtUtc] datetimeoffset NULL,
    [CustomerNotes] nvarchar(2000) NULL,
    [ConfirmationTokenHash] nvarchar(64) NULL,
    [ConfirmationExpiresAtUtc] datetimeoffset NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [ConductedByEmployeeId] uniqueidentifier NULL,
    [DistanceKm] decimal(10,2) NULL,
    [IsPaused] bit NOT NULL,
    [CustomerChangeRequestJson] nvarchar(max) NULL,
    [CustomerChangeRequestedAtUtc] datetimeoffset NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_Surveys] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_Surveys_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_Surveys_Employees_AssignedEmployeeId] FOREIGN KEY ([AssignedEmployeeId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Surveys_Employees_ConductedByEmployeeId] FOREIGN KEY ([ConductedByEmployeeId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Surveys_SalesLeads_SalesLeadId] FOREIGN KEY ([SalesLeadId]) REFERENCES [SalesLeads] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Surveys_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [AuditLogs] (
    [SerialNo] int NOT NULL IDENTITY,
    [TenantId] uniqueidentifier NULL,
    [ActorUserId] uniqueidentifier NULL,
    [ActorEmail] nvarchar(254) NOT NULL,
    [Action] nvarchar(30) NOT NULL,
    [EntityType] nvarchar(120) NOT NULL,
    [EntityId] nvarchar(80) NULL,
    [Changes] nvarchar(max) NOT NULL,
    [IpAddress] nvarchar(64) NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_AuditLogs] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_AuditLogs_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AuditLogs_Users_ActorUserId] FOREIGN KEY ([ActorUserId]) REFERENCES [Users] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [UserRoles] (
    [SerialNo] int NOT NULL IDENTITY,
    [UserId] uniqueidentifier NOT NULL,
    [RoleId] uniqueidentifier NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_UserRoles] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_UserRoles_Roles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [Roles] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_UserRoles_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE CASCADE
);
GO


CREATE TABLE [DeliveryItems] (
    [SerialNo] int NOT NULL IDENTITY,
    [DeliveryJobId] uniqueidentifier NOT NULL,
    [DeliveryNoteId] uniqueidentifier NOT NULL,
    [BoxId] uniqueidentifier NOT NULL,
    [Source] nvarchar(20) NOT NULL,
    [TransportJobId] uniqueidentifier NULL,
    [PickupId] uniqueidentifier NULL,
    [TrackingNumber] nvarchar(80) NOT NULL,
    [Description] nvarchar(160) NOT NULL,
    [Contents] nvarchar(2000) NOT NULL,
    [WarehouseId] uniqueidentifier NULL,
    [Location] nvarchar(500) NOT NULL,
    [Reference] nvarchar(80) NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [LoadedAtUtc] datetimeoffset NOT NULL,
    [LoadedBy] nvarchar(254) NOT NULL,
    [StatusAtUtc] datetimeoffset NULL,
    [ReceivedBy] nvarchar(160) NULL,
    [Notes] nvarchar(500) NULL,
    [UpdatedBy] nvarchar(254) NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_DeliveryItems] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_DeliveryItems_DeliveryJobs_DeliveryJobId] FOREIGN KEY ([DeliveryJobId]) REFERENCES [DeliveryJobs] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_DeliveryItems_DeliveryNotes_DeliveryNoteId] FOREIGN KEY ([DeliveryNoteId]) REFERENCES [DeliveryNotes] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_DeliveryItems_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [DeliveryJobTransactions] (
    [SerialNo] int NOT NULL IDENTITY,
    [DeliveryJobId] uniqueidentifier NOT NULL,
    [PaidByEmployeeId] uniqueidentifier NULL,
    [DeliveryNoteId] uniqueidentifier NULL,
    [TransactionNumber] nvarchar(60) NOT NULL,
    [Type] nvarchar(20) NOT NULL,
    [Category] nvarchar(120) NOT NULL,
    [Amount] decimal(20,4) NOT NULL,
    [PaymentMethod] nvarchar(40) NOT NULL,
    [Notes] nvarchar(500) NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_DeliveryJobTransactions] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_DeliveryJobTransactions_DeliveryJobs_DeliveryJobId] FOREIGN KEY ([DeliveryJobId]) REFERENCES [DeliveryJobs] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_DeliveryJobTransactions_DeliveryNotes_DeliveryNoteId] FOREIGN KEY ([DeliveryNoteId]) REFERENCES [DeliveryNotes] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_DeliveryJobTransactions_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [DeliveryNoteLinks] (
    [SerialNo] int NOT NULL IDENTITY,
    [DeliveryJobId] uniqueidentifier NOT NULL,
    [DeliveryNoteId] uniqueidentifier NOT NULL,
    [Purpose] nvarchar(20) NOT NULL,
    [TokenHash] nvarchar(64) NOT NULL,
    [ExpiresAtUtc] datetimeoffset NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_DeliveryNoteLinks] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_DeliveryNoteLinks_DeliveryJobs_DeliveryJobId] FOREIGN KEY ([DeliveryJobId]) REFERENCES [DeliveryJobs] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_DeliveryNoteLinks_DeliveryNotes_DeliveryNoteId] FOREIGN KEY ([DeliveryNoteId]) REFERENCES [DeliveryNotes] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_DeliveryNoteLinks_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [SalesLeadAttachments] (
    [SerialNo] int NOT NULL IDENTITY,
    [SalesLeadId] uniqueidentifier NOT NULL,
    [UploadLinkId] uniqueidentifier NOT NULL,
    [OriginalFileName] nvarchar(255) NOT NULL,
    [ContentType] nvarchar(150) NOT NULL,
    [DeclaredSizeBytes] bigint NOT NULL,
    [StoredSizeBytes] bigint NULL,
    [S3ObjectKey] nvarchar(700) NOT NULL,
    [IsUploaded] bit NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UploadedAtUtc] datetimeoffset NULL,
    [ExtractionJson] nvarchar(max) NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_SalesLeadAttachments] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_SalesLeadAttachments_SalesLeadUploadLinks_UploadLinkId] FOREIGN KEY ([UploadLinkId]) REFERENCES [SalesLeadUploadLinks] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_SalesLeadAttachments_SalesLeads_SalesLeadId] FOREIGN KEY ([SalesLeadId]) REFERENCES [SalesLeads] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_SalesLeadAttachments_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [Quotations] (
    [SerialNo] int NOT NULL IDENTITY,
    [QuotationNumber] nvarchar(40) NOT NULL,
    [RevisedFromNumber] nvarchar(max) NULL,
    [RevisionReason] nvarchar(max) NULL,
    [SurveyId] uniqueidentifier NULL,
    [SalesLeadId] uniqueidentifier NULL,
    [CustomerName] nvarchar(160) NOT NULL,
    [Phone] nvarchar(40) NOT NULL,
    [Email] nvarchar(254) NULL,
    [Origin] nvarchar(300) NOT NULL,
    [Destination] nvarchar(300) NOT NULL,
    [AssignedEmployeeId] uniqueidentifier NOT NULL,
    [Currency] nvarchar(3) NOT NULL,
    [ValidUntil] date NOT NULL,
    [Terms] nvarchar(4000) NULL,
    [Notes] nvarchar(2000) NULL,
    [IncludeSurveyItems] bit NOT NULL,
    [Status] nvarchar(30) NOT NULL,
    [Subtotal] decimal(20,4) NOT NULL,
    [DiscountTotal] decimal(20,4) NOT NULL,
    [TaxTotal] decimal(20,4) NOT NULL,
    [GrandTotal] decimal(20,4) NOT NULL,
    [ShareTokenHash] nvarchar(64) NULL,
    [ShareExpiresAtUtc] datetimeoffset NULL,
    [SentAtUtc] datetimeoffset NULL,
    [RespondedAtUtc] datetimeoffset NULL,
    [RejectionReason] nvarchar(1000) NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_Quotations] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_Quotations_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_Quotations_Employees_AssignedEmployeeId] FOREIGN KEY ([AssignedEmployeeId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Quotations_SalesLeads_SalesLeadId] FOREIGN KEY ([SalesLeadId]) REFERENCES [SalesLeads] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Quotations_Surveys_SurveyId] FOREIGN KEY ([SurveyId]) REFERENCES [Surveys] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Quotations_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [SurveyAttachments] (
    [SerialNo] int NOT NULL IDENTITY,
    [SurveyId] uniqueidentifier NOT NULL,
    [Source] nvarchar(20) NOT NULL,
    [UploadedBy] nvarchar(160) NOT NULL,
    [OriginalFileName] nvarchar(255) NOT NULL,
    [ContentType] nvarchar(150) NOT NULL,
    [DeclaredSizeBytes] bigint NOT NULL,
    [StoredSizeBytes] bigint NULL,
    [S3ObjectKey] nvarchar(700) NOT NULL,
    [IsUploaded] bit NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UploadedAtUtc] datetimeoffset NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_SurveyAttachments] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_SurveyAttachments_Surveys_SurveyId] FOREIGN KEY ([SurveyId]) REFERENCES [Surveys] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_SurveyAttachments_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [SurveyExpenses] (
    [SerialNo] int NOT NULL IDENTITY,
    [SurveyId] uniqueidentifier NOT NULL,
    [Category] nvarchar(30) NOT NULL,
    [Amount] decimal(20,4) NOT NULL,
    [Currency] nvarchar(3) NOT NULL,
    [IncurredAtUtc] datetimeoffset NOT NULL,
    [PaidByEmployeeId] uniqueidentifier NULL,
    [Notes] nvarchar(500) NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_SurveyExpenses] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_SurveyExpenses_Employees_PaidByEmployeeId] FOREIGN KEY ([PaidByEmployeeId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_SurveyExpenses_Surveys_SurveyId] FOREIGN KEY ([SurveyId]) REFERENCES [Surveys] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_SurveyExpenses_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [SurveyExtraMaterials] (
    [SerialNo] int NOT NULL IDENTITY,
    [SurveyId] uniqueidentifier NOT NULL,
    [MaterialId] uniqueidentifier NOT NULL,
    [Quantity] decimal(12,3) NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_SurveyExtraMaterials] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_SurveyExtraMaterials_PackingMaterials_MaterialId] FOREIGN KEY ([MaterialId]) REFERENCES [PackingMaterials] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_SurveyExtraMaterials_Surveys_SurveyId] FOREIGN KEY ([SurveyId]) REFERENCES [Surveys] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_SurveyExtraMaterials_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [SurveyRooms] (
    [SerialNo] int NOT NULL IDENTITY,
    [SurveyId] uniqueidentifier NOT NULL,
    [Name] nvarchar(120) NOT NULL,
    [DisplayOrder] int NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_SurveyRooms] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_SurveyRooms_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_SurveyRooms_Surveys_SurveyId] FOREIGN KEY ([SurveyId]) REFERENCES [Surveys] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_SurveyRooms_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [SurveyTimeEvents] (
    [SerialNo] int NOT NULL IDENTITY,
    [SurveyId] uniqueidentifier NOT NULL,
    [Type] nvarchar(20) NOT NULL,
    [OccurredAtUtc] datetimeoffset NOT NULL,
    [Reason] nvarchar(500) NULL,
    [RecordedBy] nvarchar(254) NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_SurveyTimeEvents] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_SurveyTimeEvents_Surveys_SurveyId] FOREIGN KEY ([SurveyId]) REFERENCES [Surveys] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_SurveyTimeEvents_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [Pickups] (
    [SerialNo] int NOT NULL IDENTITY,
    [PackagesLocked] bit NOT NULL,
    [Version] uniqueidentifier NOT NULL,
    [DurationMinutes] int NOT NULL,
    [SalesLeadId] uniqueidentifier NULL,
    [StartedAtUtc] datetimeoffset NULL,
    [EndedAtUtc] datetimeoffset NULL,
    [IsPaused] bit NOT NULL,
    [DistanceKm] decimal(10,2) NULL,
    [PickupNumber] nvarchar(40) NOT NULL,
    [QuotationId] uniqueidentifier NULL,
    [CustomerName] nvarchar(160) NOT NULL,
    [Phone] nvarchar(40) NOT NULL,
    [Email] nvarchar(254) NULL,
    [Address] nvarchar(500) NOT NULL,
    [Latitude] decimal(10,7) NULL,
    [Longitude] decimal(10,7) NULL,
    [ScheduledAtUtc] datetimeoffset NOT NULL,
    [ConfirmedAtUtc] datetimeoffset NULL,
    [StatusId] uniqueidentifier NOT NULL,
    [VehicleId] uniqueidentifier NULL,
    [Notes] nvarchar(2000) NULL,
    [ConfirmationTokenHash] nvarchar(64) NULL,
    [ConfirmationExpiresAtUtc] datetimeoffset NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_Pickups] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_Pickups_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_Pickups_PickupStatuses_StatusId] FOREIGN KEY ([StatusId]) REFERENCES [PickupStatuses] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Pickups_Quotations_QuotationId] FOREIGN KEY ([QuotationId]) REFERENCES [Quotations] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Pickups_SalesLeads_SalesLeadId] FOREIGN KEY ([SalesLeadId]) REFERENCES [SalesLeads] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Pickups_Vehicles_VehicleId] FOREIGN KEY ([VehicleId]) REFERENCES [Vehicles] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [QuotationItems] (
    [SerialNo] int NOT NULL IDENTITY,
    [QuotationId] uniqueidentifier NOT NULL,
    [HouseholdItemId] uniqueidentifier NOT NULL,
    [RoomName] nvarchar(120) NOT NULL,
    [ItemName] nvarchar(160) NOT NULL,
    [Quantity] int NOT NULL,
    [VolumePerUnitCbm] decimal(12,3) NOT NULL,
    [Notes] nvarchar(500) NULL,
    [DisplayOrder] int NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_QuotationItems] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_QuotationItems_HouseholdItems_HouseholdItemId] FOREIGN KEY ([HouseholdItemId]) REFERENCES [HouseholdItems] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_QuotationItems_Quotations_QuotationId] FOREIGN KEY ([QuotationId]) REFERENCES [Quotations] ([Id]) ON DELETE CASCADE
);
GO


CREATE TABLE [QuotationLines] (
    [SerialNo] int NOT NULL IDENTITY,
    [QuotationId] uniqueidentifier NOT NULL,
    [ChargeMasterId] uniqueidentifier NOT NULL,
    [Description] nvarchar(500) NOT NULL,
    [Quantity] decimal(12,3) NOT NULL,
    [Unit] nvarchar(40) NOT NULL,
    [Rate] decimal(20,4) NOT NULL,
    [DiscountPercent] decimal(7,3) NOT NULL,
    [DiscountAmount] decimal(20,4) NOT NULL,
    [TaxPercent] decimal(7,3) NOT NULL,
    [TaxAmount] decimal(20,4) NOT NULL,
    [LineTotal] decimal(20,4) NOT NULL,
    [DisplayOrder] int NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_QuotationLines] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_QuotationLines_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_QuotationLines_ChargeMasters_ChargeMasterId] FOREIGN KEY ([ChargeMasterId]) REFERENCES [ChargeMasters] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_QuotationLines_Quotations_QuotationId] FOREIGN KEY ([QuotationId]) REFERENCES [Quotations] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_QuotationLines_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [QuotationRequoteRequests] (
    [SerialNo] int NOT NULL IDENTITY,
    [QuotationId] uniqueidentifier NOT NULL,
    [ItemsJson] nvarchar(max) NOT NULL,
    [CustomerNotes] nvarchar(2000) NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [AppliedAtUtc] datetimeoffset NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_QuotationRequoteRequests] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_QuotationRequoteRequests_Quotations_QuotationId] FOREIGN KEY ([QuotationId]) REFERENCES [Quotations] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_QuotationRequoteRequests_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [SurveyItems] (
    [SerialNo] int NOT NULL IDENTITY,
    [SurveyId] uniqueidentifier NOT NULL,
    [RoomId] uniqueidentifier NOT NULL,
    [HouseholdItemId] uniqueidentifier NOT NULL,
    [Quantity] int NOT NULL,
    [VolumePerUnitCbm] decimal(12,3) NOT NULL,
    [Notes] nvarchar(500) NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_SurveyItems] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_SurveyItems_HouseholdItems_HouseholdItemId] FOREIGN KEY ([HouseholdItemId]) REFERENCES [HouseholdItems] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_SurveyItems_SurveyRooms_RoomId] FOREIGN KEY ([RoomId]) REFERENCES [SurveyRooms] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_SurveyItems_Surveys_SurveyId] FOREIGN KEY ([SurveyId]) REFERENCES [Surveys] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_SurveyItems_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [JobExpenses] (
    [SerialNo] int NOT NULL IDENTITY,
    [PickupId] uniqueidentifier NOT NULL,
    [Category] nvarchar(160) NOT NULL,
    [Vendor] nvarchar(160) NOT NULL,
    [Reference] nvarchar(120) NOT NULL,
    [Amount] decimal(18,2) NOT NULL,
    [Currency] nvarchar(160) NOT NULL,
    [Notes] nvarchar(2000) NOT NULL,
    [RecordedAtUtc] datetimeoffset NOT NULL,
    [RequestId] uniqueidentifier NOT NULL,
    [RequestHash] nvarchar(160) NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_JobExpenses] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_JobExpenses_Pickups_PickupId] FOREIGN KEY ([PickupId]) REFERENCES [Pickups] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_JobExpenses_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [JournalEntries] (
    [SerialNo] int NOT NULL IDENTITY,
    [Reference] nvarchar(160) NOT NULL,
    [Description] nvarchar(2000) NOT NULL,
    [Currency] nvarchar(160) NOT NULL,
    [PostingDate] date NOT NULL,
    [PickupId] uniqueidentifier NULL,
    [ReversesId] uniqueidentifier NULL,
    [RequestId] uniqueidentifier NOT NULL,
    [RequestHash] nvarchar(160) NOT NULL,
    [PostedBy] uniqueidentifier NOT NULL,
    [PostedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_JournalEntries] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_JournalEntries_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_JournalEntries_JournalEntries_ReversesId] FOREIGN KEY ([ReversesId]) REFERENCES [JournalEntries] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_JournalEntries_Pickups_PickupId] FOREIGN KEY ([PickupId]) REFERENCES [Pickups] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_JournalEntries_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [LabourEntries] (
    [SerialNo] int NOT NULL IDENTITY,
    [PickupId] uniqueidentifier NOT NULL,
    [EmployeeId] uniqueidentifier NOT NULL,
    [EmployeeName] nvarchar(160) NOT NULL,
    [Activity] nvarchar(160) NOT NULL,
    [StartedAtUtc] datetimeoffset NOT NULL,
    [EndedAtUtc] datetimeoffset NOT NULL,
    [UnpaidBreakMinutes] decimal(18,4) NOT NULL,
    [RegularHours] decimal(18,4) NOT NULL,
    [OvertimeHours] decimal(18,4) NOT NULL,
    [HourlyRate] decimal(18,2) NOT NULL,
    [OvertimeRate] decimal(18,2) NOT NULL,
    [Cost] decimal(18,2) NOT NULL,
    [Currency] nvarchar(160) NOT NULL,
    [Notes] nvarchar(2000) NOT NULL,
    [RequestId] uniqueidentifier NOT NULL,
    [RequestHash] nvarchar(160) NOT NULL,
    [RecordedBy] uniqueidentifier NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_LabourEntries] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_LabourEntries_Employees_EmployeeId] FOREIGN KEY ([EmployeeId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LabourEntries_Pickups_PickupId] FOREIGN KEY ([PickupId]) REFERENCES [Pickups] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_LabourEntries_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PackingConfirmations] (
    [SerialNo] int NOT NULL IDENTITY,
    [PickupId] uniqueidentifier NOT NULL,
    [SnapshotJson] nvarchar(max) NOT NULL,
    [SnapshotHash] nvarchar(64) NOT NULL,
    [TokenHash] nvarchar(64) NOT NULL,
    [ExpiresAtUtc] datetimeoffset NOT NULL,
    [RevokedAtUtc] datetimeoffset NULL,
    [Response] nvarchar(30) NOT NULL,
    [ResponderName] nvarchar(160) NULL,
    [ResponseNotes] nvarchar(2000) NULL,
    [RespondedAtUtc] datetimeoffset NULL,
    [Version] uniqueidentifier NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PackingConfirmations] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_PackingConfirmations_Pickups_PickupId] FOREIGN KEY ([PickupId]) REFERENCES [Pickups] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PackingConfirmations_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PackingJobs] (
    [SerialNo] int NOT NULL IDENTITY,
    [JobNumber] nvarchar(40) NOT NULL,
    [PickupId] uniqueidentifier NULL,
    [QuotationId] uniqueidentifier NULL,
    [SalesLeadId] uniqueidentifier NULL,
    [CustomerName] nvarchar(160) NOT NULL,
    [Phone] nvarchar(40) NOT NULL,
    [Email] nvarchar(254) NULL,
    [Address] nvarchar(500) NOT NULL,
    [ScheduledAtUtc] datetimeoffset NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [Notes] nvarchar(2000) NULL,
    [StartedAtUtc] datetimeoffset NULL,
    [CompletedAtUtc] datetimeoffset NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UpdatedAtUtc] datetimeoffset NOT NULL,
    [Version] uniqueidentifier NOT NULL,
    [IsPaused] bit NOT NULL,
    [ScheduleConfirmedAtUtc] datetimeoffset NULL,
    [Latitude] decimal(9,6) NULL,
    [Longitude] decimal(9,6) NULL,
    [LocationNotes] nvarchar(500) NULL,
    [LocationSharedAtUtc] datetimeoffset NULL,
    [ItemsResponse] nvarchar(20) NULL,
    [ItemsResponderName] nvarchar(160) NULL,
    [ItemsResponseNotes] nvarchar(2000) NULL,
    [ItemsRespondedAtUtc] datetimeoffset NULL,
    [ItemsSnapshotHash] nvarchar(64) NULL,
    [ItemsSnapshotJson] nvarchar(max) NULL,
    [DurationMinutes] int NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PackingJobs] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_PackingJobs_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_PackingJobs_Pickups_PickupId] FOREIGN KEY ([PickupId]) REFERENCES [Pickups] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PackingJobs_Quotations_QuotationId] FOREIGN KEY ([QuotationId]) REFERENCES [Quotations] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PackingJobs_SalesLeads_SalesLeadId] FOREIGN KEY ([SalesLeadId]) REFERENCES [SalesLeads] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PackingJobs_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PickupAssignments] (
    [SerialNo] int NOT NULL IDENTITY,
    [PickupId] uniqueidentifier NOT NULL,
    [EmployeeId] uniqueidentifier NOT NULL,
    [Role] nvarchar(80) NOT NULL,
    [TeamId] uniqueidentifier NULL,
    [TeamName] nvarchar(max) NULL,
    [AssignedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PickupAssignments] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_PickupAssignments_Employees_EmployeeId] FOREIGN KEY ([EmployeeId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PickupAssignments_Pickups_PickupId] FOREIGN KEY ([PickupId]) REFERENCES [Pickups] ([Id]) ON DELETE CASCADE
);
GO


CREATE TABLE [PickupAttachments] (
    [SerialNo] int NOT NULL IDENTITY,
    [PickupId] uniqueidentifier NOT NULL,
    [BoxSource] nvarchar(max) NULL,
    [BoxId] uniqueidentifier NULL,
    [Stage] nvarchar(20) NOT NULL,
    [RoomName] nvarchar(120) NULL,
    [UploadedBy] nvarchar(254) NOT NULL,
    [OriginalFileName] nvarchar(255) NOT NULL,
    [ContentType] nvarchar(150) NOT NULL,
    [DeclaredSizeBytes] bigint NOT NULL,
    [StoredSizeBytes] bigint NULL,
    [S3ObjectKey] nvarchar(700) NOT NULL,
    [IsUploaded] bit NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [UploadedAtUtc] datetimeoffset NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PickupAttachments] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_PickupAttachments_Pickups_PickupId] FOREIGN KEY ([PickupId]) REFERENCES [Pickups] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_PickupAttachments_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PickupExpenses] (
    [SerialNo] int NOT NULL IDENTITY,
    [PickupId] uniqueidentifier NOT NULL,
    [Category] nvarchar(30) NOT NULL,
    [Amount] decimal(20,4) NOT NULL,
    [Currency] nvarchar(3) NOT NULL,
    [IncurredAtUtc] datetimeoffset NOT NULL,
    [PaidByEmployeeId] uniqueidentifier NULL,
    [Notes] nvarchar(500) NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PickupExpenses] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_PickupExpenses_Employees_PaidByEmployeeId] FOREIGN KEY ([PaidByEmployeeId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PickupExpenses_Pickups_PickupId] FOREIGN KEY ([PickupId]) REFERENCES [Pickups] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_PickupExpenses_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PickupMaterialUsages] (
    [SerialNo] int NOT NULL IDENTITY,
    [PickupId] uniqueidentifier NOT NULL,
    [MaterialId] uniqueidentifier NOT NULL,
    [Quantity] decimal(12,3) NOT NULL,
    [UnitCost] decimal(20,4) NOT NULL,
    [IsBoxRecipe] bit NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PickupMaterialUsages] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_PickupMaterialUsages_PackingMaterials_MaterialId] FOREIGN KEY ([MaterialId]) REFERENCES [PackingMaterials] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PickupMaterialUsages_Pickups_PickupId] FOREIGN KEY ([PickupId]) REFERENCES [Pickups] ([Id]) ON DELETE CASCADE
);
GO


CREATE TABLE [PickupPackages] (
    [SerialNo] int NOT NULL IDENTITY,
    [PickupId] uniqueidentifier NOT NULL,
    [BoxTypeId] uniqueidentifier NOT NULL,
    [TrackingNumber] nvarchar(80) NOT NULL,
    [Notes] nvarchar(500) NULL,
    [RoomName] nvarchar(120) NULL,
    [IsFragile] bit NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PickupPackages] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_PickupPackages_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_PickupPackages_BoxTypes_BoxTypeId] FOREIGN KEY ([BoxTypeId]) REFERENCES [BoxTypes] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PickupPackages_Pickups_PickupId] FOREIGN KEY ([PickupId]) REFERENCES [Pickups] ([Id]) ON DELETE CASCADE
);
GO


CREATE TABLE [PickupSignoffs] (
    [SerialNo] int NOT NULL IDENTITY,
    [PickupId] uniqueidentifier NOT NULL,
    [Party] nvarchar(20) NOT NULL,
    [SignerName] nvarchar(160) NOT NULL,
    [EmployeeId] uniqueidentifier NULL,
    [Statement] nvarchar(1000) NOT NULL,
    [Remarks] nvarchar(1000) NULL,
    [SignaturePng] nvarchar(max) NOT NULL,
    [SignedAtUtc] datetimeoffset NOT NULL,
    [RecordedBy] nvarchar(254) NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PickupSignoffs] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_PickupSignoffs_Employees_EmployeeId] FOREIGN KEY ([EmployeeId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PickupSignoffs_Pickups_PickupId] FOREIGN KEY ([PickupId]) REFERENCES [Pickups] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_PickupSignoffs_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PickupTimeEvents] (
    [SerialNo] int NOT NULL IDENTITY,
    [PickupId] uniqueidentifier NOT NULL,
    [Type] nvarchar(20) NOT NULL,
    [OccurredAtUtc] datetimeoffset NOT NULL,
    [Reason] nvarchar(500) NULL,
    [RecordedBy] nvarchar(254) NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PickupTimeEvents] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_PickupTimeEvents_Pickups_PickupId] FOREIGN KEY ([PickupId]) REFERENCES [Pickups] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_PickupTimeEvents_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PickupTransactions] (
    [SerialNo] int NOT NULL IDENTITY,
    [PickupId] uniqueidentifier NOT NULL,
    [TransactionNumber] nvarchar(60) NOT NULL,
    [Type] nvarchar(20) NOT NULL,
    [Category] nvarchar(120) NOT NULL,
    [Amount] decimal(20,4) NOT NULL,
    [PaymentMethod] nvarchar(40) NOT NULL,
    [Notes] nvarchar(500) NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PickupTransactions] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_PickupTransactions_Pickups_PickupId] FOREIGN KEY ([PickupId]) REFERENCES [Pickups] ([Id]) ON DELETE CASCADE
);
GO


CREATE TABLE [TripAllocations] (
    [SerialNo] int NOT NULL IDENTITY,
    [TripId] uniqueidentifier NOT NULL,
    [PickupId] uniqueidentifier NOT NULL,
    [Weight] decimal(18,4) NOT NULL,
    [FuelCost] decimal(18,2) NOT NULL,
    [OtherCost] decimal(18,2) NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_TripAllocations] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_TripAllocations_Pickups_PickupId] FOREIGN KEY ([PickupId]) REFERENCES [Pickups] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_TripAllocations_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_TripAllocations_TransportTrips_TripId] FOREIGN KEY ([TripId]) REFERENCES [TransportTrips] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [QuotationLineTaxes] (
    [SerialNo] int NOT NULL IDENTITY,
    [QuotationLineId] uniqueidentifier NOT NULL,
    [TaxMasterId] uniqueidentifier NOT NULL,
    [Code] nvarchar(40) NOT NULL,
    [Name] nvarchar(160) NOT NULL,
    [Kind] nvarchar(20) NOT NULL,
    [CalculationBasis] nvarchar(30) NOT NULL,
    [Rate] decimal(12,4) NOT NULL,
    [TaxableBase] decimal(20,4) NOT NULL,
    [Amount] decimal(20,4) NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_QuotationLineTaxes] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_QuotationLineTaxes_QuotationLines_QuotationLineId] FOREIGN KEY ([QuotationLineId]) REFERENCES [QuotationLines] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_QuotationLineTaxes_TaxMasters_TaxMasterId] FOREIGN KEY ([TaxMasterId]) REFERENCES [TaxMasters] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_QuotationLineTaxes_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [JournalLines] (
    [SerialNo] int NOT NULL IDENTITY,
    [JournalId] uniqueidentifier NOT NULL,
    [AccountCode] nvarchar(160) NOT NULL,
    [Debit] decimal(18,2) NOT NULL,
    [Credit] decimal(18,2) NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_JournalLines] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_JournalLines_JournalEntries_JournalId] FOREIGN KEY ([JournalId]) REFERENCES [JournalEntries] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_JournalLines_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PackingJobBoxes] (
    [SerialNo] int NOT NULL IDENTITY,
    [PackingJobId] uniqueidentifier NOT NULL,
    [BoxTypeId] uniqueidentifier NOT NULL,
    [TrackingNumber] nvarchar(80) NOT NULL,
    [RoomName] nvarchar(120) NULL,
    [IsFragile] bit NOT NULL,
    [Notes] nvarchar(500) NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [LabelPrintedAtUtc] datetimeoffset NULL,
    [LabelPrintCount] int NOT NULL,
    [CustomMaterials] bit NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PackingJobBoxes] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [AK_PackingJobBoxes_Id] UNIQUE ([Id]),
    CONSTRAINT [FK_PackingJobBoxes_BoxTypes_BoxTypeId] FOREIGN KEY ([BoxTypeId]) REFERENCES [BoxTypes] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PackingJobBoxes_PackingJobs_PackingJobId] FOREIGN KEY ([PackingJobId]) REFERENCES [PackingJobs] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_PackingJobBoxes_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PackingJobCrew] (
    [SerialNo] int NOT NULL IDENTITY,
    [PackingJobId] uniqueidentifier NOT NULL,
    [EmployeeId] uniqueidentifier NOT NULL,
    [Role] nvarchar(80) NOT NULL,
    [TeamId] uniqueidentifier NULL,
    [TeamName] nvarchar(max) NULL,
    [AssignedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PackingJobCrew] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_PackingJobCrew_Employees_EmployeeId] FOREIGN KEY ([EmployeeId]) REFERENCES [Employees] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PackingJobCrew_PackingJobs_PackingJobId] FOREIGN KEY ([PackingJobId]) REFERENCES [PackingJobs] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_PackingJobCrew_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PackingJobLinks] (
    [SerialNo] int NOT NULL IDENTITY,
    [PackingJobId] uniqueidentifier NOT NULL,
    [Purpose] nvarchar(20) NOT NULL,
    [TokenHash] nvarchar(64) NOT NULL,
    [ExpiresAtUtc] datetimeoffset NOT NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PackingJobLinks] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_PackingJobLinks_PackingJobs_PackingJobId] FOREIGN KEY ([PackingJobId]) REFERENCES [PackingJobs] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_PackingJobLinks_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PackingJobMaterials] (
    [SerialNo] int NOT NULL IDENTITY,
    [PackingJobId] uniqueidentifier NOT NULL,
    [MaterialId] uniqueidentifier NOT NULL,
    [Quantity] decimal(12,3) NOT NULL,
    [UnitCost] decimal(20,4) NOT NULL,
    [IsBoxRecipe] bit NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PackingJobMaterials] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_PackingJobMaterials_PackingJobs_PackingJobId] FOREIGN KEY ([PackingJobId]) REFERENCES [PackingJobs] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_PackingJobMaterials_PackingMaterials_MaterialId] FOREIGN KEY ([MaterialId]) REFERENCES [PackingMaterials] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PackingJobMaterials_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PackingJobTimeEvents] (
    [SerialNo] int NOT NULL IDENTITY,
    [PackingJobId] uniqueidentifier NOT NULL,
    [Type] nvarchar(20) NOT NULL,
    [OccurredAtUtc] datetimeoffset NOT NULL,
    [Reason] nvarchar(500) NULL,
    [RecordedBy] nvarchar(254) NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PackingJobTimeEvents] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_PackingJobTimeEvents_PackingJobs_PackingJobId] FOREIGN KEY ([PackingJobId]) REFERENCES [PackingJobs] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_PackingJobTimeEvents_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PackingJobTransactions] (
    [SerialNo] int NOT NULL IDENTITY,
    [PackingJobId] uniqueidentifier NOT NULL,
    [PaidByEmployeeId] uniqueidentifier NULL,
    [TransactionNumber] nvarchar(60) NOT NULL,
    [Type] nvarchar(20) NOT NULL,
    [Category] nvarchar(120) NOT NULL,
    [Amount] decimal(20,4) NOT NULL,
    [PaymentMethod] nvarchar(40) NOT NULL,
    [Notes] nvarchar(500) NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PackingJobTransactions] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_PackingJobTransactions_PackingJobs_PackingJobId] FOREIGN KEY ([PackingJobId]) REFERENCES [PackingJobs] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_PackingJobTransactions_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PackageHandovers] (
    [SerialNo] int NOT NULL IDENTITY,
    [PickupId] uniqueidentifier NOT NULL,
    [PackageId] uniqueidentifier NOT NULL,
    [Status] nvarchar(30) NOT NULL,
    [Location] nvarchar(500) NOT NULL,
    [ReceivedBy] nvarchar(160) NOT NULL,
    [Notes] nvarchar(2000) NOT NULL,
    [RequestId] uniqueidentifier NOT NULL,
    [RecordedAtUtc] datetimeoffset NOT NULL,
    [ActorId] uniqueidentifier NOT NULL,
    [WarehouseId] uniqueidentifier NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PackageHandovers] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_PackageHandovers_PickupPackages_PackageId] FOREIGN KEY ([PackageId]) REFERENCES [PickupPackages] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PackageHandovers_Pickups_PickupId] FOREIGN KEY ([PickupId]) REFERENCES [Pickups] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PackageHandovers_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PackageHandovers_Warehouses_WarehouseId] FOREIGN KEY ([WarehouseId]) REFERENCES [Warehouses] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PickupPackageItems] (
    [SerialNo] int NOT NULL IDENTITY,
    [PickupPackageId] uniqueidentifier NOT NULL,
    [ItemName] nvarchar(160) NOT NULL,
    [Quantity] int NOT NULL,
    [Notes] nvarchar(500) NULL,
    [RoomName] nvarchar(120) NULL,
    [HouseholdItemId] uniqueidentifier NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PickupPackageItems] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_PickupPackageItems_PickupPackages_PickupPackageId] FOREIGN KEY ([PickupPackageId]) REFERENCES [PickupPackages] ([Id]) ON DELETE CASCADE
);
GO


CREATE TABLE [ShipmentClaims] (
    [SerialNo] int NOT NULL IDENTITY,
    [PickupId] uniqueidentifier NOT NULL,
    [PackageId] uniqueidentifier NULL,
    [Category] nvarchar(30) NOT NULL,
    [Description] nvarchar(2000) NOT NULL,
    [Owner] nvarchar(160) NOT NULL,
    [Status] nvarchar(30) NOT NULL,
    [Resolution] nvarchar(2000) NULL,
    [CreatedAtUtc] datetimeoffset NOT NULL,
    [ResolvedAtUtc] datetimeoffset NULL,
    [Version] uniqueidentifier NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_ShipmentClaims] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_ShipmentClaims_PickupPackages_PackageId] FOREIGN KEY ([PackageId]) REFERENCES [PickupPackages] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_ShipmentClaims_Pickups_PickupId] FOREIGN KEY ([PickupId]) REFERENCES [Pickups] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_ShipmentClaims_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PackingJobBoxItems] (
    [SerialNo] int NOT NULL IDENTITY,
    [PackingJobBoxId] uniqueidentifier NOT NULL,
    [ItemName] nvarchar(160) NOT NULL,
    [Quantity] int NOT NULL,
    [Notes] nvarchar(500) NULL,
    [HouseholdItemId] uniqueidentifier NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PackingJobBoxItems] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_PackingJobBoxItems_PackingJobBoxes_PackingJobBoxId] FOREIGN KEY ([PackingJobBoxId]) REFERENCES [PackingJobBoxes] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_PackingJobBoxItems_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [PackingJobBoxMaterials] (
    [SerialNo] int NOT NULL IDENTITY,
    [PackingJobBoxId] uniqueidentifier NOT NULL,
    [MaterialId] uniqueidentifier NOT NULL,
    [Quantity] decimal(12,3) NOT NULL,
    [Id] uniqueidentifier NOT NULL,
    [TenantId] uniqueidentifier NOT NULL,
    [CompanyId] uniqueidentifier NULL,
    CONSTRAINT [PK_PackingJobBoxMaterials] PRIMARY KEY ([SerialNo]),
    CONSTRAINT [FK_PackingJobBoxMaterials_PackingJobBoxes_PackingJobBoxId] FOREIGN KEY ([PackingJobBoxId]) REFERENCES [PackingJobBoxes] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_PackingJobBoxMaterials_PackingMaterials_MaterialId] FOREIGN KEY ([MaterialId]) REFERENCES [PackingMaterials] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_PackingJobBoxMaterials_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [Tenants] ([Id]) ON DELETE NO ACTION
);
GO


CREATE UNIQUE INDEX [IX_AiUsageRecords_Id] ON [AiUsageRecords] ([Id]);
GO


CREATE INDEX [IX_AiUsageRecords_SalesLeadId] ON [AiUsageRecords] ([SalesLeadId]);
GO


CREATE INDEX [IX_AiUsageRecords_TenantId] ON [AiUsageRecords] ([TenantId]);
GO


CREATE INDEX [IX_AiUsageRecords_TenantId_CompanyId] ON [AiUsageRecords] ([TenantId], [CompanyId]);
GO


CREATE INDEX [IX_AuditLogs_ActorUserId] ON [AuditLogs] ([ActorUserId]);
GO


CREATE UNIQUE INDEX [IX_AuditLogs_Id] ON [AuditLogs] ([Id]);
GO


CREATE INDEX [IX_AuditLogs_TenantId_SerialNo] ON [AuditLogs] ([TenantId], [SerialNo]);
GO


CREATE UNIQUE INDEX [IX_BillingRecords_Id] ON [BillingRecords] ([Id]);
GO


CREATE INDEX [IX_BillingRecords_TenantId] ON [BillingRecords] ([TenantId]);
GO


CREATE INDEX [IX_BillingRecords_TenantId_CompanyId] ON [BillingRecords] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_BillingRecords_TenantId_Kind_Number] ON [BillingRecords] ([TenantId], [Kind], [Number]);
GO


CREATE UNIQUE INDEX [IX_BillingRecords_TenantId_Kind_RequestId] ON [BillingRecords] ([TenantId], [Kind], [RequestId]);
GO


CREATE UNIQUE INDEX [IX_BoxTypeMaterials_BoxTypeId_MaterialId] ON [BoxTypeMaterials] ([BoxTypeId], [MaterialId]);
GO


CREATE UNIQUE INDEX [IX_BoxTypeMaterials_Id] ON [BoxTypeMaterials] ([Id]);
GO


CREATE INDEX [IX_BoxTypeMaterials_MaterialId] ON [BoxTypeMaterials] ([MaterialId]);
GO


CREATE INDEX [IX_BoxTypeMaterials_TenantId] ON [BoxTypeMaterials] ([TenantId]);
GO


CREATE UNIQUE INDEX [IX_BoxTypes_Id] ON [BoxTypes] ([Id]);
GO


CREATE INDEX [IX_BoxTypes_TenantId] ON [BoxTypes] ([TenantId]);
GO


CREATE UNIQUE INDEX [IX_BoxTypes_TenantId_Code] ON [BoxTypes] ([TenantId], [Code]);
GO


CREATE INDEX [IX_BoxTypes_TenantId_CompanyId] ON [BoxTypes] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_BusinessMasters_Id] ON [BusinessMasters] ([Id]);
GO


CREATE INDEX [IX_BusinessMasters_TenantId] ON [BusinessMasters] ([TenantId]);
GO


CREATE INDEX [IX_BusinessMasters_TenantId_CompanyId] ON [BusinessMasters] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_BusinessMasters_TenantId_Kind_Code] ON [BusinessMasters] ([TenantId], [Kind], [Code]);
GO


CREATE UNIQUE INDEX [IX_ChargeMasters_Id] ON [ChargeMasters] ([Id]);
GO


CREATE INDEX [IX_ChargeMasters_TenantId] ON [ChargeMasters] ([TenantId]);
GO


CREATE UNIQUE INDEX [IX_ChargeMasters_TenantId_Code] ON [ChargeMasters] ([TenantId], [Code]);
GO


CREATE INDEX [IX_ChargeMasters_TenantId_CompanyId] ON [ChargeMasters] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_Companies_Id] ON [Companies] ([Id]);
GO


CREATE INDEX [IX_Companies_TenantId] ON [Companies] ([TenantId]);
GO


CREATE UNIQUE INDEX [IX_Companies_TenantId_Code] ON [Companies] ([TenantId], [Code]);
GO


CREATE INDEX [IX_DeliveryItems_BoxId] ON [DeliveryItems] ([BoxId]);
GO


CREATE INDEX [IX_DeliveryItems_DeliveryJobId] ON [DeliveryItems] ([DeliveryJobId]);
GO


CREATE INDEX [IX_DeliveryItems_DeliveryNoteId] ON [DeliveryItems] ([DeliveryNoteId]);
GO


CREATE UNIQUE INDEX [IX_DeliveryItems_Id] ON [DeliveryItems] ([Id]);
GO


CREATE INDEX [IX_DeliveryItems_TenantId] ON [DeliveryItems] ([TenantId]);
GO


CREATE INDEX [IX_DeliveryItems_TenantId_CompanyId] ON [DeliveryItems] ([TenantId], [CompanyId]);
GO


CREATE INDEX [IX_DeliveryJobCrew_DeliveryJobId] ON [DeliveryJobCrew] ([DeliveryJobId]);
GO


CREATE INDEX [IX_DeliveryJobCrew_EmployeeId] ON [DeliveryJobCrew] ([EmployeeId]);
GO


CREATE UNIQUE INDEX [IX_DeliveryJobCrew_Id] ON [DeliveryJobCrew] ([Id]);
GO


CREATE INDEX [IX_DeliveryJobCrew_TenantId] ON [DeliveryJobCrew] ([TenantId]);
GO


CREATE INDEX [IX_DeliveryJobCrew_TenantId_CompanyId] ON [DeliveryJobCrew] ([TenantId], [CompanyId]);
GO


CREATE INDEX [IX_DeliveryJobs_DriverEmployeeId] ON [DeliveryJobs] ([DriverEmployeeId]);
GO


CREATE UNIQUE INDEX [IX_DeliveryJobs_Id] ON [DeliveryJobs] ([Id]);
GO


CREATE INDEX [IX_DeliveryJobs_TenantId] ON [DeliveryJobs] ([TenantId]);
GO


CREATE INDEX [IX_DeliveryJobs_TenantId_CompanyId] ON [DeliveryJobs] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_DeliveryJobs_TenantId_DeliveryNumber] ON [DeliveryJobs] ([TenantId], [DeliveryNumber]);
GO


CREATE INDEX [IX_DeliveryJobs_VehicleId] ON [DeliveryJobs] ([VehicleId]);
GO


CREATE INDEX [IX_DeliveryJobTimeEvents_DeliveryJobId] ON [DeliveryJobTimeEvents] ([DeliveryJobId]);
GO


CREATE UNIQUE INDEX [IX_DeliveryJobTimeEvents_Id] ON [DeliveryJobTimeEvents] ([Id]);
GO


CREATE INDEX [IX_DeliveryJobTimeEvents_TenantId] ON [DeliveryJobTimeEvents] ([TenantId]);
GO


CREATE INDEX [IX_DeliveryJobTimeEvents_TenantId_CompanyId] ON [DeliveryJobTimeEvents] ([TenantId], [CompanyId]);
GO


CREATE INDEX [IX_DeliveryJobTransactions_DeliveryJobId] ON [DeliveryJobTransactions] ([DeliveryJobId]);
GO


CREATE INDEX [IX_DeliveryJobTransactions_DeliveryNoteId] ON [DeliveryJobTransactions] ([DeliveryNoteId]);
GO


CREATE UNIQUE INDEX [IX_DeliveryJobTransactions_Id] ON [DeliveryJobTransactions] ([Id]);
GO


CREATE INDEX [IX_DeliveryJobTransactions_TenantId] ON [DeliveryJobTransactions] ([TenantId]);
GO


CREATE INDEX [IX_DeliveryJobTransactions_TenantId_CompanyId] ON [DeliveryJobTransactions] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_DeliveryJobTransactions_TenantId_TransactionNumber] ON [DeliveryJobTransactions] ([TenantId], [TransactionNumber]);
GO


CREATE INDEX [IX_DeliveryNoteLinks_DeliveryJobId] ON [DeliveryNoteLinks] ([DeliveryJobId]);
GO


CREATE INDEX [IX_DeliveryNoteLinks_DeliveryNoteId] ON [DeliveryNoteLinks] ([DeliveryNoteId]);
GO


CREATE UNIQUE INDEX [IX_DeliveryNoteLinks_Id] ON [DeliveryNoteLinks] ([Id]);
GO


CREATE INDEX [IX_DeliveryNoteLinks_TenantId] ON [DeliveryNoteLinks] ([TenantId]);
GO


CREATE INDEX [IX_DeliveryNoteLinks_TenantId_CompanyId] ON [DeliveryNoteLinks] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_DeliveryNoteLinks_TokenHash] ON [DeliveryNoteLinks] ([TokenHash]);
GO


CREATE INDEX [IX_DeliveryNotes_DeliveryJobId] ON [DeliveryNotes] ([DeliveryJobId]);
GO


CREATE UNIQUE INDEX [IX_DeliveryNotes_Id] ON [DeliveryNotes] ([Id]);
GO


CREATE INDEX [IX_DeliveryNotes_TenantId] ON [DeliveryNotes] ([TenantId]);
GO


CREATE INDEX [IX_DeliveryNotes_TenantId_CompanyId] ON [DeliveryNotes] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_DeliveryNotes_TenantId_NoteNumber] ON [DeliveryNotes] ([TenantId], [NoteNumber]);
GO


CREATE UNIQUE INDEX [IX_Designations_Id] ON [Designations] ([Id]);
GO


CREATE INDEX [IX_Designations_TenantId] ON [Designations] ([TenantId]);
GO


CREATE UNIQUE INDEX [IX_Designations_TenantId_Code] ON [Designations] ([TenantId], [Code]);
GO


CREATE INDEX [IX_Designations_TenantId_CompanyId] ON [Designations] ([TenantId], [CompanyId]);
GO


CREATE INDEX [IX_Employees_DesignationId] ON [Employees] ([DesignationId]);
GO


CREATE UNIQUE INDEX [IX_Employees_Id] ON [Employees] ([Id]);
GO


CREATE INDEX [IX_Employees_ReportsToEmployeeId] ON [Employees] ([ReportsToEmployeeId]);
GO


CREATE INDEX [IX_Employees_TenantId] ON [Employees] ([TenantId]);
GO


CREATE INDEX [IX_Employees_TenantId_CompanyId] ON [Employees] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_Employees_TenantId_EmployeeNumber] ON [Employees] ([TenantId], [EmployeeNumber]);
GO


CREATE UNIQUE INDEX [IX_ExpenseAttachments_Id] ON [ExpenseAttachments] ([Id]);
GO


CREATE INDEX [IX_ExpenseAttachments_TenantId] ON [ExpenseAttachments] ([TenantId]);
GO


CREATE INDEX [IX_ExpenseAttachments_TenantId_CompanyId] ON [ExpenseAttachments] ([TenantId], [CompanyId]);
GO


CREATE INDEX [IX_ExpenseAttachments_TenantId_ExpenseId] ON [ExpenseAttachments] ([TenantId], [ExpenseId]);
GO


CREATE UNIQUE INDEX [IX_FollowUpStatuses_Id] ON [FollowUpStatuses] ([Id]);
GO


CREATE INDEX [IX_FollowUpStatuses_TenantId] ON [FollowUpStatuses] ([TenantId]);
GO


CREATE UNIQUE INDEX [IX_FollowUpStatuses_TenantId_Code] ON [FollowUpStatuses] ([TenantId], [Code]);
GO


CREATE INDEX [IX_FollowUpStatuses_TenantId_CompanyId] ON [FollowUpStatuses] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_HouseholdItems_Id] ON [HouseholdItems] ([Id]);
GO


CREATE INDEX [IX_HouseholdItems_TenantId] ON [HouseholdItems] ([TenantId]);
GO


CREATE UNIQUE INDEX [IX_HouseholdItems_TenantId_Code] ON [HouseholdItems] ([TenantId], [Code]);
GO


CREATE INDEX [IX_HouseholdItems_TenantId_CompanyId] ON [HouseholdItems] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_JobCargo_Id] ON [JobCargo] ([Id]);
GO


CREATE INDEX [IX_JobCargo_TenantId] ON [JobCargo] ([TenantId]);
GO


CREATE UNIQUE INDEX [IX_JobCargo_TenantId_BoxId] ON [JobCargo] ([TenantId], [BoxId]) WHERE [IsActive] = 1;
GO


CREATE INDEX [IX_JobCargo_TenantId_CompanyId] ON [JobCargo] ([TenantId], [CompanyId]);
GO


CREATE INDEX [IX_JobCargo_TenantId_JobId] ON [JobCargo] ([TenantId], [JobId]);
GO


CREATE UNIQUE INDEX [IX_JobExpenses_Id] ON [JobExpenses] ([Id]);
GO


CREATE INDEX [IX_JobExpenses_PickupId] ON [JobExpenses] ([PickupId]);
GO


CREATE INDEX [IX_JobExpenses_TenantId] ON [JobExpenses] ([TenantId]);
GO


CREATE INDEX [IX_JobExpenses_TenantId_CompanyId] ON [JobExpenses] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_JobExpenses_TenantId_RequestId] ON [JobExpenses] ([TenantId], [RequestId]);
GO


CREATE UNIQUE INDEX [IX_JobExpenses_TenantId_Vendor_Reference] ON [JobExpenses] ([TenantId], [Vendor], [Reference]);
GO


CREATE UNIQUE INDEX [IX_JournalEntries_Id] ON [JournalEntries] ([Id]);
GO


CREATE INDEX [IX_JournalEntries_PickupId] ON [JournalEntries] ([PickupId]);
GO


CREATE UNIQUE INDEX [IX_JournalEntries_ReversesId] ON [JournalEntries] ([ReversesId]) WHERE [ReversesId] IS NOT NULL;
GO


CREATE INDEX [IX_JournalEntries_TenantId] ON [JournalEntries] ([TenantId]);
GO


CREATE INDEX [IX_JournalEntries_TenantId_CompanyId] ON [JournalEntries] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_JournalEntries_TenantId_Reference] ON [JournalEntries] ([TenantId], [Reference]);
GO


CREATE UNIQUE INDEX [IX_JournalEntries_TenantId_RequestId] ON [JournalEntries] ([TenantId], [RequestId]);
GO


CREATE UNIQUE INDEX [IX_JournalLines_Id] ON [JournalLines] ([Id]);
GO


CREATE INDEX [IX_JournalLines_JournalId] ON [JournalLines] ([JournalId]);
GO


CREATE INDEX [IX_JournalLines_TenantId] ON [JournalLines] ([TenantId]);
GO


CREATE INDEX [IX_JournalLines_TenantId_CompanyId] ON [JournalLines] ([TenantId], [CompanyId]);
GO


CREATE INDEX [IX_LabourEntries_EmployeeId] ON [LabourEntries] ([EmployeeId]);
GO


CREATE UNIQUE INDEX [IX_LabourEntries_Id] ON [LabourEntries] ([Id]);
GO


CREATE INDEX [IX_LabourEntries_PickupId] ON [LabourEntries] ([PickupId]);
GO


CREATE INDEX [IX_LabourEntries_TenantId] ON [LabourEntries] ([TenantId]);
GO


CREATE INDEX [IX_LabourEntries_TenantId_CompanyId] ON [LabourEntries] ([TenantId], [CompanyId]);
GO


CREATE INDEX [IX_LabourEntries_TenantId_EmployeeId] ON [LabourEntries] ([TenantId], [EmployeeId]);
GO


CREATE UNIQUE INDEX [IX_LabourEntries_TenantId_RequestId] ON [LabourEntries] ([TenantId], [RequestId]);
GO


CREATE UNIQUE INDEX [IX_LeadFollowUps_Id] ON [LeadFollowUps] ([Id]);
GO


CREATE INDEX [IX_LeadFollowUps_SalesLeadId] ON [LeadFollowUps] ([SalesLeadId]);
GO


CREATE INDEX [IX_LeadFollowUps_StatusId] ON [LeadFollowUps] ([StatusId]);
GO


CREATE INDEX [IX_LeadFollowUps_TenantId] ON [LeadFollowUps] ([TenantId]);
GO


CREATE INDEX [IX_LeadFollowUps_TenantId_CompanyId] ON [LeadFollowUps] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_LeadStatuses_Id] ON [LeadStatuses] ([Id]);
GO


CREATE INDEX [IX_LeadStatuses_TenantId] ON [LeadStatuses] ([TenantId]);
GO


CREATE UNIQUE INDEX [IX_LeadStatuses_TenantId_Code] ON [LeadStatuses] ([TenantId], [Code]);
GO


CREATE INDEX [IX_LeadStatuses_TenantId_CompanyId] ON [LeadStatuses] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_MoveTypes_Id] ON [MoveTypes] ([Id]);
GO


CREATE INDEX [IX_MoveTypes_TenantId] ON [MoveTypes] ([TenantId]);
GO


CREATE UNIQUE INDEX [IX_MoveTypes_TenantId_Code] ON [MoveTypes] ([TenantId], [Code]);
GO


CREATE INDEX [IX_MoveTypes_TenantId_CompanyId] ON [MoveTypes] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PackageHandovers_Id] ON [PackageHandovers] ([Id]);
GO


CREATE INDEX [IX_PackageHandovers_PackageId] ON [PackageHandovers] ([PackageId]);
GO


CREATE INDEX [IX_PackageHandovers_PickupId] ON [PackageHandovers] ([PickupId]);
GO


CREATE INDEX [IX_PackageHandovers_TenantId] ON [PackageHandovers] ([TenantId]);
GO


CREATE INDEX [IX_PackageHandovers_TenantId_CompanyId] ON [PackageHandovers] ([TenantId], [CompanyId]);
GO


CREATE INDEX [IX_PackageHandovers_TenantId_PackageId_SerialNo] ON [PackageHandovers] ([TenantId], [PackageId], [SerialNo]);
GO


CREATE UNIQUE INDEX [IX_PackageHandovers_TenantId_RequestId] ON [PackageHandovers] ([TenantId], [RequestId]);
GO


CREATE INDEX [IX_PackageHandovers_WarehouseId] ON [PackageHandovers] ([WarehouseId]);
GO


CREATE UNIQUE INDEX [IX_PackingConfirmations_Id] ON [PackingConfirmations] ([Id]);
GO


CREATE INDEX [IX_PackingConfirmations_PickupId] ON [PackingConfirmations] ([PickupId]);
GO


CREATE INDEX [IX_PackingConfirmations_TenantId] ON [PackingConfirmations] ([TenantId]);
GO


CREATE INDEX [IX_PackingConfirmations_TenantId_CompanyId] ON [PackingConfirmations] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PackingConfirmations_TenantId_PickupId] ON [PackingConfirmations] ([TenantId], [PickupId]);
GO


CREATE UNIQUE INDEX [IX_PackingConfirmations_TokenHash] ON [PackingConfirmations] ([TokenHash]);
GO


CREATE INDEX [IX_PackingJobBoxes_BoxTypeId] ON [PackingJobBoxes] ([BoxTypeId]);
GO


CREATE UNIQUE INDEX [IX_PackingJobBoxes_Id] ON [PackingJobBoxes] ([Id]);
GO


CREATE INDEX [IX_PackingJobBoxes_PackingJobId] ON [PackingJobBoxes] ([PackingJobId]);
GO


CREATE INDEX [IX_PackingJobBoxes_TenantId] ON [PackingJobBoxes] ([TenantId]);
GO


CREATE INDEX [IX_PackingJobBoxes_TenantId_CompanyId] ON [PackingJobBoxes] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PackingJobBoxes_TenantId_TrackingNumber] ON [PackingJobBoxes] ([TenantId], [TrackingNumber]);
GO


CREATE UNIQUE INDEX [IX_PackingJobBoxItems_Id] ON [PackingJobBoxItems] ([Id]);
GO


CREATE INDEX [IX_PackingJobBoxItems_PackingJobBoxId] ON [PackingJobBoxItems] ([PackingJobBoxId]);
GO


CREATE INDEX [IX_PackingJobBoxItems_TenantId] ON [PackingJobBoxItems] ([TenantId]);
GO


CREATE INDEX [IX_PackingJobBoxItems_TenantId_CompanyId] ON [PackingJobBoxItems] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PackingJobBoxMaterials_Id] ON [PackingJobBoxMaterials] ([Id]);
GO


CREATE INDEX [IX_PackingJobBoxMaterials_MaterialId] ON [PackingJobBoxMaterials] ([MaterialId]);
GO


CREATE INDEX [IX_PackingJobBoxMaterials_PackingJobBoxId] ON [PackingJobBoxMaterials] ([PackingJobBoxId]);
GO


CREATE INDEX [IX_PackingJobBoxMaterials_TenantId] ON [PackingJobBoxMaterials] ([TenantId]);
GO


CREATE INDEX [IX_PackingJobBoxMaterials_TenantId_CompanyId] ON [PackingJobBoxMaterials] ([TenantId], [CompanyId]);
GO


CREATE INDEX [IX_PackingJobCrew_EmployeeId] ON [PackingJobCrew] ([EmployeeId]);
GO


CREATE UNIQUE INDEX [IX_PackingJobCrew_Id] ON [PackingJobCrew] ([Id]);
GO


CREATE INDEX [IX_PackingJobCrew_PackingJobId] ON [PackingJobCrew] ([PackingJobId]);
GO


CREATE INDEX [IX_PackingJobCrew_TenantId] ON [PackingJobCrew] ([TenantId]);
GO


CREATE INDEX [IX_PackingJobCrew_TenantId_CompanyId] ON [PackingJobCrew] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PackingJobLinks_Id] ON [PackingJobLinks] ([Id]);
GO


CREATE INDEX [IX_PackingJobLinks_PackingJobId] ON [PackingJobLinks] ([PackingJobId]);
GO


CREATE INDEX [IX_PackingJobLinks_TenantId] ON [PackingJobLinks] ([TenantId]);
GO


CREATE INDEX [IX_PackingJobLinks_TenantId_CompanyId] ON [PackingJobLinks] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PackingJobLinks_TokenHash] ON [PackingJobLinks] ([TokenHash]);
GO


CREATE UNIQUE INDEX [IX_PackingJobMaterials_Id] ON [PackingJobMaterials] ([Id]);
GO


CREATE INDEX [IX_PackingJobMaterials_MaterialId] ON [PackingJobMaterials] ([MaterialId]);
GO


CREATE INDEX [IX_PackingJobMaterials_PackingJobId] ON [PackingJobMaterials] ([PackingJobId]);
GO


CREATE INDEX [IX_PackingJobMaterials_TenantId] ON [PackingJobMaterials] ([TenantId]);
GO


CREATE INDEX [IX_PackingJobMaterials_TenantId_CompanyId] ON [PackingJobMaterials] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PackingJobs_Id] ON [PackingJobs] ([Id]);
GO


CREATE INDEX [IX_PackingJobs_PickupId] ON [PackingJobs] ([PickupId]);
GO


CREATE INDEX [IX_PackingJobs_QuotationId] ON [PackingJobs] ([QuotationId]);
GO


CREATE INDEX [IX_PackingJobs_SalesLeadId] ON [PackingJobs] ([SalesLeadId]);
GO


CREATE INDEX [IX_PackingJobs_TenantId] ON [PackingJobs] ([TenantId]);
GO


CREATE INDEX [IX_PackingJobs_TenantId_CompanyId] ON [PackingJobs] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PackingJobs_TenantId_JobNumber] ON [PackingJobs] ([TenantId], [JobNumber]);
GO


CREATE UNIQUE INDEX [IX_PackingJobTimeEvents_Id] ON [PackingJobTimeEvents] ([Id]);
GO


CREATE INDEX [IX_PackingJobTimeEvents_PackingJobId] ON [PackingJobTimeEvents] ([PackingJobId]);
GO


CREATE INDEX [IX_PackingJobTimeEvents_TenantId] ON [PackingJobTimeEvents] ([TenantId]);
GO


CREATE INDEX [IX_PackingJobTimeEvents_TenantId_CompanyId] ON [PackingJobTimeEvents] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PackingJobTransactions_Id] ON [PackingJobTransactions] ([Id]);
GO


CREATE INDEX [IX_PackingJobTransactions_PackingJobId] ON [PackingJobTransactions] ([PackingJobId]);
GO


CREATE INDEX [IX_PackingJobTransactions_TenantId] ON [PackingJobTransactions] ([TenantId]);
GO


CREATE INDEX [IX_PackingJobTransactions_TenantId_CompanyId] ON [PackingJobTransactions] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PackingJobTransactions_TenantId_TransactionNumber] ON [PackingJobTransactions] ([TenantId], [TransactionNumber]);
GO


CREATE UNIQUE INDEX [IX_PackingMaterials_Id] ON [PackingMaterials] ([Id]);
GO


CREATE INDEX [IX_PackingMaterials_TenantId] ON [PackingMaterials] ([TenantId]);
GO


CREATE UNIQUE INDEX [IX_PackingMaterials_TenantId_Code] ON [PackingMaterials] ([TenantId], [Code]);
GO


CREATE INDEX [IX_PackingMaterials_TenantId_CompanyId] ON [PackingMaterials] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_Permissions_Code] ON [Permissions] ([Code]);
GO


CREATE UNIQUE INDEX [IX_Permissions_Id] ON [Permissions] ([Id]);
GO


CREATE INDEX [IX_PickupAssignments_EmployeeId] ON [PickupAssignments] ([EmployeeId]);
GO


CREATE UNIQUE INDEX [IX_PickupAssignments_Id] ON [PickupAssignments] ([Id]);
GO


CREATE INDEX [IX_PickupAssignments_PickupId] ON [PickupAssignments] ([PickupId]);
GO


CREATE INDEX [IX_PickupAssignments_TenantId] ON [PickupAssignments] ([TenantId]);
GO


CREATE INDEX [IX_PickupAssignments_TenantId_CompanyId] ON [PickupAssignments] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PickupAttachments_Id] ON [PickupAttachments] ([Id]);
GO


CREATE INDEX [IX_PickupAttachments_PickupId_SerialNo] ON [PickupAttachments] ([PickupId], [SerialNo]);
GO


CREATE INDEX [IX_PickupAttachments_TenantId] ON [PickupAttachments] ([TenantId]);
GO


CREATE INDEX [IX_PickupAttachments_TenantId_CompanyId] ON [PickupAttachments] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PickupBoxPickEvents_Id] ON [PickupBoxPickEvents] ([Id]);
GO


CREATE INDEX [IX_PickupBoxPickEvents_TenantId] ON [PickupBoxPickEvents] ([TenantId]);
GO


CREATE INDEX [IX_PickupBoxPickEvents_TenantId_CompanyId] ON [PickupBoxPickEvents] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PickupBoxPicks_Id] ON [PickupBoxPicks] ([Id]);
GO


CREATE INDEX [IX_PickupBoxPicks_TenantId] ON [PickupBoxPicks] ([TenantId]);
GO


CREATE INDEX [IX_PickupBoxPicks_TenantId_CompanyId] ON [PickupBoxPicks] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PickupCollectionApprovals_Id] ON [PickupCollectionApprovals] ([Id]);
GO


CREATE INDEX [IX_PickupCollectionApprovals_TenantId] ON [PickupCollectionApprovals] ([TenantId]);
GO


CREATE INDEX [IX_PickupCollectionApprovals_TenantId_CompanyId] ON [PickupCollectionApprovals] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PickupExpenses_Id] ON [PickupExpenses] ([Id]);
GO


CREATE INDEX [IX_PickupExpenses_PaidByEmployeeId] ON [PickupExpenses] ([PaidByEmployeeId]);
GO


CREATE INDEX [IX_PickupExpenses_PickupId_SerialNo] ON [PickupExpenses] ([PickupId], [SerialNo]);
GO


CREATE INDEX [IX_PickupExpenses_TenantId] ON [PickupExpenses] ([TenantId]);
GO


CREATE INDEX [IX_PickupExpenses_TenantId_CompanyId] ON [PickupExpenses] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PickupMaterialUsages_Id] ON [PickupMaterialUsages] ([Id]);
GO


CREATE INDEX [IX_PickupMaterialUsages_MaterialId] ON [PickupMaterialUsages] ([MaterialId]);
GO


CREATE INDEX [IX_PickupMaterialUsages_PickupId] ON [PickupMaterialUsages] ([PickupId]);
GO


CREATE INDEX [IX_PickupMaterialUsages_TenantId] ON [PickupMaterialUsages] ([TenantId]);
GO


CREATE INDEX [IX_PickupMaterialUsages_TenantId_CompanyId] ON [PickupMaterialUsages] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PickupPackageItems_Id] ON [PickupPackageItems] ([Id]);
GO


CREATE INDEX [IX_PickupPackageItems_PickupPackageId] ON [PickupPackageItems] ([PickupPackageId]);
GO


CREATE INDEX [IX_PickupPackageItems_TenantId] ON [PickupPackageItems] ([TenantId]);
GO


CREATE INDEX [IX_PickupPackageItems_TenantId_CompanyId] ON [PickupPackageItems] ([TenantId], [CompanyId]);
GO


CREATE INDEX [IX_PickupPackages_BoxTypeId] ON [PickupPackages] ([BoxTypeId]);
GO


CREATE UNIQUE INDEX [IX_PickupPackages_Id] ON [PickupPackages] ([Id]);
GO


CREATE INDEX [IX_PickupPackages_PickupId] ON [PickupPackages] ([PickupId]);
GO


CREATE INDEX [IX_PickupPackages_TenantId] ON [PickupPackages] ([TenantId]);
GO


CREATE INDEX [IX_PickupPackages_TenantId_CompanyId] ON [PickupPackages] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PickupPackages_TenantId_TrackingNumber] ON [PickupPackages] ([TenantId], [TrackingNumber]);
GO


CREATE UNIQUE INDEX [IX_PickupPackingJobs_Id] ON [PickupPackingJobs] ([Id]);
GO


CREATE INDEX [IX_PickupPackingJobs_TenantId] ON [PickupPackingJobs] ([TenantId]);
GO


CREATE INDEX [IX_PickupPackingJobs_TenantId_CompanyId] ON [PickupPackingJobs] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_Pickups_ConfirmationTokenHash] ON [Pickups] ([ConfirmationTokenHash]) WHERE [ConfirmationTokenHash] IS NOT NULL;
GO


CREATE UNIQUE INDEX [IX_Pickups_Id] ON [Pickups] ([Id]);
GO


CREATE INDEX [IX_Pickups_QuotationId] ON [Pickups] ([QuotationId]);
GO


CREATE INDEX [IX_Pickups_SalesLeadId] ON [Pickups] ([SalesLeadId]);
GO


CREATE INDEX [IX_Pickups_StatusId] ON [Pickups] ([StatusId]);
GO


CREATE INDEX [IX_Pickups_TenantId] ON [Pickups] ([TenantId]);
GO


CREATE INDEX [IX_Pickups_TenantId_CompanyId] ON [Pickups] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_Pickups_TenantId_PickupNumber] ON [Pickups] ([TenantId], [PickupNumber]);
GO


CREATE INDEX [IX_Pickups_VehicleId] ON [Pickups] ([VehicleId]);
GO


CREATE INDEX [IX_PickupSignoffs_EmployeeId] ON [PickupSignoffs] ([EmployeeId]);
GO


CREATE UNIQUE INDEX [IX_PickupSignoffs_Id] ON [PickupSignoffs] ([Id]);
GO


CREATE INDEX [IX_PickupSignoffs_PickupId_SerialNo] ON [PickupSignoffs] ([PickupId], [SerialNo]);
GO


CREATE INDEX [IX_PickupSignoffs_TenantId] ON [PickupSignoffs] ([TenantId]);
GO


CREATE INDEX [IX_PickupSignoffs_TenantId_CompanyId] ON [PickupSignoffs] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PickupStatuses_Id] ON [PickupStatuses] ([Id]);
GO


CREATE INDEX [IX_PickupStatuses_TenantId] ON [PickupStatuses] ([TenantId]);
GO


CREATE UNIQUE INDEX [IX_PickupStatuses_TenantId_Code] ON [PickupStatuses] ([TenantId], [Code]);
GO


CREATE INDEX [IX_PickupStatuses_TenantId_CompanyId] ON [PickupStatuses] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PickupTimeEvents_Id] ON [PickupTimeEvents] ([Id]);
GO


CREATE INDEX [IX_PickupTimeEvents_PickupId_SerialNo] ON [PickupTimeEvents] ([PickupId], [SerialNo]);
GO


CREATE INDEX [IX_PickupTimeEvents_TenantId] ON [PickupTimeEvents] ([TenantId]);
GO


CREATE INDEX [IX_PickupTimeEvents_TenantId_CompanyId] ON [PickupTimeEvents] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PickupTransactions_Id] ON [PickupTransactions] ([Id]);
GO


CREATE INDEX [IX_PickupTransactions_PickupId] ON [PickupTransactions] ([PickupId]);
GO


CREATE INDEX [IX_PickupTransactions_TenantId] ON [PickupTransactions] ([TenantId]);
GO


CREATE INDEX [IX_PickupTransactions_TenantId_CompanyId] ON [PickupTransactions] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_PickupTransactions_TenantId_TransactionNumber] ON [PickupTransactions] ([TenantId], [TransactionNumber]);
GO


CREATE INDEX [IX_QuotationItems_HouseholdItemId] ON [QuotationItems] ([HouseholdItemId]);
GO


CREATE UNIQUE INDEX [IX_QuotationItems_Id] ON [QuotationItems] ([Id]);
GO


CREATE INDEX [IX_QuotationItems_QuotationId_DisplayOrder] ON [QuotationItems] ([QuotationId], [DisplayOrder]);
GO


CREATE INDEX [IX_QuotationItems_TenantId] ON [QuotationItems] ([TenantId]);
GO


CREATE INDEX [IX_QuotationItems_TenantId_CompanyId] ON [QuotationItems] ([TenantId], [CompanyId]);
GO


CREATE INDEX [IX_QuotationLines_ChargeMasterId] ON [QuotationLines] ([ChargeMasterId]);
GO


CREATE UNIQUE INDEX [IX_QuotationLines_Id] ON [QuotationLines] ([Id]);
GO


CREATE INDEX [IX_QuotationLines_QuotationId] ON [QuotationLines] ([QuotationId]);
GO


CREATE INDEX [IX_QuotationLines_TenantId] ON [QuotationLines] ([TenantId]);
GO


CREATE INDEX [IX_QuotationLines_TenantId_CompanyId] ON [QuotationLines] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_QuotationLineTaxes_Id] ON [QuotationLineTaxes] ([Id]);
GO


CREATE INDEX [IX_QuotationLineTaxes_QuotationLineId_SerialNo] ON [QuotationLineTaxes] ([QuotationLineId], [SerialNo]);
GO


CREATE INDEX [IX_QuotationLineTaxes_TaxMasterId] ON [QuotationLineTaxes] ([TaxMasterId]);
GO


CREATE INDEX [IX_QuotationLineTaxes_TenantId] ON [QuotationLineTaxes] ([TenantId]);
GO


CREATE INDEX [IX_QuotationLineTaxes_TenantId_CompanyId] ON [QuotationLineTaxes] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_QuotationRequoteRequests_Id] ON [QuotationRequoteRequests] ([Id]);
GO


CREATE INDEX [IX_QuotationRequoteRequests_QuotationId_SerialNo] ON [QuotationRequoteRequests] ([QuotationId], [SerialNo]);
GO


CREATE INDEX [IX_QuotationRequoteRequests_TenantId] ON [QuotationRequoteRequests] ([TenantId]);
GO


CREATE INDEX [IX_QuotationRequoteRequests_TenantId_CompanyId] ON [QuotationRequoteRequests] ([TenantId], [CompanyId]);
GO


CREATE INDEX [IX_Quotations_AssignedEmployeeId] ON [Quotations] ([AssignedEmployeeId]);
GO


CREATE UNIQUE INDEX [IX_Quotations_Id] ON [Quotations] ([Id]);
GO


CREATE INDEX [IX_Quotations_SalesLeadId] ON [Quotations] ([SalesLeadId]);
GO


CREATE UNIQUE INDEX [IX_Quotations_ShareTokenHash] ON [Quotations] ([ShareTokenHash]) WHERE [ShareTokenHash] IS NOT NULL;
GO


CREATE INDEX [IX_Quotations_SurveyId] ON [Quotations] ([SurveyId]);
GO


CREATE INDEX [IX_Quotations_TenantId] ON [Quotations] ([TenantId]);
GO


CREATE INDEX [IX_Quotations_TenantId_CompanyId] ON [Quotations] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_Quotations_TenantId_QuotationNumber] ON [Quotations] ([TenantId], [QuotationNumber]);
GO


CREATE UNIQUE INDEX [IX_RolePermissions_Id] ON [RolePermissions] ([Id]);
GO


CREATE INDEX [IX_RolePermissions_PermissionId] ON [RolePermissions] ([PermissionId]);
GO


CREATE UNIQUE INDEX [IX_RolePermissions_RoleId_PermissionId] ON [RolePermissions] ([RoleId], [PermissionId]);
GO


CREATE UNIQUE INDEX [IX_Roles_Id] ON [Roles] ([Id]);
GO


CREATE UNIQUE INDEX [IX_Roles_TenantId_Code] ON [Roles] ([TenantId], [Code]) WHERE [TenantId] IS NOT NULL;
GO


CREATE UNIQUE INDEX [IX_SalesLeadAttachments_Id] ON [SalesLeadAttachments] ([Id]);
GO


CREATE INDEX [IX_SalesLeadAttachments_SalesLeadId_SerialNo] ON [SalesLeadAttachments] ([SalesLeadId], [SerialNo]);
GO


CREATE INDEX [IX_SalesLeadAttachments_TenantId] ON [SalesLeadAttachments] ([TenantId]);
GO


CREATE INDEX [IX_SalesLeadAttachments_TenantId_CompanyId] ON [SalesLeadAttachments] ([TenantId], [CompanyId]);
GO


CREATE INDEX [IX_SalesLeadAttachments_UploadLinkId] ON [SalesLeadAttachments] ([UploadLinkId]);
GO


CREATE UNIQUE INDEX [IX_SalesLeadInventoryItems_Id] ON [SalesLeadInventoryItems] ([Id]);
GO


CREATE INDEX [IX_SalesLeadInventoryItems_SalesLeadId] ON [SalesLeadInventoryItems] ([SalesLeadId]);
GO


CREATE INDEX [IX_SalesLeadInventoryItems_TenantId] ON [SalesLeadInventoryItems] ([TenantId]);
GO


CREATE INDEX [IX_SalesLeadInventoryItems_TenantId_CompanyId] ON [SalesLeadInventoryItems] ([TenantId], [CompanyId]);
GO


CREATE INDEX [IX_SalesLeads_AssignedEmployeeId] ON [SalesLeads] ([AssignedEmployeeId]);
GO


CREATE UNIQUE INDEX [IX_SalesLeads_Id] ON [SalesLeads] ([Id]);
GO


CREATE INDEX [IX_SalesLeads_MoveTypeId] ON [SalesLeads] ([MoveTypeId]);
GO


CREATE INDEX [IX_SalesLeads_StatusId] ON [SalesLeads] ([StatusId]);
GO


CREATE INDEX [IX_SalesLeads_TenantId] ON [SalesLeads] ([TenantId]);
GO


CREATE INDEX [IX_SalesLeads_TenantId_CompanyId] ON [SalesLeads] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_SalesLeads_TenantId_LeadNumber] ON [SalesLeads] ([TenantId], [LeadNumber]);
GO


CREATE UNIQUE INDEX [IX_SalesLeadUploadLinks_Id] ON [SalesLeadUploadLinks] ([Id]);
GO


CREATE INDEX [IX_SalesLeadUploadLinks_SalesLeadId] ON [SalesLeadUploadLinks] ([SalesLeadId]);
GO


CREATE INDEX [IX_SalesLeadUploadLinks_TenantId] ON [SalesLeadUploadLinks] ([TenantId]);
GO


CREATE INDEX [IX_SalesLeadUploadLinks_TenantId_CompanyId] ON [SalesLeadUploadLinks] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_SalesLeadUploadLinks_TokenHash] ON [SalesLeadUploadLinks] ([TokenHash]);
GO


CREATE UNIQUE INDEX [IX_SavedReports_Id] ON [SavedReports] ([Id]);
GO


CREATE INDEX [IX_SavedReports_TenantId] ON [SavedReports] ([TenantId]);
GO


CREATE UNIQUE INDEX [IX_ShipmentClaims_Id] ON [ShipmentClaims] ([Id]);
GO


CREATE INDEX [IX_ShipmentClaims_PackageId] ON [ShipmentClaims] ([PackageId]);
GO


CREATE INDEX [IX_ShipmentClaims_PickupId] ON [ShipmentClaims] ([PickupId]);
GO


CREATE INDEX [IX_ShipmentClaims_TenantId] ON [ShipmentClaims] ([TenantId]);
GO


CREATE INDEX [IX_ShipmentClaims_TenantId_CompanyId] ON [ShipmentClaims] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_SurveyAttachments_Id] ON [SurveyAttachments] ([Id]);
GO


CREATE INDEX [IX_SurveyAttachments_SurveyId_SerialNo] ON [SurveyAttachments] ([SurveyId], [SerialNo]);
GO


CREATE INDEX [IX_SurveyAttachments_TenantId] ON [SurveyAttachments] ([TenantId]);
GO


CREATE INDEX [IX_SurveyAttachments_TenantId_CompanyId] ON [SurveyAttachments] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_SurveyExpenses_Id] ON [SurveyExpenses] ([Id]);
GO


CREATE INDEX [IX_SurveyExpenses_PaidByEmployeeId] ON [SurveyExpenses] ([PaidByEmployeeId]);
GO


CREATE INDEX [IX_SurveyExpenses_SurveyId_SerialNo] ON [SurveyExpenses] ([SurveyId], [SerialNo]);
GO


CREATE INDEX [IX_SurveyExpenses_TenantId] ON [SurveyExpenses] ([TenantId]);
GO


CREATE INDEX [IX_SurveyExpenses_TenantId_CompanyId] ON [SurveyExpenses] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_SurveyExtraMaterials_Id] ON [SurveyExtraMaterials] ([Id]);
GO


CREATE INDEX [IX_SurveyExtraMaterials_MaterialId] ON [SurveyExtraMaterials] ([MaterialId]);
GO


CREATE UNIQUE INDEX [IX_SurveyExtraMaterials_SurveyId_MaterialId] ON [SurveyExtraMaterials] ([SurveyId], [MaterialId]);
GO


CREATE INDEX [IX_SurveyExtraMaterials_TenantId] ON [SurveyExtraMaterials] ([TenantId]);
GO


CREATE INDEX [IX_SurveyExtraMaterials_TenantId_CompanyId] ON [SurveyExtraMaterials] ([TenantId], [CompanyId]);
GO


CREATE INDEX [IX_SurveyItems_HouseholdItemId] ON [SurveyItems] ([HouseholdItemId]);
GO


CREATE UNIQUE INDEX [IX_SurveyItems_Id] ON [SurveyItems] ([Id]);
GO


CREATE INDEX [IX_SurveyItems_RoomId] ON [SurveyItems] ([RoomId]);
GO


CREATE INDEX [IX_SurveyItems_SurveyId] ON [SurveyItems] ([SurveyId]);
GO


CREATE INDEX [IX_SurveyItems_TenantId] ON [SurveyItems] ([TenantId]);
GO


CREATE INDEX [IX_SurveyItems_TenantId_CompanyId] ON [SurveyItems] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_SurveyRooms_Id] ON [SurveyRooms] ([Id]);
GO


CREATE INDEX [IX_SurveyRooms_SurveyId] ON [SurveyRooms] ([SurveyId]);
GO


CREATE INDEX [IX_SurveyRooms_TenantId] ON [SurveyRooms] ([TenantId]);
GO


CREATE INDEX [IX_SurveyRooms_TenantId_CompanyId] ON [SurveyRooms] ([TenantId], [CompanyId]);
GO


CREATE INDEX [IX_Surveys_AssignedEmployeeId] ON [Surveys] ([AssignedEmployeeId]);
GO


CREATE INDEX [IX_Surveys_ConductedByEmployeeId] ON [Surveys] ([ConductedByEmployeeId]);
GO


CREATE UNIQUE INDEX [IX_Surveys_ConfirmationTokenHash] ON [Surveys] ([ConfirmationTokenHash]) WHERE [ConfirmationTokenHash] IS NOT NULL;
GO


CREATE UNIQUE INDEX [IX_Surveys_Id] ON [Surveys] ([Id]);
GO


CREATE INDEX [IX_Surveys_SalesLeadId] ON [Surveys] ([SalesLeadId]);
GO


CREATE INDEX [IX_Surveys_TenantId] ON [Surveys] ([TenantId]);
GO


CREATE INDEX [IX_Surveys_TenantId_CompanyId] ON [Surveys] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_Surveys_TenantId_SurveyNumber] ON [Surveys] ([TenantId], [SurveyNumber]);
GO


CREATE UNIQUE INDEX [IX_SurveyTimeEvents_Id] ON [SurveyTimeEvents] ([Id]);
GO


CREATE INDEX [IX_SurveyTimeEvents_SurveyId_SerialNo] ON [SurveyTimeEvents] ([SurveyId], [SerialNo]);
GO


CREATE INDEX [IX_SurveyTimeEvents_TenantId] ON [SurveyTimeEvents] ([TenantId]);
GO


CREATE INDEX [IX_SurveyTimeEvents_TenantId_CompanyId] ON [SurveyTimeEvents] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_TaxMasters_Id] ON [TaxMasters] ([Id]);
GO


CREATE INDEX [IX_TaxMasters_TenantId] ON [TaxMasters] ([TenantId]);
GO


CREATE UNIQUE INDEX [IX_TaxMasters_TenantId_Code] ON [TaxMasters] ([TenantId], [Code]);
GO


CREATE INDEX [IX_TaxMasters_TenantId_CompanyId] ON [TaxMasters] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_TeamMemberships_Id] ON [TeamMemberships] ([Id]);
GO


CREATE INDEX [IX_TeamMemberships_TenantId] ON [TeamMemberships] ([TenantId]);
GO


CREATE UNIQUE INDEX [IX_Teams_Id] ON [Teams] ([Id]);
GO


CREATE INDEX [IX_Teams_TenantId] ON [Teams] ([TenantId]);
GO


CREATE INDEX [IX_Teams_TenantId_CompanyId] ON [Teams] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_TenantAwsConfigurations_Id] ON [TenantAwsConfigurations] ([Id]);
GO


CREATE UNIQUE INDEX [IX_TenantAwsConfigurations_TenantId] ON [TenantAwsConfigurations] ([TenantId]);
GO


CREATE UNIQUE INDEX [IX_TenantOpenAiConfigurations_Id] ON [TenantOpenAiConfigurations] ([Id]);
GO


CREATE UNIQUE INDEX [IX_TenantOpenAiConfigurations_TenantId] ON [TenantOpenAiConfigurations] ([TenantId]);
GO


CREATE UNIQUE INDEX [IX_Tenants_Id] ON [Tenants] ([Id]);
GO


CREATE UNIQUE INDEX [IX_Tenants_Slug] ON [Tenants] ([Slug]);
GO


CREATE UNIQUE INDEX [IX_TransportJobs_Id] ON [TransportJobs] ([Id]);
GO


CREATE INDEX [IX_TransportJobs_TenantId] ON [TransportJobs] ([TenantId]);
GO


CREATE INDEX [IX_TransportJobs_TenantId_CompanyId] ON [TransportJobs] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_TransportJobs_TenantId_JobNumber] ON [TransportJobs] ([TenantId], [JobNumber]);
GO


CREATE UNIQUE INDEX [IX_TransportJobs_TenantId_RequestId] ON [TransportJobs] ([TenantId], [RequestId]);
GO


CREATE UNIQUE INDEX [IX_TransportTrips_Id] ON [TransportTrips] ([Id]);
GO


CREATE INDEX [IX_TransportTrips_TenantId] ON [TransportTrips] ([TenantId]);
GO


CREATE INDEX [IX_TransportTrips_TenantId_CompanyId] ON [TransportTrips] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_TransportTrips_TenantId_Number] ON [TransportTrips] ([TenantId], [Number]);
GO


CREATE INDEX [IX_TransportTrips_VehicleId] ON [TransportTrips] ([VehicleId]);
GO


CREATE UNIQUE INDEX [IX_TripAllocations_Id] ON [TripAllocations] ([Id]);
GO


CREATE INDEX [IX_TripAllocations_PickupId] ON [TripAllocations] ([PickupId]);
GO


CREATE INDEX [IX_TripAllocations_TenantId] ON [TripAllocations] ([TenantId]);
GO


CREATE INDEX [IX_TripAllocations_TenantId_CompanyId] ON [TripAllocations] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_TripAllocations_TripId_PickupId] ON [TripAllocations] ([TripId], [PickupId]);
GO


CREATE UNIQUE INDEX [IX_UserRoles_Id] ON [UserRoles] ([Id]);
GO


CREATE INDEX [IX_UserRoles_RoleId] ON [UserRoles] ([RoleId]);
GO


CREATE UNIQUE INDEX [IX_UserRoles_UserId_RoleId] ON [UserRoles] ([UserId], [RoleId]);
GO


CREATE INDEX [IX_Users_CompanyId] ON [Users] ([CompanyId]);
GO


CREATE UNIQUE INDEX [IX_Users_EmployeeId] ON [Users] ([EmployeeId]) WHERE [EmployeeId] IS NOT NULL;
GO


CREATE UNIQUE INDEX [IX_Users_Id] ON [Users] ([Id]);
GO


CREATE UNIQUE INDEX [IX_Users_NormalizedEmail] ON [Users] ([NormalizedEmail]);
GO


CREATE INDEX [IX_Users_TenantId] ON [Users] ([TenantId]);
GO


CREATE UNIQUE INDEX [IX_Vehicles_Id] ON [Vehicles] ([Id]);
GO


CREATE INDEX [IX_Vehicles_TenantId] ON [Vehicles] ([TenantId]);
GO


CREATE INDEX [IX_Vehicles_TenantId_CompanyId] ON [Vehicles] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_Vehicles_TenantId_RegistrationNumber] ON [Vehicles] ([TenantId], [RegistrationNumber]);
GO


CREATE UNIQUE INDEX [IX_WarehouseAttachments_Id] ON [WarehouseAttachments] ([Id]);
GO


CREATE INDEX [IX_WarehouseAttachments_TenantId] ON [WarehouseAttachments] ([TenantId]);
GO


CREATE INDEX [IX_WarehouseAttachments_TenantId_CompanyId] ON [WarehouseAttachments] ([TenantId], [CompanyId]);
GO


CREATE INDEX [IX_WarehouseAttachments_TenantId_ReceiptId] ON [WarehouseAttachments] ([TenantId], [ReceiptId]);
GO


CREATE UNIQUE INDEX [IX_WarehouseReceipts_Id] ON [WarehouseReceipts] ([Id]);
GO


CREATE INDEX [IX_WarehouseReceipts_TenantId] ON [WarehouseReceipts] ([TenantId]);
GO


CREATE INDEX [IX_WarehouseReceipts_TenantId_CompanyId] ON [WarehouseReceipts] ([TenantId], [CompanyId]);
GO


CREATE UNIQUE INDEX [IX_WarehouseReceipts_TenantId_ReceiptNumber] ON [WarehouseReceipts] ([TenantId], [ReceiptNumber]);
GO


CREATE UNIQUE INDEX [IX_WarehouseReceipts_TenantId_RequestId] ON [WarehouseReceipts] ([TenantId], [RequestId]);
GO


CREATE UNIQUE INDEX [IX_Warehouses_Id] ON [Warehouses] ([Id]);
GO


CREATE INDEX [IX_Warehouses_TenantId] ON [Warehouses] ([TenantId]);
GO


CREATE UNIQUE INDEX [IX_Warehouses_TenantId_Code] ON [Warehouses] ([TenantId], [Code]);
GO


CREATE INDEX [IX_Warehouses_TenantId_CompanyId] ON [Warehouses] ([TenantId], [CompanyId]);
GO


