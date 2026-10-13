# Implemented Features

This document describes functionality currently implemented in the repository. Planned functionality is kept separately in `IMPLEMENTATION_PLAN.md`.

## 1. Layered server architecture

The ASP.NET Core server is divided into four projects:

| Project | Responsibility |
| --- | --- |
| `Movers.Api` | HTTP controllers, middleware, request validation, Swagger, CORS, and dependency composition |
| `Movers.Services` | Application use cases, business orchestration, service contracts, repository abstractions, and tenant context |
| `Movers.DAL` | EF Core context, SQLite configuration, repositories, database initialization, query filters, and write guards |
| `Movers.Domain` | Domain entities, identity foundation, tenant-owned entity foundation, and entity behavior |

Controllers do not access EF Core or repositories. They call `ITenantService`. The DAL implements `ITenantRepository`, keeping persistence details outside the controller and service use cases.

## 2. Common table identity

Every persisted domain entity inherits `Entity` and receives:

- `SerialNo`: database-generated integer sequence and internal primary key.
- `Id`: unique GUID used as the public API identifier.

This convention is applied automatically by `MoversDbContext`. Tenant-owned entities additionally inherit `TenantOwnedEntity`, which adds the required `TenantId`.

Lists use `SerialNo DESC`, so the most recently inserted row appears first without depending on clocks or editable timestamps. The application never calculates serial numbers with `MAX + 1`; generation is delegated to the database for concurrency safety.

## 3. Tenant administration

Platform administrators can:

- List tenants, newest first.
- Retrieve one tenant by public GUID.
- Create a tenant.
- Edit company name, workspace slug, email, phone, and address.
- Activate or deactivate a tenant without deleting its history.
- See the generated serial number in API responses and the React directory.

Tenant slugs are normalized to lowercase and must be unique. Optional text values are trimmed and blank values are stored as null.

