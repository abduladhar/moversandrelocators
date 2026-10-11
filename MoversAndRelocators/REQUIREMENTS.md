# Movers and Relocators — Product Requirements

Version: 1.0 | Date: 2026-10-03 | Status: proposed product baseline

This document describes the required finished product in plain language. It is not a statement that these capabilities are already implemented. Existing implementation descriptions remain in `FEATURES.md` and `IMPLEMENTATION_PLAN.md`; they require a separate gap assessment. The companion [meta-template specification](REQUIREMENTS_META_TEMPLATE.md) provides structured, traceable requirements and acceptance criteria.

## 1. Purpose and scope

Manage a household move from the first enquiry through survey, quotation, packing, collection, storage, consolidated transport, delivery, customer settlement, and job profitability. Office staff, field crews, drivers, and customers should understand what to do without technical training.

The system must help answer: What did the customer ask us to move? What was excluded? What did we actually pack? Where is each package? Who last handled it? What did the customer confirm? How much labour, material, vehicle, fuel, and vendor expense did this move consume? What should we charge for a similar move next time?

The product must support multiple companies (tenants), branches, warehouses, employees, owned vehicles, and subcontractors. An in-house installation may run a single company. Each deployment selects AWS Lambda, Azure Functions, or an in-house server; simultaneous active-active operation across clouds is not required.

All core requirements below are in scope. Delivery phases sequence the work; they do not remove later modules from the requested product. AI-generated inventory, live vehicle telemetry, payroll processing, and international customs processing are optional extensions. Video/image-assisted surveys and employee cost calculation are core requirements.

## 2. People and access

| Person | Typical work |
| --- | --- |
| Company administrator | Configure branches, masters, users, permissions, report templates, and approval limits |
| Salesperson | Manage enquiries, follow-ups, surveys, quotations, and customer communication |
| Surveyor | Inspect rooms, record inventory and access restrictions, estimate resources |
| Operations planner | Schedule moves, crews, vehicles, supplies, pickups, and deliveries |
| Packing supervisor / crew member | Record work time, item condition, packages, materials, and exceptions |
| Warehouse operator | Receive, locate, consolidate, scan, transfer, and release packages |
| Dispatcher / driver | See assigned trips, open directions, confirm handovers, record distance and expenses |
| Finance user / approver | Review costs, invoice, collect, pay vendors, reconcile, and close periods |
| Manager / auditor | Review exceptions, margins, approvals, reports, and change history |
| Customer / authorized representative | Review only the shared move information and submit confirmations or corrections |
| Platform administrator | Manage tenants; any support access must be explicit, scoped, and audited |

Permissions must distinguish view, create, edit, assign, approve, cancel, export, share, reverse, manage templates, and view costs/margins. Apply company, branch, assigned-job, and field restrictions on the server, including reports and downloads. Crew members and customers must not receive salary rates, supplier costs, or internal margins. A person cannot approve their own adjustment above a configured limit.

## 3. End-to-end journey and controls

1. Capture an enquiry and assign the next follow-up.
2. Schedule an on-site, video, image-based, or mixed survey.
3. Confirm survey inventory, move addresses, access conditions, and exclusions with the customer.
4. Prepare and approve a versioned quotation; share it for acceptance or correction.
5. Convert the accepted quotation into a move job, subject to deposit and scheduling policy.
6. Allocate people, supplies, vehicle capacity, and appointments; confirm pickup details.
7. Pack and label items, record time and materials, reconcile everything expected, and obtain customer acknowledgement.
8. Scan packages into a vehicle or warehouse; record each custody handover.
9. Consolidate compatible shipments, execute transport legs, and record actual kilometres and expenses.
10. Deliver, unpack as contracted, reconcile packages/items, and record customer exceptions.
11. Resolve claims, finalize job costs, invoice/collect, and close operational and financial work separately.

Every workflow must have explicit allowed transitions, an owner, timestamps, reasons for cancellation/reopening, and required evidence. Editing a status master must not bypass mandatory controls. Customer approval means acceptance of a particular recorded version; a later edit requires a new confirmation where it changes agreed scope, price, packages, or appointment details.

