---
document_type: product_requirements_meta_template
product: Movers and Relocators
version: "1.0"
date: "2026-10-03"
status: proposed_baseline
language: en
plain_language_specification: REQUIREMENTS.md
implementation_status: not_assessed
priority_definition:
  must: required_for_complete_product
  optional: separately_approved_extension
---

# Movers and Relocators — Structured Requirements and Meta Template

## 1. Interpretation and use

“Meta template” means a reusable requirement schema populated for this product. This document and [the plain-language requirements](REQUIREMENTS.md) describe the same target scope. They do not certify existing code. Requirement IDs below are stable test/backlog references; detailed business explanations and shared rules in the normal specification are incorporated by reference. If a requirement changes, update both documents and increment their versions.

Every populated requirement below has priority **must**, status **proposed**, tenant-scoped access, and the shared security/audit/transaction rules unless explicitly marked otherwise. Owners are accountable roles, not named assignees. Dependencies identify prerequisite capabilities, not deployment order restrictions. Evidence must prove the behavior, not merely that an endpoint exists.

## 2. Reusable requirement record

```yaml
id: MR-<AREA>-<NNN>
title: <short business outcome>
priority: must | optional
status: proposed | agreed | implemented | verified | deferred
owner: <accountable business role>
actors: [<human or system roles>]
problem: <real-world problem>
trigger: <event that starts the use case>
preconditions: [<required state and permissions>]
inputs: [<fields, units, source, required/optional>]
workflow: [<ordered observable behavior>]
business_rules: [<invariants and calculations>]
outputs: [<record, state, document, event>]
exceptions: [<failure, override authority, recovery>]
authorization: <tenant, branch, assignment, action, field scope>
transaction: <atomic writes, concurrency and idempotency rules>
audit: [<events and safe evidence>]
ui: {laptop: <layout>, tablet: <layout>, phone: <layout>}
dependencies: [<requirement IDs>]
acceptance:
  - given: <starting state>
    when: <action>
    then: <measurable outcome>
evidence: [<test, example document, stakeholder validation>]
open_decisions: [<decision, owner, due-before milestone>]
source: <business request or linked specification section>
```

For backlog expansion, instantiate this schema per requirement. The compact catalogue below supplies outcomes, rules, dependencies, and acceptance examples; normal-specification sections supply detailed inputs, exceptions, and device behavior. Missing implementation/test evidence must remain blank or “not assessed”, never “passed”.

## 3. Product metadata and boundaries

| Attribute | Required value |
| --- | --- |
| Objective | Trace household moves and customer agreements while measuring actual cost and improving estimates |
| Core actors | Sales, surveyor, customer/representative, planner, packer, warehouse operator, driver, finance, manager, administrator/auditor |
| Tenancy | Company isolation with branch and job-assignment restrictions; single-company in-house mode supported |
| Backend | C#; Controller/entry → Business → DAL logical layers; all business rules server-side |
| Frontend | React; deliberately different laptop/tablet/phone layouts with common authoritative API |
| Hosts | AWS Lambda, Azure Functions, in-house; deployment choice, not mandatory cross-cloud active-active |
| Database | SQL Server or PostgreSQL selected per installation, tested migrations and DAL behavior |
| Storage | Private external document/media storage with permission-aware upload/download |
| Reports | Controlled template designer, authorized datasets, versioned PDF and spreadsheet exports |
| Optional extensions | AI inventory suggestions, live GPS telemetry, payroll processing, international customs |
| Source of business detail | REQUIREMENTS.md sections 1–20 |

## 4. Requirement catalogue

### Foundation and experience

