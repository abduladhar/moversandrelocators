-- Companies inside a tenant: the Companies table, Users.CompanyId and CompanyId on every company table.
-- Each existing tenant gets a default company (MAIN) that receives all existing records; existing users join it,
-- except tenant administrators, who become tenant users and can switch companies. Masters get an optional CompanyId (empty = shared by all companies).
-- The API also applies this idempotently at startup (CompanySchema). Run with QUOTED_IDENTIFIER ON (sqlcmd -I).
IF OBJECT_ID(N'dbo.Companies', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Companies] ([SerialNo] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_Companies] PRIMARY KEY, [Id] UNIQUEIDENTIFIER NOT NULL, [TenantId] UNIQUEIDENTIFIER NOT NULL,
        [Code] NVARCHAR(20) NOT NULL, [Name] NVARCHAR(160) NOT NULL, [LegalName] NVARCHAR(200) NULL, [TaxNumber] NVARCHAR(40) NULL, [Address] NVARCHAR(500) NULL,
        [Phone] NVARCHAR(40) NULL, [Email] NVARCHAR(254) NULL, [Website] NVARCHAR(200) NULL, [NumberCode] NVARCHAR(10) NULL, [IsDefault] BIT NOT NULL, [IsActive] BIT NOT NULL,
        [CreatedAtUtc] DATETIMEOFFSET NOT NULL, [UpdatedAtUtc] DATETIMEOFFSET NOT NULL,
        CONSTRAINT [FK_Companies_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]));
    CREATE UNIQUE INDEX [IX_Companies_Id] ON [dbo].[Companies]([Id]);
    CREATE UNIQUE INDEX [IX_Companies_TenantId_Code] ON [dbo].[Companies]([TenantId], [Code]);
    CREATE INDEX [IX_Companies_TenantId] ON [dbo].[Companies]([TenantId]);