## 4. Sales leads and follow-ups

- Record customer name, multiple contacts, preferred language/channel, enquiry source, origin/destination, desired dates, household size, approximate volume, service needs, budget if supplied, owner, branch, and notes.
- Support residential, office, local, intercity, packing-only, transport-only, storage, and partial moves through configurable service types.
- Show possible duplicates using normalized phone/email and move details. Allow a deliberate merge with preserved activities and audit history; never merge silently.
- Record every call, visit, message, result, promised action, next follow-up date, and reassignment. Provide overdue reminders, escalation, lost reasons, and a daily task list.
- Allow survey and quotation creation directly as well as from a lead, while maintaining customer/job traceability. Require the missing mandatory details before progressing.
- Track communication delivery failures and consent/preferences; creating a share link must not automatically send an external message.

## 5. Surveys, video, and images

- Schedule surveyor, mode, appointment time zone, duration, customer contact, and reschedules. Check double-booking and notify the assigned worker of changes.
- Capture room-by-room items with stable item IDs, quantity, dimensions, unit volume, estimated weight, material, condition, fragility, declared value, photographs, dismantling/reassembly needs, and customer instructions.
- Record both addresses, floors, lift dimensions/availability, stair flights, parking, walking distance to loading, vehicle restrictions, building permits, time windows, and access contacts. These must influence resource and pricing estimates.
- Mark each item as included, excluded/customer-retained, customer-packed, already packed, or pending clarification. Record hazardous/restricted goods and refusal/handling decisions. Do not infer that an unseen item is absent.
- For video surveys, support a scheduled call link and uploaded video or consented recording. Tag timestamps to rooms/items and record incomplete coverage, quality limitations, and follow-up questions. A built-in conferencing service is optional; the survey workflow must work with external call links.
- For image surveys, provide guided room-by-room uploads, captions, dimensions requested from the customer, duplicate-image checks, and review queues. Media-derived quantities/measurements remain estimates until a surveyor verifies them.
- If AI assistance is introduced, show suggested items separately with confidence and evidence references; human approval is required before inventory, price, or confirmation changes.
- Customer review must show the inventory, condition notes, exclusions, uncertain items, addresses, and access requirements. Customers can confirm, dispute, add an item, or request corrections. Staff resolve changes and resubmit a version; acceptance freezes a snapshot.
- Estimate boxes, packing material quantities, crew skill mix, person-hours, vehicle volume/weight, and survey confidence. Preserve manual overrides with reasons.

## 6. Quotations and customer approval

- Build quotations from confirmed surveys or direct entry. Include scope, inventory revision, service options, packing/unpacking, floors/access charges, storage, route, dates, insurance option, taxes, discounts, validity, deposits, payment milestones, exclusions, and cancellation/rescheduling terms.
- Keep internal estimated cost separate from customer selling price. Record labour, materials, owned transport/fuel, hired transport/vendor services, other expenses, overhead allocation, contingency, and expected margin independently.
- Support fixed, item, volume, weight, distance, hour, day, and storage-period charge bases. Show minimum charges and rounding rules. Use decimal monetary calculations and explicit currency.
- Effective-dated rate cards and tax masters provide defaults; each quotation snapshots applicable rates and calculation inputs. Changing a master never changes an existing accepted quotation.
- Apply configurable manager approvals for discount, negative margin, price override, credit terms, and changes after acceptance.
- Share a branded mobile-friendly link and downloadable PDF. Customers may accept, decline with a reason, or request changes. Show version number and expiry; superseded quotations cannot be accepted.
- Acceptance captures customer/representative name, authority declaration, server timestamp, version, consent text, and appropriate verification evidence. Collect signature or OTP according to configured policy; define legal signature requirements for the operating jurisdiction before launch.
- New scope at pickup creates a priced change order or an explicit manager-approved exception. Do not silently replace an accepted quotation. Deposits, cancellation fees, refunds, and reschedules must remain traceable.