| ID | Owner / dependencies | Required outcome and rules | Acceptance criterion |
| --- | --- | --- | --- |
| MR-SEC-001 | Administrator / none | Tenant, branch, assignment, action and field authorization on APIs, files, jobs and reports; restricted support access | Given a user from company A, when requesting a company B identifier in any API/export/file path, no B data is returned and the attempt is logged safely |
| MR-SEC-002 | Administrator / SEC-001 | User lifecycle, roles, MFA for privileged access, recovery, session revocation, approval separation | When an account is disabled or a role removed, subsequent authorized actions are denied according to the documented token-revocation policy; self-approval above limit fails |
| MR-MST-001 | Administrator / SEC-001 | Maintain all master groups in normal section 13 with codes, effective dates, units, validation, active state and audit | When a used material/rate is deactivated or changed, old jobs retain their names/rates/snapshots while new selections use current permitted values |
| MR-UX-001 | Product owner / SEC-001 | Plain-language React guided tasks; laptop ≥1200px, tablet 768–1199px, phone <768px as initial breakpoints | At 1366px, 1024px and 390px, representative tasks use the dedicated layout without hidden mandatory controls or page-level horizontal overflow; rotation preserves drafts |
| MR-UX-002 | Operations / UX-001 | Offline field drafts, queued scans/media/time, explicit sync state and conflict resolution | When two devices edit the same item offline, synchronization preserves evidence and requests conflict resolution; no lost update or false dispatch confirmation occurs |
| MR-UX-003 | Product owner / UX-001 | Accessibility and practical usability, translation-ready labels | Keyboard and screen-reader checks satisfy the agreed WCAG 2.2 AA assessment; at least 8/10 pilot users complete each selected core task unaided after introduction |

### Sales, survey, quotation, and sharing

| ID | Owner / dependencies | Required outcome and rules | Acceptance criterion |
| --- | --- | --- | --- |
| MR-CRM-001 | Sales / MST-001 | Enquiries, contacts, addresses, source, owner, service/date needs, duplicate review and safe merge | Saving a repeated phone/email flags possible matches; an approved merge retains both histories and every linked survey/quote |
| MR-CRM-002 | Sales / CRM-001 | Follow-ups, outcomes, reminders, reassignment, overdue escalation and lost reasons | An overdue follow-up appears in the owner's task list; completing it records outcome and next action without deleting history |
| MR-SUR-001 | Survey manager / CRM-001, MST-001 | Survey scheduling, modes, staff availability, reschedules and customer appointment confirmation | A conflicting surveyor assignment is flagged; rescheduling keeps the old appointment and records the new customer response |
| MR-SUR-002 | Surveyor / SUR-001 | Stable room/item inventory, quantities, dimensions, weight/volume, condition, access, exclusions, risks and resource estimates | A sofa with restricted lift access and dismantling needs produces visible planning/pricing inputs; excluded items remain visible in customer review |
| MR-SUR-003 | Surveyor / SUR-002, ARC-004 | Video-call link, consented media, timestamp/item tagging and image-based survey review | A customer uploads room photos and a video; staff link them to items, mark unseen rooms unresolved and cannot silently treat proposed quantities as verified |
| MR-SUR-004 | Surveyor / SUR-002, SHR-001 | Versioned customer survey review with additions, disputes and correction workflow | Customer requests one extra chair; staff revise inventory and request confirmation of v2; acceptance of v1 does not approve v2 |
| MR-QUO-001 | Sales manager / SUR-002, MST-001 | Direct/survey quotation, charge bases, cost/price separation, taxes, validity, terms and rate snapshots | Recalculation reproduces stored line/tax totals; changing today's material rate leaves yesterday's quotation unchanged |
| MR-QUO-002 | Sales manager / QUO-001, SHR-001 | Approval thresholds, revision history, customer accept/decline/change, immutable acceptance | A superseded/expired quote cannot be accepted; a below-limit margin requires manager approval; acceptance records exactly one valid revision |
| MR-QUO-003 | Operations / QUO-002, ARC-002 | Idempotent accepted-quote conversion to job, deposit gating and priced scope changes | Retrying conversion returns the same job; an extra pickup item requires an approved change order or labelled authorized exception |
| MR-SHR-001 | Security owner / SEC-001, AUD-001 | Purpose-scoped, hashed-token links, expiry/revocation, verification, safe fields and rate limits | Revoked link fails; quotation link exposes no labour rates; a link-preview GET cannot approve; repeated submit records one decision |
| MR-SHR-002 | Customer service / SHR-001 | Survey, pickup, packing/material, delivery and quotation confirmations; representative/refusal workflows | Customer refuses packed-item confirmation; record remains disputed, an owner is assigned, and any supervisor override remains visibly distinct from customer acceptance |

### Packing, people, and materials

