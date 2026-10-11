using System.Security.Claims;
using Movers.Services.Security;

namespace Movers.Api.Security;

public sealed class UserContext(IHttpContextAccessor accessor) : IUserContext
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;
    public Guid? UserId => Guid.TryParse(Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    public Guid? EmployeeId => Guid.TryParse(Principal?.FindFirstValue("employee_id"), out var id) ? id : null;
    public string Email => Principal?.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
    public string? IpAddress => accessor.HttpContext?.Connection.RemoteIpAddress?.ToString();
    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;
    public bool IsSystemAdmin => Principal?.IsInRole(RoleCodes.SystemAdmin) == true;
    public bool HasPermission(string permission) => Principal?.HasClaim("permission", permission) == true;
}
