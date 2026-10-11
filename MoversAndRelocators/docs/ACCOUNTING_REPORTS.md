# Accounting report implementation sequence

Implement one report per user Next request. Do not label planned reports as available.
The catalogue is under Finance > Accounting reports.

1. Trial balance — READY: period opening/movement/closing balances, posted entries only, base or transaction currency, CSV.
2. General ledger — READY: account/date filters, opening/running/closing balances, original references, reversal indicators, base or transaction currency, CSV.
3. Journal register — READY: date/currency/type filters, expandable debit/credit accounts, posting user ID/time, reversal links and line-level CSV.
4. Profit and loss — READY: inclusive date range, base/transaction currency, posted revenue and expense account breakdowns, net profit/loss, memo/reversal effects and CSV.
5. Balance sheet — READY: as-of date, base/transaction currency, assets/liabilities/equity, unclosed accumulated earnings without duplicating closed earnings, reconciliation and CSV.
6. Cash flow statement — READY: date/currency filters, operating/investing/financing/exchange/unclassified activity, opening/closing cash reconciliation, transfer exclusion, configurable counterpart classifications and CSV.
7. Cash book & bank book — READY: cash/bank account selector, date/currency filters, receipts/payments, opening/running/closing balances, references, counterpart accounts, transfers, reversals and CSV.
8. Customer statement — READY: customer/date/currency filters, posted invoices, receipts, memos, reversals and advances, opening/running/closing balances, transaction amounts and CSV.
9. Vendor statement — READY: vendor/date/currency filters, posted bills, allocated payments, memos and reversals, opening/running/closing balances, original transaction amounts and CSV.
10. Accounts receivable aging — READY: as-of date/customer/currency filters, posted invoice balances adjusted historically for receipts/memos/reversals, due-date aging buckets, currency totals and CSV.
11. Accounts payable aging — READY: as-of date/vendor/currency filters, posted bill balances adjusted historically for payments/memos/reversals, due-date aging buckets, separate currency totals and CSV.
12. Invoice register — READY: invoice-date/customer/currency/status filters, current settlement balances, memo adjustments, expandable charges, separate currency/status totals and CSV.
13. Bill register — READY: bill-date/vendor/currency/status filters, current payable balances, memo adjustments, expandable charges, separate currency/status totals and CSV.
14. Receipt register — READY: receipt-date/customer/currency/status filters, vouchers and operation receipts, advances, invoice allocations, separate currency/status totals and CSV.
15. Payment voucher register — READY: payment-date/vendor/currency/status filters, vouchers and operation expenses, bill allocations, separate currency/status totals and CSV.
16. Credit memo register — READY: memo-date/party-type/party/currency/status filters, original invoice/bill and charge references, reason, reversal details, separate totals and CSV.
17. Debit memo register — READY: memo-date/party-type/party/currency/status filters, original invoice/bill and charge references, reason, reversal details, separate totals and CSV.
18. Outstanding customer balances — READY: as-of date/customer/currency filters, customer summaries, not-overdue/overdue/total balances, invoice drilldown, separate currency totals and CSV.
19. Outstanding vendor balances — READY: as-of date/vendor/currency filters, vendor summaries, not-overdue/overdue/total balances, bill drilldown, separate currency totals and CSV.
20. Customer advances — READY: as-of date/customer/currency filters, posted unallocated receipt details, customer balances, currency totals and CSV.
21. Expense analysis by account — READY: posting-date/account/currency filters, expense debit/credit/net totals, expandable journal details, reversals, original transaction values and CSV.
22. Revenue analysis by account — READY: posting-date/account/currency filters, revenue debit/credit/net totals, expandable journal details, reversals, transaction values and CSV.
23. Pickup / warehouse / job profitability — READY: posting-date/operation/currency filters, charge-level revenue/cost attribution, contribution profit and margin, memo/reversal effects, direct paid expenses, details and CSV.
24. Currency exposure & exchange differences — READY: date/currency filters, foreign invoice/bill exposure, historical carrying values, estimated revaluation with rate warnings, posted FX account details and CSV.
25. Tax summary — READY (accounting scope): tax payable account 2200 opening/movement/closing balances, date/currency filters, posted details and CSV. Tax-code/rate and tax-return reporting require transaction tax capture not yet present.
26. Posting & reversal audit — READY: posting-date/user-ID/reference/currency/status filters, original/reversal links, posting timestamps, journal lines and CSV.