| ID | Owner / dependencies | Required outcome and rules | Acceptance criterion |
| --- | --- | --- | --- |
| MR-OPS-001 | Planner / QUO-003, MST-001 | Job/shipments, schedules, crews, skills, vehicles, capacity, checklists and no-show/access exceptions | Double-booked crew/vehicle is detected; rescheduling preserves prior allocation and customer confirmation history |
| MR-PKG-001 | Packing supervisor / OPS-001, SUR-004 | Package IDs/labels, item quantities/components, condition/seals, customer-packed declarations and unboxed units | Two parts of one bed in separate boxes retain their parent item; scanning only one does not mark the bed complete |
| MR-PKG-002 | Packing supervisor / PKG-001, SHR-002 | Reconcile packed, unboxed, retained/excluded and unresolved items; record customer scope/condition confirmation | Of 12 agreed items, 10 packed and one retained leave one unresolved; normal pickup closure fails until corrected or formally excepted |
| MR-PKG-003 | Operations / PKG-001, ARC-002 | Repack/split/merge lineage, label reprints, scan deduplication and custody manifests | Repacking P1 into P2/P3 retires P1 without losing contents/history; scanning P1 cannot add a live package |
| MR-MAT-001 | Stores manager / MST-001, ARC-002 | Receipts, transfers, reservation, issue, consumption, wastage, return, reusable stock and valuation | Issue 20 cartons, consume 16, waste 1, return 3: stock and job cost reflect 17 used/wasted at snapshotted issue cost |
| MR-LAB-001 | Supervisor / OPS-001, MST-001 | Named worker/activity time, breaks, overtime, approvals, overlap prevention and corrections | Three workers each record four elapsed hours and 0.5 unpaid break: approved total is 10.5 person-hours; overlapping paid work is rejected |
| MR-LAB-002 | Finance / LAB-001, FIN-003 | Effective loaded rates, regular/overtime split, allowances, contract-labour accrual reconciliation | A rate change does not alter approved historical cost; matching a contractor bill replaces/reconciles its accrual rather than doubling expense |
| MR-EST-001 | Estimating manager / LAB-002, MAT-001, FIN-004 | Estimate/actual variance and reviewed historical productivity/material norms | A completed job appears in comparable samples with hours/volume and variance reasons; proposed norm change requires manager publication |

### Logistics, delivery, and claims

| ID | Owner / dependencies | Required outcome and rules | Acceptance criterion |
| --- | --- | --- | --- |
| MR-WHS-001 | Warehouse manager / PKG-003 | Scan inbound/outbound, bin location, custody, storage charges, stock counts and discrepancies | A bin transfer retains prior location and custodian; a missing count item opens an investigation without silently changing stock |
| MR-CON-001 | Dispatcher / WHS-001, OPS-001 | Route-compatible consolidation, volume/weight/time constraints, separate customer ownership and partial loads | Two customers share a trip within capacity; each manifest and customer view contains only its own packages; overload is blocked |
| MR-TRN-001 | Dispatcher / CON-001 | Multi-leg trips/stops, vehicles/drivers/vendors, dispatch gates, handovers, breakdowns and ETA | On vehicle breakdown, replacement handover retains every scan/custodian; a package cannot be active on conflicting legs |
| MR-TRN-002 | Driver / TRN-001 | Open Google Maps from verified address/coordinates with fallback contact/address | Directions action launches an encoded destination; unavailable navigation still exposes copyable job address; map opening does not invent actual kilometres |
| MR-FUL-001 | Transport manager / TRN-001 | Approved actual kilometres, reading evidence, business/empty/detour separation, fuel basis and variance | 180km at 9km/litre and 100/litre produces 2,000 expected fuel cost; negative odometer distance is rejected |
| MR-FUL-002 | Finance / FUL-001, FIN-003 | Fuel purchase/consumption reconciliation and no duplicate accrual or fuel-inclusive carrier charge | Actual reconciliation replaces estimate in final cost; fuel bought but remaining in tank is not all charged as trip consumption |
| MR-CON-002 | Finance / CON-001, FUL-002 | Shared-cost allocation by snapshotted per-leg basis with rounding and empty-running policy | Source trip cost 3,000 allocated 60%/40% yields 1,800/1,200; job allocations and rounding reconcile exactly to source |
| MR-DEL-001 | Delivery supervisor / TRN-001, SHR-002 | Appointment, receiver, scans, condition, item checks, partial/refused delivery and proof | 18 of 20 packages delivered produces partial delivery with two outstanding; signed exceptions remain exceptions |
| MR-CLM-001 | Claims manager / DEL-001, AUD-001 | Incident/claim evidence, ownership, deadline, investigation, compensation and linked adjustments | A missing-item claim links survey, package and custody evidence; approved compensation creates a traceable financial adjustment |
| MR-CLS-001 | Operations / DEL-001, CLM-001, FIN-004 | Separate operational/financial closure, explicit exceptions and audited reopening | Clean closure fails with unaccounted package or unapproved cost; permitted closure with outstanding receivable records policy and approver |

