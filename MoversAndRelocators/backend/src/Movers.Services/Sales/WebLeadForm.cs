using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using Movers.Domain.Operations;
using Movers.Domain.Tenants;
using Movers.Services.Billing;
using Movers.Services.Operations;
using Movers.Services.Tenancy;

namespace Movers.Services.Sales;

/// <summary>A company's public "request a quote" form for its website. Key: the public id in the form's address.</summary>
public sealed record WebLeadFormSettings(bool Enabled, string? Key, Guid? StatusId, Guid? DefaultMoveTypeId, Guid? AssignedEmployeeId, string? Source,
    string? Heading, string? Intro, string? ThankYou, string? AccentColor, bool AllowUploads, bool ShowCompanyName);
public sealed record WebLeadFormView(Guid? Version, WebLeadFormSettings Settings);
public sealed record SaveWebLeadForm(Guid? Version, WebLeadFormSettings Settings);

public sealed record PublicMoveTypeOption(Guid Id, string Name, string? Description);
public sealed record PublicLeadFormModel(string CompanyName, bool ShowCompanyName, string? Heading, string? Intro, string? ThankYou, string? AccentColor,
    bool AllowUploads, Guid? DefaultMoveTypeId, IReadOnlyList<PublicMoveTypeOption> MoveTypes);
/// <summary>Website: a honeypot field people never see; when a bot fills it in the submission is dropped quietly.</summary>
public sealed record SubmitWebLeadCommand(string CustomerName, string Phone, string? Email, Guid? MoveTypeId, string Origin, string Destination,
    DateOnly? ExpectedMoveDate, string? Notes, string? Website);
/// <summary>UploadToken: a customer upload link for the new lead (null when uploads are off or storage is not set up).</summary>
public sealed record WebLeadSubmittedModel(string? LeadNumber, string? UploadToken, DateTimeOffset? UploadExpiresAtUtc);

public interface IWebLeadFormRepository
{
    /// <summary>The form with this public key across every tenant, with its active tenant; null when there is none.</summary>
    Task<(Tenant Tenant, BillingRecord Form)?> FindAsync(string kind, string number, CancellationToken t);
}