### Endpoints

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/health` | API health response |
| `GET` | `/api/platform/tenants` | List tenants by descending serial number |
| `GET` | `/api/platform/tenants/{id}` | Get a tenant by GUID |
| `POST` | `/api/platform/tenants` | Create a tenant |
| `PUT` | `/api/platform/tenants/{id}` | Update a tenant |
| `PATCH` | `/api/platform/tenants/{id}/status` | Activate or deactivate a tenant |
| `GET` | `/api/tenant/current` | Return the active request tenant |

Platform routes are bootstrap endpoints until authentication and permissions are implemented in Module 2.

## 4. Tenant request resolution

Tenant-scoped requests derive tenant identity from validated JWT claims. Tenant administrators receive a fixed `tenant_id`; system administrators receive an `acting_tenant_id` after selecting a tenant. Missing, unknown, or inactive tenant selections receive HTTP `400` with the `tenant_required` error. Platform administration, authentication, Swagger, and health routes are tenant-neutral.

## 5. Tenant data isolation

The DAL automatically applies a tenant query filter to every entity implementing `ITenantOwned`. Before saving, it rejects:

- Tenant-owned writes when no tenant has been resolved.
- Inserts, updates, or deletes whose `TenantId` differs from the current request tenant.

This creates a second isolation boundary below controllers and services.

## 6. Validation and errors

- Company names and slugs require 2–160 and 2–80 characters respectively.
- Slugs accept alphanumeric segments separated by single hyphens.
- Contact email uses email validation.
- Phone and address lengths are bounded.
- Duplicate slugs return an ASP.NET validation problem response.
- Unknown tenant GUIDs return `404` from resource endpoints.

## 7. React administration client

The React/TypeScript client provides:

- Tenant totals and active/inactive counts.
- Create and edit form with browser-side validation.
- Tenant directory ordered newest first.
- Visible serial number for each tenant.
- Activate/deactivate actions.
- Loading, empty, saving, and API-error states.
- Responsive desktop and mobile layout.

## 8. Database scripts

- `database/scripts/sqlserver/001_initial_schema.sql` creates the Microsoft SQL Server schema.
- `database/scripts/postgresql/001_initial_schema.sql` creates the PostgreSQL schema.
- The `002_upgrade_existing_tenants_add_serial_no.sql` script under each provider upgrades a database created before serial numbers were introduced.
- SQLite scripts are retained for the isolated automated-test database.

All provider scripts use database-generated integer identities and unique indexes for public GUIDs and tenant slugs.

## 9. Runtime database provider selection

The API selects its EF Core provider during application startup using `Database:Provider` in `appsettings.json`:

- `SqlServer` loads `ConnectionStrings:SqlServer` and configures `UseSqlServer`.
- `PostgreSql` loads `ConnectionStrings:PostgreSql` and configures `UseNpgsql`.

Aliases such as `MSSQL`, `Postgres`, and `Npgsql` are accepted. Unsupported providers fail immediately with a configuration error instead of silently using another database. SQLite can only be selected while the application environment is `Testing`.

## 10. Automated verification

The test suite covers:

- Domain normalization and tenant status behavior.
- Service-layer duplicate-slug rejection and repository persistence.
- Tenant creation and resolution through the API.
- Duplicate API requests.
- Inactive tenant rejection.
- Missing tenant selection and anonymous access rejection.
- Database-generated serial numbers and newest-first ordering.
- SQL Server and PostgreSQL EF Core provider selection.
- Designation and employee reporting-hierarchy rules through the API.

## 11. Authentication

- JWT bearer authentication with issuer, audience, signing-key, and expiration validation.
- Passwords use random salts and PBKDF2-SHA256 with 120,000 iterations; plaintext passwords are never stored.
- Inactive users cannot authenticate.
- Login requires only a globally unique email address and password.
- System administrators sign in at platform level and must select a tenant before entering tenant data.
- Tenant administrators enter their assigned tenant automatically after authentication.
- `GET /api/auth/me` returns the authenticated identity, roles, permissions, and active tenant.

The bootstrap system administrator is created only if it does not already exist. Its email and initial password come from the `Bootstrap` settings. Production deployments must override the password using `Bootstrap__SystemAdminPassword` and override `Jwt__SigningKey` with secrets.

## 12. Authorization and tenant isolation

Two default roles are seeded automatically:

| Role | Scope | Access |
| --- | --- | --- |
| System administrator | Global | Tenant administration and every module permission; may select an active tenant for support or investigation |
| Tenant administrator | One tenant | Every operational and security permission inside that tenant, but no platform tenant management |

System administrators select a tenant through `POST /api/auth/select-tenant`. The API issues a new signed token containing the acting tenant. Tenant administrators receive a token permanently bound to their own tenant. Tenant scope is derived from validated claims rather than request headers, preventing users from changing tenant identity manually.

Permission policies currently cover platform tenants, users, roles, audit, sales, surveys, quotations, operations, warehouse, transportation, delivery, accounting, and incentives.

## 13. User, role, and permission administration

- List tenant users newest first.
- Create a tenant user and assign an available role.
- Activate or deactivate a user without deleting history.
- List the default tenant-administrator role and tenant-specific custom roles.
- Create custom roles from granular module permissions.
- System-administrator roles cannot be assigned to tenant users.
- Duplicate email addresses are rejected across the entire system, including across different tenants.

Security endpoints require the matching `security.*` permission claim.

## 14. Automatic audit trail

Every EF Core entity insert, update, or delete automatically creates an append-only `AuditLogs` record containing:

- Tenant and acting user identifiers.
- Actor email and source IP address.
- Entity type and public entity ID.
- Action type and UTC timestamp.
- JSON old/new values or inserted/deleted values.

Password hashes are explicitly excluded from audit payloads. Audit queries are tenant-scoped and ordered newest first. System-administrator changes made while investigating a tenant retain the administrator’s global identity in that tenant’s audit history.

## 15. Security administration client

The responsive React client now includes:

- Professional secure-login screen with optional workspace entry for system administrators.
- Active-workspace and signed-in-user indicators.
- System-administrator tenant selection.
- Tenant user directory, creation, role assignment, and activation controls.
- Default/custom role cards and grouped permission selection.
- Expandable audit timeline with actor and changed-value details.
- Protected navigation that disables tenant modules until a system administrator selects a tenant.
- Node.js 26 runtime contract with Node 26.9.0 version-manager pins and the Vite 8 build toolchain.

## 16. Security database scripts

For a clean manually provisioned database, run `001_initial_schema.sql` followed by `003_security_authentication_audit.sql` for the selected provider. For a database created before serial numbers existed, run `002_upgrade_existing_tenants_add_serial_no.sql` before script `003`. Databases already using the earlier per-tenant email index must also run `004_global_user_email.sql`.

## 17. Designation master

Tenant administrators can create, edit, activate, and deactivate designations. Each designation has a tenant-unique code, display name, description, and numeric reporting level. Level `1` is the highest organizational level; larger numbers represent lower levels. Designations and all status changes are tenant-scoped and automatically audited.

| Method | Route | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/api/designations` | `employees.view` | List designations newest first |
| `POST` | `/api/designations` | `designations.manage` | Create a designation |
| `PUT` | `/api/designations/{id}` | `designations.manage` | Update a designation |
| `PATCH` | `/api/designations/{id}/status` | `designations.manage` | Activate or deactivate a designation |

## 18. Employee directory and reporting hierarchy

Employee records contain employee number, first and last name, work email, phone, joining date, designation, reporting manager, and active status. Employee numbers are normalized to uppercase and unique inside a tenant. Lists use descending serial number so the latest employee appears first.

Reporting relationships enforce these rules in the service layer:

- The designation and reporting manager must belong to the active tenant.
- New employees can only use active designations and active managers.
- A manager must have a numerically lower designation level than the employee.
- An employee cannot report to themselves.
- Changes cannot create a circular reporting chain.

