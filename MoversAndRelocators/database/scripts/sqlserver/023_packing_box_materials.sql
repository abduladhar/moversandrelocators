-- Per-box packing materials (actual usage overriding the box type recipe).
IF COL_LENGTH(N'dbo.PackingJobBoxes', N'CustomMaterials') IS NULL
    ALTER TABLE [dbo].[PackingJobBoxes] ADD [CustomMaterials] BIT NOT NULL CONSTRAINT [DF_PackingJobBoxes_CustomMaterials] DEFAULT 0;
IF OBJECT_ID(N'dbo.PackingJobBoxMaterials', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PackingJobBoxMaterials] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PackingJobBoxMaterials] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL, [PackingJobBoxId] UNIQUEIDENTIFIER NOT NULL, [MaterialId] UNIQUEIDENTIFIER NOT NULL, [Quantity] DECIMAL(12,3) NOT NULL,
        CONSTRAINT [FK_PackingJobBoxMaterials_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]), CONSTRAINT [FK_PackingJobBoxMaterials_PackingJobBoxes] FOREIGN KEY ([PackingJobBoxId]) REFERENCES [dbo].[PackingJobBoxes]([Id]) ON DELETE CASCADE, CONSTRAINT [FK_PackingJobBoxMaterials_PackingMaterials] FOREIGN KEY ([MaterialId]) REFERENCES [dbo].[PackingMaterials]([Id]));
    CREATE UNIQUE INDEX [IX_PackingJobBoxMaterials_Id] ON [dbo].[PackingJobBoxMaterials]([Id]);
    CREATE INDEX [IX_PackingJobBoxMaterials_PackingJobBoxId] ON [dbo].[PackingJobBoxMaterials]([PackingJobBoxId]);
    CREATE INDEX [IX_PackingJobBoxMaterials_TenantId] ON [dbo].[PackingJobBoxMaterials]([TenantId]);
END
