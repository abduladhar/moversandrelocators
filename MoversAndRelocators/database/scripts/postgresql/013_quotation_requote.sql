-- Customer-visible survey inventory and requote requests for PostgreSQL.
BEGIN;
ALTER TABLE "Quotations" ADD COLUMN "IncludeSurveyItems" BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE "QuotationRequoteRequests" (
  "SerialNo" INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "Id" UUID NOT NULL UNIQUE,
  "TenantId" UUID NOT NULL REFERENCES "Tenants"("Id"),
  "QuotationId" UUID NOT NULL REFERENCES "Quotations"("Id") ON DELETE CASCADE,
  "ItemsJson" TEXT NOT NULL,
  "CustomerNotes" VARCHAR(2000),
  "CreatedAtUtc" TIMESTAMPTZ NOT NULL);
CREATE INDEX "IX_QuotationRequoteRequests_Tenant" ON "QuotationRequoteRequests"("TenantId");
CREATE INDEX "IX_QuotationRequoteRequests_Quotation" ON "QuotationRequoteRequests"("QuotationId","SerialNo" DESC);
COMMIT;
