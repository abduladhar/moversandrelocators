using Microsoft.EntityFrameworkCore;
namespace Movers.DAL.Persistence;

/// <summary>
/// Idempotent upgrade that adds the customer reply tracking (script 039) and the office's action plus the history (script 040). Records already waiting on the customer are
/// brought in once: quotations sent with a live link, surveys with an unanswered confirmation link, and customer
/// requote/change requests the office has not dealt with yet.
/// </summary>
public static class CustomerReplySchema
{
    /// <summary>Creates the table (with its CompanyId). Runs before CompanySchema, which lists the table.</summary>
    public static async Task Apply(MoversDbContext db)
    {
        if (db.Database.IsSqlServer()) await db.Database.ExecuteSqlRawAsync(SqlServer);
        else if (db.Database.IsNpgsql()) await db.Database.ExecuteSqlRawAsync(PostgreSql);
        // SQLite is only used for fresh test databases, which EnsureCreated builds from the current model.
    }

    /// <summary>Brings in records already waiting on the customer. Runs after CompanySchema (it copies each record's CompanyId) and only adds rows for records that have none, so running it again is harmless.</summary>
    public static async Task Backfill(MoversDbContext db)
    {
        if (db.Database.IsSqlServer()) await db.Database.ExecuteSqlRawAsync(SqlServerBackfill);
        else if (db.Database.IsNpgsql()) await db.Database.ExecuteSqlRawAsync(PostgreSqlBackfill);
    }

    public const string SqlServer = """
        IF OBJECT_ID(N'dbo.CustomerReplies', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[CustomerReplies] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_CustomerReplies] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [CompanyId] UNIQUEIDENTIFIER NULL,
                [RecordType] NVARCHAR(30) NOT NULL, [RecordId] UNIQUEIDENTIFIER NOT NULL, [SharedAtUtc] DATETIMEOFFSET NULL, [ExpiresAtUtc] DATETIMEOFFSET NULL, [RepliedAtUtc] DATETIMEOFFSET NULL,
                [ReplyKind] NVARCHAR(40) NULL, [ReplyNote] NVARCHAR(500) NULL, [HandledAtUtc] DATETIMEOFFSET NULL, [HandledBy] NVARCHAR(320) NULL, [HandledAction] NVARCHAR(40) NULL, [HandledNote] NVARCHAR(500) NULL,
                CONSTRAINT [FK_CustomerReplies_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]));
            CREATE UNIQUE INDEX [IX_CustomerReplies_Id] ON [dbo].[CustomerReplies]([Id]);
            CREATE UNIQUE INDEX [IX_CustomerReplies_TenantId_RecordType_RecordId] ON [dbo].[CustomerReplies]([TenantId], [RecordType], [RecordId]);
            CREATE INDEX [IX_CustomerReplies_TenantId] ON [dbo].[CustomerReplies]([TenantId]);
        END
        IF COL_LENGTH(N'dbo.CustomerReplies', N'HandledAction') IS NULL ALTER TABLE [dbo].[CustomerReplies] ADD [HandledAction] NVARCHAR(40) NULL;
        IF COL_LENGTH(N'dbo.CustomerReplies', N'HandledNote') IS NULL ALTER TABLE [dbo].[CustomerReplies] ADD [HandledNote] NVARCHAR(500) NULL;
        IF OBJECT_ID(N'dbo.CustomerReplyEvents', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[CustomerReplyEvents] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_CustomerReplyEvents] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [CompanyId] UNIQUEIDENTIFIER NULL,
                [RecordType] NVARCHAR(30) NOT NULL, [RecordId] UNIQUEIDENTIFIER NOT NULL, [Event] NVARCHAR(20) NOT NULL, [Detail] NVARCHAR(40) NULL, [Note] NVARCHAR(500) NULL, [Actor] NVARCHAR(200) NOT NULL,
                [AtUtc] DATETIMEOFFSET NOT NULL, [ExpiresAtUtc] DATETIMEOFFSET NULL,
                CONSTRAINT [FK_CustomerReplyEvents_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]));
            CREATE UNIQUE INDEX [IX_CustomerReplyEvents_Id] ON [dbo].[CustomerReplyEvents]([Id]);
            CREATE INDEX [IX_CustomerReplyEvents_TenantId_RecordType_RecordId] ON [dbo].[CustomerReplyEvents]([TenantId], [RecordType], [RecordId]);
            CREATE INDEX [IX_CustomerReplyEvents_TenantId] ON [dbo].[CustomerReplyEvents]([TenantId]);
        END
        """;

