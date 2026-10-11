# Report templates and PDF printing (Report Engine V2)

Report Engine V2 replaces the earlier DOM-capture designer. Templates are data-bound layouts: the server returns the document's data record and the browser renders the selected template against it. Ported from the Logipulse Report Engine V2 (Angular) to React.

## Usage
1. Open **Administration & setup → Report designs** (permission `reports.design`).
2. On the **Letterhead (logo & address)** tab, upload the logo and enter the company name, address, contacts, tax ID and footer note. Every report uses these.
3. On **Templates**, choose a document type. Then use one of:
   - **Create default template**: the standard layout, saved as the default.
   - **Create defaults for all documents without a template**.
   - **New template**, or edit, duplicate or import an existing one.
4. The designer opens with the latest real record of that type as preview data. Arrange elements, bind fields, switch to **Preview**, then **Save**. **Professional layout** rebuilds the standard design. **Letterhead** adds the logo and address block to the top of the page.
5. The first template saved for a type becomes its default. **Use as default** and **Offer at print** need `reports.publish`.
6. On the document or report, choose **Print / PDF**. The default template is preselected; templates marked "offer when printing" and the built-in standard layout can be chosen instead.

## Letterhead and standard layout
The letterhead is stored once per tenant and reaches templates through `{{company.name}}`, `company.logo`, `company.address`, `company.phone`, `company.email`, `company.website`, `company.taxId` and `company.footerNote`. Changing it updates every report without editing templates. Blank fields fall back to the tenant profile (name, address, phone, email). The footer note replaces the default "system generated" line printed in each page's bottom margin.

The standard layout, used when a type has no template and by **Create default template**, has:
- logo top-left; company name, address, contacts and tax ID top-right; an accent rule
- the document title with a meta block (number, dates, reference, currency…) and the party block
- a line-item table that flows across pages
- totals with the amount in words, notes or terms, and signature lines
- a page footer with page X of Y

Field paths are tailored for invoices, bills, receipts, payment vouchers, memos, quotations, pickup receipts, packing lists, warehouse receipts, job manifests and cost reports. Accounting reports are laid out from their data. Box labels are 4×6 in with the logo and a QR tracking code. Images bound to a field (`{{company.logo}}`) show their real value in the designer, and the image alignment (left, centre, right) positions the logo inside its box.

## Designer
- **Modes:** fixed (designed pages), batch (pages repeat per record) and flowing (banded, multi-page: page header, report header, column header, detail loop, up to 8 summary sections that flow after the last row, report footer and page footer).
- **Elements:** text, data field, table (loop over a list or a fixed single-record grid), line, box, image (embedded PNG/JPEG/GIF/WebP up to 1 MB, an https URL or a `{{field}}`), Code 128 barcode and QR code (built-in encoders, scannable).
- **Repeat pages for each item of a list** (e.g. `packages`), with the item's fields at the top level.
- Page sizes for documents, cargo labels and thermal labels; margins; typography, colours, borders; watermark with per-type suggestions.
- Undo/redo, zoom, snap grid, arrow-key nudge, duplicate, bring to front, page add/duplicate/delete.
- Variables tab: the record's field tree, searchable. Click to insert, drag onto the page to bind.
- Layout JSON open/save, data JSON load, built-in sample templates, HTML/Print/PDF from the designer.

## Expressions
`{{ ... }}` supports field paths (`details.partyName`, `rows[0].amount`), arithmetic, comparisons, `&&`, `||`, `??` and `?:`, plus these helpers:

| Helper | Use |
|---|---|
| `SUM`, `COUNT`, `AVG`, `MIN`, `MAX` | `SUM(details.lines.amount)` |
| `ROUND`, `ABS` | Numbers |
| `MONEY(n, decimals)`, `NUM` | Formatting |
| `DATE`, `DATETIME` | Dates |
| `UPPER`, `LOWER`, `CONCAT` | Text |
| `IF(cond, a, b)` | Conditions |
| `WORDS(amount, currency)` | Amount in words |
| `LINE(' · ', a, b, c)` | Joins non-empty values, so missing contacts leave no stray separators |
| `JOIN(list, 'field', ', ')` | Joins one field of a list |
| `LIST(list, 'name', 'qty')` | `Books × 2, Plates × 4` |

Common string, number and array methods are also allowed (`toFixed`, `slice`, `padStart`, `join`, …). Table totals use `$rows`, e.g. `{{MONEY(SUM($rows.amount))}}`. Flowing reports provide `{{PAGE}}` and `{{PAGES}}`.

