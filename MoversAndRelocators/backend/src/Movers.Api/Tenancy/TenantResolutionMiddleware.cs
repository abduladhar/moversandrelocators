using Movers.Services.Tenants;

namespace Movers.Api.Tenancy;

public sealed class TenantResolutionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext httpContext, ITenantService tenantService)
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

        await next(httpContext);
    }

    private static bool IsTenantOptionalPath(PathString path) =>
        path.StartsWithSegments("/api/platform") ||
        path.StartsWithSegments("/api/public") ||
        path.StartsWithSegments("/api/auth") ||
        path.StartsWithSegments("/health") ||
        path.StartsWithSegments("/swagger");

}