## 7. Secure sharing and customer confirmations

Provide purpose-specific links for survey appointment, survey inventory, quotation approval, pickup appointment, packed-item list, material/extra-charge acknowledgement, delivery appointment, and proof of delivery.

- A link grants only the named document/action and customer-safe fields. Use unguessable tokens stored as hashes, expiry, revocation, rate limits, and optional OTP for sensitive approvals. Never put customer personal details in URLs or analytics logs.
- Default proposal: seven-day expiry, configurable by purpose and tenant. Expiry must also respect quotation validity. Resending can revoke the previous token; staff must see which links remain active.
- Opening a link is read-only. Link previews and security scanners must not approve anything. Approval requires an explicit submission protected against replay and concurrent edits.
- Show the exact content/version being acknowledged, a clear correction option, and downloadable evidence. Viewing, notification delivery, and approval are separate events.
- Record the response, snapshot hash/reference, responder identity/verification method, timestamp, and privacy-appropriate device/IP metadata. Capture representative authority and relationship where the customer is absent.
- A refusal, unavailable customer, or weak internet creates an exception. Authorized override requires a reason and follow-up owner; it must never appear as customer confirmation.
- For in-house deployments, define a secure externally reachable customer portal or public gateway. If no public access is permitted, public links cannot work; provide a documented staff-assisted confirmation alternative with accurately labelled evidence.

## 8. Household shipments, pickup, and packing

- A job holds customer, accepted commercial version, survey inventory, addresses/stops, schedule, service commitments, documents, assigned teams, and risks. A job can contain multiple shipments, pickups, deliveries, and transport legs.
- Plan crew skills, shifts, capacity, supplies, vehicle, and appointment windows; prevent overlapping assignments unless a planner resolves the conflict. Track postponement, no-show, access denial, and waiting time with reasons.
- Before packing, reconcile the confirmed survey against the actual household. Photograph relevant existing damage. Record additions, removals, quantity changes, customer-retained items, and unpacked items explicitly.
- Assign a unique package ID with QR/barcode and human-readable label. Link each contents row to survey item and quantity; link disassembled parts to their parent item. Bulky unboxed items also need tracked handling-unit IDs.
- Support one item distributed across packages and one package containing multiple items. Track component completeness and quantities so scans cannot falsely imply that every part has arrived.
- Record package type, contents, room, dimensions, weight/estimate, seal number, condition, packer, time, photographs where necessary, and handling instructions. Customer-packed sealed boxes record declared contents and inspection limitations.
- Repacking, splitting, merging, broken seals, damaged labels, and label reprinting preserve predecessor/successor history; retired IDs cannot count as live packages.
- Before pickup closure, every included inventory quantity must be accounted for as packed, separately tracked unboxed, customer-retained/excluded with acknowledgement, or an unresolved exception. Show a room-by-room “Anything left behind?” checklist and package totals.
- Customer confirmation must show packed contents, package IDs/counts, left-behind items, condition exceptions, material quantities where relevant, and approved extras. Record disagreements immediately. Evidence reduces disputes; it cannot guarantee that loss or claims will never occur.
- Loading requires scanning the manifest and recording the releasing/receiving custodian, vehicle, location, time, seal, and exceptions. Duplicate and wrong-job scans must be rejected. Missing packages block normal dispatch; an authorized partial dispatch creates a distinct outstanding manifest.

## 9. Materials, employees, and actual cost

### Packing materials

Maintain branch/warehouse stock of cartons, tape, wrap, foam, crates, covers, straps, and other supplies by unit of measure. Record purchases/receipts, transfers, reservations, job issues, unused returns, consumption, wastage, damage, and reusable-material loans/returns. Support partial rolls and unit conversions such as metres per roll. Block negative stock unless an authorized adjustment process resolves it.