| Method | Route | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/api/employees` | `employees.view` | List employees newest first |
| `GET` | `/api/employees/{id}` | `employees.view` | Retrieve one employee |
| `GET` | `/api/employees/hierarchy` | `employees.view` | Return the nested reporting tree |
| `POST` | `/api/employees` | `employees.manage` | Create an employee |
| `PUT` | `/api/employees/{id}` | `employees.manage` | Update an employee |
| `PATCH` | `/api/employees/{id}/status` | `employees.manage` | Activate or deactivate an employee |

The responsive client provides separate Designations and Employees areas, manager choices filtered to higher levels, status controls, newest-first directories, and a switchable visual reporting hierarchy.

The client uses Ant Design for a consistent professional interface. Each module is implemented in a separate page file rather than inside `App.tsx`. Advanced search opens from the page action bar in a focused filter dialog, and every select control supports option filtering. Filters and sorting are applied to the complete result set before scroll pagination: desktop users can sort from column headers and filter from column menus, while the search dialog exposes equivalent sort-field and direction controls for responsive tiles. Wide desktop record lists use compact, full-width tables whose cells wrap to use the available screen width; horizontal overflow is exposed only when fixed content cannot fit. Tablet, mobile, and small-desktop layouts automatically use responsive record tiles. Create and edit workflows use validated modal forms. The navigation sidebar can be minimized to an icon rail on desktop and hidden on small screens to maximize working space.

## 19. Employee database scripts

Run `005_employee_designation.sql` for the database provider selected in `appsettings.json` after the earlier scripts. The SQL Server and PostgreSQL versions create `Designations` and `Employees`, including database-generated integer serial numbers, public GUIDs, tenant-aware unique keys, reporting foreign keys, and newest-first indexes. On startup, the seeder adds the new employee permissions to both default administrator roles; administrators should sign in again to receive refreshed permission claims.

## 20. Sales status and move-type masters

Each tenant maintains independent lead-status, follow-up-status, and move-type lists. Status masters contain a tenant-unique normalized code, display name, display order, color, and active state. Lead statuses can be marked as closed, while follow-up statuses can be marked as completed. Move types contain a code, name, display order, description, and active state. Inactive master values remain visible for historical records but cannot be selected for new or edited activity.

| Method | Route | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/api/sales/statuses/leads` | `sales.view` | List lead statuses newest first |
| `POST` | `/api/sales/statuses/leads` | `sales.statuses.manage` | Create a lead status |
| `PUT` | `/api/sales/statuses/leads/{id}` | `sales.statuses.manage` | Edit a lead status |
| `PATCH` | `/api/sales/statuses/leads/{id}/status` | `sales.statuses.manage` | Activate or deactivate a lead status |
| `GET` | `/api/sales/statuses/follow-ups` | `sales.view` | List follow-up statuses newest first |
| `POST` | `/api/sales/statuses/follow-ups` | `sales.statuses.manage` | Create a follow-up status |
| `PUT` | `/api/sales/statuses/follow-ups/{id}` | `sales.statuses.manage` | Edit a follow-up status |
| `PATCH` | `/api/sales/statuses/follow-ups/{id}/status` | `sales.statuses.manage` | Activate or deactivate a follow-up status |
| `GET` | `/api/sales/statuses/move-types` | `sales.view` | List move types newest first |
| `POST` | `/api/sales/statuses/move-types` | `sales.statuses.manage` | Create a move type |
| `PUT` | `/api/sales/statuses/move-types/{id}` | `sales.statuses.manage` | Edit a move type |
| `PATCH` | `/api/sales/statuses/move-types/{id}/status` | `sales.statuses.manage` | Activate or deactivate a move type |

New tenants receive usable starter data automatically:

- Lead statuses: New enquiry, Contacted, Survey scheduled, Quotation sent, Accepted, and Rejected.
- Follow-up statuses: Planned, Contacted, No answer, Rescheduled, and Completed.
- Move types: Household move, Office move, Vehicle transport, International move, and Storage only.

All starter records are ordinary tenant-owned master data: administrators may rename, reorder, recolor, deactivate, or extend them.

## 21. Sales leads and follow-ups

Sales leads include a tenant-unique lead number, customer name, phone, email, source, move type, origin, destination, expected move date, status, optional assigned employee, notes, and active state. Lead numbers are normalized to uppercase. Move type is a required foreign-key relationship rather than free text. New and edited leads require an active lead status and active move type; assigned sales employees must also be active. Every master, lead, and follow-up is tenant-filtered by the DAL and automatically audited.

Follow-ups record the scheduled UTC date/time, follow-up status, activity notes, and optional next follow-up UTC date/time. They are shown newest first using the database-generated integer serial number.

| Method | Route | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/api/sales/leads` | `sales.view` | List sales leads newest first |
| `POST` | `/api/sales/leads` | `sales.manage` | Create a sales lead |
| `PUT` | `/api/sales/leads/{id}` | `sales.manage` | Edit a sales lead |
| `PATCH` | `/api/sales/leads/{id}/status` | `sales.manage` | Activate or deactivate a sales lead |
| `GET` | `/api/sales/leads/{leadId}/follow-ups` | `sales.view` | List a lead's follow-ups newest first |
| `POST` | `/api/sales/leads/{leadId}/follow-ups` | `sales.manage` | Add a follow-up |
| `PUT` | `/api/sales/leads/follow-ups/{id}` | `sales.manage` | Edit a follow-up |

The React client provides separate **Sales leads** and **Sales statuses** pages. The sales-master page contains Lead statuses, Follow-up statuses, and Move types tabs. Both pages support advanced search, filtering, sorting, scroll pagination, responsive table/tile presentation, and modal editing. The lead form uses a searchable move-type selector, the lead filter dialog can filter and sort by move type, and the activity dialog supports creating and editing follow-ups without leaving the lead directory.

## 22. Sales database scripts

Run `006_sales_leads_followups.sql` for the configured SQL Server or PostgreSQL provider after scripts `001` through `005`. It creates `LeadStatuses`, `FollowUpStatuses`, `SalesLeads`, and `LeadFollowUps`, with database-generated integer serial numbers, public GUIDs, tenant-aware unique indexes, relationship constraints, and newest-first lookup indexes. On startup, the seeder adds `sales.view`, `sales.manage`, and `sales.statuses.manage` to both default administrator roles; users must sign in again for existing JWT claims to include newly seeded permissions.

After script `006`, run `007_move_type_master_and_sales_defaults.sql`. It creates `MoveTypes`, inserts any missing starter status and move-type records for existing tenants, migrates existing lead move-type text without data loss, and replaces the text column with the required `MoveTypeId` foreign key. Newly registered tenants receive the same defaults from the service layer.

## 23. My Tasks dashboard

After entering a tenant, users land on **My Tasks** instead of a module directory. `GET /api/tasks/mine` gathers overdue and due-today work assigned to the authenticated user. The client sends its timezone offset so “today” follows the user’s local calendar while task timestamps remain stored in UTC.

Sales follow-ups and surveys are task sources. For tenant users, ownership uses the employee id carried in the signed JWT; the System Admin uses the matching employee work email while investigating a tenant because that global account is intentionally not employee-linked. An incomplete scheduled follow-up appears through its scheduled time; when a next-follow-up date exists, that date becomes the actionable task deadline. Completed activity without a next action does not appear.

The service aggregates implementations of `ITodayTaskSource`. Sources execute sequentially because they share the request-scoped EF Core context; this prevents overlapping database operations while keeping the endpoint extensible. Future quotation, pickup, warehouse, transportation, delivery, accounting, or approval modules can register another task source without changing the dashboard API or client. Tasks are ordered with overdue items first and provide direct navigation to their source module.

## 24. Tenant AWS configuration

Each tenant can maintain one AWS connection profile containing an AWS region, S3 bucket name, access-key ID, and secret access key. Tenant administrators and selected system administrators require `settings.aws.manage` to view or change the profile.

| Method | Route | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/api/settings/aws` | `settings.aws.manage` | Return region and masked configuration state |
| `PUT` | `/api/settings/aws` | `settings.aws.manage` | Create the profile or update/rotate selected credentials |

