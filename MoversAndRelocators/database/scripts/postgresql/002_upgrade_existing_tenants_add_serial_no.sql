-- One-time PostgreSQL upgrade for databases created before SerialNo existed.

BEGIN;

ALTER TABLE "Tenants"
    ADD COLUMN "SerialNo" INTEGER GENERATED ALWAYS AS IDENTITY;

ALTER TABLE "Tenants" DROP CONSTRAINT IF EXISTS "PK_Tenants";
ALTER TABLE "Tenants" ADD CONSTRAINT "PK_Tenants" PRIMARY KEY ("SerialNo");

CREATE UNIQUE INDEX IF NOT EXISTS "UX_Tenants_Id" ON "Tenants" ("Id");
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Tenants_Slug" ON "Tenants" ("Slug");
CREATE INDEX IF NOT EXISTS "IX_Tenants_Latest" ON "Tenants" ("SerialNo" DESC);

COMMIT;