For each job, reconcile net issued quantity to consumed, wasted, and outstanding quantities. Expense consumed/wasted disposable materials; track reusable assets using an explicit rental/depreciation policy. Snapshot issue valuation (proposed default: weighted average) and reverse returns at the originating valuation. Do not expense procurement and consumption twice. Track actual cost independently of customer-billable material quantities and prices.

### Labour and person-hours

Record named employee or contract worker, role/skill, job, activity (packing, loading, travel, waiting, unloading, unpacking), start/end, unpaid breaks, overtime, supervisor approval, and corrections. Prevent overlapping paid allocations for one worker; split shared work across jobs with allocations summing to the original time.

Person-hours are the sum of individual approved hours, not elapsed team duration. Three people packing for four hours with a half-hour unpaid break each produce 10.5 person-hours.

Use effective-dated loaded hourly rates: base employment cost plus configured employer contributions/benefits/allowances. Define salaried hourly conversion using configured productive hours, with the basis visible. Snapshot the rate applied to each entry. Separate regular and overtime hours/rates; allocate fixed shift allowances once. Restrict access to individual rates.

Contract labour may be tracked by worker and hours for productivity while its bill supplies the expense. Mark the cost source so a supplier bill and a time-derived accrual are reconciled, not added twice. Payroll calculation and statutory filing are separate optional integrations.

### Future quotation planning

Compare estimated and actual person-hours, materials, fuel, vendor charges, and other costs by job, room type, volume, floors, access conditions, service, and crew skill. Record variance reasons. Report hours per cubic metre and material usage with sample size and outlier indicators. Managers may approve updated estimating norms; the system must not silently rewrite rate cards from historical averages.

## 10. Storage, consolidation, and transport

- Warehouse receipts scan each handling unit, condition, custodian, and bin/zone. Maintain location history, storage dates, periodic charges, stock counts, discrepancy investigations, and release permissions.
- Consolidate shipments by route, destination, delivery window, available volume/weight, handling compatibility, and customer commitment. A package always belongs to its original shipment/customer even in a shared load.
- Create trips with ordered legs/stops, assigned driver/carrier, vehicle, planned/actual dates, capacities, manifests, route, and status. Reject overloads and duplicate active leg assignments; support partial loads, transshipment, breakdowns, replacement vehicles, and return-to-depot legs.
- Each handover requires outbound/inbound reconciliation. Flag packages with no matching receipt or excessive dwell time. Do not mark an entire job delivered when only one shipment arrives.
- Vehicle/driver masters hold type, fuel, capacity, documents/expiry, maintenance availability, and carrier rates. Provide expiry warnings and configurable dispatch blocks. Outsourced transport must retain vendor booking and agreed rate evidence.
- The driver sees only assigned work, customer contact/access instructions, safe handling notes, and approved documents.
- Provide an “Open in Google Maps” action using verified address/coordinates, for example `https://www.google.com/maps/dir/?api=1&destination=<encoded-address-or-latitude,longitude>&travelmode=driving`. Ask the user to review ambiguous destinations; provide copyable address/contact details when navigation is unavailable. Opening directions does not automatically supply actual trip distance or truck-safe routing.

### Kilometre-based fuel and trip costs

Record odometer start/end for each leg, readings/photos, timestamp, route, and source. Actual kilometres = ending odometer minus starting odometer; reject negative values and flag unrealistic changes. Reset/replacement corrections require approval. Separate loaded, empty/repositioning, detour, and personal/non-business kilometres. Estimated map distance is labelled as planned distance until actual readings are approved.

Support one selected fuel-cost basis per trip:

- Distance-rate basis: approved business kilometres × effective fuel cost per kilometre.
- Efficiency basis: approved business kilometres ÷ vehicle kilometres per litre × fuel price per litre.
- Actual-consumption basis: reconciled opening fuel + purchases − closing fuel − documented non-trip transfers; cost using the approved inventory valuation. Keep the kilometre-based expectation to compare efficiency/variance.

Fuel purchases alone are cash/stock movements and may include fuel still in the tank. Never add estimated fuel cost and actual fuel cost together. Replace/reconcile accruals when actuals become known. Example: 180 km ÷ 9 km/litre × 100 currency units/litre = 2,000 fuel cost. Customer transport price is a separate calculation.

