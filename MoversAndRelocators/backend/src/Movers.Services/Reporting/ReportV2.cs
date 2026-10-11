using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Movers.Domain.Operations;
using Movers.Services.Billing;
using Movers.Services.Operations;
using Movers.Services.Pickups;
using Movers.Services.Quotations;
using Movers.Services.Security;
using Movers.Services.Tenancy;
namespace Movers.Services.Reporting;

public record ReportTypeV2(string Type, string Label, string Module, string Permission);
public record ReportTemplateV2(string Type, string Name, string Layout, bool IsDefault, bool ListOnPrint, int Revision, Guid? UpdatedBy, DateTimeOffset UpdatedAt);
public record ReportTemplateV2View(Guid Id, Guid Version, ReportTemplateV2 Details);
public record ReportTemplateV2History(Guid TemplateId, string Action, Guid? Actor, DateTimeOffset At, ReportTemplateV2 Template);
public record SaveReportTemplateV2(Guid? Version, string Type, string Name, string Layout, bool ListOnPrint);
public record ReportTemplateV2Flags(Guid Version, bool? IsDefault, bool? ListOnPrint);

/// <summary>Catalogue of printable document types and the permission that guards each one's data.</summary>
public static class ReportTypesV2
{
    public static readonly string[] Accounting = [
        "Trial balance","General ledger","Journal register","Profit and loss","Balance sheet","Cash flow statement","Cash book & bank book","Customer statement","Vendor statement","Accounts receivable aging","Accounts payable aging","Invoice register","Bill register","Receipt register","Payment voucher register","Credit memo register","Debit memo register","Outstanding customer balances","Outstanding vendor balances","Customer advances","Expense analysis by account","Revenue analysis by account","Pickup / warehouse / job profitability","Currency exposure & exchange differences","Tax summary","Posting & reversal audit"];
    public static readonly IReadOnlyList<ReportTypeV2> All = [
        new("INVOICE","Invoice","Billing",SecurityPermissions.BillingView),
        new("BILL","Bill","Billing",SecurityPermissions.BillingView),
        new("RECEIPT","Receipt","Billing",SecurityPermissions.BillingView),
        new("PAYMENT","Payment voucher","Billing",SecurityPermissions.BillingView),
        new("CREDIT_MEMO","Credit memo","Billing",SecurityPermissions.BillingView),
        new("DEBIT_MEMO","Debit memo","Billing",SecurityPermissions.BillingView),
        new("QUOTATION","Quotation","Sales",SecurityPermissions.QuotesManage),
        new("PICKUP_RECEIPT","Pickup payment receipt","Operations",SecurityPermissions.OperationsManage),
        new("BOX_LABELS","Box labels","Operations",SecurityPermissions.OperationsManage),
        new("PACKING_LIST","Packing list","Operations",SecurityPermissions.OperationsManage),
        new("PACKING_LABELS","Packing job box labels","Packing",SecurityPermissions.PackingManage),
        new("PACKING_SHEET","Packing job packing list","Packing",SecurityPermissions.PackingManage),
        new("PACKING_RECEIPT","Packing job payment receipt","Packing",SecurityPermissions.PackingManage),
        new("DELIVERY_NOTE","Delivery note","Delivery",SecurityPermissions.DeliveryManage),
        new("DELIVERY_RECEIPT","Delivery payment receipt","Delivery",SecurityPermissions.DeliveryManage),
        new("WAREHOUSE_RECEIPT","Warehouse receipt","Operations",SecurityPermissions.OperationsManage),
        new("JOB_MANIFEST","Job cargo manifest","Operations",SecurityPermissions.OperationsManage),
        new("COST_REPORT","Operations cost report","Operations",SecurityPermissions.AccountingManage),
        ..Accounting.Select((name,i)=>new ReportTypeV2("ACCOUNTING_"+i,name,"Accounting reports",SecurityPermissions.BillingView))];
    public static ReportTypeV2 Require(string type) => All.FirstOrDefault(t=>t.Type==type) ?? throw new InvalidOperationException("Unknown report type.");
}

/// <summary>Report Engine V2 templates. Stored as BillingRecord payloads (kind REPORT_TEMPLATE_V2) with an immutable history row per change.</summary>
public sealed class ReportTemplateV2Service(IBillingRepository repository, IOperationsRepository unit, ITenantContext tenant, IUserContext user, TimeProvider clock)
{
    private const string Kind = "REPORT_TEMPLATE_V2", HistoryKind = "REPORT_HISTORY_V2";
    private static ReportTemplateV2View View(BillingRecord r) => new(r.Id, r.Version, JsonSerializer.Deserialize<ReportTemplateV2>(r.Payload)!);
    private async Task<List<ReportTemplateV2View>> All(CancellationToken ct) => (await repository.List(Kind, ct)).Select(View).ToList();
    private async Task<BillingRecord> Require(Guid id, CancellationToken ct) { var r = await repository.Get(id, ct); return r?.Kind == Kind ? r : throw new KeyNotFoundException(); }

