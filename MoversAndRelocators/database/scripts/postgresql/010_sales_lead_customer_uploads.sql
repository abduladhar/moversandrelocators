-- S3 bucket setting, expiring customer upload links, and lead attachments for PostgreSQL.
BEGIN;
ALTER TABLE "TenantAwsConfigurations" ADD COLUMN "BucketName" VARCHAR(63) NOT NULL DEFAULT '';
ALTER TABLE "TenantAwsConfigurations" ALTER COLUMN "BucketName" DROP DEFAULT;
CREATE TABLE "SalesLeadUploadLinks" ("SerialNo" INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, "Id" UUID NOT NULL UNIQUE, "TenantId" UUID NOT NULL REFERENCES "Tenants"("Id"), "SalesLeadId" UUID NOT NULL REFERENCES "SalesLeads"("Id"), "TokenHash" VARCHAR(64) NOT NULL UNIQUE, "ExpiresAtUtc" TIMESTAMPTZ NOT NULL, "IsActive" BOOLEAN NOT NULL, "CreatedAtUtc" TIMESTAMPTZ NOT NULL);
CREATE INDEX "IX_SalesLeadUploadLinks_Tenant" ON "SalesLeadUploadLinks"("TenantId");
CREATE TABLE "SalesLeadAttachments" ("SerialNo" INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, "Id" UUID NOT NULL UNIQUE, "TenantId" UUID NOT NULL REFERENCES "Tenants"("Id"), "SalesLeadId" UUID NOT NULL REFERENCES "SalesLeads"("Id"), "UploadLinkId" UUID NOT NULL REFERENCES "SalesLeadUploadLinks"("Id"), "OriginalFileName" VARCHAR(255) NOT NULL, "ContentType" VARCHAR(150) NOT NULL, "DeclaredSizeBytes" BIGINT NOT NULL, "StoredSizeBytes" BIGINT, "S3ObjectKey" VARCHAR(700) NOT NULL, "IsUploaded" BOOLEAN NOT NULL, "CreatedAtUtc" TIMESTAMPTZ NOT NULL, "UploadedAtUtc" TIMESTAMPTZ);
CREATE INDEX "IX_SalesLeadAttachments_Lead_Latest" ON "SalesLeadAttachments"("SalesLeadId","SerialNo" DESC); CREATE INDEX "IX_SalesLeadAttachments_Tenant" ON "SalesLeadAttachments"("TenantId");
COMMIT;
