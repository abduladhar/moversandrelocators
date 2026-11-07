-- My Tasks history: an index to read one record's audit history quickly.
-- The API also applies this at startup (AuditHistorySchema). Run after 040.
CREATE INDEX IF NOT EXISTS "IX_AuditLogs_TenantId_EntityType_EntityId" ON "AuditLogs"("TenantId", "EntityType", "EntityId");