### Finance, reports, architecture, and operating quality

| ID | Owner / dependencies | Required outcome and rules | Acceptance criterion |
| --- | --- | --- | --- |
| MR-FIN-001 | Finance manager / MST-001, ARC-002 | Invoice, deposit, receipt, supplier bill, payment, employee advance, reimbursement, refund and partial allocation | A payment can settle parts of two invoices without exceeding its amount; duplicate supplier invoice is flagged/blocked by configured rule |
| MR-FIN-002 | Accountant / FIN-001 | Balanced postings, explicit recognition rules, reversals, period locking, ledgers, ageing and reconciliation | Unbalanced journal and closed-period posting fail; correcting a posted bill creates linked reversal/adjustment with original retained |
| MR-FIN-003 | Finance manager / FIN-001 | Expense evidence/approvals and estimate/commitment/accrual/actual reconciliation | A vendor bill matched to its accrued charge changes payable/actual position once; paying it does not create a second operating expense |
| MR-FIN-004 | Finance manager / FIN-002, LAB-002, MAT-001, CON-002 | Job margin by separate labour/material/fuel/vehicle/vendor/storage/claims/overhead buckets | Drill-down cost totals agree with source entries and ledger; collections are displayed separately from revenue |
| MR-RPT-001 | Reporting owner / SEC-001, FIN-004 | Starter operational/financial templates, approved field/formula catalogue, branding, filter/group/totals, version/publish | Authorized user clones profitability template and adds grouped material/labour totals; unauthorized salary fields cannot be selected or inferred via totals |
| MR-RPT-002 | Reporting owner / RPT-001, ARC-003 | PDF/print/CSV/spreadsheet, snapshots, asynchronous exports and controlled schedules | Editing template v2 leaves accepted v1 PDF unchanged; revoked recipient loses download access even to an already generated report |
| MR-ARC-001 | Technical lead / none | C# three-layer boundaries; reusable business/DAL; React authoritative-server contract | Architecture checks and review find no DAL access in controllers and no pricing/workflow rules in cloud handlers |
| MR-ARC-002 | Technical lead / ARC-001 | Transactions, optimistic concurrency, uniqueness and idempotency on critical writes | Injected failure between stock and audit writes rolls everything back; duplicate acceptance or payment submission commits once |
| MR-ARC-003 | Technical lead / ARC-002 | Atomic outbox, durable background work, retry/dead letters and reconciliation | Crash after commit but before notification leaves a retryable outbox event; worker replay does not duplicate the business effect |
| MR-ARC-004 | Security lead / SEC-001 | Private media, authorized short-lived URLs, quarantine, type/size/checksum validation and resumable upload | Unscanned upload remains unavailable as approved evidence; another tenant cannot fetch it by changing object ID |
| MR-HST-001 | Infrastructure lead / ARC-001, ARC-003 | AWS Lambda, Azure Functions isolated worker and in-house packages/adapters with equivalent API behavior | The same contract suite and sample move pass in each host; in-house core flows work with no cloud-account dependency |
| MR-DAT-001 | Data lead / ARC-002 | SQL Server/PostgreSQL migrations, constraints, decimal values, tenant indexes, UTC/version semantics | Transaction/concurrency and migration upgrade tests pass on both providers; production scripts do not rely on SQLite behavior |
| MR-AUD-001 | Auditor / ARC-002 | Append-only safe before/after, identity/version/reason, sharing, approval, override and custody history | Auditor reconstructs survey-to-delivery revisions and support actions; normal user cannot alter history; raw tokens/passwords never appear |
| MR-NFR-001 | Operations lead / HST-001 | Capacity/performance and monitoring targets in normal section 18 | Load test at agreed baseline reports warm/cold p95 separately and demonstrates target response time or records a release-blocking variance |
| MR-NFR-002 | Infrastructure lead / HST-001, DAT-001 | Backup/restore, availability, recovery, secrets, migrations and rollback | A restore drill recovers linked database/files within proposed RPO 15min/RTO 4h; per-host runbook and measured evidence exist |
| MR-PRV-001 | Privacy owner / AUD-001, ARC-004 | Consent, retention, deletion/correction, legal holds and local-device cache protection | A permitted deletion removes eligible media/local cached access while retaining legally required protected financial evidence under recorded policy |