Record tolls, parking, permits, driver allowances, hired vehicle charges, subcontract handling, and other trip expenses separately with receipts, vendor/payee, tax, approval, and payment status. If a hired-vehicle price includes fuel, suppress a second fuel charge unless the agreement explicitly excludes it.

For consolidated trips, allocate each shared cost once using a saved basis (for example chargeable volume-kilometres per occupied leg, weight-kilometres, or approved manual percentages). Allocate empty running under an explicit policy. Allocations must total the source expense, including currency rounding; retain unallocated costs visibly until resolved.

## 11. Delivery, exceptions, and claims

- Confirm appointment, destination, access, receiver identity, and contracted unloading/unpacking/reassembly work.
- Scan delivered packages against the current manifest, reconcile item/component quantities when unpacking is in scope, and capture seal/condition/photos and receiver response. Distinguish packages delivered from contents verified.
- Support partial delivery, customer absence, refused delivery, wrong address, missing contents, damage, late delivery, storage extension, return trips, and customer-requested disposal with authorization.
- Customer proof of delivery records actual received units, exceptions, representative details, and verification. A signed receipt with exceptions must not become a clean delivery automatically.
- Create a claim/incident with category, owner, due date, custody evidence, declared value, insurer/vendor references, investigation, resolution, approved compensation, and linked financial adjustments. Do not delete the original inventory or evidence.
- Operational closure requires reconciled delivery and explicitly resolved/accepted outstanding work. Finance closure additionally requires approved actual costs, reconciled advances, and settlement or an authorized open-receivable policy. Reopening is permission-controlled and audited.

## 12. Finance

- Maintain customers, suppliers, chart of accounts, cost centres, fiscal periods, currencies, configurable taxes, bank/cash accounts, payment methods, numbering, approval limits, and posting rules.
- Produce customer invoices, deposits/advances, milestone bills, receipts, refunds, credit/debit adjustments, supplier bills, expenses, employee advances, reimbursements, and vendor payments. Match receipts/payments partially across documents and retain unapplied amounts.
- Quotation acceptance is not itself revenue or cash receipt. Define invoice, delivery, accrual, and revenue-recognition posting policies with the business accountant before launch.
- Post balanced journals in a database transaction. Posted documents cannot be silently edited/deleted; use linked reversals/adjustments. Lock closed periods, prevent duplicate supplier invoices, and reconcile cash/bank movements.
- Job profitability must show revenue, labour, packing materials, owned-vehicle fuel, other owned-vehicle costs, hired transport, other vendor services, storage, claims, and overhead separately, with estimate, committed, accrued, actual, and variance columns. Avoid mixing recoverable tax with operating cost under the configured policy.
- Keep collections distinct from revenue, vendor payments distinct from expenses, and estimated costs distinct from actuals. Show unpaid bills and unrecorded expected costs before financial closure.
- Provide receivables/payables ageing, trial balance, general ledger, profit and loss, balance sheet, tax summaries, cash flow, job margin, and reconciliation reports. Legal invoice/tax formats are configurable and require jurisdiction-specific validation.

## 13. Master data and starter records

All masters require tenant ownership, stable code, display label, active/effective dates, audit history, and import/export where appropriate. Referenced records are deactivated rather than deleted. Costs, rates, taxes, and currencies need effective dating and historical snapshots. Starter operational values are editable; they are not statutory rates or final pricing.