    /// <summary>Templates for one type. Printing callers only see the default and list-on-print templates.</summary>
    public async Task<IReadOnlyList<ReportTemplateV2View>> List(string? type, bool printOnly, CancellationToken ct) =>
        (await All(ct)).Where(x => (string.IsNullOrEmpty(type) || x.Details.Type == type) && (!printOnly || x.Details.IsDefault || x.Details.ListOnPrint))
        .OrderByDescending(x => x.Details.IsDefault).ThenBy(x => x.Details.Name).ToList();
    public async Task<ReportTemplateV2View> Get(Guid id, CancellationToken ct) => View(await Require(id, ct));
    public async Task<ReportTemplateV2View?> Default(string type, CancellationToken ct) => (await All(ct)).FirstOrDefault(x => x.Details.Type == type && x.Details.IsDefault);

    public Task<ReportTemplateV2View> Save(Guid? id, SaveReportTemplateV2 c, CancellationToken ct) => unit.Transaction(async () => {
        ReportLayoutV2Validation.Validate(c);
        BillingRecord r; ReportTemplateV2? old = null;
        if (id.HasValue) {
            r = await Require(id.Value, ct);
            if (r.Version != c.Version) throw new OperationConflictException("This template changed. Refresh before saving.");
            old = View(r).Details;
            if (old.Type != c.Type) throw new InvalidOperationException("Duplicate the template to change its report type.");
        } else { r = new BillingRecord(tenant.TenantId) { Kind = Kind, Number = Guid.NewGuid().ToString("N"), RequestId = Guid.NewGuid() }; unit.Add(r); }
        // The first template of a type becomes its default so printing picks it up without an extra step.
        var isDefault = old?.IsDefault ?? !(await All(ct)).Any(x => x.Details.Type == c.Type && x.Details.IsDefault);
        var d = new ReportTemplateV2(c.Type, c.Name.Trim(), c.Layout, isDefault, c.ListOnPrint, (old?.Revision ?? 0) + 1, user.UserId, clock.GetUtcNow());
        Write(r, id.HasValue ? "Saved" : "Created", d); await unit.Save(ct); return View(r);
    }, ct);

    public Task<ReportTemplateV2View> SetFlags(Guid id, ReportTemplateV2Flags c, CancellationToken ct) => unit.Transaction(async () => {
        var r = await Require(id, ct);
        if (r.Version != c.Version) throw new OperationConflictException("This template changed. Refresh before saving.");
        var d = View(r).Details;
        if (c.IsDefault == true)
            foreach (var other in await repository.List(Kind, ct)) {
                var o = View(other).Details;
                if (other.Id != id && o.Type == d.Type && o.IsDefault) Write(other, "Default replaced", o with { IsDefault = false });
            }
        d = d with { IsDefault = c.IsDefault ?? d.IsDefault, ListOnPrint = c.ListOnPrint ?? d.ListOnPrint, UpdatedBy = user.UserId, UpdatedAt = clock.GetUtcNow() };
        Write(r, "Flags changed", d); await unit.Save(ct); return View(r);
    }, ct);

    public Task<ReportTemplateV2View> Duplicate(Guid id, CancellationToken ct) => unit.Transaction(async () => {
        var src = View(await Require(id, ct)).Details;
        var r = new BillingRecord(tenant.TenantId) { Kind = Kind, Number = Guid.NewGuid().ToString("N"), RequestId = Guid.NewGuid() }; unit.Add(r);
        var name = (src.Name.Length > 110 ? src.Name[..110] : src.Name) + " (copy)";
        Write(r, "Duplicated", src with { Name = name, IsDefault = false, Revision = 1, UpdatedBy = user.UserId, UpdatedAt = clock.GetUtcNow() });
        await unit.Save(ct); return View(r);
    }, ct);

    /// <summary>Deletion is soft: the record is re-kinded so history and audit rows stay intact.</summary>
    public Task<bool> Delete(Guid id, CancellationToken ct) => unit.Transaction(async () => {
        var r = await Require(id, ct); var d = View(r).Details;
        Write(r, "Deleted", d); r.Kind = Kind + "_DELETED"; await unit.Save(ct); return true;
    }, ct);