/// <summary>
/// Stores each company's website form as one BillingRecord (kind WEB_LEAD_FORM, Number = WF- + key) and turns public
/// submissions into sales leads of that company. Uploads afterwards go through an ordinary customer upload link.
/// </summary>
public sealed partial class WebLeadFormService(IBillingRepository records, IOperationsRepository unit, IWebLeadFormRepository forms, ITenantContext tenant,
    Tenants.ICompanyScope companies, ISalesRepository sales, ISalesService leads, ILeadUploadService uploads)
{
    private const string Kind = "WEB_LEAD_FORM", Prefix = "WF-";
    public const int UploadDays = 7;
    [GeneratedRegex("^#[0-9a-fA-F]{6}$")] private static partial Regex HexColor();
    [GeneratedRegex("^[A-Za-z0-9_-]{16,32}$")] private static partial Regex KeyShape();

    private async Task<BillingRecord?> Record(CancellationToken ct) => (await records.List(Kind, ct)).FirstOrDefault();
    private static WebLeadFormSettings Read(BillingRecord r) => JsonSerializer.Deserialize<WebLeadFormSettings>(r.Payload)!;
    private static readonly WebLeadFormSettings Empty = new(false, null, null, null, null, "Website", null, null, null, null, true, true);

    public async Task<WebLeadFormView> Get(CancellationToken ct) { var r = await Record(ct); return new(r?.Version, r is null ? Empty : Read(r)); }

    public Task<WebLeadFormView> Save(SaveWebLeadForm c, CancellationToken ct) => unit.Transaction(async () => {
        var s = await Clean(c.Settings ?? throw new InvalidOperationException("Provide the website form settings."), ct);
        var r = await Record(ct);
        if (r is null) { s = s with { Key = NewKey() }; r = new BillingRecord(tenant.TenantId) { Kind = Kind, Number = Prefix + s.Key, RequestId = Guid.NewGuid() }; unit.Add(r); }
        else if (r.Version != c.Version) throw new OperationConflictException("The website form changed. Refresh before saving.");
        else s = s with { Key = Read(r).Key };
        r.Payload = JsonSerializer.Serialize(s); r.Version = Guid.NewGuid();
        await unit.Save(ct); return new WebLeadFormView(r.Version, s);
    }, ct);

    /// <summary>A new public key: the old address and every website embedding it stop working.</summary>
    public Task<WebLeadFormView> NewAddress(Guid? version, CancellationToken ct) => unit.Transaction(async () => {
        var r = await Record(ct) ?? throw new InvalidOperationException("Save the website form first.");
        if (r.Version != version) throw new OperationConflictException("The website form changed. Refresh before saving.");
        var s = Read(r) with { Key = NewKey() };
        r.Number = Prefix + s.Key; r.Payload = JsonSerializer.Serialize(s); r.Version = Guid.NewGuid();
        await unit.Save(ct); return new WebLeadFormView(r.Version, s);
    }, ct);

    public async Task<PublicLeadFormModel?> GetPublic(string key, CancellationToken ct)
    {
        var s = await Resolve(key, ct); if (s is null) return null;
        var types = (await sales.ListMoveTypesAsync(ct)).Where(x => x.IsActive).OrderBy(x => x.DisplayOrder).ThenBy(x => x.Name).Select(x => new PublicMoveTypeOption(x.Id, x.Name, x.Description)).ToList();
        return new(tenant.Company?.Name ?? tenant.Tenant?.Name ?? "", s.ShowCompanyName, s.Heading, s.Intro, s.ThankYou, s.AccentColor, s.AllowUploads,
            types.Any(x => x.Id == s.DefaultMoveTypeId) ? s.DefaultMoveTypeId : null, types);
    }

    public async Task<WebLeadSubmittedModel?> Submit(string key, SubmitWebLeadCommand c, CancellationToken ct)
    {
        var s = await Resolve(key, ct); if (s is null) return null;
        if (!string.IsNullOrWhiteSpace(c.Website)) return new(null, null, null);
        var moveType = c.MoveTypeId ?? s.DefaultMoveTypeId ?? (await sales.ListMoveTypesAsync(ct)).Where(x => x.IsActive).OrderBy(x => x.DisplayOrder).Select(x => (Guid?)x.Id).FirstOrDefault()
            ?? throw new InvalidOperationException("Select an active move type.");
        var statuses = (await sales.ListLeadStatusesAsync(ct)).Where(x => x.IsActive).ToList();
        var status = statuses.FirstOrDefault(x => x.Id == s.StatusId) ?? statuses.Where(x => !x.IsClosed).OrderBy(x => x.DisplayOrder).FirstOrDefault()
            ?? throw new InvalidOperationException("Select an active lead status.");
        var lead = await leads.CreateLeadAsync(new SaveSalesLeadCommand("", c.CustomerName.Trim(), c.Phone.Trim(), Blank(c.Email), s.Source ?? "Website", moveType,
            c.Origin.Trim(), c.Destination.Trim(), c.ExpectedMoveDate, status.Id, s.AssignedEmployeeId, Blank(c.Notes)), ct);
        if (!s.AllowUploads) return new(lead.LeadNumber, null, null);
        try
        {
            var link = await uploads.GenerateLinkAsync(lead.Id, UploadDays, ct, null, "Sent from the website form", awaitReply: false);
            return new(lead.LeadNumber, link.Token, link.Link.ExpiresAtUtc);
        }
        catch (InvalidOperationException) { return new(lead.LeadNumber, null, null); } // Storage not configured: the lead still counts.
    }

    private async Task<WebLeadFormSettings?> Resolve(string key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key) || !KeyShape().IsMatch(key)) return null;
        var found = await forms.FindAsync(Kind, Prefix + key, ct); if (found is null) return null;
        var (owner, form) = found.Value; var s = Read(form);
        if (!s.Enabled || s.Key != key) return null;
        if (!tenant.IsResolved) tenant.SetTenant(owner);
        if (tenant.TenantId != owner.Id) return null;
        await companies.UseCompanyOfAsync(form, ct);
        return s;
    }

    private async Task<WebLeadFormSettings> Clean(WebLeadFormSettings s, CancellationToken ct)
    {
        static string? T(string? v, int max) {
            if (string.IsNullOrWhiteSpace(v)) return null;
            v = v.Trim(); return v.Length > max ? throw new InvalidOperationException("A website form text is too long.") : v;
        }
        if (s.AccentColor is { Length: > 0 } color && !HexColor().IsMatch(color)) throw new InvalidOperationException("Use a colour like #176b52.");
        if (s.StatusId is { } status && await sales.GetLeadStatusAsync(status, false, ct) is not { IsActive: true }) throw new InvalidOperationException("Select an active lead status.");
        if (s.DefaultMoveTypeId is { } type && await sales.GetMoveTypeAsync(type, false, ct) is not { IsActive: true }) throw new InvalidOperationException("Select an active move type.");
        if (s.AssignedEmployeeId is { } employee && await sales.GetEmployeeAsync(employee, ct) is not { IsActive: true }) throw new InvalidOperationException("Select an active employee.");
        return s with { Source = T(s.Source, 100) ?? "Website", Heading = T(s.Heading, 160), Intro = T(s.Intro, 1000),
            ThankYou = T(s.ThankYou, 1000), AccentColor = string.IsNullOrWhiteSpace(s.AccentColor) ? null : s.AccentColor.ToLowerInvariant() };
    }

    private static string? Blank(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
    private static string NewKey() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(16)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