Reports must preserve tenant isolation, show currency codes, exclude draft postings where appropriate, include reversals, support date filters and exports, and avoid assuming missing historical exchange rates. Party reports should support party currency. General ledger should include account selection, opening balance, dated journal lines, debit/credit, references, running balance and closing totals.






Cash flow uses accounts flagged Cash / bank, including inactive accounts with posted history. Rows show net cash movement per journal; cash-to-cash transfers are shown separately with no activity inflow/outflow. Mixed activity journals remain unclassified rather than receiving an arbitrary allocation. Known operational controls and revenue/expense accounts default to Operating; FX-only counterparts use Exchange. Custom assets/liabilities and equity funding require classification. billing.accounts permission controls audited mapping changes, which apply to historical reports when rerun. Classification completeness and cash reconciliation are independent. Base values use saved historical journal conversions, not current market rates.


Customer statements include customer-linked receivables and unallocated advances; a positive balance is due from the customer and a negative balance is customer credit. Unlinked manual journals are excluded. Base mode uses saved historical journal amounts. Customer-currency mode converts those base values using one rate valid at the period end, including opening balances. Explicit currency selection includes only transactions recorded in that currency. Draft documents and receipts are excluded.

Vendor statements use linked payable account 2000 entries. Credit-positive balances are payable to the vendor; debit balances are in your favour. Direct expenses paid without a bill allocation do not affect payables and are excluded, as are unlinked manual journals. Allocated operation payments are included once via their voucher. Currency modes follow customer statements: saved historical base values, end-date vendor-currency equivalents, or a single native transaction currency.

Receivable aging uses effective journal posting and reversal dates, not current document status. Buckets are not overdue (including due today), 1–30, 31–60, 61–90 and over 90 days. Only outstanding posted invoices are shown; unallocated advances and manual journals without invoice links are excluded. Base balances use saved invoice/memo control values and allocation base values; missing historical values produce an error. Customer-currency balances convert historical base balances at the as-of rate, with separate totals per currency. Native currency mode selects invoices recorded in that currency.

Payable aging uses payable control account 2000 with credit-positive balances and effective posting/reversal dates. Bills due on the as-of date are not overdue; overdue buckets are 1–30, 31–60, 61–90 and over 90 days. Draft and fully settled bills are excluded. Direct expenses without bill allocations and unlinked manual journals are excluded. Base balances use saved historical payable and allocation values; vendor currency converts these at the as-of rate. Totals are kept separate per currency.

Invoice register filters by invoice date and reports current settlement status, not historical balances at the period end. Only posted active receipts and memos affect balances. Draft and voided documents have zero receivable balances and separate status totals. Accounting base values use saved historical control/allocation values; customer-currency presentation uses the period-end rate. Native currency mode selects invoices recorded in that currency.

Bill register filters by bill date and reports current settlement status, including currently posted payments and memos after the selected bill period. Draft and voided bills have zero payable balances and separate totals. Saved payable control account 2000 values use credit-positive amounts, with historical allocation values deducted. Vendor currency presentation uses the period-end rate; native currency mode selects bills recorded in that currency.

Receipt register filters by receipt/capture date and shows current posting status. Operation receipts allocated to invoices appear once through their voucher; unallocated advances and draft captures are included separately. Voided and draft totals are separate from posted totals. Receipt amounts use saved cash values, while allocations display both invoice currency and receipt currency amounts. Base mode uses saved receipt base values, customer mode uses the period-end rate, and missing historical exchange values raise an error.

Payment voucher register filters by payment/capture date and shows current posting status. Operation expenses allocated to bills appear once through their voucher; direct expenses paid without bill allocations and draft captures are included separately. They are not labelled vendor advances. Draft and voided totals are separate from posted totals. Bill allocations show bill currency and payment currency amounts; report amounts use saved cash values, converted at the period-end rate for vendor currency.

