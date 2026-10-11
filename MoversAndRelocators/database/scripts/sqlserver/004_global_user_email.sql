-- Enforce one email identity across the entire installation.
-- Resolve any reported duplicates before running this script.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF EXISTS (
    SELECT [NormalizedEmail] FROM [dbo].[Users]
    GROUP BY [NormalizedEmail] HAVING COUNT(*) > 1
)
    THROW 51000, 'Duplicate user emails exist. Resolve them before enabling global email uniqueness.', 1;

IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'UX_Users_Tenant_Email' AND [object_id] = OBJECT_ID(N'dbo.Users'))
    DROP INDEX [UX_Users_Tenant_Email] ON [dbo].[Users];

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'UX_Users_NormalizedEmail' AND [object_id] = OBJECT_ID(N'dbo.Users'))
    CREATE UNIQUE INDEX [UX_Users_NormalizedEmail] ON [dbo].[Users] ([NormalizedEmail]);

COMMIT TRANSACTION;
