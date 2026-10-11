using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Movers.Services.Security;

namespace Movers.Api.Security;

public sealed record IssuedToken(string AccessToken, DateTimeOffset ExpiresAtUtc);

public interface IJwtTokenService
{
    IssuedToken Issue(AuthenticationResult authentication);
}

public sealed class JwtTokenService(IConfiguration configuration) : IJwtTokenService
{
    public IssuedToken Issue(AuthenticationResult authentication)
    {
        var issuer = configuration["Jwt:Issuer"] ?? throw new InvalidOperationException("Jwt:Issuer is required.");
        var audience = configuration["Jwt:Audience"] ?? throw new InvalidOperationException("Jwt:Audience is required.");
        var signingKey = configuration["Jwt:SigningKey"] ?? throw new InvalidOperationException("Jwt:SigningKey is required.");
        var minutes = configuration.GetValue("Jwt:AccessTokenMinutes", 60);
        var expires = DateTimeOffset.UtcNow.AddMinutes(minutes);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, authentication.User.Id.ToString()),
            new(ClaimTypes.Name, authentication.User.FullName),
            new(ClaimTypes.Email, authentication.User.Email)
        };
        claims.AddRange(authentication.User.Roles.Select(x => new Claim(ClaimTypes.Role, x)));
        claims.AddRange(authentication.User.Permissions.Select(x => new Claim("permission", x)));
        if (authentication.User.TenantId.HasValue)
            claims.Add(new Claim("tenant_id", authentication.User.TenantId.Value.ToString()));
        if (authentication.User.EmployeeId.HasValue)
            claims.Add(new Claim("employee_id", authentication.User.EmployeeId.Value.ToString()));
        if (authentication.ActingTenantId.HasValue)
            claims.Add(new Claim("acting_tenant_id", authentication.ActingTenantId.Value.ToString()));
        if (authentication.ActingTenantName is not null)
            claims.Add(new Claim("acting_tenant_name", authentication.ActingTenantName));
        if (authentication.Company is not null)
        {
            claims.Add(new Claim("company_id", authentication.Company.Id.ToString()));
            claims.Add(new Claim("company_name", authentication.Company.Name));
        }
        if (authentication.User.CompanyId.HasValue)
            claims.Add(new Claim("company_scope", "company"));

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(issuer, audience, claims, expires: expires.UtcDateTime, signingCredentials: credentials);
        return new IssuedToken(new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}
