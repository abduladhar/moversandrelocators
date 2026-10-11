using Microsoft.EntityFrameworkCore;
namespace Movers.DAL.Persistence;

/// <summary>Idempotent upgrade that adds the delivery module tables to existing databases (scripts 029-030).</summary>
public static class DeliverySchema
{
    public static async Task Apply(MoversDbContext db)
    {
        if (db.Database.IsSqlServer()) { foreach (var batch in System.Text.RegularExpressions.Regex.Split(SqlServer, @"^\s*GO\s*$", System.Text.RegularExpressions.RegexOptions.Multiline)) await db.Database.ExecuteSqlRawAsync(batch); }
        else if (db.Database.IsNpgsql()) await db.Database.ExecuteSqlRawAsync(PostgreSql);
        // SQLite is only used for fresh test databases, which EnsureCreated builds from the current model.
    }

    public const string SqlServer = """
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
        IF COL_LENGTH(N'dbo.DeliveryNotes', N'DateResponse') IS NULL
            ALTER TABLE [dbo].[DeliveryNotes] ADD [DateResponse] NVARCHAR(20) NULL, [PreferredAtUtc] DATETIMEOFFSET NULL, [DateRespondedAtUtc] DATETIMEOFFSET NULL, [DateRespondedForUtc] DATETIMEOFFSET NULL, [Latitude] DECIMAL(9,6) NULL, [Longitude] DECIMAL(9,6) NULL, [LocationNotes] NVARCHAR(500) NULL, [LocationSharedAtUtc] DATETIMEOFFSET NULL;
        GO
        IF OBJECT_ID(N'dbo.DeliveryNoteLinks', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[DeliveryNoteLinks] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_DeliveryNoteLinks] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [DeliveryJobId] UNIQUEIDENTIFIER NOT NULL, [DeliveryNoteId] UNIQUEIDENTIFIER NOT NULL, [Purpose] NVARCHAR(20) NOT NULL, [TokenHash] NVARCHAR(64) NOT NULL, [ExpiresAtUtc] DATETIMEOFFSET NOT NULL, [CreatedAtUtc] DATETIMEOFFSET NOT NULL,
                CONSTRAINT [FK_DeliveryNoteLinks_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_DeliveryNoteLinks_DeliveryJobs] FOREIGN KEY ([DeliveryJobId]) REFERENCES [dbo].[DeliveryJobs]([Id]) ON DELETE CASCADE, CONSTRAINT [FK_DeliveryNoteLinks_DeliveryNotes] FOREIGN KEY ([DeliveryNoteId]) REFERENCES [dbo].[DeliveryNotes]([Id]));
            CREATE UNIQUE INDEX [IX_DeliveryNoteLinks_Id] ON [dbo].[DeliveryNoteLinks]([Id]);
            CREATE UNIQUE INDEX [IX_DeliveryNoteLinks_TokenHash] ON [dbo].[DeliveryNoteLinks]([TokenHash]);
            CREATE INDEX [IX_DeliveryNoteLinks_DeliveryNoteId] ON [dbo].[DeliveryNoteLinks]([DeliveryNoteId]);
            CREATE INDEX [IX_DeliveryNoteLinks_TenantId] ON [dbo].[DeliveryNoteLinks]([TenantId]);
        END
        """;

