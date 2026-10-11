-- Adds the pickup origin and delivery destination to quotations.
BEGIN;

ALTER TABLE "Quotations" ADD COLUMN "Origin" VARCHAR(300), ADD COLUMN "Destination" VARCHAR(300);

UPDATE "Quotations" q
SET "Origin" = COALESCE(l."Origin", ''),
    "Destination" = COALESCE(l."Destination", '')
FROM "SalesLeads" l
WHERE l."Id" = q."SalesLeadId";

UPDATE "Quotations" SET "Origin" = '' WHERE "Origin" IS NULL;
UPDATE "Quotations" SET "Destination" = '' WHERE "Destination" IS NULL;
ALTER TABLE "Quotations" ALTER COLUMN "Origin" SET NOT NULL, ALTER COLUMN "Destination" SET NOT NULL;

COMMIT;
