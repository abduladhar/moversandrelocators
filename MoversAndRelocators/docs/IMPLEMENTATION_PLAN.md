# Movers & Relocators Platform — Implementation Plan

## Delivery approach

The product is a modular monolith: one deployable ASP.NET Core API and one React client, with strict module boundaries. The server uses separate `Movers.Api`, `Movers.Services`, `Movers.DAL`, and `Movers.Domain` projects. Controllers call services, services own use cases and repository abstractions, and DAL implements persistence without exposing EF Core to controllers. Each module is completed end-to-end (domain model, API, UI, validation, tests, and documentation) before the next begins. PostgreSQL is the production database target; SQLite keeps local development zero-setup during the foundation stage.

## Module sequence

### 1. Multi-tenancy — implemented

- Tenant registration, profile editing, activation and deactivation.
- Resolve the active tenant from signed JWT tenant claims.
- Request-scoped tenant context, reusable by all later modules.
- Automatic query filters and cross-tenant write guards for all `ITenantOwned` entities.
- Tenant-management React page and API client.
- Data model prepared for tenant-owned records to carry a required `TenantId`.

Exit criteria: tenant CRUD works, inactive tenants cannot resolve, duplicate slugs are rejected, and tenant-scoped endpoints reject requests without a tenant.

### 2. Identity, users, roles, and permissions — implemented

- Login, refresh-token rotation, logout, password reset, and account lockout.
- Platform administrator versus tenant users.
- Tenant-scoped users, roles, granular permissions, and branch access.
- Audit trail for security-sensitive changes.
- Permission policies on APIs and route/menu guards in React.

Implemented with JWT access tokens, PBKDF2 password hashing, global system-administrator access, tenant-bound administrators, signed tenant selection, custom roles, module permissions, and automatic mutation auditing.

Exit criteria: users only see their tenant, every protected action has a permission, and security flows have integration tests.

### 2A. Employees and designation master — implemented

- Tenant-owned designation master with code, name, reporting level, description, and active status.
- Employee directory with employee number, contact details, joining date, designation, manager, and active status.
- Reporting hierarchy in which a manager must belong to a strictly higher designation level (`1` is highest).
- Cross-tenant, self-reporting, same/lower-level reporting, and circular reporting protections.
- Newest-first lists, API authorization, automatic audit history, responsive administration screens, and automated API coverage.

Exit criteria: administrators can maintain designation levels and employees, view the reporting tree, and cannot save an invalid reporting relationship.

### 3. CRM: sales leads and follow-ups — implemented

- Tenant-owned lead-status, follow-up-status, and move-type masters with starter data, display ordering, active state, and workflow indicators.
- Lead capture with customer/contact details, source, move type, origin, destination, expected move date, employee assignment, status, and notes.
- Follow-up scheduling, outcome/status, notes, next-follow-up reminder, and a newest-first lead activity list.
- Tenant-unique lead numbers and status codes, active-master validation, active-employee assignment validation, and automatic auditing.
- Responsive Ant Design pages with searchable/sortable desktop grids, mobile tiles, advanced-search dialogs, and modal create/edit workflows.
- Revocable 5–30 day customer links with direct private-S3 photo, video, audio, and document uploads under tenant and lead prefixes.

Exit criteria met for lead capture and follow-up management. Survey conversion and calendar scheduling continue in Module 4.

### 4. Survey scheduling and move details — implemented

- Survey creation with or without a sales lead, surveyor assignment, appointment changes, start, and completion.
- Customer confirmation links for appointment date/time, address, browser location, notes, and final item-list confirmation.
- Tenant-owned household-item, box-type, box-recipe, and packing-material masters with current material costs.
- Inventory by room, item, count, overrideable unit volume, notes, and extra packing materials.
- Non-splitting first-fit box planning, unused-capacity visibility, oversized/unboxed warnings, material aggregation, and estimated material cost.
- Assigned surveys appear in the employee's daily task inbox.
- Quotation-ready volume, box, and material-cost summary is exposed after data collection; commercial quotation pricing remains Module 5.

