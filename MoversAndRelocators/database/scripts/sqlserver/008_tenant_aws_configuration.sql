-- One encrypted AWS credential profile per tenant for Microsoft SQL Server.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

CREATE TABLE [dbo].[TenantAwsConfigurations] (
    [SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_TenantAwsConfigurations] PRIMARY KEY,
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [TenantId] UNIQUEIDENTIFIER NOT NULL,
    [Region] NVARCHAR(60) NOT NULL,
    [EncryptedAccessKey] NVARCHAR(1000) NOT NULL,
    [AccessKeyLastFour] NVARCHAR(4) NOT NULL,
    [EncryptedSecretKey] NVARCHAR(1000) NOT NULL,
    [CreatedAtUtc] DATETIMEOFFSET NOT NULL,
    [UpdatedAtUtc] DATETIMEOFFSET NOT NULL,
    CONSTRAINT [FK_TenantAwsConfigurations_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id])
);

CREATE UNIQUE INDEX [UX_TenantAwsConfigurations_Id] ON [dbo].[TenantAwsConfigurations]([Id]);
CREATE UNIQUE INDEX [UX_TenantAwsConfigurations_Tenant] ON [dbo].[TenantAwsConfigurations]([TenantId]);

COMMIT TRANSACTION;
