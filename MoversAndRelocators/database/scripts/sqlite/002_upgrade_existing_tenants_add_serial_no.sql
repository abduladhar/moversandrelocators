-- One-time SQLite upgrade for databases created before SerialNo existed.
-- Backfills serial numbers in original creation order and changes the internal key.

PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

ALTER TABLE "Tenants" RENAME TO "Tenants_Legacy";

CREATE TABLE "Tenants" (
    "SerialNo"      INTEGER NOT NULL CONSTRAINT "PK_Tenants" PRIMARY KEY AUTOINCREMENT,
    "Id"            TEXT    NOT NULL,
    "Name"          TEXT    NOT NULL CHECK (length("Name") BETWEEN 2 AND 160),
    "Slug"          TEXT    NOT NULL CHECK (length("Slug") BETWEEN 2 AND 80),
    "ContactEmail"  TEXT    NULL CHECK ("ContactEmail" IS NULL OR length("ContactEmail") <= 254),
    "Phone"         TEXT    NULL CHECK ("Phone" IS NULL OR length("Phone") <= 40),
    "Address"       TEXT    NULL CHECK ("Address" IS NULL OR length("Address") <= 500),
    "IsActive"      INTEGER NOT NULL DEFAULT 1 CHECK ("IsActive" IN (0, 1)),
    "CreatedAtUtc"  TEXT    NOT NULL,
    "UpdatedAtUtc"  TEXT    NOT NULL
);

INSERT INTO "Tenants" (
    "SerialNo", "Id", "Name", "Slug", "ContactEmail", "Phone", "Address",
    "IsActive", "CreatedAtUtc", "UpdatedAtUtc"
)
SELECT
    ROW_NUMBER() OVER (ORDER BY "CreatedAtUtc", "Id"),
    "Id", "Name", "Slug", "ContactEmail", "Phone", "Address",
    "IsActive", "CreatedAtUtc", "UpdatedAtUtc"
FROM "Tenants_Legacy";

DROP TABLE "Tenants_Legacy";

CREATE UNIQUE INDEX "UX_Tenants_Id" ON "Tenants" ("Id");
CREATE UNIQUE INDEX "UX_Tenants_Slug" ON "Tenants" ("Slug");
CREATE INDEX "IX_Tenants_Latest" ON "Tenants" ("SerialNo" DESC);

COMMIT;
PRAGMA foreign_keys = ON;
