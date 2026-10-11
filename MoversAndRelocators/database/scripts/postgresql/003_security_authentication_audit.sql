-- Module 2: users, roles, permissions and audit trail for PostgreSQL.
BEGIN;

CREATE TABLE "Users" (
    "SerialNo" INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Id" UUID NOT NULL UNIQUE,
    "TenantId" UUID NULL REFERENCES "Tenants" ("Id"),
    "FullName" VARCHAR(160) NOT NULL,
    "Email" VARCHAR(254) NOT NULL,
    "NormalizedEmail" VARCHAR(254) NOT NULL,
    "PasswordHash" VARCHAR(600) NOT NULL,
    "IsActive" BOOLEAN NOT NULL,
    "LastLoginAtUtc" TIMESTAMPTZ NULL,
    "CreatedAtUtc" TIMESTAMPTZ NOT NULL,
    "UpdatedAtUtc" TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX "UX_Users_NormalizedEmail" ON "Users" ("NormalizedEmail");

CREATE TABLE "Roles" (
    "SerialNo" INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Id" UUID NOT NULL UNIQUE,
    "TenantId" UUID NULL REFERENCES "Tenants" ("Id"),
    "Name" VARCHAR(120) NOT NULL,
    "Code" VARCHAR(80) NOT NULL,
    "IsSystemRole" BOOLEAN NOT NULL,
    "CreatedAtUtc" TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX "UX_Roles_Tenant_Code" ON "Roles" ("TenantId", "Code");

CREATE TABLE "Permissions" (
    "SerialNo" INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Id" UUID NOT NULL UNIQUE,
    "Code" VARCHAR(120) NOT NULL UNIQUE,
    "Name" VARCHAR(160) NOT NULL,
    "Module" VARCHAR(80) NOT NULL
);

CREATE TABLE "UserRoles" (
    "SerialNo" INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Id" UUID NOT NULL UNIQUE,
    "UserId" UUID NOT NULL REFERENCES "Users" ("Id") ON DELETE CASCADE,
    "RoleId" UUID NOT NULL REFERENCES "Roles" ("Id") ON DELETE CASCADE,
    CONSTRAINT "UX_UserRoles_User_Role" UNIQUE ("UserId", "RoleId")
);

CREATE TABLE "RolePermissions" (
    "SerialNo" INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Id" UUID NOT NULL UNIQUE,
    "RoleId" UUID NOT NULL REFERENCES "Roles" ("Id") ON DELETE CASCADE,
    "PermissionId" UUID NOT NULL REFERENCES "Permissions" ("Id") ON DELETE CASCADE,
    CONSTRAINT "UX_RolePermissions_Role_Permission" UNIQUE ("RoleId", "PermissionId")
);

CREATE TABLE "AuditLogs" (
    "SerialNo" INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Id" UUID NOT NULL UNIQUE,
    "TenantId" UUID NULL REFERENCES "Tenants" ("Id"),
    "ActorUserId" UUID NULL REFERENCES "Users" ("Id"),
    "ActorEmail" VARCHAR(254) NOT NULL,
    "Action" VARCHAR(30) NOT NULL,
    "EntityType" VARCHAR(120) NOT NULL,
    "EntityId" VARCHAR(80) NULL,
    "Changes" TEXT NOT NULL,
    "IpAddress" VARCHAR(64) NULL,
    "CreatedAtUtc" TIMESTAMPTZ NOT NULL
);
CREATE INDEX "IX_AuditLogs_Tenant_Latest" ON "AuditLogs" ("TenantId", "SerialNo" DESC);

COMMIT;
