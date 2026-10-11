-- Survey attachments and customer inventory change requests. PostgreSQL equivalent of SQL Server script 019.
BEGIN;
ALTER TABLE "Surveys" ADD COLUMN IF NOT EXISTS "CustomerChangeRequestJson" TEXT NULL;
ALTER TABLE "Surveys" ADD COLUMN IF NOT EXISTS "CustomerChangeRequestedAtUtc" TIMESTAMPTZ NULL;
CREATE TABLE IF NOT EXISTS "SurveyAttachments"("SerialNo" INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,"Id" UUID NOT NULL UNIQUE,"TenantId" UUID NOT NULL REFERENCES "Tenants"("Id"),"SurveyId" UUID NOT NULL REFERENCES "Surveys"("Id") ON DELETE CASCADE,"Source" VARCHAR(20) NOT NULL,"UploadedBy" VARCHAR(160) NOT NULL,"OriginalFileName" VARCHAR(255) NOT NULL,"ContentType" VARCHAR(150) NOT NULL,"DeclaredSizeBytes" BIGINT NOT NULL,"StoredSizeBytes" BIGINT NULL,"S3ObjectKey" VARCHAR(700) NOT NULL,"IsUploaded" BOOLEAN NOT NULL,"CreatedAtUtc" TIMESTAMPTZ NOT NULL,"UploadedAtUtc" TIMESTAMPTZ NULL);
CREATE INDEX IF NOT EXISTS "IX_SurveyAttachments_SurveyId_SerialNo" ON "SurveyAttachments"("SurveyId","SerialNo");
CREATE INDEX IF NOT EXISTS "IX_SurveyAttachments_TenantId" ON "SurveyAttachments"("TenantId");
COMMIT;
