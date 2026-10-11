-- Adds household items directly to quotations, including direct quotations without surveys.
BEGIN;
CREATE TABLE "QuotationItems" (
    "SerialNo" INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, "Id" UUID NOT NULL UNIQUE,
    "TenantId" UUID NOT NULL REFERENCES "Tenants"("Id"), "QuotationId" UUID NOT NULL REFERENCES "Quotations"("Id") ON DELETE CASCADE,
    "HouseholdItemId" UUID NOT NULL REFERENCES "HouseholdItems"("Id"), "RoomName" VARCHAR(120) NOT NULL,
    "ItemName" VARCHAR(160) NOT NULL, "Quantity" INTEGER NOT NULL, "VolumePerUnitCbm" NUMERIC(12,3) NOT NULL,
    "Notes" VARCHAR(500), "DisplayOrder" INTEGER NOT NULL
);
CREATE INDEX "IX_QuotationItems_TenantId" ON "QuotationItems"("TenantId");
CREATE INDEX "IX_QuotationItems_QuotationId_DisplayOrder" ON "QuotationItems"("QuotationId", "DisplayOrder");
COMMIT;