Credential handling follows these rules:

- Access and secret keys are encrypted with AES-GCM before persistence.
- Encryption uses tenant-specific purposes, preventing ciphertext from being exchanged between tenants.
- The API never returns either plaintext credential; it returns only the last four access-key characters.
- Audit history records the configuration change but explicitly excludes both encrypted credential properties.
- During updates, omitted credentials preserve their existing encrypted values so the region or one credential can be changed independently.
- The initial configuration requires both credentials.

Run `008_tenant_aws_configuration.sql` for the selected SQL Server or PostgreSQL provider after script `007`. It creates `TenantAwsConfigurations` with a database-generated serial number and a unique tenant constraint.

`CredentialEncryption:Key` in `appsettings.json` is a development-only base64-encoded AES key. Production deployments must provide a stable secret through `CredentialEncryption__Key`; changing or losing this key makes existing credentials impossible to decrypt. After startup seeds the new permission, existing users must sign in again to refresh their JWT permission claims.

## 25. Tenant OpenAI configuration

Each tenant can maintain one OpenAI profile containing an encrypted API key and two independent model selections:

- **Data extraction model** for structured extraction from text, PDF page content, images, and preprocessed video outputs.
- **Audio transcription model** for converting uploaded or recorded audio into text.

The initial defaults are `gpt-5.6-terra` for balanced extraction quality/cost and `gpt-transcribe` for high-accuracy speech-to-text. Raw video is not sent directly to the general extraction model; the future media-processing workflow should sample frames and transcribe the audio track, then send those derived inputs for combined extraction.

| Method | Route | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/api/settings/openai` | `settings.openai.manage` | Return masked configuration and model selections |
| `PUT` | `/api/settings/openai` | `settings.openai.manage` | Create the profile, select models, or rotate the API key |

The API key uses the same AES-GCM protection and production encryption key as AWS credentials. Only its final four characters are returned, encrypted material is excluded from audit payloads, and an omitted key during update preserves the current encrypted value.

Run `009_tenant_openai_configuration.sql` for the selected SQL Server or PostgreSQL provider after script `008`. It creates `TenantOpenAiConfigurations` with a database-generated serial number and a unique tenant constraint. On startup the default roles receive `settings.openai.manage`; existing users must sign in again to refresh their JWT permission claims.

### Tenant Claude configuration

Settings › **Claude configuration** holds one encrypted Anthropic API key per tenant, the Claude extraction model (default `claude-opus-5-5`; also Sonnet 5.5, Haiku 5.5, Fable 5.1), an effort level (low / medium / high) and optional prices. Picking a model fills in Anthropic's list prices. Whoever has `settings.openai.manage` may also manage Claude (`settings.claude.manage` exists for roles that need only Claude).

| Method | Route | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/api/settings/claude` | `settings.claude.manage` (or `settings.openai.manage`) | Masked configuration |
| `PUT` | `/api/settings/claude` | same | Create, change model/effort/prices, or rotate the key |
| `GET` | `/api/settings/claude/usage` | same | Claude runs and approximate cost |
| `GET` | `/api/sales/extraction-providers` | `sales.items.extract` | AIs configured for the Extract items dialog |

In a lead's **Extract items** dialog, staff choose OpenAI or Claude for each run (`provider` on the extract request). Claude reads pictures, not video files: the browser takes still frames from the video, the server stores them in S3 next to it, and Claude receives short-lived presigned links (image URL blocks) and answers with the same JSON schema as OpenAI (structured outputs). Claude cannot listen to sound, so the narration is transcribed by OpenAI when OpenAI is configured; otherwise the run warns that only the pictures were used. On Opus 5.5, Opus 5, Sonnet 5.5 and Fable 5.1 the request opts into Anthropic's server-side refusal fallback (`fallbacks: "default"`). Script `036_claude_configuration.sql` creates `TenantClaudeConfigurations`; the API also applies it at startup.

