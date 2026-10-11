-- Movers & Relocators - PostgreSQL initial schema
-- SerialNo is the database-generated internal sequence.
-- Id is the stable public identifier exposed by the API.

BEGIN;

CREATE TABLE IF NOT EXISTS "Tenants" (
    "SerialNo"      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Id"            UUID         NOT NULL,
    "Name"          VARCHAR(160) NOT NULL,
    "Slug"          VARCHAR(80)  NOT NULL,
    "ContactEmail"  VARCHAR(254),
    "Phone"         VARCHAR(40),
    "Address"       VARCHAR(500),
    "IsActive"      BOOLEAN      NOT NULL DEFAULT TRUE,
    "CreatedAtUtc"  TIMESTAMPTZ  NOT NULL,
    "UpdatedAtUtc"  TIMESTAMPTZ  NOT NULL,
    CONSTRAINT "CK_Tenants_Name_Length" CHECK (char_length("Name") BETWEEN 2 AND 160),
    CONSTRAINT "CK_Tenants_Slug_Length" CHECK (char_length("Slug") BETWEEN 2 AND 80)
);

CREATE UNIQUE INDEX IF NOT EXISTS "UX_Tenants_Id" ON "Tenants" ("Id");
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Tenants_Slug" ON "Tenants" ("Slug");
CREATE INDEX IF NOT EXISTS "IX_Tenants_Latest" ON "Tenants" ("SerialNo" DESC);

COMMIT;