## 5. Core entity model and relationships

| Aggregate | Required relationships / data invariants |
| --- | --- |
| Tenant / Branch / User / Employee | Tenant owns branch and business records; user identity may link to employee; assignment does not replace authorization |
| Customer / Contact / Address | Customer can have many leads/jobs/contacts; snapshot historical move addresses separately from current contact address |
| Lead / FollowUp | Lead has owner and activities; conversion preserves originating links; direct workflows allowed |
| Survey / SurveyVersion / SurveyItem / Evidence | Version owns stable-item snapshots, quantities, rooms, access and media references; customer response names a version |
| Quotation / Revision / Charge / TaxComponent | Revision references its inventory and cost assumptions; accepted revision immutable; change order references predecessor |
| Job / Shipment / Stop | Job originates from accepted commercial scope or explicit exception; shipments partition operational movements |
| Package / PackageContent / PackageLineage | Contents link item quantity/components; lineage preserves repacking; handling-unit IDs unique per tenant and externally opaque |
| Manifest / CustodyEvent / WarehouseLocation | Each package has one current custody/location state; movements append evidence and respect leg ordering |
| MaterialStock / StockMovement / Valuation | Quantity/UOM conversions and valuation reconcile; corrections use movements, not historical overwrite |
| TimeEntry / RateSnapshot / CostEntry | Approved hours and rate basis reproducible; allocations conserve hours and source money |
| Trip / Leg / Odometer / Fuel / Expense / Allocation | Per-leg distance and business classification; cost allocation totals source once |
| Invoice / Receipt / Bill / Payment / Journal | Financial document links source job/vendor; posted journal balanced and immutable except reversal |
| ShareGrant / CustomerResponse | Purpose/resource/version scope; hashed token; expiry/revocation; exact evidence snapshot |
| Claim / Resolution | Evidence links remain accessible under retention policy; compensation links finance adjustment |
| ReportTemplate / TemplateVersion / ExportJob | Published template version and parameter snapshot preserved; dataset/recipient permission checked |
| AuditEvent / OutboxEvent | Mandatory audit/outbox writes participate in source transaction; safe payloads and retry state |

## 6. Workflow contracts

| Workflow | Normal states | Gate / exception |
| --- | --- | --- |
| Lead | New → Contacted → Survey planned → Quoted → Won / Lost | Lost reason required; next-action ownership retained |
| Survey | Draft → Scheduled → In progress → Staff reviewed → Customer review → Confirmed | Correction creates new version; incomplete media/access remains unresolved |
| Quotation | Draft → Internal approval → Shared → Accepted / Declined / Expired / Superseded | Only current valid approved revision accepts; scope change creates revision/change order |
| Job | Planned → Ready → Packing → Picked up → Stored/In transit → Partially delivered/Delivered → Operationally closed | Can repeat storage/transit per leg; cancellation/reopening requires reason and reconciliation |
| Package | Planned → Packed → Loaded/Stored → In transit → Received → Delivered | Repeat custody legs allowed; damaged/missing/held are explicit exception flags; repacked IDs retire |
| Confirmation | Issued → Viewed → Confirmed / Correction requested / Declined | Expired/revoked grants cannot submit; GET has no approval side effect |
| Expense | Draft → Submitted → Approved → Accrued/Posted → Settled | Rejected/adjusted states retain history; settlement is distinct from expense recognition |
| Financial document | Draft → Approved → Posted → Partially settled/Settled | Posted corrections use reversal/adjustment; closed periods block new posting |
| Claim | Open → Investigating → Resolution proposed → Approved → Resolved | Rejection/reopening reason required; financial resolution linked |

State lists are product defaults. Administrators may rename labels or configure optional steps, but mandatory invariant checks stay enforced in the business layer.

## 7. Calculation contracts with test fixtures

All examples use fictional currency units (CU), not prescribed employee, fuel, tax, or selling rates. Store decimal values; define rounding at line/document/allocation boundaries and preserve residuals deterministically.

