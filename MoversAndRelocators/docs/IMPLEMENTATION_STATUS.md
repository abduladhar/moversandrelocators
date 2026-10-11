# Implementation status

Date: 2026-10-03. This file describes the new MoversAndRelocators project, not the original Movers checkout. Requirements remain the target, not an assertion of production readiness.

## Delivered and tested

| Area | Behavior present |
| --- | --- |
| Databases | SQL Server and PostgreSQL EF providers; live full-workflow integration tests on SQL Express and PostgreSQL 18; generated create scripts |
| Transactions | Atomic mutation/audit writes; serializable costing, trip allocation, confirmation, custody, claim and journal operations; tenant/master creation in one save |
| Foundation | Existing tenants, authentication, roles/permissions, employees/designations, audit, leads/follow-ups, survey/quotation/pickup modules copied into independent project |
| Labour | Named employee and activity, start/end/break, regular/overtime hours and rates, snapshotted cost, overlap and duplicate-request checks |
| Transport | Owned-vehicle trip planning, multi-pickup allocation weights, completion readings, kilometres, efficiency-based fuel, other trip cost, exact allocation, Maps links |
| Expenses | Categorized vendor/other expenses, supplier reference uniqueness, currency checks |
| Cost views | Separate labour, material usage, fuel, trip-other, vendor, miscellaneous and inherited pickup expenses; recorded income explicitly distinguished from ledger revenue |
| Reports | Authorized cost dataset, columns, sorting, clone/edit with concurrency, CSV formula escaping, browser print/PDF preview |
| Finance | Starter chart of accounts, balanced journal API/UI, immutable posted entries, reversal, currency-specific trial balance |
| Packing confirmation | Customer-safe frozen snapshot, named response/dispute, left-behind declaration, token hashing, revocation/expiry/rate limit, GET has no approval side effects |
| Custody | Stable package IDs after sharing, explicit state transitions, warehouse/location/receiver notes, scan replay checks, partial-delivery calculation, append-only handovers |
| Claims | Missing/damaged/late/left-behind/other issues, owner, resolution and concurrency token |
| Media | Lead-linked image/video/audio/PDF collection; private local or S3 storage; expiring capability URLs, size validation, immutable objects |
| UI | Existing React pages plus cost/finance, transport, shipment and customer-packing pages; laptop/tablet/phone CSS variants |

## Required follow-on work from the full specification

These are not represented as complete or fully tested:

- AWS Lambda and Azure Functions hosting adapters, deployment/IaC, equivalent host contract tests, durable queue/outbox workers, production secrets and disaster recovery.
- Production versioned schema migrations/upgrades; current startup creates only an empty database.
- Branch and assignment-based authorization throughout all inherited modules; more granular approval permissions, MFA, token refresh/revocation, and audit retention/tamper controls.
- Room/item/component-level reconciliation between confirmed survey and package contents, explicitly tracked unboxed goods, repacking lineage, proof photographs/seals, customer delivery confirmation and verified evidence. Current left-behind data is a staff declaration shown to the customer.
- Warehouse/bin masters, stock counts, actual material receipts/issues/returns/wastage and valuation. Current material cost comes from saved pickup usage quantities and unit-cost snapshots.
- Effective-dated employee rate masters, supervisor time approvals, payroll accrual reconciliation, productivity-based future quotation norms.
- Vehicle volume/weight capacity and schedule enforcement, multi-leg manifests, odometer evidence approval, actual tank-consumption reconciliation, fuel-inclusive carrier contracts, deterministic volume-kilometre allocation.
- Invoice/receipt/vendor-bill workflows, fiscal period locks, tax validation, reconciliations, financial statements beyond trial balance and automatic source-to-ledger posting.
- Versioned commercial change orders, full customer verification/OTP, survey/video annotations and review queues, retained immutable rendered quotation revisions.
- Report formulas/grouping/filtering/branding/signature templates, all operational report datasets, server-generated PDFs and scheduled exports.
- Offline persistence/conflict resolution, real-device/accessibility/usability testing, pagination/load targets, upload malware scanning and resumable upload.
- Explicit operational and financial job closure gates; current tracking shows package delivery completeness without claiming settlement or claim closure.

## Cost interpretation

Labour cost is calculated from the manually entered loaded rates saved with each time entry. Trip fuel is the distance/efficiency estimate recorded at completion, not measured tank consumption. Allocation weights are operator-supplied and snapshotted. Current pickup income is not an automatic revenue-recognition event. The journal ledger is separate; recording a cost does not silently post it again.

The UI warns users to record a source expense once. Existing free-form pickup expenses are shown as a separate legacy bucket; automatic matching/reconciliation between those entries, vendor bills, stock and accruals remains required.

## Test evidence

- Full suite: 25 passing tests with both live SQL Server and PostgreSQL enabled.
- End-to-end test covers tenant isolation, private media upload/download, tampered URLs, labour overlap/idempotency, vendor duplicate references, packed snapshot revocation/locking, customer confirmation, duplicate handovers, partial delivery, claims, consolidated fuel allocation, report export, journal balancing and reversal.
- Audit failure injection demonstrates that an invalid audit write rolls back the otherwise valid business write.
- Both provider schemas generate successfully.
- React TypeScript and production build pass; bundle-size optimization is outstanding.
- Browser visual inspection was unavailable because the in-app browser tab closed during creation. Do not treat CSS breakpoints as evidence of real-device acceptance.

See the root requirements for the complete product scope and acceptance criteria.
