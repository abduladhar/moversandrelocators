# Packing module

Packing jobs are separate from pickups. The pickup module is unchanged, including its own packing tab; it is planned to be slimmed down later.

## Use
1. **Operations › Packing** in the left menu, below Pickup (permission `packing.manage` or `operations.manage`) → **Create packing job** from a pickup, a quotation, or directly. Customer details are copied from the source.
2. **Crew** tab: assign employees with roles. Roles come from the business master `crew-role`.
3. **Boxes & labels** tab:
   - **Pack a box**: choose a box type, a room, the items with quantities, fragile and notes, and optionally *Identical boxes*. Each box gets a tracking number `PKB-yyyyMMdd-nnnnnn`.
   - After packing, use **Print label** and stick it on the box. Labels are 4×6 in, with the logo, box n / N, a QR tracking code, the customer, the address and the contents.
   - You can also **Print pending labels**, **Print selected**, **Reprint all**, or print one label per box. Every print records when the label was printed, and boxes still needing a label are counted in the register and the KPIs.
   - **Materials used** in the box window starts with the box type's standard materials. Change quantities, add or remove materials to record what was actually used for that box; **Use box type standard** reverts. Boxes with recorded materials show *materials edited* in the list.
   - Editing a box keeps its id and tracking number, so a label already stuck on stays valid. Removing a box invalidates its label.
4. **Materials** tab:
   - Box materials are calculated automatically from the packed boxes: each box's recorded materials, or its box type's standard (Operations setup › Box types).
   - Extra materials can be added; leave the cost blank to use the material's current unit cost.
5. **Income & expense** tab:
   - **Receive payment** prints a receipt; **Record expense** uses categories from `expense-category`.
   - Each entry has its own currency and an exchange-rate snapshot.
6. **Invoicing & billing** tab (`billing.view`): charges, invoices and bills with source `PACKING`.
7. **Complete** locks crew, boxes and materials and posts the material cost. Payments can still be recorded afterwards. **Reopen** reverses the material posting, and completing again re-posts it. **Cancel** blocks all edits until the job is reopened.
8. **Packing list** prints the job's boxes and contents.
9. **Customer confirmation** tab: three separate links, each with its own card (status, details, validity 1–30 days, **Create link** / **New link**, **Revoke**) and its own customer page. Send by WhatsApp, email or copy.
   - **Confirm packing date** (`/packing-date/<token>`): the customer taps *Yes, this date works* or chooses another time. The job shows *Customer confirmed*; an office date change returns it to *Not confirmed*.
   - **Share location** (`/packing-location/<token>`): the customer uses the phone's GPS (shown on a map), can correct the address and add directions for the crew. Staff see the coordinates with **Open in Maps**.
   - **Confirm packed items** (`/packing-items/<token>`, available once a box is packed): the customer reviews every box and confirms or requests corrections (name and authorization required). The response is tied to the exact list; if boxes change afterwards it shows *Outdated* and the customer can respond to the new list on the same link.
   - A link only works for its own purpose. Only a hash of the token is stored, so a link is shown once; a new link for the same purpose replaces the old one.

## Accounting
- **Payments and expenses** appear in the accountant's cash-posting queue (Billing › Cash) as source `PACKING`. Posting follows the same rules as pickup money:
  - A receipt is Dr cash/bank and Cr `2100` customer advance, or Cr `1100` when allocated to invoices.
  - An expense is Dr the mapped expense account and Cr cash/bank.
- **Material consumption** is posted when the job completes, in the tenant base currency, with journal reference `MAT-<job>-<n>`. It is recorded as a `MATERIALPOST` billing record.

  | Account | Debit | Credit |
  |---|---|---|
  | 5100 Material expense | material cost | |
  | 1300 Packing material stock | | material cost |

  Reopening posts a `REV-…` reversal.
- **Operation profitability** (Accounting reports) has a `PACKING` operation type. It includes invoices, bills, memos, cash expenses and material consumption.

## API (`/api/packing`, policy `packing.manage`, also satisfied by `operations.manage`)

| Purpose | Endpoint |
|---|---|
| Lookups | `GET masters`: box types with recipes, materials, active employees, crew roles, payment methods, income purposes, expense categories |
| Lookups | `GET sources`: pickups and quotations |
| Jobs | `GET` / `POST` |
| Jobs | `GET {id}` / `PUT {id}` |
| Jobs | `PUT {id}/status`, with values `PLANNED`, `IN_PROGRESS`, `COMPLETED` or `CANCELLED` |
| Crew | `PUT {id}/crew` |
| Boxes | `POST {id}/boxes` (`copies` 1–50; optional `materials` [{materialId, quantity}], null = box type standard) |
| Boxes | `PUT {id}/boxes/{boxId}` |
| Boxes | `DELETE {id}/boxes/{boxId}` |
| Boxes | `POST {id}/labels-printed` |
| Materials | `PUT {id}/materials` (extras only) |
| Money | `POST {id}/transactions` (`INCOME` / `EXPENSE`) |
| Customer links | `POST {id}/links` (`purpose` SCHEDULE / LOCATION / ITEMS, `validDays` 1–30; returns `url`) / `DELETE {id}/links/{purpose}` |

Customer (anonymous) API `/api/public/packing-jobs/{token}`: `GET` (includes `purpose`; boxes only for ITEMS), `POST schedule` (`scheduledAtUtc`), `POST location` (`latitude`, `longitude`, optional `address`, `notes`), `POST items` (`name`, `confirmed`, `notes`, `snapshotHash`).

Report Engine types: `PACKING_LABELS` (query `boxIds`), `PACKING_SHEET` and `PACKING_RECEIPT` (query `transactionId`). Designs are editable in Report designs.

## Storage
Tables:
- `PackingJobs` (number `PK-…`, concurrency `Version`; date confirmation, GPS location and directions, packing list response with the snapshot it applies to)
- `PackingJobLinks` (one customer link per purpose: token hash, expiry)
- `PackingJobCrew`
- `PackingJobBoxes` (tracking number unique per tenant; label printed time and count)
- `PackingJobBoxItems`
- `PackingJobBoxMaterials` (materials recorded per box, used when the box's `CustomMaterials` is set)
- `PackingJobMaterials` (`IsBoxRecipe`)
- `PackingJobTransactions` (number `PKT-…`)

Existing databases are upgraded at startup by `PackingSchema` (SQL Server and PostgreSQL). The same DDL is in `database/scripts/*/022_packing_jobs.sql` `023_packing_box_materials.sql` and `024_packing_customer_confirmation.sql`, and `database/generated/*` has been regenerated.

## Code
| Layer | Location |
|---|---|
| Domain | `Movers.Domain/Packing/PackingEntities.cs` |
| DAL | `Movers.DAL/Packing/` |
| Service | `Movers.Services/Packing/PackingService.cs` |
| Material posting | `Movers.Services/Billing/MaterialConsumptionPosting.cs` |
| API | `Movers.Api/Controllers/PackingController.cs` |
| Frontend | `src/packingApi.ts`, `src/pages/PackingJobsPage.tsx`, `src/pages/PackingJobDetailPage.tsx`, `src/components/packing/PackingCustomerTab.tsx`, customer pages `src/pages/CustomerPackingLinkPages.tsx` |

Tests: `PackingApiTests.cs`, and `tests/reporting-v2.test.mjs` for the packing layouts.