    public async Task<IReadOnlyList<ReportTemplateV2History>> History(Guid id, CancellationToken ct) {
        await Require(id, ct);
        return (await repository.List(HistoryKind, ct)).Select(x => JsonSerializer.Deserialize<ReportTemplateV2History>(x.Payload)!).Where(x => x.TemplateId == id).OrderBy(x => x.At).ToList();
    }

    private void Write(BillingRecord r, string action, ReportTemplateV2 d) {
        r.Payload = JsonSerializer.Serialize(d); r.Version = Guid.NewGuid();
        unit.Add(new BillingRecord(tenant.TenantId) {
            Kind = HistoryKind, Number = Guid.NewGuid().ToString("N"), RequestId = Guid.NewGuid(),
            Payload = JsonSerializer.Serialize(new ReportTemplateV2History(r.Id, action, user.UserId, clock.GetUtcNow(), d))
        });
    }
}

/// <summary>
/// Server-side guard for V2 layouts. Text-bearing properties (text, expressions, headers, image sources) are
/// escaped by the renderer, but style properties are written into style attributes verbatim, so they are
/// restricted to a CSS-value alphabet here. That keeps a stored template from injecting markup into the
/// pages of whoever prints it.
/// </summary>
public static partial class ReportLayoutV2Validation
{
    private static readonly HashSet<string> FreeText = ["text", "expr", "header", "footer", "dataPath", "repeatPath", "id", "size", "_label"];
    private static readonly string[] Modes = ["fixed", "batch", "flow"];
    [GeneratedRegex(@"^[#\w\s.,%()'+\-/]*$")] private static partial Regex CssValue();
    [GeneratedRegex(@"^(data:image/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=\r\n]+|https://[^\s""'<>]+|\{\{[^<>""]*\}\})?$")] private static partial Regex ImageSource();
    public static void Validate(SaveReportTemplateV2 c) {
        if (string.IsNullOrWhiteSpace(c.Name) || c.Name.Trim().Length > 120) throw new InvalidOperationException("Provide a template name up to 120 characters.");
        ReportTypesV2.Require(c.Type);
        if (string.IsNullOrEmpty(c.Layout) || c.Layout.Length > 4_000_000) throw new InvalidOperationException("The layout is empty or larger than 4 MB.");
        JsonNode? root;
        try { root = JsonNode.Parse(c.Layout); } catch (JsonException) { throw new InvalidOperationException("The layout is not valid JSON."); }
        if (root is not JsonObject o || !Modes.Contains(o["mode"]?.GetValue<string>())) throw new InvalidOperationException("The layout must declare a fixed, batch or flow mode.");
        if (o["pages"] is not JsonArray pages || pages.Count is < 1 or > 50) throw new InvalidOperationException("A layout needs between 1 and 50 pages.");
        Walk(o, null, 0);
    }
    private static void Walk(JsonNode? n, string? key, int depth) {
        if (depth > 32) throw new InvalidOperationException("The layout is nested too deeply.");
        switch (n) {
            case JsonObject obj: foreach (var (k, v) in obj) Walk(v, k, depth + 1); break;
            case JsonArray arr: foreach (var v in arr) Walk(v, key, depth + 1); break;
            case JsonValue v when v.TryGetValue<string>(out var s):
                if (s.Length > 20000 && key != "src") throw new InvalidOperationException("A layout value is too long.");
                if (key == "src") { if (!ImageSource().IsMatch(s)) throw new InvalidOperationException("Images must be uploaded PNG/JPEG/GIF/WebP data, an https URL or a {{field}}."); }
                else if (key is null || !FreeText.Contains(key)) { if (!CssValue().IsMatch(s)) throw new InvalidOperationException($"Invalid value for '{key}'."); }
                break;
        }
    }
}

/// <summary>Tenant letterhead shown on every report: logo, address and contact lines, and the page footer note.</summary>
public record ReportBranding(string? CompanyName, string? Logo, string? Address, string? Phone, string? Email, string? Website, string? TaxId, string? FooterNote);
public record ReportBrandingView(Guid? Version, ReportBranding Branding);
public record SaveReportBranding(Guid? Version, ReportBranding Branding);

/// <summary>
/// Stores the tenant letterhead as a single BillingRecord (kind REPORT_BRANDING). Unset fields fall back to the
/// tenant's own name, address, phone and email, so reports carry a sensible header before anything is configured.
/// </summary>
public sealed partial class ReportBrandingService(IBillingRepository repository, IOperationsRepository unit, ITenantContext tenant, IUserContext user, TimeProvider clock)
{
    private const string Kind = "REPORT_BRANDING";
    [GeneratedRegex(@"^data:image/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=\r\n]+$")] private static partial Regex LogoData();
    private async Task<BillingRecord?> Record(CancellationToken ct) => (await repository.List(Kind, ct)).FirstOrDefault();

