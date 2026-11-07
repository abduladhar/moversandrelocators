using Movers.Services.Security;

namespace Movers.Services.Assistant;

/// <summary>Field types the query tool understands: text, number, date (a day), datetime (local time), bool.</summary>
public static class AssistantFieldTypes
{
    public const string Text = "text", Number = "number", Date = "date", DateTime = "datetime", Bool = "bool";
}

public sealed record AssistantField(string Name, string Type, string Description);

/// <param name="Permissions">The user needs any one of these to read the dataset.</param>
/// <param name="ListKey">The screen a record opens in (the front end's list key); null when records have no screen.</param>
/// <param name="NumberField">The field that identifies a record on that screen (searched for when a link is opened).</param>
/// <param name="ListFields">Fields returned when the model lists records without naming fields.</param>
public sealed record AssistantDataset(string Name, string Description, string[] Permissions, string? ListKey, string? NumberField, AssistantField[] Fields, string[] ListFields)
{
    public AssistantField? Field(string name) => Fields.FirstOrDefault(f => string.Equals(f.Name, name, StringComparison.OrdinalIgnoreCase));
}

/// <summary>
/// Everything the assistant may read: a fixed list of datasets and fields. The model can filter, group, count and
/// sum these fields however it likes, but nothing outside this list exists for it (no tables, no SQL), every dataset
/// needs its module's permission, and the data layer only ever returns the current company's records.
/// </summary>
public static class AssistantCatalog
{
    private static AssistantField T(string name, string description) => new(name, AssistantFieldTypes.Text, description);
    private static AssistantField N(string name, string description) => new(name, AssistantFieldTypes.Number, description);
    private static AssistantField D(string name, string description) => new(name, AssistantFieldTypes.Date, description);
    private static AssistantField DT(string name, string description) => new(name, AssistantFieldTypes.DateTime, description);
    private static AssistantField B(string name, string description) => new(name, AssistantFieldTypes.Bool, description);

    public const string Leads = "leads", FollowUps = "follow_ups", Surveys = "surveys", SurveyExpenses = "survey_expenses", Quotations = "quotations", Pickups = "pickups",
        PackingJobs = "packing_jobs", Deliveries = "deliveries", Employees = "employees",
        Invoices = "invoices", Receipts = "receipts", Bills = "bills", Receivables = "receivables", Payables = "payables",
        Payments = "payments", Memos = "memos", CustomerAdvances = "customer_advances", Profitability = "operation_profitability", Ledger = "ledger",
        Charges = "charges", OperationMoney = "operation_money", PickupCosts = "pickup_costs", AiUsage = "ai_usage";

    /// <summary>Datasets read from the accounting and operations services (reports, cash queue, costing), not from the operational tables.</summary>
    public static readonly string[] Finance = [Invoices, Receipts, Bills, Receivables, Payables, Payments, Memos, CustomerAdvances, Profitability, Ledger, Charges, OperationMoney, PickupCosts];