| Calculation | Formula / fixture | Required result |
| --- | --- | --- |
| Person-hours | Sum(end − start − unpaid breaks); 3 × (4 − 0.5) | 10.5 hours |
| Labour cost | Sum(regular hours × regular loaded rate + overtime hours × overtime loaded rate) + allocated allowances; 8 × 200 + 2 × 300 | 2,200 CU before allowances |
| Net material issue | Issued − returned; 20 − 3; consume 16 + waste 1 | 17 units accounted as used/wasted; zero outstanding |
| Disposable material expense | (Consumed + wasted) × issue valuation; 17 × 50 | 850 CU; no duplicate purchase expense |
| Actual trip distance | Approved end − start; 12,480 − 12,300 | 180 km |
| Efficiency fuel estimate | km ÷ km/litre × CU/litre; 180 ÷ 9 × 100 | 2,000 CU |
| Distance-rate fuel estimate | km × CU/km; 180 × 11 | 1,980 CU; alternative basis, not additional cost |
| Consumed fuel | Opening 20L + purchased 30L − closing 32L, no transfers | 18L; purchasing 30L does not imply consuming 30L |
| Shared trip allocation | Cost × occupied-leg volume-km share; 3,000 × 0.6 / 0.4 | 1,800 + 1,200 = 3,000 CU |
| Job contribution | Recognized net revenue − direct cost; 10,000 − (2,200 + 850 + 2,000 + 1,000) | 3,950 CU before overhead/other costs |
| Margin percentage | Contribution ÷ net revenue × 100 | 39.5%; zero revenue displays undefined rather than divide-by-zero |

Cost-source identity must prevent double-counting contractor time and its bill, estimate and actual fuel, purchase and stock consumption, or carrier-included fuel. Rates and allocation weights are snapshotted. Shared sources cannot allocate beyond 100%; unallocated balances remain visible.

## 8. Fully populated example: packing reconciliation

```yaml
id: MR-PKG-002
title: Confirm packed and left-behind items before pickup
priority: must
status: proposed
owner: Packing supervisor
actors: [Packing crew, Customer or authorized representative, Operations approver]
problem: Items omitted or moved without agreement cause missing-package disputes.
trigger: Crew requests pickup completion.
preconditions:
  - User has assigned-job packing permission.
  - Current inventory and accepted changes are available.
inputs:
  - Stable item IDs, expected quantities/components and current inventory version.
  - Active package IDs and content quantities, including unboxed handling units.
  - Customer-retained quantities, condition evidence and exception reasons.
workflow:
  - Reconcile each included item quantity and component against handling units.
  - Show room-by-room differences and the left-behind checklist.
  - Resolve differences or submit an explicit exception for authorized review.
  - Save an immutable packing snapshot and issue its customer confirmation link.
  - Record customer confirmation, correction or refusal against that snapshot.
business_rules:
  - A repacked retired ID cannot satisfy the live manifest.
  - Unresolved quantities block normal completion.
  - Staff override is not customer approval.
  - Changed contents invalidate the prior snapshot for the changed scope.
outputs: [Packing snapshot, Response or exception, Pickup readiness decision]
exceptions:
  - Customer absent requires representative authority or exception owner.
  - Offline state is pending until server acknowledgement.
authorization: Tenant and assigned-job scope; override permission separate from packing.
transaction: Validate version and atomically persist snapshot/readiness/audit/outbox; customer wait is outside transaction.
audit: [Actor, Version, Differences, Reason, Response identity, Server timestamp]
ui:
  laptop: Side-by-side inventory and package reconciliation.
  tablet: Room checklist with scan, photos and review.
  phone: One room or package at a time with persistent unresolved count.
dependencies: [MR-PKG-001, MR-SHR-002, MR-ARC-002]
acceptance:
  - given: 12 included items; 10 packed; 1 explicitly retained by customer.
    when: Crew requests completion without accounting for item 12.
    then: Completion is blocked and the missing item is shown.
  - given: Current snapshot has a valid customer confirmation.
    when: A package content quantity changes.
    then: Prior evidence is retained and the changed scope requires reconfirmation.
evidence: [Integration test pending, Customer-screen review pending]
open_decisions: [Operations owner to approve exception thresholds before field pilot]
source: REQUIREMENTS.md sections 7 and 8
```

## 9. Verification matrix and release gates