    public async Task<ReportBrandingView> Get(CancellationToken ct) {
        var r = await Record(ct);
        return new(r?.Version, r is null ? new ReportBranding(null, null, null, null, null, null, null, null) : JsonSerializer.Deserialize<ReportBranding>(r.Payload)!);
    }

    /// <summary>The letterhead with blanks filled from the tenant profile.</summary>
    public async Task<ReportBranding> Effective(CancellationToken ct) {
        var b = (await Get(ct)).Branding; var t = tenant.Tenant;
        static string? Pick(string? a, string? b) => string.IsNullOrWhiteSpace(a) ? b : a;
        return new(Pick(b.CompanyName, t?.Name) ?? "", b.Logo, Pick(b.Address, t?.Address), Pick(b.Phone, t?.Phone), Pick(b.Email, t?.ContactEmail), b.Website, b.TaxId, b.FooterNote);
    }

    public Task<ReportBrandingView> Save(SaveReportBranding c, CancellationToken ct) => unit.Transaction(async () => {
        var b = Clean(c.Branding ?? throw new InvalidOperationException("Provide the letterhead details."));
        var r = await Record(ct);
        if (r is null) { r = new BillingRecord(tenant.TenantId) { Kind = Kind, Number = "BRANDING", RequestId = Guid.NewGuid() }; unit.Add(r); }
        else if (r.Version != c.Version) throw new OperationConflictException("The letterhead changed. Refresh before saving.");
        r.Payload = JsonSerializer.Serialize(b); r.Version = Guid.NewGuid();
        unit.Add(new BillingRecord(tenant.TenantId) { Kind = "BRANDING_HISTORY", Number = Guid.NewGuid().ToString("N"), RequestId = Guid.NewGuid(),
            Payload = JsonSerializer.Serialize(new { Actor = user.UserId, At = clock.GetUtcNow(), Branding = b with { Logo = b.Logo is null ? null : "(logo)" } }) });
        await unit.Save(ct); return new ReportBrandingView(r.Version, b);
    }, ct);

    private static ReportBranding Clean(ReportBranding b) {
        static string? T(string? v, int max, string label) {
            if (string.IsNullOrWhiteSpace(v)) return null;
            v = v.Trim(); if (v.Length > max) throw new InvalidOperationException($"{label} must be {max} characters or fewer.");
            return v;
        }
        var logo = string.IsNullOrWhiteSpace(b.Logo) ? null : b.Logo.Trim();
        if (logo is not null && (logo.Length > 1_400_000 || !LogoData().IsMatch(logo))) throw new InvalidOperationException("Upload the logo as a PNG, JPEG, GIF or WebP image of 1 MB or less.");
        return new(T(b.CompanyName, 200, "Company name"), logo, T(b.Address, 1000, "Address"), T(b.Phone, 100, "Phone"), T(b.Email, 200, "Email"), T(b.Website, 200, "Website"), T(b.TaxId, 100, "Tax ID"), T(b.FooterNote, 300, "Footer note"));
    }
}