| Master group | Required examples / fields |
| --- | --- |
| Organization | Company, branch, warehouse, zones/bins, time zone, financial year, base currency, document sequences |
| Customers and contacts | Individual/company, billing address, move addresses, representatives, contact preferences |
| Sales | Sources: referral, website, phone; statuses: new, contacted, survey planned, quoted, won, lost; lost reasons |
| Follow-up | Call, visit, message; pending, completed, postponed; outcomes and escalation intervals |
| Move services | Household/office, local/intercity, packing-only, full service, storage; service inclusions |
| Survey | On-site, video, images, mixed; room: kitchen, bedroom, living room; condition and access reasons |
| Household items | Sofa, bed, wardrobe, fridge, TV; default dimensions/volume/weight, fragility, dismantling rules |
| Packages and materials | Small/medium/large box, crate, unboxed; carton, tape roll, wrap metre, foam sheet; units/conversions, recipes, reusable flag |
| People | Employee, designation, manager, skills, shift, availability, regular/overtime cost rates, contract worker/vendor link |
| Fleet and routes | Vehicle type/capacity, fuel type, efficiency, driver, route/stops, distance-cost basis, documents/expiry |
| Vendors | Carrier, contract labour, packing supplier, warehouse partner; service/rate/credit terms |
| Pricing and tax | Charge code/basis, service/route rate card, discounts, tax/cess components, rounding, effective dates |
| Finance | Ledger accounts, cost centres, payment methods, expense heads, bank/cash, approval thresholds |
| Exceptions | Missing, damaged, left behind, access denied, label lost, customer absent, breakdown, variance reasons |
| Communication and documents | Confirmation text, quotation/invoice/manifest templates, notification text, languages, retention policies |
| Security and workflow | Roles, permissions, allowed transitions, stage checklists, required evidence, approval/override rules |

Seed a usable household-item catalogue and material recipes with clearly labelled illustrative dimensions/quantities; administrators must validate them. Do not seed production passwords, fabricated employee rates, or assumed tax rates as approved business data.

## 14. Layperson-friendly React experience

Use plain labels such as “Moves today”, “Items to pack”, “Ask customer to confirm”, and “Money received”. Explain volume and person-hours where entered. Show the next action, who owns it, and what is missing. Reuse known information, provide searchable selections, guided steps, drafts, inline validation, readable dates/currency, and clear success/error feedback.

| Device style | Dedicated interaction and layout |
| --- | --- |
| Laptop, proposed ≥1200 px | Persistent navigation, dense but readable tables, side-by-side job details, bulk planning, report designer |
| Tablet, proposed 768–1199 px | Touch-first two-column workspace, collapsible navigation, survey room cards, camera capture, signature and packing checklists |
| Phone, proposed <768 px | One task per screen, stacked cards, large scan/camera buttons, sticky primary action, simple customer confirmations and driver directions |

These are three deliberate layout variants sharing React business state and components. Device rotation and intermediate widths must work. Phone users must still access every authorized essential task; provide a guided report-configuration wizard where a desktop canvas is impractical.

Field drafts, scans, time entries, and media upload queues must survive temporary network loss. Show “Saved on this device” separately from “Synced”. Resolve edit conflicts explicitly, expire/purge local sensitive caches, and prevent user switching from exposing another user's drafts. Authoritative approvals, dispatch, and financial posting require server acknowledgement; never show a queued action as completed.

Accessibility target: WCAG 2.2 AA, keyboard access, descriptive labels, visible focus, readable contrast, practical touch targets, and screen-reader feedback. Support translation resources and configurable local display formats. Pilot usability target: at least 8 of 10 representative users complete lead capture, packing confirmation, and customer approval with no assistance after a brief introduction.

## 15. Template-based reports

- Provide starter templates for quotation, survey inventory, packing list, labels, pickup checklist, manifest, warehouse stock, proof of delivery, labour hours/cost, material consumption/cost, trip kilometres/fuel, vendor expense, job profitability, financial statements, and audit changes.
- A permitted user can clone a template, choose allowed fields, rename headings, add filters/grouping/sorting/totals, select approved formulas, add branding/signature blocks, configure page size, preview, save a version, and publish for a role/branch.
- Support PDF/print and spreadsheet/CSV exports, saved filters, and optional scheduled delivery to authorized recipients. Re-check recipient permission at delivery/download time; sanitize spreadsheet formulas and escape untrusted template content.
- Use a controlled field catalogue and formula language. No arbitrary SQL, scripts, cross-tenant joins, or unrestricted external assets. Enforce row/field permissions before aggregation and on exports.
- Snapshot the rendered document and template version for accepted quotations, invoices, and confirmations. Later template edits do not alter evidence. Large reports run as background jobs with status, expiry, cancellation, and download authorization.

