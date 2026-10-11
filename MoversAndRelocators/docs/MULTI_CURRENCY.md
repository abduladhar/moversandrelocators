# Multi-currency setup and accounting

- Open Master data > Currencies. Currency and Currency Exchange Rates are separate pages (also separate tabs in Invoicing & billing).
- Set the accounting base under Settings > System currency. USD is the initial base for compatibility. The selected base has rate 1. AED is the initial default transaction currency, configured separately.
- Maintain active currency codes, names and decimal places. Additional country currencies can be added; common zero-, two- and three-decimal currencies are provided.
- Enter dated rates as **1 currency unit = X system-currency units**. The latest rate starting on or before the transaction date is suggested only while it is valid. A bounded rate is not reused after its end date. No market rates are invented or downloaded.
- Customer and vendor masters have independent default currencies. A new party inherits the workspace default.
- Charges, receipts, vendor payments, pickup/survey expenses, labour, transport and manual journal forms accept a currency and USD rate. Server-side minor-unit validation prevents invalid currency amounts.
- Every new monetary capture saves its rate. Changing a master rate does not revalue saved charges, invoices or vouchers.
- An invoice/bill consolidates charges for one party and transaction currency, retaining the sum of their captured base-currency values.
- Allocations are entered in invoice/bill currency. For a payment in another currency, enter the actual settlement amount in payment currency. One customer receipt can settle several invoices; vendor batches keep separate vouchers and references.
- Base-currency control entries clear the historical invoice/bill value. Differences between that value and cash settlement are posted to realized exchange gain (4200-FX) or exchange loss/rounding (5500).
- Final partial settlements absorb the rounding remainder. Reversals use the original base-currency entries.
- Financial currency report supports transaction currency, system base, and customer/vendor currency, plus CSV export. Party conversion uses the selected report date.
- Costs & finance supports separate original-currency rows, system base or customer-currency reports and saved-template CSV export. Customer matching in legacy pickup cost reports requires a unique master matching the saved name and phone.
- Consolidated base-currency trial balance includes the saved base-currency journal entries; original-currency ledger views remain available.
- Only billing.accounts users change currency masters, exchange rates and location defaults. Existing capture, issue and posting permissions remain in force. Data is tenant scoped and audited.

## Existing data

Existing records keep their original currency. Missing historical rates are shown explicitly, never assumed. Historical foreign-currency ledger entries block a consolidated base-currency trial balance until their historical values are resolved. Unposted legacy receipts/expenses can receive an explicit rate at posting. Historical charges without rates must be recaptured before conversion; historical invoices/bills without a base value cannot be settled by the new FX workflow. Original-currency listings remain available.

The schema updater widens monetary columns to decimal(20,4) for SQL Server and PostgreSQL without changing existing values. Currency, rate and base-currency posting snapshots use the existing audited BillingRecords store. Automated API integration tests use SQLite; provider schema tests cover SQL Server/PostgreSQL generation.

Currency support does not implement every country's tax filing, electronic invoicing or statutory localization. Tax masters remain configurable.

## Exchange-rate periods
On Currency Exchange Rates, choose **Add exchange rate period**. Enter inclusive From and To dates, review the rows for every active currency and save all rates together. The selected system currency is fixed at 1. Existing rates are copied as starting values and must be reviewed. Inactive currencies are excluded.

An identical start date updates that period; overlapping periods with other start dates are rejected. All rows are validated and saved in one transaction. Missing, duplicate or newly added currencies require refreshing the form. Invalid rows do not partially save the batch. Existing transaction snapshots are unchanged.

Old open-ended rates remain readable until superseded. Once a newer bounded period ends, the system does not revive an older rate; enter the next period or an explicit transaction rate.

## System accounting currency configuration
Settings > System currency is available to users with billing.accounts. Choose an active currency as the accounting base and save. The base currency controls exchange-rate entry, base amounts, the consolidated trial balance and reports. The default transaction currency is a separate setting. Accounting reports also offer a "Default transaction currency" view (report API currency=DEFAULT): saved accounting-base values are translated to the default transaction currency at the rate valid on the report end or as-of date. Journal-based reports post any per-line rounding difference to 5500 so totals stay balanced. Recorded values are not changed.

Changing the base is allowed only before financial captures or journals exist. Afterward it is locked server-side and in the UI; changing an established accounting base requires a separate, controlled migration of historical balances. Existing workspaces retain USD and their original snapshots. No historical amounts are relabeled.

Rates are separated by accounting base. Before financial activity, changing the base hides the previous base's rate schedule and requires rates for the new base. The base's minor-unit precision is applied to conversions, allocations, journals and exchange differences.

Compatibility: existing JSON/API field usdPerUnit retains its name but represents units of the explicitly recorded BaseCurrency per transaction unit. New snapshots store BaseCurrency and BaseDecimalPlaces; legacy snapshots default to USD and two decimals. The report API mode BASE uses the configured base; the historical USD mode remains an explicit USD conversion.

## Transaction and customer/vendor amounts
Billing charge, invoice/bill and payment lists display the original transaction amount and the equivalent in the linked customer's currency (or vendor's currency for expenses and payments). Invoice/payment print totals also show both amounts, including paid and outstanding totals. Both amounts carry currency codes.

Listings use the current party master currency and the exchange rate valid on the transaction date, converting from the saved accounting-base amount. Financial reports and CSV exports include party amounts alongside transaction amounts in every report mode, using the selected report conversion date. A missing party master, saved base value or valid rate is displayed explicitly rather than assuming a conversion. These display equivalents do not change recorded transaction values or journals.