| Test group | Required evidence |
| --- | --- |
| Business rules | Golden calculation fixtures, state transition rejection cases, immutable versions and cost-source reconciliation |
| Database integrity | Failure injection, concurrent acceptance/stock/manifest tests, replayed requests, SQL Server and PostgreSQL migration/upgrade tests |
| Customer trust | Expired/revoked/replayed links, preview GET, incorrect version, representative/refusal flows, complete response snapshots |
| Field reliability | Offline scans/drafts, interrupted media upload, device restart/user switch, conflicting edits and server-authoritative completion |
| Tenant/security | Cross-company/branch APIs, workers, reports, cached files, exports; unauthorized cost fields and support access |
| Devices/usability | Laptop/tablet/phone acceptance, rotation, accessibility checks and observed pilot task completion |
| Hosting | Contract and end-to-end smoke tests on AWS Lambda, Azure Functions and in-house; provider outage and queue replay |
| Operations | Capacity/load report, cold-start metrics, alert exercise, backup/file restore, RPO/RTO measurements and rollback exercise |
| Full move | Revised survey → accepted quote → extra/retained items → pack/repack → named labour/material returns → consolidation/fuel → partial delivery/claim → finance closure |
| Reporting | Template edits, export formatting/totals, safe formulas, restricted fields/aggregates, historical snapshots and revoked recipients |

No module is verified until its acceptance evidence is recorded with environment, version, tester, date, and result. Financial release additionally requires accountant sign-off on configured posting/tax policies. Production requires documented host-specific recovery tests and resolved critical security/data-integrity failures.

## 10. Open-decision register

| ID | Decision / proposed starting assumption | Accountable role | Due before |
| --- | --- | --- | --- |
| D-01 | Countries, invoice/tax rules, currency and financial year; no statutory rates assumed | Finance lead | Finance configuration approval |
| D-02 | Hosting/database choice and public customer portal; all three deployment options remain supported | Infrastructure lead | Deployment pilot |
| D-03 | Seven-day link default, OTP/signature/representative assurance by action | Business/security owners | Customer approval pilot |
| D-04 | Retention, consent, deletion, legal holds and audit archival | Privacy owner | Real customer media collection |
| D-05 | Loaded-rate, productive-hours divisor, overtime and allowances | HR/finance | Labour costing rollout |
| D-06 | Weighted-average material valuation and reusable-asset policy | Finance/stores | Stock opening balances |
| D-07 | Fuel basis, odometer exception rules, volume-km allocation and empty-running policy | Transport/finance | Consolidated trip costing |
| D-08 | Posting/recognition/accrual, closure, credit and approval thresholds | Accountant/operations | Financial posting pilot |
| D-09 | Actual sizing, network test profile, 99.9% availability and 15min/4h recovery budget | Product/infrastructure | Production acceptance |
| D-10 | Languages and messaging/payment/video providers; optional AI/GPS/payroll scope | Product owner | Affected integration release |

## 11. Traceability to the original request

| Requested capability | Requirement references |
| --- | --- |
| Sales leads and follow-ups | MR-CRM-001–002 |
| Survey, video survey, image survey, quotation | MR-SUR-001–004; MR-QUO-001–003 |
| Customer links and approvals | MR-SHR-001–002; MR-SUR-004; MR-QUO-002 |
| Household shipments, pickup, packed/left-behind items | MR-OPS-001; MR-PKG-001–003; MR-DEL-001; MR-CLM-001 |
| Materials, named employees, person-hours, future estimating | MR-MAT-001; MR-LAB-001–002; MR-EST-001 |
| Consolidation, transport, Google Maps, kilometres and fuel | MR-WHS-001; MR-CON-001–002; MR-TRN-001–002; MR-FUL-001–002 |
| Separate employee, material, vendor, fuel and other expenses | MR-FIN-001–004; MR-LAB-002; MR-FUL-002 |
| Users, roles/permissions, audit and change history | MR-SEC-001–002; MR-AUD-001; MR-PRV-001 |
| Layperson UI, React, laptop/tablet/phone styles | MR-UX-001–003 |
| C#, controller/business/DAL, transactions | MR-ARC-001–004; MR-DAT-001 |
| AWS Lambda, Azure Functions, in-house | MR-HST-001; MR-NFR-001–002 |
| User-designed reports from templates | MR-RPT-001–002 |
| Appropriate master data | MR-MST-001 and REQUIREMENTS.md section 13 |

The authoritative external architecture references are linked in REQUIREMENTS.md section 17. Runtime versions, provider limits, and jurisdiction-specific financial/legal rules must be checked when implementation/deployment choices are finalized.