    public const string PostgreSql = """
        CREATE TABLE IF NOT EXISTS "DeliveryJobs" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "DeliveryNumber" varchar(40) NOT NULL, "ScheduledAtUtc" timestamp with time zone NOT NULL, "DurationMinutes" integer NOT NULL, "Status" varchar(20) NOT NULL, "Notes" varchar(2000) NULL, "VehicleId" uuid NULL REFERENCES "Vehicles"("Id"), "DriverEmployeeId" uuid NULL REFERENCES "Employees"("Id"), "StartedAtUtc" timestamp with time zone NULL, "CompletedAtUtc" timestamp with time zone NULL, "IsPaused" boolean NOT NULL, "DistanceKm" numeric(9,2) NULL, "CreatedAtUtc" timestamp with time zone NOT NULL, "UpdatedAtUtc" timestamp with time zone NOT NULL, "Version" uuid NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_DeliveryJobs_Id" ON "DeliveryJobs"("Id");
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_DeliveryJobs_TenantId_DeliveryNumber" ON "DeliveryJobs"("TenantId","DeliveryNumber");
        CREATE INDEX IF NOT EXISTS "IX_DeliveryJobs_TenantId" ON "DeliveryJobs"("TenantId");
        CREATE TABLE IF NOT EXISTS "DeliveryJobTimeEvents" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "DeliveryJobId" uuid NOT NULL REFERENCES "DeliveryJobs"("Id") ON DELETE CASCADE, "Type" varchar(20) NOT NULL, "OccurredAtUtc" timestamp with time zone NOT NULL, "Reason" varchar(500) NULL, "RecordedBy" varchar(254) NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_DeliveryJobTimeEvents_Id" ON "DeliveryJobTimeEvents"("Id");
        CREATE INDEX IF NOT EXISTS "IX_DeliveryJobTimeEvents_DeliveryJobId" ON "DeliveryJobTimeEvents"("DeliveryJobId");
        CREATE INDEX IF NOT EXISTS "IX_DeliveryJobTimeEvents_TenantId" ON "DeliveryJobTimeEvents"("TenantId");
        CREATE TABLE IF NOT EXISTS "DeliveryJobCrew" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "DeliveryJobId" uuid NOT NULL REFERENCES "DeliveryJobs"("Id") ON DELETE CASCADE, "EmployeeId" uuid NOT NULL REFERENCES "Employees"("Id"), "Role" varchar(80) NOT NULL, "TeamId" uuid NULL, "TeamName" varchar(120) NULL, "AssignedAtUtc" timestamp with time zone NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_DeliveryJobCrew_Id" ON "DeliveryJobCrew"("Id");
        CREATE INDEX IF NOT EXISTS "IX_DeliveryJobCrew_DeliveryJobId" ON "DeliveryJobCrew"("DeliveryJobId");
        CREATE INDEX IF NOT EXISTS "IX_DeliveryJobCrew_TenantId" ON "DeliveryJobCrew"("TenantId");
        CREATE TABLE IF NOT EXISTS "DeliveryNotes" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "DeliveryJobId" uuid NOT NULL REFERENCES "DeliveryJobs"("Id") ON DELETE CASCADE, "NoteNumber" varchar(40) NOT NULL, "CustomerName" varchar(160) NOT NULL, "ContactName" varchar(160) NULL, "Phone" varchar(40) NULL, "Address" varchar(500) NULL, "CreatedAtUtc" timestamp with time zone NOT NULL, "SignerName" varchar(160) NULL, "SignaturePng" text NULL, "Remarks" varchar(1000) NULL, "SignedAtUtc" timestamp with time zone NULL, "SignedBy" varchar(254) NULL, "SignedItemsJson" text NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_DeliveryNotes_Id" ON "DeliveryNotes"("Id");
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_DeliveryNotes_TenantId_NoteNumber" ON "DeliveryNotes"("TenantId","NoteNumber");
        CREATE INDEX IF NOT EXISTS "IX_DeliveryNotes_DeliveryJobId" ON "DeliveryNotes"("DeliveryJobId");
        CREATE TABLE IF NOT EXISTS "DeliveryItems" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "DeliveryJobId" uuid NOT NULL REFERENCES "DeliveryJobs"("Id") ON DELETE CASCADE, "DeliveryNoteId" uuid NOT NULL REFERENCES "DeliveryNotes"("Id"), "BoxId" uuid NOT NULL, "Source" varchar(20) NOT NULL, "TransportJobId" uuid NULL, "PickupId" uuid NULL, "TrackingNumber" varchar(80) NOT NULL, "Description" varchar(160) NOT NULL, "Contents" varchar(2000) NOT NULL, "WarehouseId" uuid NULL, "Location" varchar(500) NOT NULL, "Reference" varchar(80) NOT NULL, "Status" varchar(20) NOT NULL, "LoadedAtUtc" timestamp with time zone NOT NULL, "LoadedBy" varchar(254) NOT NULL, "StatusAtUtc" timestamp with time zone NULL, "ReceivedBy" varchar(160) NULL, "Notes" varchar(500) NULL, "UpdatedBy" varchar(254) NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_DeliveryItems_Id" ON "DeliveryItems"("Id");
        CREATE INDEX IF NOT EXISTS "IX_DeliveryItems_BoxId" ON "DeliveryItems"("BoxId");
        CREATE INDEX IF NOT EXISTS "IX_DeliveryItems_DeliveryJobId" ON "DeliveryItems"("DeliveryJobId");
        CREATE INDEX IF NOT EXISTS "IX_DeliveryItems_DeliveryNoteId" ON "DeliveryItems"("DeliveryNoteId");
        CREATE INDEX IF NOT EXISTS "IX_DeliveryItems_TenantId" ON "DeliveryItems"("TenantId");
        CREATE TABLE IF NOT EXISTS "DeliveryJobTransactions" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "DeliveryJobId" uuid NOT NULL REFERENCES "DeliveryJobs"("Id") ON DELETE CASCADE, "DeliveryNoteId" uuid NULL REFERENCES "DeliveryNotes"("Id"), "TransactionNumber" varchar(60) NOT NULL, "Type" varchar(20) NOT NULL, "Category" varchar(120) NOT NULL, "Amount" numeric(20,4) NOT NULL, "PaymentMethod" varchar(40) NOT NULL, "Notes" varchar(500) NULL, "CreatedAtUtc" timestamp with time zone NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_DeliveryJobTransactions_Id" ON "DeliveryJobTransactions"("Id");
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_DeliveryJobTransactions_TenantId_TransactionNumber" ON "DeliveryJobTransactions"("TenantId","TransactionNumber");
        CREATE INDEX IF NOT EXISTS "IX_DeliveryJobTransactions_DeliveryJobId" ON "DeliveryJobTransactions"("DeliveryJobId");
        ALTER TABLE "DeliveryNotes" ADD COLUMN IF NOT EXISTS "DateResponse" varchar(20) NULL, ADD COLUMN IF NOT EXISTS "PreferredAtUtc" timestamp with time zone NULL, ADD COLUMN IF NOT EXISTS "DateRespondedAtUtc" timestamp with time zone NULL, ADD COLUMN IF NOT EXISTS "DateRespondedForUtc" timestamp with time zone NULL, ADD COLUMN IF NOT EXISTS "Latitude" numeric(9,6) NULL, ADD COLUMN IF NOT EXISTS "Longitude" numeric(9,6) NULL, ADD COLUMN IF NOT EXISTS "LocationNotes" varchar(500) NULL, ADD COLUMN IF NOT EXISTS "LocationSharedAtUtc" timestamp with time zone NULL;
        CREATE TABLE IF NOT EXISTS "DeliveryNoteLinks" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "DeliveryJobId" uuid NOT NULL REFERENCES "DeliveryJobs"("Id") ON DELETE CASCADE, "DeliveryNoteId" uuid NOT NULL REFERENCES "DeliveryNotes"("Id"), "Purpose" varchar(20) NOT NULL, "TokenHash" varchar(64) NOT NULL, "ExpiresAtUtc" timestamp with time zone NOT NULL, "CreatedAtUtc" timestamp with time zone NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_DeliveryNoteLinks_Id" ON "DeliveryNoteLinks"("Id");
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_DeliveryNoteLinks_TokenHash" ON "DeliveryNoteLinks"("TokenHash");
        CREATE INDEX IF NOT EXISTS "IX_DeliveryNoteLinks_DeliveryNoteId" ON "DeliveryNoteLinks"("DeliveryNoteId");
        CREATE INDEX IF NOT EXISTS "IX_DeliveryNoteLinks_TenantId" ON "DeliveryNoteLinks"("TenantId");
        """;
}
