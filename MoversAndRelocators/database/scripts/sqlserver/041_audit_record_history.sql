-- My Tasks history: an index to read one record's audit history quickly.
-- The API also applies this at startup (AuditHistorySchema). Run after 040.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AuditLogs_TenantId_EntityType_EntityId' AND object_id = OBJECT_ID(N'dbo.AuditLogs'))
    CREATE INDEX [IX_AuditLogs_TenantId_EntityType_EntityId] ON [dbo].[AuditLogs]([TenantId], [EntityType], [EntityId]);