    public static readonly IReadOnlyList<AssistantDataset> All =
    [
        new(Leads, "Sales leads (enquiries). One row per active lead.", [SecurityPermissions.SalesView], "sales", "number",
            [T("number", "Lead number"), T("customer", "Customer name"), T("phone", "Phone"), T("email", "Email"), T("source", "Where the lead came from (Website, Referral, ...)"),
             T("move_type", "Type of move"), T("origin", "Moving from"), T("destination", "Moving to"), D("expected_move_date", "Expected move date"),
             T("status", "Lead status name"), B("closed", "True when the status is a closed one (won, lost, ...)"), T("assigned_to", "Salesperson"),
             DT("created", "When the lead was created"), DT("updated", "Last change")],
            ["number", "customer", "source", "status", "assigned_to", "created"]),
        new(FollowUps, "Follow-up calls/visits planned on sales leads.", [SecurityPermissions.SalesView], "sales", "lead_number",
            [T("lead_number", "Lead number"), T("customer", "Customer of the lead"), T("assigned_to", "Salesperson owning the lead"), DT("scheduled", "When the follow-up was planned"),
             T("status", "Follow-up status name"), B("completed", "True when the status counts as done"), DT("next_follow_up", "Next follow-up planned, if any"),
             B("overdue", "True when it is still open and its due time has passed"), T("notes", "Notes"), DT("created", "When it was recorded")],
            ["lead_number", "customer", "assigned_to", "scheduled", "status", "overdue"]),
        new(Surveys, "Home/office surveys (site visits before quoting).", [SecurityPermissions.SurveysManage], "surveys", "number",
            [T("number", "Survey number"), T("lead_number", "Sales lead number, if any"), T("customer", "Customer"), T("surveyor", "Employee doing the survey"),
             DT("scheduled", "Planned visit time"), T("address", "Address"), T("status", "DRAFT, SCHEDULED, IN_PROGRESS, COMPLETED, ..."),
             DT("started", "Visit started"), DT("ended", "Visit ended"), DT("created", "Created"),
             N("expenses", "Total of the expenses recorded on this survey (0 when none), in expense_currency"), N("expense_count", "Number of expenses recorded"),
             T("expense_currency", "Currency of those expenses (empty when none; MIXED when they are in several currencies)")],
            ["number", "customer", "surveyor", "scheduled", "status", "expenses"]),
        new(SurveyExpenses, "Out-of-pocket expenses recorded on surveys (fuel, taxi, toll, ...), one row per expense, in each expense's own currency. " +
            "Only surveys that have expenses appear here; for an average per survey that also counts surveys without expenses, use the expenses field of surveys.",
            [SecurityPermissions.SurveysManage], "surveys", "survey_number",
            [T("survey_number", "Survey number"), T("customer", "Customer of the survey"), T("surveyor", "Employee doing the survey"), T("survey_status", "Status of the survey"),
             T("category", "FUEL, TAXI, METRO, BUS, TOLL, PARKING, FOOD or OTHER"), N("amount", "Amount"), T("currency", "Currency code"),
             DT("incurred", "When the expense was incurred"), T("paid_by", "Employee who paid it"), T("notes", "Notes"), DT("created", "When it was recorded")],
            ["survey_number", "customer", "category", "amount", "currency", "incurred", "paid_by"]),
        new(Quotations, "Quotations sent to customers. Amounts are in each quotation's own currency (see currency).", [SecurityPermissions.QuotesManage], "quotations", "number",
            [T("number", "Quotation number"), T("customer", "Customer"), T("origin", "From"), T("destination", "To"), T("assigned_to", "Salesperson"), T("currency", "Currency code"),
             T("status", "DRAFT, SENT, ACCEPTED, REJECTED or REQUOTE_REQUESTED"), N("subtotal", "Subtotal"), N("discount", "Discount total"), N("tax", "Tax total"),
             N("grand_total", "Grand total"), D("valid_until", "Valid until"), DT("sent", "When it was sent"), DT("responded", "When the customer answered"),
             T("rejection_reason", "Why the customer rejected it"), DT("created", "Created")],
            ["number", "customer", "status", "currency", "grand_total", "assigned_to", "created"]),
        new(Pickups, "Pickup jobs (collecting goods from the customer).", [SecurityPermissions.OperationsManage], "pickups", "number",
            [T("number", "Pickup number"), T("customer", "Customer"), T("address", "Address"), DT("scheduled", "Planned time"), T("status", "Pickup status name"),
             B("completed", "True when the status counts as done"), DT("started", "Trip started"), DT("ended", "Trip ended"), N("distance_km", "Distance driven (km)"), DT("created", "Created")],
            ["number", "customer", "scheduled", "status"]),
        new(PackingJobs, "Packing jobs at the customer's place.", [SecurityPermissions.PackingManage, SecurityPermissions.OperationsManage], "packing", "number",
            [T("number", "Packing job number"), T("customer", "Customer"), T("address", "Address"), DT("scheduled", "Planned time"),
             T("status", "PLANNED, IN_PROGRESS, COMPLETED or CANCELLED"), DT("started", "Started"), DT("completed", "Completed"), DT("created", "Created"),
             N("material_cost", "Cost of the packing materials used (at the recorded unit costs)")],
            ["number", "customer", "scheduled", "status"]),
        new(Deliveries, "Delivery jobs (taking goods to the customer).", [SecurityPermissions.DeliveryManage, SecurityPermissions.OperationsManage], "delivery", "number",
            [T("number", "Delivery number"), DT("scheduled", "Planned time"), T("status", "PLANNED, OUT_FOR_DELIVERY, COMPLETED or CANCELLED"), T("driver", "Driver"),
             DT("started", "Started"), DT("completed", "Completed"), N("distance_km", "Distance (km)"), T("notes", "Notes"), DT("created", "Created")],
            ["number", "scheduled", "status", "driver"]),
        new(Employees, "Employees of the company.", [SecurityPermissions.EmployeesView], "employees", "number",
            [T("number", "Employee number"), T("name", "Full name"), T("designation", "Designation"), T("email", "Work email"), T("phone", "Phone"),
             D("joining_date", "Joining date"), B("active", "Still active"), T("reports_to", "Manager")],
            ["number", "name", "designation", "active"]),
        new(Invoices, "Customer invoices from the invoice register, amounts in the base currency. Drafts and voided ones are included: filter on status.", [SecurityPermissions.BillingView], null, null,
            [T("number", "Invoice number"), T("customer", "Customer name"), T("customer_code", "Customer code"), D("date", "Invoice date"), D("due_date", "Due date"),
             T("status", "DRAFT, UNPAID, PART_PAID, SETTLED or VOIDED"), T("currency", "Base currency code"), N("amount", "Invoice amount"), N("paid", "Received against it"),
             N("balance", "Still to be received"), T("reference", "Reference")],
            ["number", "customer", "date", "status", "amount", "balance"]),
        new(Receipts, "Money received from customers (receipt register), base currency.", [SecurityPermissions.BillingView], null, null,
            [T("number", "Receipt number"), T("customer", "Customer name"), D("date", "Receipt date"), T("status", "DRAFT, POSTED or VOIDED"), T("currency", "Base currency code"),
             N("amount", "Amount received"), T("reference", "Reference")],
            ["number", "customer", "date", "status", "amount"]),
        new(Bills, "Vendor bills from the bill register, base currency.", [SecurityPermissions.BillingView], null, null,
            [T("number", "Bill number"), T("vendor", "Vendor name"), T("vendor_code", "Vendor code"), D("date", "Bill date"), D("due_date", "Due date"),
             T("status", "DRAFT, UNPAID, PART_PAID, SETTLED or VOIDED"), T("currency", "Base currency code"), N("amount", "Bill amount"), N("paid", "Paid"), N("balance", "Still to pay"), T("reference", "Reference")],
            ["number", "vendor", "date", "status", "amount", "balance"]),
        new(Receivables, "What customers owe today (receivable aging), one row per open invoice, base currency.", [SecurityPermissions.BillingView], null, null,
            [T("number", "Invoice number"), T("customer", "Customer name"), T("customer_code", "Customer code"), D("invoice_date", "Invoice date"), D("due_date", "Due date"),
             N("days_overdue", "Days past due (0 or less = not due yet)"), T("aging_bucket", "CURRENT, 1-30, 31-60, 61-90, 91-120 or OVER_120"), T("currency", "Base currency code"), N("outstanding", "Amount still owed")],
            ["number", "customer", "due_date", "days_overdue", "outstanding"]),
        new(Payables, "What the company owes vendors today (payable aging), one row per open bill, base currency.", [SecurityPermissions.BillingView], null, null,
            [T("number", "Bill number"), T("vendor", "Vendor name"), T("vendor_code", "Vendor code"), D("bill_date", "Bill date"), D("due_date", "Due date"),
             N("days_overdue", "Days past due"), T("aging_bucket", "CURRENT, 1-30, 31-60, 61-90, 91-120 or OVER_120"), T("currency", "Base currency code"), N("outstanding", "Amount still owed")],
            ["number", "vendor", "due_date", "days_overdue", "outstanding"]),
        new(Payments, "Payments to vendors (payment voucher register, including expenses paid in cash), base currency.", [SecurityPermissions.BillingView], null, null,
            [T("number", "Payment number"), T("vendor", "Vendor / payee name"), T("vendor_code", "Vendor code"), D("date", "Payment date"), T("status", "DRAFT, POSTED or VOIDED"),
             T("account", "Cash/bank account paid from"), T("reference", "Reference"), T("notes", "Notes"), T("transaction_currency", "Currency it was paid in"),
             N("transaction_amount", "Amount in that currency"), T("currency", "Base currency code"), N("amount", "Amount in the base currency"), N("unallocated", "Part not set against any bill (in the paid currency)")],
            ["number", "vendor", "date", "status", "amount"]),
        new(Memos, "Credit and debit memos on customer invoices and vendor bills, base currency.", [SecurityPermissions.BillingView], null, null,
            [T("number", "Memo number"), T("type", "CREDIT_MEMO or DEBIT_MEMO"), T("party_type", "CUSTOMER or VENDOR"), T("party", "Customer or vendor name"), D("date", "Memo date"),
             T("status", "DRAFT, POSTED or VOIDED"), T("document_number", "Invoice or bill it adjusts"), T("charge", "Charge line it adjusts"), T("reason", "Reason"),
             T("transaction_currency", "Currency of the document"), N("transaction_amount", "Amount in that currency"), T("currency", "Base currency code"), N("amount", "Amount in the base currency")],
            ["number", "type", "party", "date", "status", "amount", "reason"]),
        new(CustomerAdvances, "Advances customers paid before being invoiced, still held today (one row per advance receipt), base currency.", [SecurityPermissions.BillingView], null, null,
            [T("number", "Receipt number"), T("customer", "Customer name"), T("customer_code", "Customer code"), D("date", "Date received"), T("reference", "Reference"),
             T("source", "Operation it was taken on"), T("transaction_currency", "Currency received"), N("transaction_amount", "Amount in that currency"), T("currency", "Base currency code"), N("amount", "Amount still held, base currency")],
            ["number", "customer", "date", "source", "amount"]),
        new(Profitability, "Posted revenue and cost of each operation (operation profitability report), one row per posting, base currency. " +
            "Group by operation for profit per job; profit = revenue - expense.", [SecurityPermissions.BillingView], null, null,
            [T("operation_type", "SURVEY, PICKUP, PACKING, DELIVERY, WAREHOUSE or JOB"), T("operation", "Operation number and name"), D("date", "Posting date"), T("reference", "Journal reference"),
             T("description", "What was posted"), N("revenue", "Revenue (invoiced)"), N("expense", "Cost (bills, expenses paid, materials used)"), N("profit", "revenue - expense"),
             B("reversal", "True for a reversal of an earlier posting (amounts are negative)"), T("currency", "Base currency code")],
            ["operation_type", "operation", "date", "description", "revenue", "expense"]),
        new(Ledger, "Every posted accounting line (general ledger), base currency. Use for totals by account or account type: income = credit - debit on Revenue accounts, " +
            "spending = debit - credit on Expense accounts, cash movement = debit - credit on cash/bank accounts.", [SecurityPermissions.BillingView, SecurityPermissions.AccountingManage], null, null,
            [D("date", "Posting date"), T("reference", "Journal reference"), T("description", "Journal description"), T("account_code", "Account code"), T("account", "Account name"),
             T("account_type", "Asset, Liability, Equity, Revenue or Expense"), B("cash_bank", "True for cash and bank accounts"), N("debit", "Debit"), N("credit", "Credit"),
             N("net", "debit - credit"), B("reversal", "True when the journal reverses an earlier one"), T("currency", "Base currency code")],
            ["date", "reference", "account", "debit", "credit"]),
        new(Charges, "Charges captured on operations for billing (income to invoice, costs to bill), whether invoiced yet or not. Amounts in each charge's own currency; base_amount in the base currency.",
            [SecurityPermissions.BillingView], null, null,
            [T("number", "Charge number"), T("operation_type", "PICKUP, PACKING, DELIVERY, WAREHOUSE or JOB"), T("operation", "Operation"), T("direction", "INCOME (to invoice) or EXPENSE (vendor cost)"),
             T("party", "Customer or vendor"), T("description", "Description"), T("account_code", "Account"), N("quantity", "Quantity"), N("unit_price", "Price per unit"),
             T("currency", "Currency"), N("amount", "Amount"), N("base_amount", "Amount in the base currency"), B("billed", "True when it is on an invoice or bill"),
             T("document_number", "Invoice/bill number when billed"), B("cancelled", "True when cancelled")],
            ["number", "operation", "direction", "party", "amount", "currency", "billed"]),
        new(OperationMoney, "Money recorded on surveys, pickups, packing jobs and deliveries by the crews and staff: cash collected from customers (INCOME) and expenses paid (EXPENSE), " +
            "plus cash captured in billing. Amount is in the recorded currency; base_amount in the base currency (empty when no exchange rate was saved).", [SecurityPermissions.BillingView], null, null,
            [T("number", "Transaction number"), T("operation_type", "SURVEY, PICKUP, PACKING, DELIVERY, WAREHOUSE or JOB"), T("operation", "Operation number (and customer)"),
             T("type", "INCOME or EXPENSE"), T("party", "Customer or vendor, if recorded"), T("category", "Category (FUEL, TOLL, ... or the crew's category)"), T("notes", "Notes"),
             D("date", "Date"), T("currency", "Recorded currency"), N("amount", "Amount"), N("base_amount", "Amount in the base currency"), T("base_currency", "Base currency code"),
             T("paid_by", "Employee who paid the expense"), B("posted", "True when the accountant has posted it"), T("posting_number", "Posting number")],
            ["number", "operation_type", "operation", "type", "category", "amount", "currency", "date"]),
        new(PickupCosts, "Cost sheet per pickup (operations costing): recorded income, labour, materials, fuel, transport, vendor and other costs, and surplus. " +
            "One row per pickup and currency, amounts in that currency.", [SecurityPermissions.AccountingManage], "pickups", "pickup_number",
            [T("pickup_number", "Pickup number"), T("customer", "Customer"), T("currency", "Currency"), N("income", "Income recorded"), N("labour_hours", "Labour hours"),
             N("labour_cost", "Labour cost"), N("material_cost", "Materials cost"), N("fuel_cost", "Fuel cost (trips)"), N("transport_other_cost", "Other trip cost"),
             N("vendor_cost", "Vendor costs"), N("other_expense", "Other expenses (crew)"), N("legacy_expense", "Older recorded expenses"), N("total_cost", "Total cost"), N("surplus", "income - total cost")],
            ["pickup_number", "customer", "currency", "income", "total_cost", "surplus"]),
        new(AiUsage, "AI runs and what they cost (lead extraction and this assistant).", [SecurityPermissions.OpenAiConfigurationManage, SecurityPermissions.ClaudeConfigurationManage], null, null,
            [T("feature", "What the AI was used for"), T("model", "Model"), N("input_tokens", "Input tokens"), N("output_tokens", "Output tokens"), N("cost", "Cost (empty when prices are not set)"),
             T("currency", "Currency of the cost"), T("by", "Who ran it"), DT("created", "When")],
            ["feature", "model", "cost", "currency", "created"]),
    ];

    public static AssistantDataset? Find(string? name) => All.FirstOrDefault(d => string.Equals(d.Name, name?.Trim(), StringComparison.OrdinalIgnoreCase));

    public static IReadOnlyList<AssistantDataset> Allowed(IUserContext user) => All.Where(d => d.Permissions.Any(user.HasPermission)).ToList();

    public static string Bucket(int daysOverdue) => daysOverdue switch { <= 0 => "CURRENT", <= 30 => "1-30", <= 60 => "31-60", <= 90 => "61-90", <= 120 => "91-120", _ => "OVER_120" };
}
