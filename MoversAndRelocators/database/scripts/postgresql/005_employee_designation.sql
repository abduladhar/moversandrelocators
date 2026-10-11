-- Employee module: designation master data and reporting hierarchy for PostgreSQL.
BEGIN;

CREATE TABLE "Designations" (
    "SerialNo" INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Id" UUID NOT NULL UNIQUE,
    "TenantId" UUID NOT NULL REFERENCES "Tenants" ("Id"),
    "Code" VARCHAR(40) NOT NULL,
    "Name" VARCHAR(120) NOT NULL,
    "Level" INTEGER NOT NULL CHECK ("Level" >= 1),
    "Description" VARCHAR(500) NULL,
    "IsActive" BOOLEAN NOT NULL,
    "CreatedAtUtc" TIMESTAMPTZ NOT NULL,
    "UpdatedAtUtc" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "UX_Designations_Tenant_Code" UNIQUE ("TenantId", "Code")
);
CREATE INDEX "IX_Designations_Tenant_Latest" ON "Designations" ("TenantId", "SerialNo" DESC);

CREATE TABLE "Employees" (
    "SerialNo" INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Id" UUID NOT NULL UNIQUE,
    "TenantId" UUID NOT NULL REFERENCES "Tenants" ("Id"),
    "EmployeeNumber" VARCHAR(40) NOT NULL,
    "FirstName" VARCHAR(100) NOT NULL,
    "LastName" VARCHAR(100) NOT NULL,
    "WorkEmail" VARCHAR(254) NULL,
    "Phone" VARCHAR(40) NULL,
    "JoiningDate" DATE NOT NULL,
    "DesignationId" UUID NOT NULL REFERENCES "Designations" ("Id"),
    "ReportsToEmployeeId" UUID NULL REFERENCES "Employees" ("Id"),
    "IsActive" BOOLEAN NOT NULL,
    "CreatedAtUtc" TIMESTAMPTZ NOT NULL,
    "UpdatedAtUtc" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "UX_Employees_Tenant_Number" UNIQUE ("TenantId", "EmployeeNumber")
);
CREATE INDEX "IX_Employees_Tenant_Latest" ON "Employees" ("TenantId", "SerialNo" DESC);
CREATE INDEX "IX_Employees_DesignationId" ON "Employees" ("DesignationId");
CREATE INDEX "IX_Employees_ReportsToEmployeeId" ON "Employees" ("ReportsToEmployeeId");

COMMIT;