END
GO
IF COL_LENGTH(N'dbo.Users', N'CompanyId') IS NULL ALTER TABLE [dbo].[Users] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Users_CompanyId' AND object_id = OBJECT_ID(N'dbo.Users')) CREATE INDEX [IX_Users_CompanyId] ON [dbo].[Users]([CompanyId]);
GO
IF COL_LENGTH(N'dbo.AiUsageRecords', N'CompanyId') IS NULL ALTER TABLE [dbo].[AiUsageRecords] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AiUsageRecords_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.AiUsageRecords')) CREATE INDEX [IX_AiUsageRecords_TenantId_CompanyId] ON [dbo].[AiUsageRecords]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.BillingRecords', N'CompanyId') IS NULL ALTER TABLE [dbo].[BillingRecords] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_BillingRecords_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.BillingRecords')) CREATE INDEX [IX_BillingRecords_TenantId_CompanyId] ON [dbo].[BillingRecords]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.DeliveryItems', N'CompanyId') IS NULL ALTER TABLE [dbo].[DeliveryItems] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_DeliveryItems_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.DeliveryItems')) CREATE INDEX [IX_DeliveryItems_TenantId_CompanyId] ON [dbo].[DeliveryItems]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.DeliveryJobCrew', N'CompanyId') IS NULL ALTER TABLE [dbo].[DeliveryJobCrew] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_DeliveryJobCrew_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.DeliveryJobCrew')) CREATE INDEX [IX_DeliveryJobCrew_TenantId_CompanyId] ON [dbo].[DeliveryJobCrew]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.DeliveryJobs', N'CompanyId') IS NULL ALTER TABLE [dbo].[DeliveryJobs] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_DeliveryJobs_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.DeliveryJobs')) CREATE INDEX [IX_DeliveryJobs_TenantId_CompanyId] ON [dbo].[DeliveryJobs]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.DeliveryJobTimeEvents', N'CompanyId') IS NULL ALTER TABLE [dbo].[DeliveryJobTimeEvents] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_DeliveryJobTimeEvents_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.DeliveryJobTimeEvents')) CREATE INDEX [IX_DeliveryJobTimeEvents_TenantId_CompanyId] ON [dbo].[DeliveryJobTimeEvents]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.DeliveryJobTransactions', N'CompanyId') IS NULL ALTER TABLE [dbo].[DeliveryJobTransactions] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_DeliveryJobTransactions_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.DeliveryJobTransactions')) CREATE INDEX [IX_DeliveryJobTransactions_TenantId_CompanyId] ON [dbo].[DeliveryJobTransactions]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.DeliveryNoteLinks', N'CompanyId') IS NULL ALTER TABLE [dbo].[DeliveryNoteLinks] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_DeliveryNoteLinks_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.DeliveryNoteLinks')) CREATE INDEX [IX_DeliveryNoteLinks_TenantId_CompanyId] ON [dbo].[DeliveryNoteLinks]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.DeliveryNotes', N'CompanyId') IS NULL ALTER TABLE [dbo].[DeliveryNotes] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_DeliveryNotes_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.DeliveryNotes')) CREATE INDEX [IX_DeliveryNotes_TenantId_CompanyId] ON [dbo].[DeliveryNotes]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.ExpenseAttachments', N'CompanyId') IS NULL ALTER TABLE [dbo].[ExpenseAttachments] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ExpenseAttachments_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.ExpenseAttachments')) CREATE INDEX [IX_ExpenseAttachments_TenantId_CompanyId] ON [dbo].[ExpenseAttachments]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.JobCargo', N'CompanyId') IS NULL ALTER TABLE [dbo].[JobCargo] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_JobCargo_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.JobCargo')) CREATE INDEX [IX_JobCargo_TenantId_CompanyId] ON [dbo].[JobCargo]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.JobExpenses', N'CompanyId') IS NULL ALTER TABLE [dbo].[JobExpenses] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_JobExpenses_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.JobExpenses')) CREATE INDEX [IX_JobExpenses_TenantId_CompanyId] ON [dbo].[JobExpenses]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.JournalEntries', N'CompanyId') IS NULL ALTER TABLE [dbo].[JournalEntries] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_JournalEntries_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.JournalEntries')) CREATE INDEX [IX_JournalEntries_TenantId_CompanyId] ON [dbo].[JournalEntries]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.JournalLines', N'CompanyId') IS NULL ALTER TABLE [dbo].[JournalLines] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_JournalLines_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.JournalLines')) CREATE INDEX [IX_JournalLines_TenantId_CompanyId] ON [dbo].[JournalLines]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.LabourEntries', N'CompanyId') IS NULL ALTER TABLE [dbo].[LabourEntries] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_LabourEntries_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.LabourEntries')) CREATE INDEX [IX_LabourEntries_TenantId_CompanyId] ON [dbo].[LabourEntries]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.LeadFollowUps', N'CompanyId') IS NULL ALTER TABLE [dbo].[LeadFollowUps] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_LeadFollowUps_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.LeadFollowUps')) CREATE INDEX [IX_LeadFollowUps_TenantId_CompanyId] ON [dbo].[LeadFollowUps]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PackageHandovers', N'CompanyId') IS NULL ALTER TABLE [dbo].[PackageHandovers] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PackageHandovers_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PackageHandovers')) CREATE INDEX [IX_PackageHandovers_TenantId_CompanyId] ON [dbo].[PackageHandovers]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PackingConfirmations', N'CompanyId') IS NULL ALTER TABLE [dbo].[PackingConfirmations] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PackingConfirmations_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PackingConfirmations')) CREATE INDEX [IX_PackingConfirmations_TenantId_CompanyId] ON [dbo].[PackingConfirmations]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PackingJobBoxes', N'CompanyId') IS NULL ALTER TABLE [dbo].[PackingJobBoxes] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PackingJobBoxes_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PackingJobBoxes')) CREATE INDEX [IX_PackingJobBoxes_TenantId_CompanyId] ON [dbo].[PackingJobBoxes]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PackingJobBoxItems', N'CompanyId') IS NULL ALTER TABLE [dbo].[PackingJobBoxItems] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PackingJobBoxItems_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PackingJobBoxItems')) CREATE INDEX [IX_PackingJobBoxItems_TenantId_CompanyId] ON [dbo].[PackingJobBoxItems]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PackingJobBoxMaterials', N'CompanyId') IS NULL ALTER TABLE [dbo].[PackingJobBoxMaterials] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PackingJobBoxMaterials_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PackingJobBoxMaterials')) CREATE INDEX [IX_PackingJobBoxMaterials_TenantId_CompanyId] ON [dbo].[PackingJobBoxMaterials]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PackingJobCrew', N'CompanyId') IS NULL ALTER TABLE [dbo].[PackingJobCrew] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PackingJobCrew_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PackingJobCrew')) CREATE INDEX [IX_PackingJobCrew_TenantId_CompanyId] ON [dbo].[PackingJobCrew]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PackingJobLinks', N'CompanyId') IS NULL ALTER TABLE [dbo].[PackingJobLinks] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PackingJobLinks_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PackingJobLinks')) CREATE INDEX [IX_PackingJobLinks_TenantId_CompanyId] ON [dbo].[PackingJobLinks]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PackingJobMaterials', N'CompanyId') IS NULL ALTER TABLE [dbo].[PackingJobMaterials] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PackingJobMaterials_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PackingJobMaterials')) CREATE INDEX [IX_PackingJobMaterials_TenantId_CompanyId] ON [dbo].[PackingJobMaterials]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PackingJobs', N'CompanyId') IS NULL ALTER TABLE [dbo].[PackingJobs] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PackingJobs_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PackingJobs')) CREATE INDEX [IX_PackingJobs_TenantId_CompanyId] ON [dbo].[PackingJobs]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PackingJobTimeEvents', N'CompanyId') IS NULL ALTER TABLE [dbo].[PackingJobTimeEvents] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PackingJobTimeEvents_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PackingJobTimeEvents')) CREATE INDEX [IX_PackingJobTimeEvents_TenantId_CompanyId] ON [dbo].[PackingJobTimeEvents]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PackingJobTransactions', N'CompanyId') IS NULL ALTER TABLE [dbo].[PackingJobTransactions] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PackingJobTransactions_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PackingJobTransactions')) CREATE INDEX [IX_PackingJobTransactions_TenantId_CompanyId] ON [dbo].[PackingJobTransactions]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PickupAssignments', N'CompanyId') IS NULL ALTER TABLE [dbo].[PickupAssignments] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PickupAssignments_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PickupAssignments')) CREATE INDEX [IX_PickupAssignments_TenantId_CompanyId] ON [dbo].[PickupAssignments]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PickupAttachments', N'CompanyId') IS NULL ALTER TABLE [dbo].[PickupAttachments] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PickupAttachments_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PickupAttachments')) CREATE INDEX [IX_PickupAttachments_TenantId_CompanyId] ON [dbo].[PickupAttachments]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PickupBoxPickEvents', N'CompanyId') IS NULL ALTER TABLE [dbo].[PickupBoxPickEvents] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PickupBoxPickEvents_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PickupBoxPickEvents')) CREATE INDEX [IX_PickupBoxPickEvents_TenantId_CompanyId] ON [dbo].[PickupBoxPickEvents]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PickupBoxPicks', N'CompanyId') IS NULL ALTER TABLE [dbo].[PickupBoxPicks] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PickupBoxPicks_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PickupBoxPicks')) CREATE INDEX [IX_PickupBoxPicks_TenantId_CompanyId] ON [dbo].[PickupBoxPicks]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PickupCollectionApprovals', N'CompanyId') IS NULL ALTER TABLE [dbo].[PickupCollectionApprovals] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PickupCollectionApprovals_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PickupCollectionApprovals')) CREATE INDEX [IX_PickupCollectionApprovals_TenantId_CompanyId] ON [dbo].[PickupCollectionApprovals]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PickupExpenses', N'CompanyId') IS NULL ALTER TABLE [dbo].[PickupExpenses] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PickupExpenses_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PickupExpenses')) CREATE INDEX [IX_PickupExpenses_TenantId_CompanyId] ON [dbo].[PickupExpenses]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PickupMaterialUsages', N'CompanyId') IS NULL ALTER TABLE [dbo].[PickupMaterialUsages] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PickupMaterialUsages_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PickupMaterialUsages')) CREATE INDEX [IX_PickupMaterialUsages_TenantId_CompanyId] ON [dbo].[PickupMaterialUsages]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PickupPackageItems', N'CompanyId') IS NULL ALTER TABLE [dbo].[PickupPackageItems] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PickupPackageItems_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PickupPackageItems')) CREATE INDEX [IX_PickupPackageItems_TenantId_CompanyId] ON [dbo].[PickupPackageItems]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PickupPackages', N'CompanyId') IS NULL ALTER TABLE [dbo].[PickupPackages] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PickupPackages_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PickupPackages')) CREATE INDEX [IX_PickupPackages_TenantId_CompanyId] ON [dbo].[PickupPackages]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PickupPackingJobs', N'CompanyId') IS NULL ALTER TABLE [dbo].[PickupPackingJobs] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PickupPackingJobs_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PickupPackingJobs')) CREATE INDEX [IX_PickupPackingJobs_TenantId_CompanyId] ON [dbo].[PickupPackingJobs]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.Pickups', N'CompanyId') IS NULL ALTER TABLE [dbo].[Pickups] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Pickups_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.Pickups')) CREATE INDEX [IX_Pickups_TenantId_CompanyId] ON [dbo].[Pickups]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PickupSignoffs', N'CompanyId') IS NULL ALTER TABLE [dbo].[PickupSignoffs] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PickupSignoffs_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PickupSignoffs')) CREATE INDEX [IX_PickupSignoffs_TenantId_CompanyId] ON [dbo].[PickupSignoffs]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PickupTimeEvents', N'CompanyId') IS NULL ALTER TABLE [dbo].[PickupTimeEvents] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PickupTimeEvents_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PickupTimeEvents')) CREATE INDEX [IX_PickupTimeEvents_TenantId_CompanyId] ON [dbo].[PickupTimeEvents]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PickupTransactions', N'CompanyId') IS NULL ALTER TABLE [dbo].[PickupTransactions] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PickupTransactions_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PickupTransactions')) CREATE INDEX [IX_PickupTransactions_TenantId_CompanyId] ON [dbo].[PickupTransactions]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.QuotationItems', N'CompanyId') IS NULL ALTER TABLE [dbo].[QuotationItems] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_QuotationItems_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.QuotationItems')) CREATE INDEX [IX_QuotationItems_TenantId_CompanyId] ON [dbo].[QuotationItems]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.QuotationLines', N'CompanyId') IS NULL ALTER TABLE [dbo].[QuotationLines] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_QuotationLines_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.QuotationLines')) CREATE INDEX [IX_QuotationLines_TenantId_CompanyId] ON [dbo].[QuotationLines]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.QuotationLineTaxes', N'CompanyId') IS NULL ALTER TABLE [dbo].[QuotationLineTaxes] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_QuotationLineTaxes_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.QuotationLineTaxes')) CREATE INDEX [IX_QuotationLineTaxes_TenantId_CompanyId] ON [dbo].[QuotationLineTaxes]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.QuotationRequoteRequests', N'CompanyId') IS NULL ALTER TABLE [dbo].[QuotationRequoteRequests] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_QuotationRequoteRequests_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.QuotationRequoteRequests')) CREATE INDEX [IX_QuotationRequoteRequests_TenantId_CompanyId] ON [dbo].[QuotationRequoteRequests]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.Quotations', N'CompanyId') IS NULL ALTER TABLE [dbo].[Quotations] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Quotations_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.Quotations')) CREATE INDEX [IX_Quotations_TenantId_CompanyId] ON [dbo].[Quotations]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.SalesLeadAttachments', N'CompanyId') IS NULL ALTER TABLE [dbo].[SalesLeadAttachments] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SalesLeadAttachments_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.SalesLeadAttachments')) CREATE INDEX [IX_SalesLeadAttachments_TenantId_CompanyId] ON [dbo].[SalesLeadAttachments]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.SalesLeadInventoryItems', N'CompanyId') IS NULL ALTER TABLE [dbo].[SalesLeadInventoryItems] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SalesLeadInventoryItems_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.SalesLeadInventoryItems')) CREATE INDEX [IX_SalesLeadInventoryItems_TenantId_CompanyId] ON [dbo].[SalesLeadInventoryItems]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.SalesLeads', N'CompanyId') IS NULL ALTER TABLE [dbo].[SalesLeads] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SalesLeads_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.SalesLeads')) CREATE INDEX [IX_SalesLeads_TenantId_CompanyId] ON [dbo].[SalesLeads]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.SalesLeadUploadLinks', N'CompanyId') IS NULL ALTER TABLE [dbo].[SalesLeadUploadLinks] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SalesLeadUploadLinks_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.SalesLeadUploadLinks')) CREATE INDEX [IX_SalesLeadUploadLinks_TenantId_CompanyId] ON [dbo].[SalesLeadUploadLinks]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.ShipmentClaims', N'CompanyId') IS NULL ALTER TABLE [dbo].[ShipmentClaims] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ShipmentClaims_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.ShipmentClaims')) CREATE INDEX [IX_ShipmentClaims_TenantId_CompanyId] ON [dbo].[ShipmentClaims]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.SurveyAttachments', N'CompanyId') IS NULL ALTER TABLE [dbo].[SurveyAttachments] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SurveyAttachments_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.SurveyAttachments')) CREATE INDEX [IX_SurveyAttachments_TenantId_CompanyId] ON [dbo].[SurveyAttachments]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.SurveyExpenses', N'CompanyId') IS NULL ALTER TABLE [dbo].[SurveyExpenses] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SurveyExpenses_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.SurveyExpenses')) CREATE INDEX [IX_SurveyExpenses_TenantId_CompanyId] ON [dbo].[SurveyExpenses]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.SurveyExtraMaterials', N'CompanyId') IS NULL ALTER TABLE [dbo].[SurveyExtraMaterials] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SurveyExtraMaterials_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.SurveyExtraMaterials')) CREATE INDEX [IX_SurveyExtraMaterials_TenantId_CompanyId] ON [dbo].[SurveyExtraMaterials]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.SurveyItems', N'CompanyId') IS NULL ALTER TABLE [dbo].[SurveyItems] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SurveyItems_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.SurveyItems')) CREATE INDEX [IX_SurveyItems_TenantId_CompanyId] ON [dbo].[SurveyItems]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.SurveyRooms', N'CompanyId') IS NULL ALTER TABLE [dbo].[SurveyRooms] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SurveyRooms_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.SurveyRooms')) CREATE INDEX [IX_SurveyRooms_TenantId_CompanyId] ON [dbo].[SurveyRooms]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.Surveys', N'CompanyId') IS NULL ALTER TABLE [dbo].[Surveys] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Surveys_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.Surveys')) CREATE INDEX [IX_Surveys_TenantId_CompanyId] ON [dbo].[Surveys]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.SurveyTimeEvents', N'CompanyId') IS NULL ALTER TABLE [dbo].[SurveyTimeEvents] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SurveyTimeEvents_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.SurveyTimeEvents')) CREATE INDEX [IX_SurveyTimeEvents_TenantId_CompanyId] ON [dbo].[SurveyTimeEvents]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.TransportJobs', N'CompanyId') IS NULL ALTER TABLE [dbo].[TransportJobs] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TransportJobs_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.TransportJobs')) CREATE INDEX [IX_TransportJobs_TenantId_CompanyId] ON [dbo].[TransportJobs]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.TransportTrips', N'CompanyId') IS NULL ALTER TABLE [dbo].[TransportTrips] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TransportTrips_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.TransportTrips')) CREATE INDEX [IX_TransportTrips_TenantId_CompanyId] ON [dbo].[TransportTrips]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.TripAllocations', N'CompanyId') IS NULL ALTER TABLE [dbo].[TripAllocations] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TripAllocations_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.TripAllocations')) CREATE INDEX [IX_TripAllocations_TenantId_CompanyId] ON [dbo].[TripAllocations]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.WarehouseAttachments', N'CompanyId') IS NULL ALTER TABLE [dbo].[WarehouseAttachments] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_WarehouseAttachments_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.WarehouseAttachments')) CREATE INDEX [IX_WarehouseAttachments_TenantId_CompanyId] ON [dbo].[WarehouseAttachments]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.WarehouseReceipts', N'CompanyId') IS NULL ALTER TABLE [dbo].[WarehouseReceipts] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_WarehouseReceipts_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.WarehouseReceipts')) CREATE INDEX [IX_WarehouseReceipts_TenantId_CompanyId] ON [dbo].[WarehouseReceipts]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.BoxTypes', N'CompanyId') IS NULL ALTER TABLE [dbo].[BoxTypes] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_BoxTypes_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.BoxTypes')) CREATE INDEX [IX_BoxTypes_TenantId_CompanyId] ON [dbo].[BoxTypes]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.BusinessMasters', N'CompanyId') IS NULL ALTER TABLE [dbo].[BusinessMasters] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_BusinessMasters_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.BusinessMasters')) CREATE INDEX [IX_BusinessMasters_TenantId_CompanyId] ON [dbo].[BusinessMasters]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.ChargeMasters', N'CompanyId') IS NULL ALTER TABLE [dbo].[ChargeMasters] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ChargeMasters_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.ChargeMasters')) CREATE INDEX [IX_ChargeMasters_TenantId_CompanyId] ON [dbo].[ChargeMasters]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.Designations', N'CompanyId') IS NULL ALTER TABLE [dbo].[Designations] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Designations_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.Designations')) CREATE INDEX [IX_Designations_TenantId_CompanyId] ON [dbo].[Designations]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.Employees', N'CompanyId') IS NULL ALTER TABLE [dbo].[Employees] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Employees_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.Employees')) CREATE INDEX [IX_Employees_TenantId_CompanyId] ON [dbo].[Employees]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.FollowUpStatuses', N'CompanyId') IS NULL ALTER TABLE [dbo].[FollowUpStatuses] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_FollowUpStatuses_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.FollowUpStatuses')) CREATE INDEX [IX_FollowUpStatuses_TenantId_CompanyId] ON [dbo].[FollowUpStatuses]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.HouseholdItems', N'CompanyId') IS NULL ALTER TABLE [dbo].[HouseholdItems] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HouseholdItems_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.HouseholdItems')) CREATE INDEX [IX_HouseholdItems_TenantId_CompanyId] ON [dbo].[HouseholdItems]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.LeadStatuses', N'CompanyId') IS NULL ALTER TABLE [dbo].[LeadStatuses] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_LeadStatuses_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.LeadStatuses')) CREATE INDEX [IX_LeadStatuses_TenantId_CompanyId] ON [dbo].[LeadStatuses]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.MoveTypes', N'CompanyId') IS NULL ALTER TABLE [dbo].[MoveTypes] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MoveTypes_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.MoveTypes')) CREATE INDEX [IX_MoveTypes_TenantId_CompanyId] ON [dbo].[MoveTypes]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PackingMaterials', N'CompanyId') IS NULL ALTER TABLE [dbo].[PackingMaterials] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PackingMaterials_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PackingMaterials')) CREATE INDEX [IX_PackingMaterials_TenantId_CompanyId] ON [dbo].[PackingMaterials]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.PickupStatuses', N'CompanyId') IS NULL ALTER TABLE [dbo].[PickupStatuses] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PickupStatuses_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.PickupStatuses')) CREATE INDEX [IX_PickupStatuses_TenantId_CompanyId] ON [dbo].[PickupStatuses]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.TaxMasters', N'CompanyId') IS NULL ALTER TABLE [dbo].[TaxMasters] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TaxMasters_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.TaxMasters')) CREATE INDEX [IX_TaxMasters_TenantId_CompanyId] ON [dbo].[TaxMasters]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.Teams', N'CompanyId') IS NULL ALTER TABLE [dbo].[Teams] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Teams_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.Teams')) CREATE INDEX [IX_Teams_TenantId_CompanyId] ON [dbo].[Teams]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.Vehicles', N'CompanyId') IS NULL ALTER TABLE [dbo].[Vehicles] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Vehicles_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.Vehicles')) CREATE INDEX [IX_Vehicles_TenantId_CompanyId] ON [dbo].[Vehicles]([TenantId], [CompanyId]);
GO
IF COL_LENGTH(N'dbo.Warehouses', N'CompanyId') IS NULL ALTER TABLE [dbo].[Warehouses] ADD [CompanyId] UNIQUEIDENTIFIER NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Warehouses_TenantId_CompanyId' AND object_id = OBJECT_ID(N'dbo.Warehouses')) CREATE INDEX [IX_Warehouses_TenantId_CompanyId] ON [dbo].[Warehouses]([TenantId], [CompanyId]);
GO
-- A default company for every tenant that has none; that tenant's users join it, except tenant administrators.
DECLARE @created TABLE ([TenantId] UNIQUEIDENTIFIER NOT NULL, [CompanyId] UNIQUEIDENTIFIER NOT NULL);
INSERT INTO [dbo].[Companies] ([Id], [TenantId], [Code], [Name], [Address], [Phone], [Email], [IsDefault], [IsActive], [CreatedAtUtc], [UpdatedAtUtc])
OUTPUT inserted.[TenantId], inserted.[Id] INTO @created
SELECT NEWID(), t.[Id], N'MAIN', t.[Name], t.[Address], t.[Phone], t.[ContactEmail], 1, 1, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET()
FROM [dbo].[Tenants] t WHERE NOT EXISTS (SELECT 1 FROM [dbo].[Companies] c WHERE c.[TenantId] = t.[Id]);
UPDATE u SET u.[CompanyId] = n.[CompanyId] FROM [dbo].[Users] u JOIN @created n ON n.[TenantId] = u.[TenantId]
WHERE NOT EXISTS (SELECT 1 FROM [dbo].[UserRoles] ur JOIN [dbo].[Roles] r ON r.[Id] = ur.[RoleId] WHERE ur.[UserId] = u.[Id] AND r.[Code] = N'TENANT_ADMIN');
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[AiUsageRecords] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[BillingRecords] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL AND x.[Kind] NOT IN ('ACCOUNT', 'CASHFLOWMAP', 'CHARGEMAP', 'CURRENCY', 'FXRATE', 'FXSETTINGS', 'REPORT_HISTORY_V2', 'REPORT_TEMPLATE_V2', 'REPORT_TEMPLATE_V2_DELETED');
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[DeliveryItems] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[DeliveryJobCrew] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[DeliveryJobs] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[DeliveryJobTimeEvents] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[DeliveryJobTransactions] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[DeliveryNoteLinks] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[DeliveryNotes] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[ExpenseAttachments] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[JobCargo] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[JobExpenses] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[JournalEntries] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[JournalLines] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[LabourEntries] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[LeadFollowUps] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PackageHandovers] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PackingConfirmations] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PackingJobBoxes] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PackingJobBoxItems] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PackingJobBoxMaterials] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PackingJobCrew] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PackingJobLinks] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PackingJobMaterials] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PackingJobs] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PackingJobTimeEvents] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PackingJobTransactions] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PickupAssignments] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PickupAttachments] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PickupBoxPickEvents] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PickupBoxPicks] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PickupCollectionApprovals] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PickupExpenses] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PickupMaterialUsages] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PickupPackageItems] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PickupPackages] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PickupPackingJobs] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[Pickups] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PickupSignoffs] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PickupTimeEvents] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[PickupTransactions] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[QuotationItems] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[QuotationLines] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[QuotationLineTaxes] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[QuotationRequoteRequests] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[Quotations] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[SalesLeadAttachments] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[SalesLeadInventoryItems] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[SalesLeads] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[SalesLeadUploadLinks] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[ShipmentClaims] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[SurveyAttachments] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[SurveyExpenses] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[SurveyExtraMaterials] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[SurveyItems] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[SurveyRooms] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[Surveys] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[SurveyTimeEvents] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[TransportJobs] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[TransportTrips] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[TripAllocations] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[WarehouseAttachments] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
UPDATE x SET x.[CompanyId] = c.[Id] FROM [dbo].[WarehouseReceipts] x JOIN [dbo].[Companies] c ON c.[TenantId] = x.[TenantId] AND c.[IsDefault] = 1
WHERE x.[CompanyId] IS NULL;
GO