/// <summary>
/// Builds the data record a V2 template is rendered against. Each type reuses the service that serves the
/// screen the document is printed from, and is gated by that screen's permission, so printing never exposes
/// more than the user can already see. Every record carries `company`, `generatedAt` and `title`.
/// </summary>
public sealed class ReportDataService(BillingService billing, IPickupService pickups, JobService jobs, WarehouseService warehouse, IQuotationService quotations,
    IOperationsService operations, IShipmentService shipments, Movers.Services.Packing.PackingService packing, Movers.Services.Delivery.DeliveryService delivery, ReportBrandingService branding, ITenantContext tenant, IUserContext user, TimeProvider clock)
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    /// <summary>The screen permission, matching the API policies: packing and delivery are also open to operations.manage.</summary>
    private bool Allowed(string permission) => user.IsSystemAdmin || user.HasPermission(permission)
        || permission is SecurityPermissions.PackingManage or SecurityPermissions.DeliveryManage && user.HasPermission(SecurityPermissions.OperationsManage);

    public async Task<JsonObject> Data(string type, Guid? id, IReadOnlyDictionary<string, string> q, CancellationToken ct) {
        var t = ReportTypesV2.Require(type);
        if (!Allowed(t.Permission)) throw new UnauthorizedAccessException();
        var (title, body) = await Build(type, id, q, ct);
        return await Envelope(title, body, ct);
    }

    /// <summary>A representative record for the designer: the most recent document of the type, or the report run with default filters.</summary>
    public async Task<JsonObject> Sample(string type, CancellationToken ct) {
        var t = ReportTypesV2.Require(type);
        if (!Allowed(t.Permission)) throw new UnauthorizedAccessException();
        Guid? id = type switch {
            "INVOICE" or "BILL" => (await billing.Documents(ct)).LastOrDefault(x => x.Details.Type == type)?.Id,
            "RECEIPT" or "PAYMENT" => (await billing.Vouchers(ct)).LastOrDefault(x => x.Details.Type == type)?.Id,
            "CREDIT_MEMO" or "DEBIT_MEMO" => (await billing.Memos(ct)).LastOrDefault(x => x.Details.Type == type)?.Id,
            "QUOTATION" => (await quotations.ListAsync(ct)).OrderByDescending(x => x.CreatedAtUtc).FirstOrDefault()?.Id,
            "PICKUP_RECEIPT" or "BOX_LABELS" or "PACKING_LIST" => (await pickups.List(ct)).OrderByDescending(x => x.CreatedAtUtc).FirstOrDefault()?.Id,
            "WAREHOUSE_RECEIPT" => (await warehouse.Receipts(ct)).OrderByDescending(x => x.ReceivedAtUtc).FirstOrDefault()?.Id,
            "JOB_MANIFEST" => (await jobs.List(ct)).OrderByDescending(x => x.CreatedAtUtc).FirstOrDefault()?.Id,
            "PACKING_LABELS" or "PACKING_SHEET" or "PACKING_RECEIPT" => (await packing.List(ct)).FirstOrDefault()?.Id,
            "DELIVERY_NOTE" or "DELIVERY_RECEIPT" => (await delivery.List(ct)).FirstOrDefault(x => x.NoteCount > 0)?.Id,
            "COST_REPORT" => (await operations.Reports(ct)).FirstOrDefault()?.Id,
            _ => null
        };
        var q = new Dictionary<string, string>();
        if (type.StartsWith("ACCOUNTING_")) {
            var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
            q["from"] = new DateOnly(today.Year, 1, 1).ToString("yyyy-MM-dd"); q["to"] = q["date"] = today.ToString("yyyy-MM-dd");
            q["currency"] = "BASE"; q["status"] = "ALL"; q["partyType"] = "CUSTOMER"; q["sourceKind"] = "ALL"; q["document"] = "";
            q["accountCode"] = type == "ACCOUNTING_6" ? "1000" : type == "ACCOUNTING_24" ? "2200" : "1100";
            if (type is "ACCOUNTING_7" or "ACCOUNTING_8") {
                var choices = JsonSerializer.SerializeToNode(await billing.Choices(ct), Web);
                var list = choices?[type == "ACCOUNTING_7" ? "customers" : "vendors"] as JsonArray;
                var code = list?.FirstOrDefault()?["code"]?.GetValue<string>();
                if (code is null) return await Envelope(t.Label, new JsonObject(), ct);
                q[type == "ACCOUNTING_7" ? "customerCode" : "vendorCode"] = code;
            }
        } else if (id is null) return await Envelope(t.Label, new JsonObject(), ct);
        try { var (title, body) = await Build(type, id, q, ct); return await Envelope(title, body, ct); }
        catch (Exception e) when (e is InvalidOperationException or KeyNotFoundException) { return await Envelope(t.Label, new JsonObject(), ct); }
    }

    /// <summary>Public packing link: the customer sees the packing snapshot only, never the staff record.</summary>
    public async Task<JsonObject> PublicPacking(string token, CancellationToken ct) {
        var p = await shipments.Public(token, ct);
        var body = Node(p); body["packageCount"] = p.Snapshot.Packages.Count;
        // Same top-level shape as the staff packing list, so one PACKING_LIST template serves both.
        body["pickup"] = new JsonObject { ["pickupNumber"] = p.Snapshot.PickupNumber, ["customerName"] = p.Snapshot.CustomerName, ["address"] = p.Snapshot.Address };
        body["packages"] = JsonSerializer.SerializeToNode(p.Snapshot.Packages, Web);
        body["leftBehindNotes"] = p.Snapshot.LeftBehindNotes;
        return await Envelope(p.Snapshot.PickupNumber + " packing list", body, ct);
    }

    private async Task<JsonObject> Envelope(string title, JsonObject body, CancellationToken ct) {
        var b = await branding.Effective(ct);
        body["company"] = new JsonObject { ["name"] = b.CompanyName, ["logo"] = b.Logo, ["address"] = b.Address, ["phone"] = b.Phone, ["email"] = b.Email, ["website"] = b.Website, ["taxId"] = b.TaxId, ["footerNote"] = b.FooterNote };
        body["generatedAt"] = clock.GetUtcNow();
        body["title"] = title;
        return body;
    }
    private static JsonObject Node(object o) => JsonSerializer.SerializeToNode(o, Web) as JsonObject ?? new JsonObject { ["value"] = JsonSerializer.SerializeToNode(o, Web) };
    private static Guid Need(Guid? id) => id ?? throw new InvalidOperationException("Provide the record id to print.");
    private static string Arg(IReadOnlyDictionary<string, string> q, string k, string? fallback = null) => q.TryGetValue(k, out var v) && !string.IsNullOrEmpty(v) ? v : fallback ?? throw new InvalidOperationException($"Missing '{k}'.");
    private static string? Opt(IReadOnlyDictionary<string, string> q, string k) => q.TryGetValue(k, out var v) && !string.IsNullOrEmpty(v) ? v : null;
    private static DateOnly Date(IReadOnlyDictionary<string, string> q, string k) => DateOnly.TryParse(Arg(q, k), out var d) ? d : throw new InvalidOperationException($"Invalid date '{k}'.");

    private async Task<(string, JsonObject)> Build(string type, Guid? id, IReadOnlyDictionary<string, string> q, CancellationToken ct) {
        switch (type) {
            case "INVOICE" or "BILL": {
                var d = (await billing.Documents(ct)).FirstOrDefault(x => x.Id == Need(id) && x.Details.Type == type) ?? throw new KeyNotFoundException();
                return (d.Number, Node(d));
            }
            case "RECEIPT" or "PAYMENT": {
                var v = (await billing.Vouchers(ct)).FirstOrDefault(x => x.Id == Need(id) && x.Details.Type == type) ?? throw new KeyNotFoundException();
                var docs = (await billing.Documents(ct)).ToDictionary(x => x.Id);
                var n = Node(v);
                // Allocations only carry a document id; resolve the number and currency the printed voucher shows.
                if (n["details"]?["allocations"] is JsonArray allocations)
                    foreach (var a in allocations.OfType<JsonObject>())
                        if (Guid.TryParse(a["documentId"]?.GetValue<string>(), out var did) && docs.TryGetValue(did, out var doc)) {
                            a["documentNumber"] = doc.Number; a["documentType"] = doc.Details.Type; a["documentCurrency"] = doc.Details.Currency;
                        }
                return (v.Number, n);
            }
            case "CREDIT_MEMO" or "DEBIT_MEMO": {
                var m = (await billing.Memos(ct)).FirstOrDefault(x => x.Id == Need(id) && x.Details.Type == type) ?? throw new KeyNotFoundException();
                return (m.Number, Node(m));
            }
            case "QUOTATION": {
                var d = await quotations.GetAsync(Need(id), ct) ?? throw new KeyNotFoundException();
                return (d.Quotation.QuotationNumber, Node(d));
            }
            case "PICKUP_RECEIPT" or "BOX_LABELS" or "PACKING_LIST": {
                var d = await pickups.Get(Need(id), ct) ?? throw new KeyNotFoundException();
                var n = Node(d);
                if (type == "PICKUP_RECEIPT") {
                    var payment = Opt(q, "transactionId") is { } tx && Guid.TryParse(tx, out var tid) ? d.Transactions.FirstOrDefault(x => x.Id == tid) : d.Transactions.LastOrDefault(x => x.Type == "INCOME");
                    if (payment is null) throw new InvalidOperationException("This pickup has no payment to print.");
                    n["payment"] = Node(payment);
                    n["totalCollected"] = d.Transactions.Where(x => x.Type == "INCOME" && x.Currency == payment.Currency).Sum(x => x.Amount);
                    return (payment.TransactionNumber, n);
                }
                var wanted = Opt(q, "packageIds")?.Split(',').Select(s => Guid.TryParse(s, out var g) ? g : Guid.Empty).ToHashSet();
                var packages = new JsonArray();
                for (var i = 0; i < d.Packages.Count; i++) {
                    if (wanted is not null && !wanted.Contains(d.Packages[i].Id)) continue;
                    var p = Node(d.Packages[i]); p["boxIndex"] = i + 1; p["boxCount"] = d.Packages.Count; packages.Add(p);
                }
                n["packages"] = packages; n["packageCount"] = d.Packages.Count;
                return (d.Pickup.PickupNumber + (type == "BOX_LABELS" ? " box labels" : " packing list"), n);
            }
            case "PACKING_LABELS" or "PACKING_SHEET" or "PACKING_RECEIPT": {
                var d = await packing.Get(Need(id), ct) ?? throw new KeyNotFoundException();
                var n = Node(d);
                if (type == "PACKING_RECEIPT") {
                    var payment = Opt(q, "transactionId") is { } tx && Guid.TryParse(tx, out var tid) ? d.Transactions.FirstOrDefault(x => x.Id == tid) : d.Transactions.FirstOrDefault(x => x.Type == "INCOME");
                    if (payment is null) throw new InvalidOperationException("This packing job has no payment to print.");
                    n["payment"] = Node(payment);
                    n["totalCollected"] = d.Transactions.Where(x => x.Type == "INCOME" && x.Currency == payment.Currency).Sum(x => x.Amount);
                    return (payment.TransactionNumber, n);
                }
                // Labels: one entry per box (optionally only the selected ones), each knowing its position in the job.
                var wanted = Opt(q, "boxIds")?.Split(',').Select(s => Guid.TryParse(s, out var g) ? g : Guid.Empty).ToHashSet();
                var boxes = new JsonArray();
                for (var i = 0; i < d.Boxes.Count; i++) {
                    if (wanted is not null && !wanted.Contains(d.Boxes[i].Id)) continue;
                    var b = Node(d.Boxes[i]); b["boxIndex"] = i + 1; b["boxCount"] = d.Boxes.Count; boxes.Add(b);
                }
                n["boxes"] = boxes; n["boxCount"] = d.Boxes.Count;
                n["itemCount"] = d.Boxes.Sum(b => b.Items.Sum(i => i.Quantity));
                return (d.Job.JobNumber + (type == "PACKING_LABELS" ? " box labels" : " packing list"), n);
            }
            case "DELIVERY_NOTE" or "DELIVERY_RECEIPT": {
                var d = await delivery.Get(Need(id), ct) ?? throw new KeyNotFoundException();
                var n = new JsonObject { ["delivery"] = Node(d.Job), ["crew"] = JsonSerializer.SerializeToNode(d.Crew, Web) };
                if (type == "DELIVERY_RECEIPT") {
                    var payment = Opt(q, "transactionId") is { } tx && Guid.TryParse(tx, out var tid) ? d.Transactions.FirstOrDefault(x => x.Id == tid) : d.Transactions.FirstOrDefault(x => x.Type == "INCOME");
                    if (payment is null || payment.Type != "INCOME") throw new InvalidOperationException("This delivery has no collected payment to print.");
                    n["payment"] = Node(payment);
                    var payer = d.Notes.FirstOrDefault(x => x.Id == payment.DeliveryNoteId);
                    n["customer"] = new JsonObject { ["name"] = payer?.CustomerName ?? "", ["contact"] = payer?.ContactName, ["phone"] = payer?.Phone, ["address"] = payer?.Address, ["noteNumber"] = payer?.NoteNumber };
                    return (payment.TransactionNumber, n);
                }
                // One note per customer: the note asked for, or the first one on the run.
                var note = Opt(q, "noteId") is { } nid && Guid.TryParse(nid, out var noteId) ? d.Notes.FirstOrDefault(x => x.Id == noteId) : d.Notes.FirstOrDefault();
                if (note is null) throw new InvalidOperationException("This delivery has no delivery note yet. Load packages first.");
                var noteNode = Node(note); noteNode.Remove("items");
                n["note"] = noteNode;
                var items = new JsonArray();
                for (var i = 0; i < note.Items.Count; i++) { var item = Node(note.Items[i]); item["index"] = i + 1; item["statusLabel"] = note.Items[i].Status switch { "DELIVERED" => "Delivered", "RETURNED" => "Not delivered", _ => "Loaded" }; items.Add(item); }
                n["items"] = items; n["itemCount"] = note.Items.Count;
                n["deliveredCount"] = note.Items.Count(x => x.Status == "DELIVERED"); n["notDeliveredCount"] = note.Items.Count(x => x.Status == "RETURNED");
                return (note.NoteNumber + " · " + note.CustomerName, n);
            }
            case "WAREHOUSE_RECEIPT": {
                var r = (await warehouse.Receipts(ct)).FirstOrDefault(x => x.Id == Need(id)) ?? throw new KeyNotFoundException();
                return (r.ReceiptNumber, Node(r));
            }
            case "JOB_MANIFEST": {
                var j = await jobs.Get(Need(id), ct);
                var n = Node(j); n["activeCargo"] = JsonSerializer.SerializeToNode(j.Cargo.Where(x => x.IsActive).ToList(), Web);
                return (j.JobNumber, n);
            }
            case "COST_REPORT": {
                var def = (await operations.Reports(ct)).FirstOrDefault(x => x.Id == Need(id)) ?? throw new KeyNotFoundException();
                DateOnly? date = Opt(q, "date") is { } ds && DateOnly.TryParse(ds, out var dd) ? dd : null;
                var rows = Node(new { rows = await operations.Costs(ct, Opt(q, "mode") ?? "TRANSACTION", date) })["rows"] as JsonArray ?? [];
                var sorted = new JsonArray(rows.OrderBy(r => r?[JsonNamingPolicy.CamelCase.ConvertName(def.SortBy)]?.ToJsonString()).Select(r => r?.DeepClone()).ToArray());
                var n = Node(def); n["rows"] = sorted; n["mode"] = Opt(q, "mode") ?? "TRANSACTION"; n["date"] = date?.ToString("yyyy-MM-dd");
                return (def.Name, n);
            }
        }
        if (type.StartsWith("ACCOUNTING_") && int.TryParse(type[11..], out var idx)) {
            string cur = Arg(q, "currency", "BASE"), status = Arg(q, "status", "ALL");
            object result = idx switch {
                0 => await billing.TrialBalanceReport(Date(q, "from"), Date(q, "to"), cur, ct),
                1 => await billing.GeneralLedgerReport(Date(q, "from"), Date(q, "to"), cur, Arg(q, "accountCode"), ct),
                2 => await billing.JournalRegister(Date(q, "from"), Date(q, "to"), cur, status, ct),
                3 => await billing.ProfitAndLossReport(Date(q, "from"), Date(q, "to"), cur, ct),
                4 => await billing.BalanceSheetReport(Date(q, "date"), cur, ct),
                5 => await billing.CashFlowReport(Date(q, "from"), Date(q, "to"), cur, ct),
                6 => await billing.CashBookReport(Date(q, "from"), Date(q, "to"), cur, Arg(q, "accountCode"), ct),
                7 => await billing.CustomerStatement(Date(q, "from"), Date(q, "to"), cur, Arg(q, "customerCode"), ct),
                8 => await billing.VendorStatement(Date(q, "from"), Date(q, "to"), cur, Arg(q, "vendorCode"), ct),
                9 => await billing.ReceivableAging(Date(q, "date"), cur, Opt(q, "customerCode"), ct),
                10 => await billing.PayableAging(Date(q, "date"), cur, Opt(q, "vendorCode"), ct),
                11 => await billing.InvoiceRegister(Date(q, "from"), Date(q, "to"), cur, status, Opt(q, "customerCode"), ct),
                12 => await billing.BillRegister(Date(q, "from"), Date(q, "to"), cur, status, Opt(q, "vendorCode"), ct),
                13 => await billing.ReceiptRegister(Date(q, "from"), Date(q, "to"), cur, status, Opt(q, "customerCode"), ct),
                14 => await billing.PaymentVoucherRegister(Date(q, "from"), Date(q, "to"), cur, status, Opt(q, "vendorCode"), ct),
                15 => await billing.CreditMemoRegister(Date(q, "from"), Date(q, "to"), cur, status, Arg(q, "partyType", "CUSTOMER"), Opt(q, "partyCode"), ct),
                16 => await billing.DebitMemoRegister(Date(q, "from"), Date(q, "to"), cur, status, Arg(q, "partyType", "CUSTOMER"), Opt(q, "partyCode"), ct),
                17 => await billing.OutstandingCustomers(Date(q, "date"), cur, Opt(q, "customerCode"), ct),
                18 => await billing.OutstandingVendors(Date(q, "date"), cur, Opt(q, "vendorCode"), ct),
                19 => await billing.CustomerAdvances(Date(q, "date"), cur, Opt(q, "customerCode"), ct),
                20 => await billing.ExpenseAnalysis(Date(q, "from"), Date(q, "to"), cur, Opt(q, "accountCode"), ct),
                21 => await billing.RevenueAnalysis(Date(q, "from"), Date(q, "to"), cur, Opt(q, "accountCode"), ct),
                22 => await billing.OperationProfitability(Date(q, "from"), Date(q, "to"), cur, Arg(q, "sourceKind", "ALL"), Opt(q, "sourceId") is { } s && Guid.TryParse(s, out var sid) ? sid : null, ct),
                23 => await billing.CurrencyExposure(Date(q, "from"), Date(q, "to"), cur, ct),
                24 => await billing.TaxSummary(Date(q, "from"), Date(q, "to"), cur, ct),
                25 => await billing.PostingAudit(Date(q, "from"), Date(q, "to"), cur, status, Opt(q, "userId") is { } u && Guid.TryParse(u, out var uid) ? uid : null, Opt(q, "document"), ct),
                _ => throw new InvalidOperationException("Unknown accounting report.")
            };
            var n = Node(result); n["filters"] = JsonSerializer.SerializeToNode(q, Web);
            return (ReportTypesV2.Accounting[idx], n);
        }
        throw new InvalidOperationException("Unknown report type.");
    }
}
