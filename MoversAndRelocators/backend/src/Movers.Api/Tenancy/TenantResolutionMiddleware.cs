using System.Security.Claims;
using Movers.Services.Security;
using Movers.Services.Tenants;

namespace Movers.Api.Tenancy;

public sealed class TenantResolutionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext httpContext, ITenantService tenantService, CompanyService companyService)
    {
        if (IsTenantOptionalPath(httpContext.Request.Path))
        {
            await next(httpContext);
            return;
        }

        if (httpContext.User.Identity?.IsAuthenticated != true)
        {
            await next(httpContext);
            return;
        }

        var tenantId = httpContext.User.FindFirst("acting_tenant_id")?.Value
            ?? httpContext.User.FindFirst("tenant_id")?.Value;
        var resolved = await tenantService.ResolveCurrentAsync(
            tenantId,
            null,
            httpContext.RequestAborted);
        if (!resolved)
        {
            httpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
            await httpContext.Response.WriteAsJsonAsync(new
            {
                error = "tenant_required",
                message = "Select an active tenant before using tenant-scoped features."
            });
            return;
        }

        // Company users always work in their own company (read from the user, so a reassignment applies at once);
        // tenant users and system administrators work in the company they selected, else the default one.
        var user = httpContext.User;
        var companyResolved = await companyService.ResolveCurrentAsync(
            Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ? userId : null,
            user.IsInRole(RoleCodes.SystemAdmin),
            user.FindFirst("company_id")?.Value,
            httpContext.RequestAborted);
        if (!companyResolved)
        {
            httpContext.Response.StatusCode = StatusCodes.Status403Forbidden;
            await httpContext.Response.WriteAsJsonAsync(new
            {
                error = "company_unavailable",
                message = "Your company is not active. Ask your administrator to activate it or move you to another company."
            });
            return;
        }

        await next(httpContext);
    }

    private static bool IsTenantOptionalPath(PathString path) =>
        path.StartsWithSegments("/api/platform") ||
        path.StartsWithSegments("/api/public") ||
        path.StartsWithSegments("/api/auth") ||
        path.StartsWithSegments("/health") ||
        path.StartsWithSegments("/swagger");

}
