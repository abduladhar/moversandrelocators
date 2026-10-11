-- Crew scheduling: supervisor replaces the team leader, and pickups and packing jobs carry a duration.
ALTER TABLE "Teams" ADD COLUMN IF NOT EXISTS "SupervisorEmployeeId" uuid NULL REFERENCES "Employees"("Id");
ALTER TABLE "Pickups" ADD COLUMN IF NOT EXISTS "DurationMinutes" integer NOT NULL DEFAULT 240;
ALTER TABLE "PackingJobs" ADD COLUMN IF NOT EXISTS "DurationMinutes" integer NOT NULL DEFAULT 240;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Teams' AND column_name = 'LeaderEmployeeId') THEN
        UPDATE "Teams" SET "SupervisorEmployeeId" = "LeaderEmployeeId" WHERE "SupervisorEmployeeId" IS NULL AND "LeaderEmployeeId" IS NOT NULL;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS "IX_Pickups_Scheduled" ON "Pickups"("TenantId","ScheduledAtUtc");
CREATE INDEX IF NOT EXISTS "IX_PackingJobs_Scheduled" ON "PackingJobs"("TenantId","ScheduledAtUtc");
