# Movers and Relocators

A separate C# / React project in `C:\Workarea\MoversAndRelocators`, based on the existing Movers modules and extended with labour costing, consolidated transport, customer packing confirmations, custody tracking, claims, cost reports, and a journal ledger.

The application is configured locally for **SQL Server Express** at `LOCALHOST\SQLEXPRESS`, database **MoversRelocatordb**. The supplied connection string is in the ignored local file `backend/src/Movers.Api/appsettings.Development.json`. SQL Server and PostgreSQL share the same business layer and use separate EF Core providers. No SQLite fallback is used in a normal deployment.

## Start on this computer

Run from this project directory:

```powershell
.\Start-Local.ps1
```

After a successful build, subsequent starts can use `.\Start-Local.ps1 -SkipBuild`.

- Application: [localhost:5174](http://localhost:5174)
- API and Swagger: [localhost:5121/swagger](http://localhost:5121/swagger)
- Health: [localhost:5121/health](http://localhost:5121/health)
- Stop only this project's processes: `.\Stop-Local.ps1`
- Logs and process records: `.run/`

The script runs both processes with hidden windows, verifies the API health endpoint, and uses separate ports from the original Movers project. It accepts Node 24–26 and can use this computer's bundled Node 24 runtime. On another machine, install Node 24+, pnpm, and the .NET 10 SDK (the API targets `net10.0`).

Initial local login: **admin@movers.local** / **ChangeMe123!**. This is the bootstrap development account. Create a company on the Tenants screen, then open its workspace. Tenant creation atomically seeds sales statuses, follow-up statuses, move types, household items, materials, box recipes, charges, and example tax definitions. Review example quantities/prices and tax applicability before using them for a real customer; example tax definitions are not selected automatically.

## Manual start

```powershell
dotnet restore Movers.slnx
dotnet run --project backend/src/Movers.Api --launch-profile http
```

In a second terminal with Node 24+:

```powershell
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

## Database selection

Development overrides come from `backend/src/Movers.Api/appsettings.Development.json`. Use the adjacent example when configuring a new installation. Environment variables override JSON configuration:

```powershell
$env:Database__Provider = 'PostgreSql'
$env:ConnectionStrings__PostgreSql = 'Host=localhost;Port=5432;Database=movers_relocators;Username=YOUR_USER;Password=YOUR_PASSWORD'
dotnet run --project backend/src/Movers.Api --launch-profile http
```

For SQL Server use `Database__Provider=SqlServer` and `ConnectionStrings__SqlServer`. Normal startup accepts SQL Server/MSSQL or PostgreSQL/Postgres/Npgsql. SQLite is available only under the Testing environment.

An empty database is initialized from the current EF model on first startup. Complete **fresh-database** DDL scripts are in `database/generated/sqlserver-create.sql` and `postgresql-create.sql`. Do not apply these create scripts over an existing populated database. `EnsureCreated` does not upgrade an existing schema. The numbered scripts under `database/scripts/` were inherited from the original project and stop at its earlier feature set; a production upgrade/migration pipeline remains to be completed.

## Layers

- `Movers.Api`: controllers, authentication, request/response mapping, local/S3 storage adapters and composition.
- `Movers.Services`: all application business rules, workflow checks, costing, allocations, report generation and transaction orchestration.
- `Movers.Domain`: entities inside the business boundary.
- `Movers.DAL`: EF Core SQL Server/PostgreSQL mappings, tenant-scoped repositories and database transactions.

Controllers do not access the database. New multi-record operations use serializable database transactions. Business writes and their required audit rows are saved atomically. UTC normalization supports PostgreSQL timestamp semantics. GUID concurrency tokens protect shared packing lists, trips, claims and report edits.

## Local media

Development uses `Storage:Provider=Local`; private files live under the API's `.data/private/` directory. Customers can upload survey images, videos, recordings and PDFs through lead upload links without an AWS account. Files are accessed through encrypted, expiring upload/download capabilities, not a public static directory. Downloaded files are attachments, and uploaded objects cannot be overwritten.

To use the existing S3 adapter, set `Storage:Provider=S3` and configure tenant AWS settings. Local file data and the credential-encryption key must be backed up alongside the database. Resumable transfer, antivirus quarantine and Azure Blob support are not yet implemented.

## Working modules

- Tenant administration, login, employees/designations, roles and permissions, audit history.
- Sales leads and follow-ups; survey inventory, appointments, customer confirmation and media collection.
- Quotation charges/taxes, customer acceptance/rejection/requote, pickup/packing and labels.
- Named employee/activity hours, unpaid breaks, overtime and snapshotted rates; overlap and replay rejection.
- Trips combining multiple moves, Google Maps directions, odometer-based fuel calculation and exact cost allocation.
- Vendor expenses with duplicate-reference checks; separate labour/material/fuel/vendor cost summaries.
- Customer packing-list confirmation, revocable links, locked shared package lists, warehouse/transit/delivery handovers, partial delivery and claims.
- Saved cost report columns/sort order, cloning, CSV export, browser print/PDF.
- Balanced journal posting, immutable entries, reversal and currency-specific trial balance.

The full product requirements include more than these implemented workflows. See [implementation status and remaining work](docs/IMPLEMENTATION_STATUS.md) before treating this as a production-complete system.

## Verification

```powershell
dotnet test Movers.slnx
cd frontend
pnpm build
```

Opt into live provider integration tests by setting `MOVERS_TEST_SQLSERVER` and/or `MOVERS_TEST_POSTGRESQL` to administrative **test-server** connection strings. The fixture creates random `movers_test_<guid>` databases, exercises the workflow, and deletes only those temporary databases. It never uses the supplied database name for cleanup.

Validation on 2026-10-03: **25 tests passed**, including live SQL Express and an isolated PostgreSQL 18 instance; React TypeScript/production build passed. Browser visual verification could not run because the in-app browser tool repeatedly closed its target.

Original requirements: [plain language](REQUIREMENTS.md) and [structured meta template](REQUIREMENTS_META_TEMPLATE.md).

### Automatic business numbering
Business services assign tenant-scoped daily sequences: LD (lead), SV (survey), QT (quotation), PU (pickup), EMP (employee), TR (trip), TXN (pickup transaction), and PKG (package). Format: PREFIX-YYYYMMDD-000001, using the server UTC date. The database reserves numbers atomically, so parallel requests and multiple server instances do not reuse numbers. Failed or cancelled saves can leave gaps. Existing record numbers are preserved on edits; supplied creation numbers are ignored. Existing package tracking numbers are retained when submitted back with their pickup. Internal serial numbers remain database generated.

Startup provisions the additive number_counters table on SQL Server, PostgreSQL, and the SQLite test provider. Vehicle registration numbers, supplier invoice references, ledger source-document references, and descriptive master codes remain externally assigned fields. Do not reset counters on an existing database.
### AI inventory extraction from lead attachments

In Sales leads, open the attachments and select **Extract items**. Users must be logged in and have `sales.items.extract` (Extract inventory with AI). System and tenant administrators receive this permission; assign it explicitly to other roles. Sign in again after a permission change to refresh the session. If both OpenAI and Claude are configured, choose which one runs in the dialog.

Configure the tenant OpenAI API key and a vision-capable Responses API model supporting structured output in OpenAI settings. With S3 storage, configure tenant AWS credentials and a private bucket. The server creates a ten-minute presigned image download URL; users cannot submit arbitrary remote image URLs to the extraction endpoint. Video is downloaded using the system download link and sampled in the browser into six JPEG frames. Configure bucket CORS to allow GET from the application origin for video sampling (and PUT for uploads). Videos must use a browser-supported codec. Local storage supports image previews as well.

Extraction sends the image or sampled frames to OpenAI and saves item names, estimated quantities, and review notes as an audited draft. It does not confirm packing or automatically change a survey. Sampled video frames can miss items; review every result. API keys remain on the server. Public customer upload links cannot run extraction or receive saved extraction results. No live OpenAI request is made by automated tests.