## Separate billing pages and direct documents
Invoicing & billing opens an icon menu with a separate page for each former tab. The same icon menu is available inside pickup, job and warehouse billing. Invoices has New invoice; Bills has New bill. Select the source and customer/vendor, choose the transaction currency, and enter multiple mapped charges in one form. Creating a document requires both billing.capture and billing.issue permissions.

POST /api/billing/documents/new validates the full request, uses the document-date exchange rate by default, and saves charges, document and balanced original/base journals in one transaction. Repeating an identical request ID returns the same document. Failed validation leaves no partial charges or document. Existing unposted charges can still be converted from the charges page.

Transaction forms show the configured workspace default currency as read-only. The transaction currency remains selectable. Its accounting-base exchange rate loads automatically for the transaction date; the displayed default-currency cross-rate is the transaction-to-base rate divided by the default-to-base rate. Missing rates are identified explicitly. Currency settings remain an administrator configuration.

## Direct entries and a single visible exchange rate
New invoice and New bill now allow an empty Operation field. Such lines are stored as DIRECT with an empty source GUID and appear in the overall financial registers/reports, not an unrelated pickup/job/warehouse. Supplying an invalid or incomplete operation is still rejected. A source opened from an operation remains linked to that operation.

Currency controls show only one visible rate: default-currency units per transaction-currency unit. The workspace default is read-only; transaction currency is selectable. The compatible accounting-base value is calculated internally before posting. Existing journal currency and historical snapshots are unchanged. Billing form inputs, labels and charge cards have explicit responsive spacing.

Development sample seeding: run the API with SampleRatesTenant set to the exact tenant name. It adds illustrative, clearly marked sample rates for supported active currencies that have no existing schedule, effective for 365 days starting today. It never replaces existing rates, is repeatable, and is rejected outside Development. These are testing values, not market quotes. Seeding was run for Al Kareem and added 17 rates.

## Charge availability defaults
Charges created outside billing previously had no account mapping and were filtered out of invoice/bill selectors. A master with no mapping record now uses general-service revenue 4300 and general-service expense 5600. New billing masters default to these accounts when omitted. Explicit mappings, including deliberately disabled sides, remain respected. Existing captured charges retain their saved accounts and amounts. An empty active master list can be initialized with a General service master through the Development-only BillingDefaultsTenant command. No arbitrary selling price is supplied: the configured default amount fills on selection, and a missing price must be entered before posting.

## Quantity and per-item pricing
New invoice and bill lines include Quantity (default 1), Amount per item and a calculated line total. Selecting a charge fills the configured per-item amount. The server recomputes quantity × price and rounds each line to the transaction currency precision, ignoring client-supplied totals when a unit price is supplied. Quantities allow up to four decimal places and must be positive. Stored charges, documents and printed line items retain quantity and unit price. Legacy amount-only lines remain equivalent to quantity 1.

## Explicit accounting posting (current workflow)
Saving a direct invoice/bill, converting charges from Pickup/Warehouse/Job, or saving a receipt/payment voucher creates an unposted draft. It does not create journals or settle balances. Existing rows with JournalId remain posted. Use the document row menu > Post to accounting, or the central Accountant posting queue. Posting uses the existing billing.pay accountant permission; creation permissions remain separate.

POST /api/billing/documents/{id}/post and /api/billing/vouchers/{id}/post accept { id, version }. Posting runs in a serializable transaction with concurrency checks. A repeated post returns the original journal. The journal retains posting user and timestamp, record changes are audited, and original/base currency debits equal credits. The original document date and saved exchange-rate values are used.

- Invoice: debit customer receivables (1100); credit mapped revenue accounts.
- Bill: debit mapped expense accounts; credit vendor payables (2000).
- Receipt: debit the selected cash/bank account; credit receivables.
- Vendor payment: debit payables; credit the selected cash/bank account.
- Base-currency settlement differences retain the existing exchange gain/loss treatment.

Only posted invoices/bills can receive allocations. Draft vouchers do not reduce balances; posting revalidates the current outstanding amount and recomputes settlement allocation values. Competing drafts cannot both settle the same balance. Accounting currency reports exclude drafts. Drafts may be cancelled without journals; posted records use the existing reversing-entry flow. The existing received-payment/expense-paid queue continues to post captures explicitly, including customer advances or unallocated mapped expenses.

## Credit and debit memos
Credit memos and Debit memos are separate billing menu pages, also available in operation billing. A memo links to a posted invoice or bill and one original charge, with an automatically generated number, date, amount and required reason. Its currency, party and account come from that document. Original saved document conversion is used; closing credits clear the remaining base balance including rounding.

A credit memo reduces the outstanding invoice/bill; a debit memo increases it. For customer invoices, credit debits revenue and credits receivables, while debit debits receivables and credits revenue. For vendor bills, credit debits payables and credits expense; debit debits expense and credits payables. These are customer-issued and supplier-received adjustments, respectively.

Memos save as drafts with billing.issue permission. The row menu and Accountant posting queue post them with billing.pay permission. Posting is transactional, concurrency-checked and idempotent. Only posted active memos change balances and currency reports. Settlement rechecks adjusted balances and saved base values. Credit memos cannot exceed outstanding balances; payment reversal is required to credit an already-settled amount. Reverse active memos before voiding their original document. A settled debit cannot be reversed until the relevant payment is reversed.

Draft cancellation creates no journal. Posted reversal creates exact opposite transaction/base entries, preserves the memo, and records the reason and date. Memo previews can be printed/saved as PDF. Invoice/bill listings and prints show the memo adjustment separately.
