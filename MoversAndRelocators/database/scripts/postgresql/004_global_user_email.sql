-- Enforce one email identity across the entire installation.
-- This script fails if duplicate normalized emails already exist.
BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT "NormalizedEmail" FROM "Users"
        GROUP BY "NormalizedEmail" HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate user emails exist. Resolve them before enabling global email uniqueness.';
    END IF;
END $$;

DROP INDEX IF EXISTS "UX_Users_Tenant_Email";
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Users_NormalizedEmail" ON "Users" ("NormalizedEmail");

COMMIT;
