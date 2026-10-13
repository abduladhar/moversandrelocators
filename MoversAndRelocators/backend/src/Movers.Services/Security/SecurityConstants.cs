namespace Movers.Services.Security;

public static class RoleCodes
{
    public const string SystemAdmin = "SYSTEM_ADMIN";
    public const string TenantAdmin = "TENANT_ADMIN";
}

public static class SecurityPermissions
{
    public const string TenantsManage = "platform.tenants.manage";
    public const string UsersView = "security.users.view";
    public const string CompaniesManage = "settings.companies.manage";
    public const string UsersManage = "security.users.manage";
    public const string RolesView = "security.roles.view";
    public const string RolesManage = "security.roles.manage";
    public const string AuditView = "security.audit.view";
    public const string EmployeesView = "employees.view";
    public const string EmployeesManage = "employees.manage";
    public const string DesignationsManage = "designations.manage";
    public const string SalesExtract = "sales.items.extract";
    public const string SalesView = "sales.view";
    public const string SalesManage = "sales.manage";
    public const string SalesStatusesManage = "sales.statuses.manage";
    public const string AwsConfigurationManage = "settings.aws.manage";
    public const string OpenAiConfigurationManage = "settings.openai.manage";
    public const string ClaudeConfigurationManage = "settings.claude.manage";
    public const string SurveysManage = "surveys.manage";
    public const string QuotesManage = "quotes.manage";
    public const string OperationsManage = "operations.manage";
    public const string PackingManage = "packing.manage";
    public const string PickupCollectionReopen = "pickup.collection.reopen";
    public const string WarehouseManage = "warehouse.manage";
    public const string TransportationManage = "transportation.manage";
    public const string DeliveryManage = "delivery.manage";
    public const string AccountingManage = "accounting.manage";
    public const string BillingView = "billing.view";
    public const string BillingCapture = "billing.capture";
    public const string BillingIssue = "billing.issue";
    public const string BillingPay = "billing.pay";
    public const string BillingAccounts = "billing.accounts";
    public const string IncentivesManage = "incentives.manage";

    public static readonly IReadOnlyList<(string Code, string Name, string Module)> All =
    [
        (TenantsManage, "Manage tenants", "Platform"),
        ("reports.design", "Design report templates", "Reports"), ("reports.publish", "Publish report templates", "Reports"), ("reports.print", "Print saved report templates", "Reports"),
        (UsersView, "View users", "Security"), (UsersManage, "Manage users", "Security"),
        (RolesView, "View roles", "Security"), (RolesManage, "Manage roles", "Security"),
        (AuditView, "View audit log", "Security"),
        (EmployeesView, "View employees", "Employees"),
        (EmployeesManage, "Manage employees", "Employees"),
        (DesignationsManage, "Manage designations", "Employees"),
        (SalesExtract, "Extract inventory with AI (OpenAI or Claude)", "Sales"),
        (SalesView, "View sales leads", "Sales"), (SalesManage, "Manage sales leads and follow-ups", "Sales"),
        (SalesStatusesManage, "Manage sales status masters", "Sales"),
        (CompaniesManage, "Manage companies (tenant users only)", "Settings"),
        (AwsConfigurationManage, "Manage tenant AWS configuration", "Settings"), (SurveysManage, "Manage surveys", "Surveys"),
        (OpenAiConfigurationManage, "Manage tenant OpenAI configuration", "Settings"),
        (ClaudeConfigurationManage, "Manage tenant Claude configuration", "Settings"),
        (QuotesManage, "Manage quotations", "Quotations"),
        (OperationsManage, "Manage pickup and operations", "Operations"),
        (PackingManage, "Manage packing jobs, crew, boxes, labels and materials", "Operations"),
        (PickupCollectionReopen, "Reopen a pickup collection the warehouse has approved", "Operations"),
        (WarehouseManage, "Manage warehouses", "Warehouse"),
        (TransportationManage, "Manage transportation", "Transportation"),
        (DeliveryManage, "Manage deliveries, delivery notes, signatures, crew and delivery money", "Delivery"),
        (BillingView, "View invoices, bills and charges", "Billing"),
        (BillingCapture, "Capture income and expense charges", "Billing"),
        (BillingIssue, "Issue and void invoices and bills", "Billing"),
        (BillingPay, "Post billing to accounting; record and reverse receipts and payments", "Billing"),
        (BillingAccounts, "Manage chart of accounts", "Billing"),
        (AccountingManage, "Manage accounting", "Accounting"),
        (IncentivesManage, "Manage incentives", "Incentives")
    ];
}