## 16. Technical architecture and transactions

The backend must use C# and three logical layers:

1. Controller / entry layer: HTTP routing, authentication integration, request binding, structural validation, and response mapping. Cloud-specific handlers belong here.
2. Business layer: all business validation, permission scope decisions, pricing, cost calculations, workflow transitions, approvals, orchestration, and transaction boundaries.
3. Data access layer: database queries, repositories, persistence, locking/concurrency implementation, and transaction execution through interfaces owned by the business layer.

The existing `Movers.Api`, `Movers.Services`, and `Movers.DAL` projects map to these layers. `Movers.Domain` may hold business entities/rules as part of the business boundary; a separate project does not create an extra application tier. Controllers and function handlers must not query the database or implement pricing/workflows. React calculations may preview values, but the server recalculates authoritative results.

Support SQL Server and PostgreSQL through tested DAL implementations/migrations. Each installation selects one database; running a transaction across both providers is not required. Use tenant-scoped constraints, unique business document numbers, foreign keys, decimal money/quantities, UTC event timestamps plus display time zones, and explicit version tokens.

Atomic database transactions must cover quotation acceptance plus job creation when coupled; stock issue/return plus ledger/audit; package transfer plus custody/location; approved time/cost allocation; and invoice/payment plus journals/audit. Business services determine boundaries; DAL commits or rolls back. Mandatory audit write failure rolls back the business mutation.

Do not hold database transactions open while a customer decides, a file uploads, or an external provider responds. Use an outbox committed with business changes, idempotent workers, retry/dead-letter handling, and reconciliation for external effects. Payment webhooks, approval submissions, scans, and posting commands need scoped idempotency keys. Concurrent acceptance, stock issue, or package assignment must produce one valid result and a clear conflict, never silent overwrite.

Store media/documents in private object storage with metadata in the database. Use short-lived authorized upload/download URLs, checksums, size/type limits, malware scanning/quarantine, resumable upload, and abandoned-upload cleanup. An unavailable/quarantined file must not be represented as verified evidence.

## 17. Hosting on AWS, Azure, and in-house

| Concern | AWS deployment | Azure deployment | In-house deployment |
| --- | --- | --- | --- |
| C# request host | API Gateway + Lambda ASP.NET adapter | Azure Functions isolated-worker HTTP adapter | ASP.NET Core under supported service/container host |
| React assets | Object hosting/CDN | Static hosting/CDN | Web server/reverse proxy |
| Database | Reachable managed SQL Server/PostgreSQL | Reachable managed SQL Server/PostgreSQL | SQL Server/PostgreSQL |
| Files | Private S3 | Private Blob Storage | Private S3-compatible/object/file adapter |
| Background work | Queue/event-triggered workers | Queue/event-triggered Functions | Durable queue and worker service |
| Configuration/telemetry | Provider secrets and monitoring adapters | Provider secrets and monitoring adapters | Approved secrets store, logs/metrics, backup tooling |