Exit criteria met: completed survey data is sufficient to produce a traceable quotation.

### 5. Quotation and acceptance — implemented

- Tenant-owned charge master, line items, taxes, discounts, terms, validity, employee assignment, and deterministic server-side totals.
- Tenant tax/cess configuration with multiple snapshotted components per charge, taxable-amount, tax-amount, and quantity-based calculations.
- Direct, sales-lead, and survey-based creation; surveys automatically preserve their linked sales lead.
- Secure customer links, responsive review, WhatsApp/email sharing, acceptance/rejection, and rejection reasons.
- Optional room-by-room survey inventory on the customer quotation, customer quantity corrections, audited requote requests, staff repricing, and resend workflow.
- Applying a requote updates the linked survey inventory, recalculates CBM-priced charges and all tax/cess components, and blocks resend until completed.
- Salesman-designation visibility restricts employees to their own assigned quotations; system administrators remain unrestricted.
- Employee/user one-to-one linkage is required for newly created non-system accounts.

Exit criteria met for deterministic totals and immutable accepted customer responses. PDF rendering, revision history, approval thresholds, and conversion into a move job will be added with the operations workflow.

### 6. Pickup and operations

- Job planning, crew/vehicle assignment, packing materials, checklists, and pickup proof.
- Status workflow, exceptions/damage, signatures, photos, and documents.
- Operational dashboard and notifications.

Exit criteria: an accepted job can be picked up with a complete chain of custody.

### 7. Warehouse and storage

- Warehouses, zones, racks/bins, storage lots, inbound/outbound movements, and inventory labels.
- Storage contracts, periodic charges, stock counts, and damage/condition history.
- Tenant and branch-level warehouse access.

Exit criteria: every stored item has a location and auditable stock movement history.

### 8. Transportation

- Trips, routes, legs, carriers, vehicles, drivers, manifests, and dispatch.
- Transfer between warehouses, in-transit events, ETA, expenses, and proof documents.
- Shipment tracking timeline.

Exit criteria: jobs can move through one or more traceable transport legs to destination.

### 9. Delivery and job closure

- Delivery appointment, destination checks, unloading/unpacking, item reconciliation, proof of delivery, exceptions, and claims handoff.
- Customer feedback and operational job closure.

Exit criteria: delivery reconciles the manifest and produces signed proof before closure.

### 10. Billing and general accounting

- Chart of accounts, fiscal periods, journal entries, ledgers, trial balance, profit and loss, and balance sheet.
- Customer invoices, receipts, credit notes, supplier bills, payments, taxes, and bank/cash accounts.
- Automatic postings from quotes/jobs, storage, transport, and commissions using configurable posting rules.
- Job profitability, receivables/payables ageing, and reconciliation.

Exit criteria: every operational financial event posts balanced journal entries with a source-document audit trail.

### 11. Sales incentives

- Effective-dated incentive plans by salesperson/team, service, revenue, margin, target, and collection status.
- Slabs, caps, accelerators, cancellations, clawbacks, approval, and payout batches.
- Explainable calculation breakdown and accounting posting.

Exit criteria: incentive results can be reproduced from locked source data and approved before payout.

### 12. Reporting, administration, and production hardening

- Dashboards, exports, saved filters, scheduled reports, notifications, templates, and tenant settings.
- Background jobs, idempotency, observability, backups, retention, privacy, rate limiting, deployment, and disaster recovery.
- PostgreSQL migrations, containerization, CI/CD, performance and security testing.

Exit criteria: production readiness checklist passes and all critical workflows have automated end-to-end coverage.

## Cross-module rules

- Every business table is tenant-owned and indexed by `TenantId`; tenant identity is never accepted from a request body.
- Workflow changes use explicit commands and append to an audit/event timeline.
- Money stores currency plus decimal amount; accounting entries are immutable after posting.
- Documents are stored outside the database with tenant-prefixed object keys and metadata in the database.
- API contracts are versioned and timestamps are UTC; display time zones come from tenant settings.