    public const string SqlServerBackfill = """
            INSERT INTO [dbo].[CustomerReplies] ([Id], [TenantId], [CompanyId], [RecordType], [RecordId], [SharedAtUtc], [ExpiresAtUtc])
            SELECT NEWID(), q.[TenantId], q.[CompanyId], N'QUOTATION', q.[Id], q.[SentAtUtc], q.[ShareExpiresAtUtc] FROM [dbo].[Quotations] q
            WHERE q.[Status] = N'SENT' AND q.[SentAtUtc] IS NOT NULL AND q.[ShareExpiresAtUtc] > SYSDATETIMEOFFSET() AND NOT EXISTS (SELECT 1 FROM [dbo].[CustomerReplies] c WHERE c.[RecordId] = q.[Id]);
            INSERT INTO [dbo].[CustomerReplies] ([Id], [TenantId], [CompanyId], [RecordType], [RecordId], [RepliedAtUtc], [ReplyKind])
            SELECT NEWID(), q.[TenantId], q.[CompanyId], N'QUOTATION', q.[Id], ISNULL(q.[RespondedAtUtc], SYSDATETIMEOFFSET()), N'QUOTATION_REQUOTE' FROM [dbo].[Quotations] q
            WHERE q.[Status] = N'REQUOTE_REQUESTED' AND EXISTS (SELECT 1 FROM [dbo].[QuotationRequoteRequests] r WHERE r.[QuotationId] = q.[Id] AND r.[AppliedAtUtc] IS NULL) AND NOT EXISTS (SELECT 1 FROM [dbo].[CustomerReplies] c WHERE c.[RecordId] = q.[Id]);
            INSERT INTO [dbo].[CustomerReplies] ([Id], [TenantId], [CompanyId], [RecordType], [RecordId], [RepliedAtUtc], [ReplyKind])
            SELECT NEWID(), s.[TenantId], s.[CompanyId], N'SURVEY', s.[Id], s.[CustomerChangeRequestedAtUtc], N'SURVEY_CHANGES' FROM [dbo].[Surveys] s
            WHERE s.[CustomerChangeRequestJson] IS NOT NULL AND s.[CustomerChangeRequestedAtUtc] IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[CustomerReplies] c WHERE c.[RecordId] = s.[Id]);
            INSERT INTO [dbo].[CustomerReplies] ([Id], [TenantId], [CompanyId], [RecordType], [RecordId], [SharedAtUtc], [ExpiresAtUtc])
            SELECT NEWID(), s.[TenantId], s.[CompanyId], N'SURVEY', s.[Id], SYSDATETIMEOFFSET(), s.[ConfirmationExpiresAtUtc] FROM [dbo].[Surveys] s
            WHERE s.[ConfirmationExpiresAtUtc] > SYSDATETIMEOFFSET() AND s.[ScheduleConfirmedAtUtc] IS NULL AND s.[ItemsConfirmedAtUtc] IS NULL AND s.[CustomerChangeRequestJson] IS NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[CustomerReplies] c WHERE c.[RecordId] = s.[Id]);
            -- History for records tracked before it existed: what the state row knows (one statement, so a record gets all its steps at once).
            INSERT INTO [dbo].[CustomerReplyEvents] ([Id], [TenantId], [CompanyId], [RecordType], [RecordId], [Event], [Detail], [Note], [Actor], [AtUtc], [ExpiresAtUtc])
            SELECT NEWID(), r.[TenantId], r.[CompanyId], r.[RecordType], r.[RecordId], e.[Event], e.[Detail], e.[Note], e.[Actor], e.[AtUtc], e.[ExpiresAtUtc]
            FROM [dbo].[CustomerReplies] r
            CROSS APPLY (VALUES (N'SHARED', NULL, NULL, N'System', r.[SharedAtUtc], r.[ExpiresAtUtc]), (N'REPLIED', r.[ReplyKind], r.[ReplyNote], N'CUSTOMER', r.[RepliedAtUtc], NULL),
                (N'ACTION_TAKEN', ISNULL(r.[HandledAction], N'MARKED'), r.[HandledNote], ISNULL(r.[HandledBy], N'System'), r.[HandledAtUtc], NULL)) e([Event], [Detail], [Note], [Actor], [AtUtc], [ExpiresAtUtc])
            WHERE e.[AtUtc] IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[CustomerReplyEvents] x WHERE x.[RecordId] = r.[RecordId]);
        """;

    public const string PostgreSql = """
        DO $$
        BEGIN
            IF to_regclass('"CustomerReplies"') IS NULL THEN
                CREATE TABLE "CustomerReplies" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "CompanyId" uuid NULL,
                    "RecordType" varchar(30) NOT NULL, "RecordId" uuid NOT NULL, "SharedAtUtc" timestamp with time zone NULL, "ExpiresAtUtc" timestamp with time zone NULL, "RepliedAtUtc" timestamp with time zone NULL,
                    "ReplyKind" varchar(40) NULL, "ReplyNote" varchar(500) NULL, "HandledAtUtc" timestamp with time zone NULL, "HandledBy" varchar(320) NULL, "HandledAction" varchar(40) NULL, "HandledNote" varchar(500) NULL);
                CREATE UNIQUE INDEX "IX_CustomerReplies_Id" ON "CustomerReplies"("Id");
                CREATE UNIQUE INDEX "IX_CustomerReplies_TenantId_RecordType_RecordId" ON "CustomerReplies"("TenantId", "RecordType", "RecordId");
                CREATE INDEX "IX_CustomerReplies_TenantId" ON "CustomerReplies"("TenantId");
            END IF;
        END $$;
        ALTER TABLE "CustomerReplies" ADD COLUMN IF NOT EXISTS "HandledAction" varchar(40) NULL;
        ALTER TABLE "CustomerReplies" ADD COLUMN IF NOT EXISTS "HandledNote" varchar(500) NULL;
        CREATE TABLE IF NOT EXISTS "CustomerReplyEvents" ("SerialNo" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "Id" uuid NOT NULL, "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id"), "CompanyId" uuid NULL,
            "RecordType" varchar(30) NOT NULL, "RecordId" uuid NOT NULL, "Event" varchar(20) NOT NULL, "Detail" varchar(40) NULL, "Note" varchar(500) NULL, "Actor" varchar(200) NOT NULL,
            "AtUtc" timestamp with time zone NOT NULL, "ExpiresAtUtc" timestamp with time zone NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_CustomerReplyEvents_Id" ON "CustomerReplyEvents"("Id");
        CREATE INDEX IF NOT EXISTS "IX_CustomerReplyEvents_TenantId_RecordType_RecordId" ON "CustomerReplyEvents"("TenantId", "RecordType", "RecordId");
        CREATE INDEX IF NOT EXISTS "IX_CustomerReplyEvents_TenantId" ON "CustomerReplyEvents"("TenantId");
        """;

