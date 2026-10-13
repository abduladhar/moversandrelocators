-- The customer's answer on each sales-lead inventory line, from the inventory link shared with them. The API also applies this at startup (LeadInventorySchema).
ALTER TABLE "SalesLeadInventoryItems" ADD COLUMN IF NOT EXISTS "CustomerStatus" varchar(20) NOT NULL DEFAULT 'PENDING';
ALTER TABLE "SalesLeadInventoryItems" ADD COLUMN IF NOT EXISTS "CustomerNote" varchar(500) NULL;
ALTER TABLE "SalesLeadInventoryItems" ADD COLUMN IF NOT EXISTS "CustomerDecidedAtUtc" timestamp with time zone NULL;
