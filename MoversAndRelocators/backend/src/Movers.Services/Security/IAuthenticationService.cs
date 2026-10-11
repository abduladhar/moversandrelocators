namespace Movers.Services.Security;

public interface IAuthenticationService
{
    Task<AuthenticationResult?> AuthenticateAsync(string email, string password, CancellationToken cancellationToken);
    Task<AuthenticationResult?> SelectTenantAsync(Guid tenantId, CancellationToken cancellationToken);
}