**Optional item pictures.** The Extract items dialog has an *Attach a picture to each item* switch (off by default). When on, the pictures are numbered for the AI (OpenAI or Claude) and each item returns `picture`, the number of the picture that shows it best, and `mark`, a box around the item in that picture (x, y, width, height in thousandths, 0–1000) so a frame with several items shows which one is meant. The mark is clamped to the picture and stored as `ImageMark` ("x,y,w,h"); the inventory thumbnail zooms into it and the enlarged view outlines it (the box is the AI's estimate). The inventory line keeps that picture (`ImageKey`: the lead photo, or the stored video frame `frames/frame-NN.jpg` next to the video; with local storage the frames are saved only when this switch is on). The inventory shows a thumbnail with preview and a remove button; links are 30-minute signed URLs. Staff edits keep a picture by sending the line's own id (`imageFromLineId`), never a storage key. Script `037_lead_inventory_images.sql` adds the column; the API also applies it at startup.

## 26. Sales-lead customer uploads

Sales users can generate a secure customer upload link and share it through WhatsApp, email, SMS, or another channel. The mobile-first page requires no login and accepts multiple photos, videos, audio recordings, PDFs, office files, text files, archives, and other attachments up to 500 MB each.

The customer page presents four touch-friendly actions instead of a generic uploader:

- **Audio** requests microphone access and records a voice note until the customer selects **Stop and add**.
- **Video** requests camera and microphone access, shows a live preview, and adds the completed recording to the upload queue.
- **Image** opens the device's native image capture/picker, preferring the rear camera on supported mobile browsers.
- **Browse** opens the normal file picker for documents and existing media.

Customers can review file names, types, and sizes, remove unwanted items, and explicitly upload the final queue. Browser recording requires user permission and a secure HTTPS page (localhost is also permitted during development).

- Links must be valid for 5–30 days and can be revoked immediately.
- The URL contains 256 random bits; only its SHA-256 hash is stored.
- A 15-minute presigned S3 PUT sends bytes directly from the customer device to the tenant bucket.
- Keys use `tenants/{tenantId}/sales-leads/{leadId}/attachments/{attachmentId}/{fileName}`.
- The API confirms that the object exists before making it available to staff.
- Staff downloads use private 10-minute presigned GET URLs.
- Tenant AWS credentials are never sent to the browser.

| Audience | Method | Route | Description |
| --- | --- | --- | --- |
| Staff | `POST` | `/api/sales/leads/{leadId}/upload-links` | Generate a 5–30 day share link |
| Staff | `GET` | `/api/sales/leads/{leadId}/upload-links` | List link history |
| Staff | `PATCH` | `/api/sales/leads/{leadId}/upload-links/{id}/revoke` | Revoke a link |
| Staff | `GET` | `/api/sales/leads/{leadId}/attachments` | List completed uploads |
| Staff | `GET` | `/api/sales/leads/{leadId}/attachments/{id}/download` | Generate a short download URL |
| Public | `GET` | `/api/public/lead-uploads/{token}` | Validate the link |
| Public | `POST` | `/api/public/lead-uploads/{token}/upload-requests` | Create a presigned upload |
| Public | `POST` | `/api/public/lead-uploads/{token}/attachments/{id}/complete` | Verify and complete the upload |

Run `010_sales_lead_customer_uploads.sql` after script `009`. It adds the AWS bucket field and creates the upload-link and attachment tables. Set `PublicApp__BaseUrl` to the externally reachable client URL.

The private S3 bucket must allow browser `PUT` requests from `PublicApp:BaseUrl` through its CORS policy. Allow `PUT` and the `Content-Type` header for that origin; do not make the bucket public. The configured IAM identity should have only object upload, metadata/read, and download permissions for the application prefixes.

## 27. Survey module

The survey module is protected by `surveys.manage` and follows the Controller → Service → DAL layering used by the rest of the server. All master and transaction tables are tenant-owned, use database-generated integer serial numbers, participate in automatic auditing, and are returned newest-first where applicable.

### Master data

- **Household items** store a tenant-unique code, name, individual volume in CBM, description, and active state.
- **Packing materials** store a unit such as sheet, roll, or meter and the current unit cost.
- **Box types** store maximum CBM capacity and a recipe containing the quantity of each material required to build one box.
- SQL script `011_survey_module.sql` inserts starter household items (beds, chair, sofa, table, wardrobe, television, and refrigerator), materials (cardboard, tape, bubble wrap, foam, and stretch wrap), four box sizes, and sample box recipes for every existing tenant. Tenant registration adds the same starter set for tenants created later.

### Survey workflow

- A survey may be created independently or linked to an existing sales lead.
- Every survey has a customer, scheduled UTC date/time, location, assigned active employee, status, and notes.
- Status moves through scheduled/confirmed, in progress, and completed using explicit **Start survey** and **End survey** actions.
- Assigned, incomplete surveys due today or overdue are shown in the employee's task inbox.
- Rooms contain household items, count, captured unit volume, and optional notes. Extra materials such as bubble wrap can be added separately.
- Completion produces a quotation-ready summary; quotation pricing and document generation remain the next module.

Opening a survey uses a dedicated responsive workspace rather than a drawer or nested grid. A colored room navigator lets the surveyor add and select rooms one at a time. The selected room displays touch-friendly item cards with separate add/edit dialogs, count, individual CBM, total CBM, handling notes, and clear edit/remove actions. Customer context, confirmation state, extra materials, lifecycle controls, box utilization, and quotation inputs are visually separated into focused sections with icons and color-coded summaries.

### Packing and cost calculation

The service expands each survey line into individual units and uses a best-fit existing box before opening the smallest active box that can hold the entire item. An item is never split across boxes. If a box has 3 CBM free and the next bed requires 5 CBM, that space stays unused and a box with at least 5 CBM is selected. Items larger than every active box are listed as unboxed exceptions.

Box recipe quantities are multiplied by planned box counts, combined with extra survey materials, and priced with the current material master cost. The result includes surveyed CBM, total box capacity, unused capacity per box, box contents, aggregated material quantities, and estimated material cost.

### Customer confirmation

Staff can generate a 1–30 day link containing 256 random bits; only its SHA-256 hash is stored. The responsive public page requires no account and allows the customer to:

- confirm or update the proposed survey date and time;
- confirm the address and optionally share precise browser geolocation;
- review room/item/count/volume details; and
- confirm the collected inventory with optional notes.

The staff share dialog supports WhatsApp, email, copying the URL, and the device-native share sheet where available. WhatsApp uses the customer's saved phone number when it includes a country code, while email uses the saved customer address. Both channels receive a prepared message containing the customer name, survey number, scheduled time, and secure confirmation URL.

Geolocation requires customer permission and HTTPS outside localhost. Set `PublicApp:BaseUrl` to the externally reachable React application before sharing links.

| Audience | Method | Route | Description |
| --- | --- | --- | --- |
| Staff | `GET/POST` | `/api/surveys` | List or create surveys |
| Staff | `GET/PUT` | `/api/surveys/{id}` | Read or update a survey |
| Staff | `PUT` | `/api/surveys/{id}/details` | Replace rooms, items, and extra materials and recalculate |
| Staff | `POST` | `/api/surveys/{id}/start` | Record survey start |
| Staff | `POST` | `/api/surveys/{id}/complete` | Record survey end and mark quotation ready |
| Staff | `POST` | `/api/surveys/{id}/confirmation-link` | Generate a customer link |
| Staff | `GET/POST/PUT/PATCH` | `/api/surveys/masters/*` | Maintain all three survey masters and box recipes |
| Public | `GET` | `/api/public/surveys/{token}` | Review appointment and inventory |
| Public | `POST` | `/api/public/surveys/{token}/confirm-schedule` | Confirm date/time and location |
| Public | `POST` | `/api/public/surveys/{token}/confirm-items` | Confirm item details |

Apply `database/scripts/sqlserver/011_survey_module.sql` or `database/scripts/postgresql/011_survey_module.sql` after script `010`. Both scripts create the complete schema and tenant-specific dummy master data.

## 28. Quotations and customer approval

The quotation module is protected by `quotes.manage` and follows Controller → Service → DAL layering. A quotation can be created directly, from a sales lead, or from a survey. Selecting a lead fills the customer/contact/employee values; selecting a survey fills the same values and the server automatically links the survey's sales lead when one exists, so clients cannot break the relationship.

- **Charge master** stores tenant-specific service codes, units, default rates, tax percentages, descriptions, and active state.
- Starter charges cover survey, packing, transport, loading, unloading, storage, and insurance for existing and newly registered tenants.
- Quote lines capture quantity, rate, discount, tax, and display order. The service calculates all amounts rather than trusting totals sent by the browser.
- Quotations carry customer details, optional survey and lead references, assigned employee, three-letter currency, validity date, terms, notes, and draft/sent/accepted/rejected status.
- A 1–30 day customer link contains 256 random bits; only its SHA-256 hash is stored. The responsive public page shows the complete price breakdown and allows one acceptance or rejection with a reason.
- Staff can share the generated link through WhatsApp, email, clipboard, or the device-native share sheet.
- Accepted/rejected quotations and their charges are locked from editing.
- For survey-based quotations, staff can enable **Show survey rooms and items**. The public quotation then groups inventory by room with surveyed count, unit CBM, total volume, and notes.
- Customers can propose a different count for any surveyed item, provide item-level or overall notes, and submit the quotation for requoting. The original survey remains unchanged; the request is stored as an audited snapshot and the quotation moves to `REQUOTE_REQUESTED`.
- Staff see the requested before/after quantities in the quotation workspace, revise charges, save, and generate a new link. Resending returns the quotation to `SENT`, after which the customer can accept, reject, or request another requote.
- Staff use **Apply changes & recalculate** before resending. Requested quantities are applied to the linked survey (zero removes the item), customer item notes are retained, survey item confirmation is cleared, and total CBM is recalculated. Every quotation line whose unit is `CBM` receives the new survey volume as its quantity; discounts, multiple taxes, cess, line totals, and the grand total are recalculated by the server.
- The API blocks generation of a replacement link while the latest customer request remains unapplied. Applied requests retain their timestamp and before/after snapshot for auditing.

Designations now include an **Is salesman** flag. Every newly created non-system user must be linked one-to-one to an active employee. Administrators can use **Link employee** or **Change employee** from the Users page for migrated and existing accounts; inactive, cross-tenant, and already-linked employees are rejected. At sign-in the employee id is placed in the signed JWT, so an affected user signs in again after the link changes. If the linked employee's designation is marked as a salesman, quotation list/read/update/share queries are restricted at the service/repository boundary to quotations assigned to that employee. System administrators remain unrestricted while investigating a selected tenant; non-sales employees with the permission retain tenant-wide access.

| Audience | Method | Route | Description |
| --- | --- | --- | --- |
| Staff | `GET/POST` | `/api/quotations` | List visible quotations or create one |
| Staff | `GET/PUT` | `/api/quotations/{id}` | Read or update a visible quotation |
| Staff | `PUT` | `/api/quotations/{id}/lines` | Replace charge lines and recalculate totals |
| Staff | `POST` | `/api/quotations/{id}/share-link` | Generate a customer approval link |
| Staff | `GET/POST/PUT/PATCH` | `/api/quotations/charges/*` | Maintain charge master data |
| Public | `GET` | `/api/public/quotations/{token}` | Review a valid quotation |
| Public | `POST` | `/api/public/quotations/{token}/accept` | Accept a sent quotation |
| Public | `POST` | `/api/public/quotations/{token}/reject` | Reject with a reason |
| Public | `POST` | `/api/public/quotations/{token}/request-requote` | Submit revised surveyed item counts and notes |

Apply `database/scripts/sqlserver/012_quotation_module.sql` or `database/scripts/postgresql/012_quotation_module.sql` after script `011`. Each new table has a database-generated integer `SerialNo`; the script also adds employee linkage to users, the salesman designation flag, indexes, foreign keys, and starter charge data.

Apply `013_quotation_requote.sql` after script `012` for existing databases. It adds the quotation inventory-visibility option and the serial-numbered, tenant-scoped requote-request history table.

### Multiple taxes and cess

Tax percentages are no longer typed directly into a quotation charge. Tenant administrators maintain reusable **Tax configuration** records and select any number of active components on each charge line. Each configuration defines:

- a tax or cess classification;
- a percentage of the discounted taxable amount;
- for cess, an optional percentage of the combined selected standard-tax amount; or
- a fixed amount multiplied by charge quantity.

CGST 9%, SGST 9%, IGST 18%, cess on taxable amount, and cess on tax amount are seeded for existing and newly registered tenants. Administrators choose which configurations are selected automatically. Every calculated component is saved with its code, name, type, basis, rate, base amount, and final amount, so later master-data changes do not alter historical quotations. Line and quotation totals are always recalculated by the service.

Apply `014_multi_tax_and_cess.sql` after script `013` for existing SQL Server or PostgreSQL databases. It creates `TaxMasters` and `QuotationLineTaxes`; both are tenant-scoped and have database-generated integer serial numbers.

Apply `015_apply_requote_to_survey.sql` after script `014`. It records when each customer request was applied, enabling the server to enforce apply-and-recalculate before a revised quotation is shared.

Apply `016_quotation_origin_destination.sql` after script `015`. Quotations now store required origin and destination values. Selecting a sales lead, or a survey linked to a lead, fills the route automatically while still allowing the quotation route to be edited. Direct quotations require both values, and the route is included in staff and customer quotation details.

Apply `017_quotation_items.sql` after script `016`. Staff can add household items directly to any quotation, including quotations without a survey. Each row records room, household item, count, per-item CBM and notes. Quotation CBM uses this inventory when present, and the customer quotation link displays the included items.

## Pickup and packing

Apply `018_pickup_packing.sql` after script `017`. The Operations permission now exposes a responsive Pickup & Packing workspace with tenant-specific pickup statuses and vehicles. A pickup can link to a quotation, schedule a customer, assign a vehicle and employees, record packing materials, create box-type packages, record their contents, and generate a unique printable tracking label for every package.

Pickup income, customer collections, and expenses are recorded as audited financial entries. Collections have printable receipts suitable for tablet and phone use. Staff can generate a seven-day confirmation link and share it through WhatsApp; the customer can confirm the time, address, and browser GPS location. Saved coordinates or the address can be opened in Google Maps.

## Port-to-port Jobs
- Jobs is available to signed-in users with Operations management permission in the selected tenant.
- Job numbers are generated automatically. Routes have an origin and destination port or road terminal.
- Air shows airline, flight and air waybill; Ocean shows shipping line, vessel, voyage, bill of lading, container and seal; Road shows transporter, truck, trailer, driver and road consignment reference.
- Vendor master supports an optional vendor type and optional Agent flag. Origin/destination agents on jobs are optional and use active agent vendors.
- Available warehouse boxes from pickups or customer office drop-offs can be loaded across customers. Cargo snapshots preserve customer, contents, warehouse and shipping parties.
- Loading removes boxes from available stock. Serializable transactions, version checks and a unique active-box index prevent double allocation. Other receiving/handover endpoints reject boxes assigned to jobs.
- Boxes can be returned to their original warehouse before departure, with load/return history retained.
- Departure requires cargo and transport details. Arrived means arrival at destination port; it does not automatically create a destination warehouse receipt.
- Cargo manifests can be printed. Empty predeparture jobs may be cancelled.
- Additive schema initialization supports SQL Server and PostgreSQL; integration tests use SQLite.

## Invoicing and billing
- Entry points: Pickup detail > Invoicing & billing; Job detail > Invoicing & billing; Warehouse > Receiving history > row actions > Invoicing & billing. Finance > Invoicing & billing combines all sections.
- Capture an income charge against an active customer or an expense charge against an active vendor. Every charge must have a source record, currency, positive amount and corresponding Revenue/Expense account.
- Existing operational income, payments, expenses, labour and material capture remain unchanged. They are not automatically posted or copied, preventing accidental duplication. New billing charges are a separate subledger.
- Select unposted charges for one party/direction/currency to issue an automatically numbered invoice or bill. A document can consolidate multiple pickup/job/warehouse records for that party.
- Posting is atomic with charge linkage, mandatory audit records and balanced ledger entries: invoice debits customer receivables (1100); bill credits vendor payables (2000). Counterentries use each charge's account.
- Chart of accounts includes protected built-in accounts plus tenant-specific accounts. New accounts can be cash/bank Asset, other Asset, Liability, Equity, Revenue or Expense. Custom account names/active status can change; type cannot.
- Receive one customer payment against multiple invoices of that customer in one currency. Partial allocations are supported.
- Pay multiple bills across vendors in a batch. Every vendor has one separate numbered voucher and its own required reference. A batch uses one currency and cash/bank account; submit separate batches for different currencies or bank accounts.
- Payment posting records cash/bank and AR/AP ledger entries and allocations together. It records payments only; it does not initiate bank transfers.
- Vouchers, invoices and bills support print/PDF output. Overpayments, mixed parties/currencies, stale versions, duplicate charge conversion and duplicate requests are rejected or safely replayed.
- Void only unpaid documents; reverse their payment vouchers first when necessary. Reversals post opposite ledger entries, restore balances and release voided document charges. Billing journals cannot be reversed independently through the generic Ledger screen.
- Permissions: billing.view, billing.capture, billing.issue, billing.pay and billing.accounts. Read permission is required in addition to each action permission. Administrators receive these via the standard seeder; other roles need explicit grants. Sign in again to refresh permission claims.
- Amounts currently support two decimal places. There is no foreign-exchange conversion, unallocated advance payment or automatic tax calculation in this workflow.
- SQL Server and PostgreSQL use additive BillingRecords schema with tenant/request uniqueness, concurrency versions and the existing audit/ledger tables.

## Charge mappings and accountant posting (2026-10-07)
- Charge master account mappings are configured once: customer charges map to a Revenue account and vendor charges to an Expense account. Manage mappings from Charge master > Charge account mappings or Finance > Invoicing & billing > Charge master mappings.
- Add charges selects one customer/vendor, currency and source, then accepts multiple charge rows in one window. The batch saves atomically and can be retried safely. No account selector is shown during charge capture; amounts can override the master default.
- Customer receipts and Expenses paid are cash captures, distinct from invoice/bill charges. New captures in Pickup, Job and Warehouse await review.
- Finance > Accountant posting is the shared queue. Existing pickup transaction receipts and paid crew expenses also appear automatically; the accountant must select the corresponding customer/vendor for older records without master codes.
- Posting requires billing.view + billing.pay, a cash/bank account, date and matching party. Capture requires billing.capture; mapping changes require billing.accounts.
- Allocate the exact captured amount across invoices/bills to settle them without recording cash twice. A receipt without invoice allocation posts to Customer advances (2100), not income or a paid invoice. An expense without bill allocation posts directly to its charge master's Expense account; use bill allocation if already billed.
- Customer advances currently require subsequent ledger reconciliation; this update does not add an advance-to-invoice allocation screen.
- Stale/duplicate postings are rejected. Posted pickup expenses cannot be changed or deleted. Each posting has a numbered journal and audit history. Existing captured and issued charge account snapshots are preserved when master mappings change.
- Monetary inputs use direct entry without increment/decrement controls.

## FIN-CURRENCY-001 — Multi-currency
USD base; configurable workspace and customer/vendor currencies; dated exchange-rate master; editable capture rates saved permanently; original and USD amounts; cross-currency invoice/bill settlement; realized exchange differences; USD/party/original-currency reporting; tenant permissions and audit. See [MULTI_CURRENCY.md](MULTI_CURRENCY.md) for workflows, verification and existing-data limitations. This supersedes earlier fixed-two-decimal/no-FX limitations for the implemented financial workflows.
Acceptance: master-rate edits do not alter existing document values; partial settlement leaves no control-account rounding remainder; payment reversals restore original base entries; mixed currencies are never summed without conversion.

## FIN-CURRENCY-002 — Configurable system accounting currency
Settings > System currency configures the workspace accounting base independently of the transaction default. Rates, base reporting and currency precision follow that setting. Existing USD history remains unchanged. Base changes are locked after financial records exist; rate schedules are separated by base. Requires billing.accounts. This supersedes the earlier fixed-USD requirement; see MULTI_CURRENCY.md.

## Languages (English, Arabic, Turkish, Spanish, French, Portuguese)

Staff screens and customer link pages can be shown in English, العربية (right-to-left), Türkçe, Español, Français or Português (Brazil). The language picker is in the workspace header, on the login page and at the top of every customer page; the choice is remembered on the device, and the browser language is used the first time. Ant Design's own texts (date pickers, tables) and date formats follow the language.

**Server messages are sent as codes.** Every error response that carries a message has the shape `{ code, params, message }` — for example `{ "code": "BOX_ALREADY_STORED_DELIVERED_REFRESH_LIST", "params": { "trackingNumber": "PKG-0042" }, "message": "Box PKG-0042 is already stored or delivered. Refresh the list." }`. The client shows `server.<code>` in the user's language with the params filled in; `message` is the English fallback. Model validation errors use `VALIDATION_FAILED` with `params.fields`; responses without a body (403, 404…) are worded by status on the client. Success messages are the client's own and are translated there.

The catalog (`backend/src/Movers.Api/Localization/server-messages.json`, ~680 messages) is built from the messages in the code by `node tools/i18n/extract-server-messages.mjs`, which keeps existing codes stable; `MessageCodeFilter` tags responses with it. A test fails when a new message has no code. After adding or changing a server message: run the extractor, then translate the new keys in `frontend/src/i18n/locales/*/server.json`. `node tools/i18n/check-locales.mjs` reports missing translations and placeholder mismatches. Developer guide: `frontend/src/i18n/README.md`.

Not translated: data users enter (item names, notes, master data), customer message templates (tenant data in Business masters), and printed report templates designed in the report designer.
