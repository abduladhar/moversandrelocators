-- Employee module: designation master data and reporting hierarchy for Microsoft SQL Server.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

CREATE TABLE [dbo].[Designations] (
    [SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_Designations] PRIMARY KEY,
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [TenantId] UNIQUEIDENTIFIER NOT NULL,
    [Code] NVARCHAR(40) NOT NULL,
    [Name] NVARCHAR(120) NOT NULL,
    [Level] INT NOT NULL,
    [Description] NVARCHAR(500) NULL,
    [IsActive] BIT NOT NULL,
    [CreatedAtUtc] DATETIMEOFFSET NOT NULL,
    [UpdatedAtUtc] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [CK_Designations_Level] CHECK ([Level] >= 1),
    CONSTRAINT [FK_Designations_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants] ([Id])
);
CREATE UNIQUE INDEX [UX_Designations_Id] ON [dbo].[Designations] ([Id]);
CREATE UNIQUE INDEX [UX_Designations_Tenant_Code] ON [dbo].[Designations] ([TenantId], [Code]);
CREATE INDEX [IX_Designations_Tenant_Latest] ON [dbo].[Designations] ([TenantId], [SerialNo] DESC);

CREATE TABLE [dbo].[Employees] (
    [SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_Employees] PRIMARY KEY,
    [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [UQ_Employees_Id] UNIQUE,
    [TenantId] UNIQUEIDENTIFIER NOT NULL,
    [EmployeeNumber] NVARCHAR(40) NOT NULL,
    [FirstName] NVARCHAR(100) NOT NULL,
    [LastName] NVARCHAR(100) NOT NULL,
    [WorkEmail] NVARCHAR(254) NULL,
    [Phone] NVARCHAR(40) NULL,
    [JoiningDate] DATE NOT NULL,
    [DesignationId] UNIQUEIDENTIFIER NOT NULL,
    [ReportsToEmployeeId] UNIQUEIDENTIFIER NULL,
    [IsActive] BIT NOT NULL,
    [CreatedAtUtc] DATETIMEOFFSET NOT NULL,
    [UpdatedAtUtc] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [FK_Employees_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants] ([Id]),
    CONSTRAINT [FK_Employees_Designations_DesignationId] FOREIGN KEY ([DesignationId]) REFERENCES [dbo].[Designations] ([Id]),
    CONSTRAINT [FK_Employees_Employees_ReportsToEmployeeId] FOREIGN KEY ([ReportsToEmployeeId]) REFERENCES [dbo].[Employees] ([Id])
);
CREATE UNIQUE INDEX [UX_Employees_Tenant_Number] ON [dbo].[Employees] ([TenantId], [EmployeeNumber]);
CREATE INDEX [IX_Employees_Tenant_Latest] ON [dbo].[Employees] ([TenantId], [SerialNo] DESC);
CREATE INDEX [IX_Employees_DesignationId] ON [dbo].[Employees] ([DesignationId]);
CREATE INDEX [IX_Employees_ReportsToEmployeeId] ON [dbo].[Employees] ([ReportsToEmployeeId]);

COMMIT TRANSACTION;
