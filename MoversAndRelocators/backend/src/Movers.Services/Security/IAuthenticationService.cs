namespace Movers.Services.Security;

public interface IAuthenticationService
{
    Task<AuthenticationResult?> AuthenticateAsync(string email, string password, CancellationToken cancellationToken, Guid? companyId = null);
    Task<AuthenticationResult?> SelectTenantAsync(Guid tenantId, CancellationToken cancellationToken);
    /// <summary>Switches the session to another company of the same tenant (tenant users and system administrators only).</summary>
    Task<AuthenticationResult?> SelectCompanyAsync(Guid tenantId, Guid companyId, CancellationToken cancellationToken);
}