Credit memo register includes credit memos only, with current draft/posted/voided status and memo-date filtering. Customer credits and vendor credits are totalled separately by currency and status. Amounts are positive credit values, not combined receivable/payable movements. Party currency uses the period-end rate applied to saved memo base values. Original document references, charge description, reason and posted reversal references/dates are included.

Debit memo register includes debit memos only and reports current draft/posted/voided status for the selected memo dates. Customer debits increase receivables; vendor debits increase payables. Positive memo amounts are totalled separately by party type, currency and status. Party currency converts saved memo base values using the period-end rate. Original document references, charge, reason and posted reversal reference/date are included.

Outstanding customer balances reuse the historical receivable aging calculation and group outstanding posted invoices by customer and reporting currency. Draft and fully settled invoices, unallocated advances and unlinked manual journals are excluded. Invoice detail includes original transaction currency balances; customer and grand totals reconcile to those details in reporting currency. Customer-currency equivalents use the as-of rate.

Outstanding vendor balances reuse historical payable aging and group outstanding posted bills by vendor and reporting currency. Draft and fully settled bills, direct expenses without bill allocations and unlinked manual journals are excluded. Bill detail preserves original transaction currency amounts; vendor and overall totals reconcile in reporting currency. Vendor-currency equivalents use the as-of rate.

Customer advances uses linked posted unallocated receipt journals on account 2100. Draft receipts and invoice-allocated receipts are excluded. Effective posting and reversal dates control as-of inclusion. Base values are saved historical journal values; customer currency uses the as-of rate. Unlinked manual journals are excluded. No advance allocation or refund workflow is introduced by this report.

Expense analysis includes posted expense-account entries, including inactive accounts with history, memos, reversals, manual journals and closing entries. Net expense is debit minus credit. Draft charges and bills are excluded. Base mode uses saved journal conversions; native mode includes only journals in the selected currency. Accounts with offsetting debit and credit activity remain visible even when net expense is zero.

Revenue analysis includes posted revenue-account entries, including inactive accounts with history, memos, reversals, manual journals and closing entries. Net revenue is credit minus debit. Draft charges and invoices are excluded. Base mode uses saved historical journal conversions; native mode includes only journals recorded in the selected currency. Accounts with offsetting activity remain visible even when net revenue is zero.

Operation profitability attributes posted invoice/bill lines using their individual operation links, saved charge base values and linked memo values. Mixed-operation documents are split per charge. Direct posted expenses without bill allocations are included; settlements are excluded to avoid double counting. Reversals affect their posting period. This is contribution profit: standalone documents, unlinked manual journals, overhead, settlement FX, customer advances and unposted labour/material estimates are excluded. It does not consolidate a pickup into a later warehouse/job lifecycle. Margin is unavailable when revenue is nonpositive.

Currency exposure covers outstanding posted foreign invoices and bills at the period end, using historical aging balances and period-end rates. Positive estimated differences are gains, negative are losses; estimates do not post journals. Missing rates leave estimated totals unavailable with warnings. Cash/bank holdings, advances and unlinked manual balances are excluded. Posted exchange movements are a separate period report for accounts 4200-FX and 5500, including rounding/manual/closing entries and reversals. The currency filter selects document currency for exposure and journal currency for posted movements. Foreign amounts are never summed across currencies; combined totals are base amounts.

Tax summary is restricted to the existing Tax payable account 2200. It reports posted ledger movements with debit-positive balances and credit balances marked Cr. It includes reversals and saved historical base conversion. Tax codes/rates, taxable values, input/output tax classifications and custom tax-account mappings do not exist in billing contracts; the report does not infer them or claim tax-return coverage.

Posting audit covers successful journal postings only. Date filters use accounting posting dates, timestamps retain actual posting time, and user IDs identify posting actors. Reference search matches original references on reversal entries. Status supports all/original/reversal/reversed-original/unreversed-original; reversal links and status reflect current history, including outside-period entries. Draft changes, failed attempts and unposted cancellations are excluded. This completes the planned report sequence, subject to documented scope limits (especially tax capture).
