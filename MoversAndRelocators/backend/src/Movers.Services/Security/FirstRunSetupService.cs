using System.Security.Cryptography;
using System.Text;
using Movers.Domain.Security;

namespace Movers.Services.Security;

/// <param name="Enabled">Administrator creation is possible: a setup key is configured, or (Development/Testing only) no administrator exists yet.</param>
/// <param name="Key">Setup key (Setup:Key, from appsettings or an environment variable). When set, anyone who knows it can create or reset a system administrator from the sign-in page.</param>
public sealed record FirstRunSetupOptions(bool Enabled, string? Key);

/// <param name="NeedsSetup">No active system administrator exists.</param>
/// <param name="RequiresKey">A setup key is configured; the sign-in page offers "Create system administrator" at any time.</param>
public sealed record FirstRunSetupStatus(bool NeedsSetup, bool Enabled, bool RequiresKey);
public sealed record CreateSystemAdminCommand(string FullName, string Email, string Password, string? SetupKey);
/// <param name="Reset">True when the email belonged to an existing system administrator whose password was reset.</param>
public sealed record CreateSystemAdminResult(bool Reset);

/// <summary>
/// Creates a system administrator from the sign-in page. With a setup key configured this works at any time and
/// requires the key; if the email already belongs to a system administrator, that account's password is reset
/// (recovery). Without a key it only works in Development/Testing while no administrator exists (first run).
/// </summary>
public sealed class FirstRunSetupService(ISecurityRepository repository, IPasswordHasher passwordHasher, FirstRunSetupOptions options)
{
    // Serializes creation within this process so two simultaneous first-run requests cannot both succeed.
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public async Task<FirstRunSetupStatus> StatusAsync(CancellationToken cancellationToken)
    {
        var needsSetup = !await repository.AnyActiveSystemAdminAsync(cancellationToken);
        return new(needsSetup, options.Key is not null || (options.Enabled && needsSetup), options.Key is not null);
    }

    public async Task<CreateSystemAdminResult> CreateSystemAdminAsync(CreateSystemAdminCommand command, CancellationToken cancellationToken)
    {
        if (options.Key is not null)
        {
            if (!KeyMatches(command.SetupKey, options.Key))
            {
                await Task.Delay(TimeSpan.FromSeconds(1), cancellationToken); // slows down guessing
                throw new UnauthorizedAccessException("The setup key is not correct.");
            }
        }
        else if (!options.Enabled) throw new UnauthorizedAccessException("Creating an administrator here is disabled. Set Setup:Key in the server settings to enable it.");

        await Gate.WaitAsync(cancellationToken);
        try
        {
            if (options.Key is null && await repository.AnyActiveSystemAdminAsync(cancellationToken)) throw new SetupCompletedException();
            var role = await repository.GetGlobalRoleAsync(RoleCodes.SystemAdmin, cancellationToken)
                ?? throw new InvalidOperationException("The system administrator role is missing. Restart the API so it can seed roles.");
            var existing = await repository.FindUserByEmailAsync(User.NormalizeEmail(command.Email), cancellationToken);
            if (existing is not null)
            {
                if (existing.TenantId.HasValue || !(await repository.GetUserRolesAsync(existing.Id, cancellationToken)).Any(r => r.Code == RoleCodes.SystemAdmin))
                    throw new InvalidOperationException("This email belongs to a tenant user. Use a different email for the system administrator.");
                if (options.Key is null) throw new InvalidOperationException("A user with this email already exists.");
                existing.ChangePassword(passwordHasher.Hash(command.Password));
                existing.SetActive(true);
                await repository.SaveChangesAsync(cancellationToken);
                return new(true);
            }
            var user = new User(null, command.FullName, command.Email, passwordHasher.Hash(command.Password));
            repository.AddUser(user);
            repository.AddUserRole(new UserRole(user.Id, role.Id));
            await repository.SaveChangesAsync(cancellationToken);
            return new(false);
        }
        finally { Gate.Release(); }
    }

    private static bool KeyMatches(string? given, string expected) =>
        given is not null && CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(given.Trim()), Encoding.UTF8.GetBytes(expected));
}

public sealed class SetupCompletedException() : InvalidOperationException("Setup is already complete. Sign in with an administrator account.");
