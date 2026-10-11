-- Movers & Relocators - Microsoft SQL Server initial schema
-- SerialNo is the database-generated internal sequence.
-- Id is the stable public identifier exposed by the API.

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'[dbo].[Tenants]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Tenants]
    (
        [SerialNo]     INT IDENTITY(1,1) NOT NULL,
        [Id]           UNIQUEIDENTIFIER  NOT NULL,
        [Name]         NVARCHAR(160)     NOT NULL,
        [Slug]         NVARCHAR(80)      NOT NULL,
        [ContactEmail] NVARCHAR(254)     NULL,
        [Phone]        NVARCHAR(40)      NULL,
        [Address]      NVARCHAR(500)     NULL,
        [IsActive]     BIT               NOT NULL CONSTRAINT [DF_Tenants_IsActive] DEFAULT (1),
        [CreatedAtUtc] DATETIMEOFFSET     NOT NULL,
        [UpdatedAtUtc] DATETIMEOFFSET     NOT NULL,
        CONSTRAINT [PK_Tenants] PRIMARY KEY CLUSTERED ([SerialNo]),
        CONSTRAINT [CK_Tenants_Name_Length] CHECK (LEN([Name]) BETWEEN 2 AND 160),
        CONSTRAINT [CK_Tenants_Slug_Length] CHECK (LEN([Slug]) BETWEEN 2 AND 80)
    );

    CREATE UNIQUE INDEX [UX_Tenants_Id] ON [dbo].[Tenants] ([Id]);
    CREATE UNIQUE INDEX [UX_Tenants_Slug] ON [dbo].[Tenants] ([Slug]);
    CREATE INDEX [IX_Tenants_Latest] ON [dbo].[Tenants] ([SerialNo] DESC);
END;

COMMIT TRANSACTION;
