-- Module 2: users, roles, permissions and audit trail for Microsoft SQL Server.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

CREATE TABLE [dbo].[Users] (
    [SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_Users] PRIMARY KEY,
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [TenantId] UNIQUEIDENTIFIER NULL,
    [FullName] NVARCHAR(160) NOT NULL,
    [Email] NVARCHAR(254) NOT NULL,
    [NormalizedEmail] NVARCHAR(254) NOT NULL,
    [PasswordHash] NVARCHAR(600) NOT NULL,
    [IsActive] BIT NOT NULL,
    [LastLoginAtUtc] DATETIMEOFFSET NULL,
    [CreatedAtUtc] DATETIMEOFFSET NOT NULL,
    [UpdatedAtUtc] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [FK_Users_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants] ([Id])
);
CREATE UNIQUE INDEX [UX_Users_Id] ON [dbo].[Users] ([Id]);
CREATE UNIQUE INDEX [UX_Users_NormalizedEmail] ON [dbo].[Users] ([NormalizedEmail]);

CREATE TABLE [dbo].[Roles] (
    [SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_Roles] PRIMARY KEY,
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [TenantId] UNIQUEIDENTIFIER NULL,
    [Name] NVARCHAR(120) NOT NULL,
    [Code] NVARCHAR(80) NOT NULL,
    [IsSystemRole] BIT NOT NULL,
    [CreatedAtUtc] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [FK_Roles_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants] ([Id])
);
CREATE UNIQUE INDEX [UX_Roles_Id] ON [dbo].[Roles] ([Id]);
CREATE UNIQUE INDEX [UX_Roles_Tenant_Code] ON [dbo].[Roles] ([TenantId], [Code]);

CREATE TABLE [dbo].[Permissions] (
    [SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_Permissions] PRIMARY KEY,
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [Code] NVARCHAR(120) NOT NULL,
    [Name] NVARCHAR(160) NOT NULL,
    [Module] NVARCHAR(80) NOT NULL
);
CREATE UNIQUE INDEX [UX_Permissions_Id] ON [dbo].[Permissions] ([Id]);
CREATE UNIQUE INDEX [UX_Permissions_Code] ON [dbo].[Permissions] ([Code]);

CREATE TABLE [dbo].[UserRoles] (
    [SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_UserRoles] PRIMARY KEY,
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [UserId] UNIQUEIDENTIFIER NOT NULL,
    [RoleId] UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT [FK_UserRoles_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_UserRoles_Roles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [dbo].[Roles] ([Id]) ON DELETE CASCADE
);
CREATE UNIQUE INDEX [UX_UserRoles_Id] ON [dbo].[UserRoles] ([Id]);
CREATE UNIQUE INDEX [UX_UserRoles_User_Role] ON [dbo].[UserRoles] ([UserId], [RoleId]);

CREATE TABLE [dbo].[RolePermissions] (
    [SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_RolePermissions] PRIMARY KEY,
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [RoleId] UNIQUEIDENTIFIER NOT NULL,
    [PermissionId] UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT [FK_RolePermissions_Roles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [dbo].[Roles] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_RolePermissions_Permissions_PermissionId] FOREIGN KEY ([PermissionId]) REFERENCES [dbo].[Permissions] ([Id]) ON DELETE CASCADE
);
CREATE UNIQUE INDEX [UX_RolePermissions_Id] ON [dbo].[RolePermissions] ([Id]);
CREATE UNIQUE INDEX [UX_RolePermissions_Role_Permission] ON [dbo].[RolePermissions] ([RoleId], [PermissionId]);

CREATE TABLE [dbo].[AuditLogs] (
    [SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_AuditLogs] PRIMARY KEY,
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [TenantId] UNIQUEIDENTIFIER NULL,
    [ActorUserId] UNIQUEIDENTIFIER NULL,
    [ActorEmail] NVARCHAR(254) NOT NULL,
    [Action] NVARCHAR(30) NOT NULL,
    [EntityType] NVARCHAR(120) NOT NULL,
    [EntityId] NVARCHAR(80) NULL,
    [Changes] NVARCHAR(MAX) NOT NULL,
    [IpAddress] NVARCHAR(64) NULL,
    [CreatedAtUtc] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [FK_AuditLogs_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants] ([Id]),
    CONSTRAINT [FK_AuditLogs_Users_ActorUserId] FOREIGN KEY ([ActorUserId]) REFERENCES [dbo].[Users] ([Id])
);
CREATE UNIQUE INDEX [UX_AuditLogs_Id] ON [dbo].[AuditLogs] ([Id]);
CREATE INDEX [IX_AuditLogs_Tenant_Latest] ON [dbo].[AuditLogs] ([TenantId], [SerialNo] DESC);

COMMIT TRANSACTION;
