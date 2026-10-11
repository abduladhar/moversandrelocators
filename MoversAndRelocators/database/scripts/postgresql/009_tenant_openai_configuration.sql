-- One encrypted OpenAI profile per tenant for PostgreSQL.
BEGIN;

CREATE TABLE "TenantOpenAiConfigurations" (
    "SerialNo" INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Id" UUID NOT NULL UNIQUE,
    "TenantId" UUID NOT NULL REFERENCES "Tenants"("Id"),
    "EncryptedApiKey" VARCHAR(1000) NOT NULL,
    "ApiKeyLastFour" VARCHAR(4) NOT NULL,
    "ExtractionModel" VARCHAR(120) NOT NULL,
    "TranscriptionModel" VARCHAR(120) NOT NULL,
    "CreatedAtUtc" TIMESTAMPTZ NOT NULL,
    "UpdatedAtUtc" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "UX_TenantOpenAiConfigurations_Tenant" UNIQUE ("TenantId")
);

COMMIT;
