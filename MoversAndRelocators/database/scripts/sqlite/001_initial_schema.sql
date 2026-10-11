-- Movers & Relocators - SQLite initial schema
-- SerialNo is the database-generated internal sequence.
-- Id is the stable public identifier exposed by the API.

PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS "Tenants" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "UX_Tenants_Id" ON "Tenants" ("Id");
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Tenants_Slug" ON "Tenants" ("Slug");
CREATE INDEX IF NOT EXISTS "IX_Tenants_Latest" ON "Tenants" ("SerialNo" DESC);

COMMIT;
