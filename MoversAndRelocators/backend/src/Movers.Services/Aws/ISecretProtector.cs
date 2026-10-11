namespace Movers.Services.Aws;

public interface ISecretProtector
{
    string Protect(string plaintext, string purpose);
    string Unprotect(string protectedValue, string purpose);
}
