# Multi-company

A **tenant** is a group. It holds one or more **companies**. A typical example is a head office and a Dubai branch, each with its own trade licence.

## Who sees what

| User | Company access |
|---|---|
| Company user (has a company) | Only that company. They cannot switch companies, and they only see and manage users of their own company. |
| Tenant user (no company) | Every active company of the tenant. They switch companies from the side menu. |
| System administrator | Acts as the tenant (Platform → Tenants → open), then switches companies the same way a tenant user does. |

A tenant user's next sign-in opens the company they used last. A user's company is read on every request, so moving a user to another company applies straight away, even with a token issued earlier.

## What is per company, what is shared

**Per company:**
- Sales leads and follow-ups, AI inventory and its cost log
- Surveys, quotations, pickups, packing, delivery, warehouse receipts, transport jobs and shipments
- Invoices, bills, receipts, payments, memos, cash and expense receipts
- Journals and every accounting report
- Document numbers
- Letterhead (the report branding)

**Masters: shared, or one company only.** Each of these records is shared with every company by default. Use the **Available in** column (or field) on its screen to keep one record to the current company:
- Customers and vendors
- Crew roles, payment methods, payment purposes and expense categories
- Employees and designations (and crews, through the API)
- Lead and follow-up statuses, move types
- Household items, packing materials and box types
- Charges and taxes
- Pickup statuses, vehicles and warehouses

A company-only record disappears from the other companies. Documents they already made with it are not changed. You can only keep a record to the company you are working in, or share it again. Built-in pickup list entries become markable once they have been edited and saved. Codes stay unique across the whole tenant.

**Always shared (tenant settings):**
- The chart of accounts, currencies and exchange rates, and the base currency
- Charge and cash-flow mappings
- Report designs and saved reports
- AWS and OpenAI settings

## Document numbers

Each company has its own number series:
- A company with a **number code** puts it in its numbers, for example `QT-DXB-20261011-000001`.
- Only one company in a tenant may use the plain format (`QT-20261011-000001`). For an upgraded tenant, that is its default company.

Master codes (`EMP-…`, customer and vendor codes) stay tenant-wide.

## Managing companies

Companies are managed under **Settings → Companies**. You need the *Manage companies* permission and must be a tenant user.

- **Add or edit:** code, name, legal name, tax number (TRN), address, phone, email, website and number code.
- **Default company:** tenant users open it first, and background work is recorded in it. It cannot be deactivated.
- **Deactivate:** the company's users can no longer sign in. Its records are kept.

To set who works where, use **Administration → Users → Company**. Choose a company, or *All companies* to make a tenant user.

## Letterhead

The letterhead is saved per company (Report designs → Letterhead). Any blank field falls back to the company profile (legal name or name, address, phone, email, website, tax number), then to the tenant profile.

## Customer links

Upload, survey, quotation, pickup, packing and delivery links open in the company of the record they point at, and show that company's name.

## Upgrade (script 034)

The API applies `CompanySchema` at start-up. For SQL Server it can also be run by hand from `database/scripts/sqlserver/034_companies.sql`, using `sqlcmd -I`. The script:

1. Creates the `Companies` table and adds `CompanyId` to `Users` and to every company table, with an index on `(TenantId, CompanyId)`.
2. Gives each existing tenant a default company called `MAIN`, named after the tenant.
3. Moves all existing records into that company. Shared billing kinds (chart of accounts, currencies, mappings, report designs) stay without a company.
4. Puts existing users in that company, except tenant administrators, who become tenant users.

To add a table later:
- If it holds company data, it gets the company automatically (the filter and stamping live in `MoversDbContext`). Add it to `CompanySchema.CompanyTables`; a test checks that the list matches the model.
- If it holds a master that can be shared or kept to one company, add it to `MoversDbContext.OptionalCompanyTypes` and `CompanySchema.OptionalCompanyTables`.
- If it holds a tenant setting with no company at all, add it to `MoversDbContext.SharedTypes`.
