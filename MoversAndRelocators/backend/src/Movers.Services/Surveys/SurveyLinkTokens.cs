using System.Security.Cryptography;
using System.Text;
using Movers.Services.Tenancy;

namespace Movers.Services.Surveys;

/// <summary>Customer survey links: only the SHA-256 hash of the token is stored.</summary>
internal static class SurveyLinkTokens
{
    public static string NewToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    /// <summary>Resolves an unexpired link and scopes the request to the survey's tenant.</summary>
    public static async Task<PublicSurveyResolution?> ResolveAsync(ISurveyRepository repository, ITenantContext tenantContext, TimeProvider clock, string token, CancellationToken t, Movers.Services.Tenants.ICompanyScope? companies = null)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var r = await repository.ResolvePublicAsync(Hash(token), t);
        if (r is null || r.Survey.ConfirmationExpiresAtUtc < clock.GetUtcNow()) return null;
        if (!tenantContext.IsResolved) tenantContext.SetTenant(r.Tenant);
        if (tenantContext.TenantId != r.Tenant.Id) return null;
        if (companies is not null) await companies.UseCompanyOfAsync(r.Survey, t);
        return r;
    }
}