    public const string PostgreSqlBackfill = """
                INSERT INTO "CustomerReplies" ("Id", "TenantId", "CompanyId", "RecordType", "RecordId", "SharedAtUtc", "ExpiresAtUtc")
                SELECT gen_random_uuid(), q."TenantId", q."CompanyId", 'QUOTATION', q."Id", q."SentAtUtc", q."ShareExpiresAtUtc" FROM "Quotations" q
                WHERE q."Status" = 'SENT' AND q."SentAtUtc" IS NOT NULL AND q."ShareExpiresAtUtc" > now() AND NOT EXISTS (SELECT 1 FROM "CustomerReplies" c WHERE c."RecordId" = q."Id");
                INSERT INTO "CustomerReplies" ("Id", "TenantId", "CompanyId", "RecordType", "RecordId", "RepliedAtUtc", "ReplyKind")
                SELECT gen_random_uuid(), q."TenantId", q."CompanyId", 'QUOTATION', q."Id", COALESCE(q."RespondedAtUtc", now()), 'QUOTATION_REQUOTE' FROM "Quotations" q
                WHERE q."Status" = 'REQUOTE_REQUESTED' AND EXISTS (SELECT 1 FROM "QuotationRequoteRequests" r WHERE r."QuotationId" = q."Id" AND r."AppliedAtUtc" IS NULL) AND NOT EXISTS (SELECT 1 FROM "CustomerReplies" c WHERE c."RecordId" = q."Id");
                INSERT INTO "CustomerReplies" ("Id", "TenantId", "CompanyId", "RecordType", "RecordId", "RepliedAtUtc", "ReplyKind")
                SELECT gen_random_uuid(), s."TenantId", s."CompanyId", 'SURVEY', s."Id", s."CustomerChangeRequestedAtUtc", 'SURVEY_CHANGES' FROM "Surveys" s
                WHERE s."CustomerChangeRequestJson" IS NOT NULL AND s."CustomerChangeRequestedAtUtc" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CustomerReplies" c WHERE c."RecordId" = s."Id");
                INSERT INTO "CustomerReplies" ("Id", "TenantId", "CompanyId", "RecordType", "RecordId", "SharedAtUtc", "ExpiresAtUtc")
                SELECT gen_random_uuid(), s."TenantId", s."CompanyId", 'SURVEY', s."Id", now(), s."ConfirmationExpiresAtUtc" FROM "Surveys" s
                WHERE s."ConfirmationExpiresAtUtc" > now() AND s."ScheduleConfirmedAtUtc" IS NULL AND s."ItemsConfirmedAtUtc" IS NULL AND s."CustomerChangeRequestJson" IS NULL AND NOT EXISTS (SELECT 1 FROM "CustomerReplies" c WHERE c."RecordId" = s."Id");
                INSERT INTO "CustomerReplyEvents" ("Id", "TenantId", "CompanyId", "RecordType", "RecordId", "Event", "Detail", "Note", "Actor", "AtUtc", "ExpiresAtUtc")
                SELECT gen_random_uuid(), r."TenantId", r."CompanyId", r."RecordType", r."RecordId", e.ev, e.detail, e.note, e.actor, e.at, e.expires
                FROM "CustomerReplies" r
                CROSS JOIN LATERAL (VALUES ('SHARED', NULL::varchar, NULL::varchar, 'System'::varchar, r."SharedAtUtc", r."ExpiresAtUtc"), ('REPLIED', r."ReplyKind", r."ReplyNote", 'CUSTOMER', r."RepliedAtUtc", NULL),
                    ('ACTION_TAKEN', COALESCE(r."HandledAction", 'MARKED'), r."HandledNote", COALESCE(r."HandledBy", 'System'), r."HandledAtUtc", NULL)) e(ev, detail, note, actor, at, expires)
                WHERE e.at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CustomerReplyEvents" x WHERE x."RecordId" = r."RecordId");
        """;
}
