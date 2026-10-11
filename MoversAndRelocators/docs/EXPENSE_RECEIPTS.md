# Expense receipts

Every expense can have receipts attached: a photo of the bill, or a PDF, Word or Excel file.

## Where to attach
| Expense | Screen |
|---|---|
| Survey trip expenses | Survey › trip panel › *Survey expenses* |
| Pickup crew expenses, and older pickup expense entries | Pickup › *Customer receipts & expenses paid* |
| Packing job expenses | Packing job › *Income & expense* |
| Delivery expenses | Delivery job › *Collections & expenses* |
| Vendor and other expenses | Operations costs › *Vendor & other expenses* |
| Cash entries captured by the accountant (`RCV-`, `EPD-`) | Accounting › Cash posting queue |

- **While adding an expense:** use **Receipt (optional)** › **Take photo** or **Attach file**. The files are uploaded as soon as the expense is saved.
- **After saving:** use the paper-clip button on the expense. It shows how many receipts the expense has and opens a window where you can view, add or remove them.
- **Take photo:** opens the phone's rear camera. Large photos are reduced to at most 2000 px (JPEG) before upload, so they upload quickly.
- **Limits:** up to 25 MB per file. Accepted types are images, PDF, Word and Excel; video and audio are not.
- **Cash posting queue:** the accountant sees the receipts of every queued expense. The *Review & post* window shows them, and warns when an expense has no receipt.
  - Receipts of pickup, packing and delivery expenses are read-only there.
  - Once an expense is posted to the ledger, its receipts can no longer be removed.

## Access
- **Adding or removing receipts** requires the permission of the module that owns the expense:

  | Expense | Permission |
  |---|---|
  | Survey | `surveys.manage` |
  | Pickup | `operations.manage` |
  | Packing | `packing.manage` or `operations.manage` |
  | Delivery | `delivery.manage` or `operations.manage` |
  | Operations | `accounting.manage` |
  | Cash | `billing.capture` |

- **Viewing** is also allowed with `billing.view`, for accountants.

## API (`/api/expense-receipts`)
| Purpose | Endpoint |
|---|---|
| List | `GET ?ids=a,b` or `POST query` `{ expenseIds: [...] }` (for long lists) |
| Upload | `POST {kind}/{expenseId}/upload-requests` (`fileName`, `contentType`, `sizeBytes`), then `PUT` the file to the returned `uploadUrl`, then `POST {id}/complete` |
| Download | `GET {id}/download` returns `{ url }`, valid for 10 minutes |
| Remove | `DELETE {id}`. Hides the receipt; refused once the expense is posted |

`kind` is one of `SURVEY`, `PICKUP`, `PACKING`, `DELIVERY`, `OPERATIONS` or `CASH`. `expenseId` is the expense's own id, which is also its id in the cash-posting queue.

Files go to the same storage as other attachments (`Storage:Provider`: Local, or the tenant's S3 bucket).

## Storage
- **Table:** `ExpenseAttachments`, added at startup by `ExpenseAttachmentSchema`. The same DDL is in `database/scripts/*/031_expense_receipts.sql`.
- **Code:**
  - Backend: `Movers.Services/Operations/ExpenseReceiptService.cs` and `Movers.Api/Controllers/ExpenseReceiptsController.cs`.
  - Frontend: `src/expenseReceipts.tsx` (API, photo shrinking, `ReceiptsButton`, `ReceiptPicker`).
