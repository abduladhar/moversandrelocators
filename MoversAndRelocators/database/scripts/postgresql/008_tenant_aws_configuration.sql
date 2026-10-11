-- One encrypted AWS credential profile per tenant for PostgreSQL.
BEGIN;

CREATE TABLE "TenantAwsConfigurations" (
    "SerialNo" INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Id" UUID NOT NULL UNIQUE,
    "TenantId" UUID NOT NULL REFERENCES "Tenants"("Id"),
    "Region" VARCHAR(60) NOT NULL,
    "EncryptedAccessKey" VARCHAR(1000) NOT NULL,
    "AccessKeyLastFour" VARCHAR(4) NOT NULL,
    "EncryptedSecretKey" VARCHAR(1000) NOT NULL,
    "CreatedAtUtc" TIMESTAMPTZ NOT NULL,
    "UpdatedAtUtc" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "UX_TenantAwsConfigurations_Tenant" UNIQUE ("TenantId")
);

COMMIT;
