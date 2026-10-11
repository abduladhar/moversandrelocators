-- Move-type master, legacy lead migration, and default sales master data for PostgreSQL.
BEGIN;

CREATE TABLE "MoveTypes" (
    "SerialNo" INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Id" UUID NOT NULL UNIQUE,
    "TenantId" UUID NOT NULL REFERENCES "Tenants"("Id"),
    "Code" VARCHAR(40) NOT NULL,
    "Name" VARCHAR(120) NOT NULL,
    "DisplayOrder" INTEGER NOT NULL,
    "Description" VARCHAR(500),
    "IsActive" BOOLEAN NOT NULL,
    "CreatedAtUtc" TIMESTAMPTZ NOT NULL,
    "UpdatedAtUtc" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "UX_MoveTypes_Tenant_Code" UNIQUE ("TenantId","Code")
);

INSERT INTO "LeadStatuses" ("Id","TenantId","Code","Name","DisplayOrder","Color","IsClosed","IsActive","CreatedAtUtc","UpdatedAtUtc")
SELECT (md5(t."Id"::text || ':lead:' || d.code))::uuid, t."Id", d.code, d.name, d.sort, d.color, d.closed, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Tenants" t
CROSS JOIN (VALUES
 ('NEW','New enquiry',10,'#1677ff',FALSE), ('CONTACTED','Contacted',20,'#13c2c2',FALSE),
 ('SURVEY','Survey scheduled',30,'#722ed1',FALSE), ('QUOTED','Quotation sent',40,'#fa8c16',FALSE),
 ('WON','Accepted',50,'#52c41a',TRUE), ('LOST','Rejected',60,'#ff4d4f',TRUE)
) d(code,name,sort,color,closed)
ON CONFLICT ("TenantId","Code") DO NOTHING;

INSERT INTO "FollowUpStatuses" ("Id","TenantId","Code","Name","DisplayOrder","Color","IsCompleted","IsActive","CreatedAtUtc","UpdatedAtUtc")
SELECT (md5(t."Id"::text || ':follow:' || d.code))::uuid, t."Id", d.code, d.name, d.sort, d.color, d.completed, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Tenants" t
CROSS JOIN (VALUES
 ('PLANNED','Planned',10,'#1677ff',FALSE), ('CONTACTED','Contacted',20,'#13c2c2',TRUE),
 ('NO_ANSWER','No answer',30,'#faad14',TRUE), ('RESCHEDULED','Rescheduled',40,'#722ed1',TRUE),
 ('COMPLETED','Completed',50,'#52c41a',TRUE)
) d(code,name,sort,color,completed)
ON CONFLICT ("TenantId","Code") DO NOTHING;

INSERT INTO "MoveTypes" ("Id","TenantId","Code","Name","DisplayOrder","Description","IsActive","CreatedAtUtc","UpdatedAtUtc")
SELECT (md5(t."Id"::text || ':move:' || d.code))::uuid, t."Id", d.code, d.name, d.sort, d.description, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Tenants" t
CROSS JOIN (VALUES
 ('HOUSEHOLD','Household move',10,'Residential household relocation'),
 ('OFFICE','Office move',20,'Office and commercial relocation'),
 ('VEHICLE','Vehicle transport',30,'Car and two-wheeler transportation'),
 ('INTERNATIONAL','International move',40,'International household or office relocation'),
 ('STORAGE','Storage only',50,'Warehouse storage without an immediate move')
) d(code,name,sort,description);

INSERT INTO "MoveTypes" ("Id","TenantId","Code","Name","DisplayOrder","Description","IsActive","CreatedAtUtc","UpdatedAtUtc")
SELECT (md5(x."TenantId"::text || ':legacy:' || x.rn::text))::uuid, x."TenantId", 'LEGACY_' || x.rn, x."MoveType", 100 + x.rn, 'Migrated from an existing sales lead', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT l."TenantId", l."MoveType", DENSE_RANK() OVER (PARTITION BY l."TenantId" ORDER BY l."MoveType") rn
    FROM "SalesLeads" l
) x
WHERE NOT EXISTS (SELECT 1 FROM "MoveTypes" m WHERE m."TenantId"=x."TenantId" AND LOWER(m."Name")=LOWER(x."MoveType"));

ALTER TABLE "SalesLeads" ADD COLUMN "MoveTypeId" UUID;
UPDATE "SalesLeads" l SET "MoveTypeId" = m."Id"
FROM "MoveTypes" m
WHERE m."TenantId"=l."TenantId" AND LOWER(m."Name")=LOWER(l."MoveType");
ALTER TABLE "SalesLeads" ALTER COLUMN "MoveTypeId" SET NOT NULL;
ALTER TABLE "SalesLeads" ADD CONSTRAINT "FK_SalesLeads_MoveTypes" FOREIGN KEY ("MoveTypeId") REFERENCES "MoveTypes"("Id");
ALTER TABLE "SalesLeads" DROP COLUMN "MoveType";

COMMIT;