Every record has `company` (name, email, phone, address), `generatedAt` and `title`.

## Integration
| Type | Data (server `ReportDataService`) | Printed from |
|---|---|---|
| INVOICE, BILL | Billing document view (`details.lines`, paid, balance) | Billing panel |
| RECEIPT, PAYMENT | Voucher; allocations add `documentNumber`, `documentType` and `documentCurrency` | Billing panel |
| CREDIT_MEMO, DEBIT_MEMO | Memo | Memo panel |
| QUOTATION | Quotation detail (lines, items, survey rooms) | Quotation workspace |
| PICKUP_RECEIPT | Pickup detail + `payment` (by `transactionId`) + `totalCollected` | Pickup payments |
| BOX_LABELS | Pickup detail; `packages` filtered by `packageIds`, each with `boxIndex` and `boxCount` | Pickup packing |
| PACKING_LIST | Pickup detail + `packageCount`; the customer link gets the packing snapshot only | Pickup / customer packing link |
| WAREHOUSE_RECEIPT | Warehouse receipt | Warehouse |
| JOB_MANIFEST | Job + `activeCargo` | Jobs |
| COST_REPORT | Report definition + sorted cost `rows` (mode, date) | Operations costs |
| ACCOUNTING_0…25 | The accounting report's result + `filters` | Accounting reports |

Accounting reports print the query of the report last run on screen, so the printed figures match the screen.

## API and storage
Controller `ReportV2Controller` (`/api/report-v2`). Business layer `ReportTemplateV2Service`, `ReportDataService` and `ReportLayoutV2Validation` (`Movers.Services/Reporting/ReportV2.cs`).

| Endpoint | Policy |
|---|---|
| `GET types`, `GET templates?type=` (default + offered), `GET templates/{id}`, `GET data/{type}?id=&…` | `reports.print` |
| `GET templates/manage`, `GET templates/{id}/history`, `POST templates`, `PUT templates/{id}`, `POST templates/{id}/duplicate`, `DELETE templates/{id}`, `GET sample/{type}` | `reports.design` |
| `PUT templates/{id}/flags` (default, offer at print) | `reports.publish` |
| `GET branding` | `reports.print` |
| `PUT branding` (letterhead; logo PNG/JPEG/GIF/WebP up to 1 MB) | `reports.design` |
| `GET /api/public/packing/{token}/report-v2` | Valid customer link |

`data/{type}` and `sample/{type}` also require the permission of the screen the document comes from:
- `billing.view` for billing documents and accounting reports
- `operations.manage` for pickups, warehouse and jobs
- `quotes.manage` for quotations
- `accounting.manage` for cost reports

Printing therefore never exposes more than the user can already see.

Templates are `REPORT_TEMPLATE_V2` payloads, with an immutable `REPORT_HISTORY_V2` row per change, in the existing tenant-filtered `BillingRecords` table. No schema change or migration is needed. Saves use optimistic version checks and transactions. Delete is soft: the record kind changes to `REPORT_TEMPLATE_V2_DELETED`. V1 `REPORT_TEMPLATE` rows are left in place but are no longer read. The letterhead is one `REPORT_BRANDING` record per tenant, guarded by a version check, with a `REPORT_BRANDING_HISTORY` row per change; the logo is omitted from history.

## Security
- **Sandboxed expressions:** expressions run in a small interpreter (`engine/safe-eval.ts`), not as JavaScript. It reaches only own data properties, the helpers and whitelisted methods, so a template cannot reach `window`, prototypes, constructors or network APIs.
- **Escaped output:** text, table cells and attributes are HTML-escaped.
- **Validated style values:** style values are restricted to a CSS-value alphabet and image sources to data images, https URLs or `{{fields}}`. This is checked on the server for every save and mirrored in the client for import.
- **Isolated print preview:** the preview renders in an iframe without script permission.

## Rendering
Print uses the browser print dialog with selectable text. Download PDF rasterises each page with html2canvas into jsPDF, at 3× scale, or less for long documents. Each page carries the letterhead footer note in its bottom margin. Without one it prints "This is a system generated document, no signature is required" (`SYSTEM_FOOTER` in `engine/render.ts`).

## Verification
- `dotnet test backend/tests/Movers.Api.Tests --filter "FullyQualifiedName~Report_v2"`
- From frontend: `node tests/reporting-v2.test.mjs`
- `pnpm build`