Keep business and DAL code reusable. AWS and Azure require separate hosting adapters and deployment packages; Azure Functions ASP.NET integration must not be assumed to host the existing MVC routing pipeline unchanged. Verify equivalent API/auth/error contracts through adapter tests. See the official [AWS ASP.NET hosting guidance](https://docs.aws.amazon.com/lambda/latest/dg/csharp-package-asp.html) and [Azure isolated-worker guidance](https://learn.microsoft.com/en-us/azure/azure-functions/dotnet-isolated-process-guide).

Select a .NET version supported by all chosen target hosts at implementation time. Keep SDK-specific storage, queue, secrets, and messaging calls behind interfaces. No dependency on durable local serverless disk, process memory, sticky sessions, or a long HTTP request. Large exports, video processing, notification batches, and document generation use restartable background jobs. Control database connection counts during function scale-out.

Provide versioned infrastructure/configuration templates, separate environments, migration/rollback procedures, health checks, centralized correlation IDs, and deployment smoke tests for all three hosts. In-house must have equivalents for scheduling, retry queues, TLS, backups, and customer access; it must not require an AWS/Azure account for core operations.

Google navigation should use universal Maps URLs; see [Google Maps URL guidance](https://developers.google.com/maps/architecture/maps-url). Paid route-distance/geocoding integrations are optional and require separate configuration, quota/error handling, and cost approval.

## 18. Audit, security, and operating quality

- Preserve append-only business audit records with company, actor/delegation, action, entity/version, UTC timestamp, reason, correlation ID, and safe before/after values. Include approvals, exports, sensitive reads, sharing/revocation, role changes, financial reversals, overrides, and custody events.
- Never log passwords, raw share tokens, authentication secrets, full payment credentials, or unrestricted media. Restrict audit access; define retention and protected archival, tamper detection, and legal holds. Application users cannot erase audit history.
- Enforce TLS, encryption at rest, secure secret storage/rotation, least privilege, MFA for privileged users, session revocation, account recovery, rate limiting, upload protection, and server-side authorization. Tenant filtering must apply to background jobs, caches, files, reports, and links as well as APIs.
- Define retention by record class and applicable jurisdiction; allow authorized correction/deletion of personal data with financial/evidence retention exceptions. Obtain consent for home recordings and location collection.
- Proposed sizing baseline for validation: 100 concurrent staff in one tenant, 100,000 jobs per tenant, 1,000 items per survey, and 5,000 packages per trip. Validate representative datasets and report complexity before promising capacity.
- Proposed performance targets: p95 ordinary API response ≤2 seconds excluding media transfer and external-provider time; first usable ordinary screen ≤3 seconds on agreed test networks; accepted scan visibly acknowledged within 2 seconds when online. Measure warm and cold serverless paths separately.
- Proposed operational targets: 99.9% monthly service availability, recovery point ≤15 minutes, recovery time ≤4 hours. These require approved infrastructure, backup/restore drills, and monitoring for each host; they are requirements targets, not current guarantees.
- Alert on failed approvals, delayed outbox work, unreceived handovers, stock discrepancies, failed backups, expiring vehicle documents, and unreconciled costs. Provide support diagnostics without exposing customer secrets.

## 19. Delivery sequence and acceptance

1. Foundation: tenants, identity, roles, masters, audit, host adapters, transactions, mobile layout patterns.
2. Sales: leads, follow-ups, survey/video/images, secure customer review, versioned quotations.
3. Field operations: jobs, appointments, packing reconciliation, materials, employee time, labels, customer acknowledgements.
4. Logistics: warehouse, consolidation, transport, fuel/expenses, delivery and claims.
5. Finance and insight: full posting/reconciliation, profitability, template designer, operational/financial reports.
6. Production gate: cross-host and database-provider validation, security, accessibility/usability, offline conflicts, scale, and recovery drills.

Acceptance must demonstrate a complete move with a revised survey, accepted quotation, an extra pickup item, a customer-retained item, a split/repacked package, named crew time, returned material, a consolidated trip, actual kilometres, partial delivery, and a resolved claim. It must also demonstrate rollback, retry without duplication, forbidden cross-company access, revoked links, concurrent edits, and reproducible costs after rate changes. Use the individual acceptance criteria in the companion specification as the test catalogue.

## 20. Decisions to finalize before production

The following do not block documenting or prototyping the product: operating countries/tax rules; currency and fiscal policy; signature/OTP assurance; retention periods; deployment/network/public-portal policy; initial language set; actual volumes and recovery budgets; employee loaded-rate and overtime policy; material valuation; shared-trip/empty-kilometre allocation; finance posting/recognition; approval thresholds; and integrations for messages, payments, conferencing, insurance, or payroll. Record an owner and due date for each decision before its affected release.
