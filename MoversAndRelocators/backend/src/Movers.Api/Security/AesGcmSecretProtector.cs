using System.Security.Cryptography;
using System.Text;
using Movers.Services.Aws;

namespace Movers.Api.Security;

public sealed class AesGcmSecretProtector : ISecretProtector
{
    private readonly byte[] _key;

    public AesGcmSecretProtector(IConfiguration configuration)
    {
        var configured = configuration["CredentialEncryption:Key"]
            ?? throw new InvalidOperationException("CredentialEncryption:Key must be configured.");
        try { _key = Convert.FromBase64String(configured); }
        catch (FormatException exception) { throw new InvalidOperationException("CredentialEncryption:Key must be base64.", exception); }
        if (_key.Length is not (16 or 24 or 32))
            throw new InvalidOperationException("CredentialEncryption:Key must decode to 16, 24, or 32 bytes.");
    }

    public string Protect(string plaintext, string purpose)
    {
        var nonce = RandomNumberGenerator.GetBytes(12);
        var source = Encoding.UTF8.GetBytes(plaintext);
        var cipher = new byte[source.Length];
        var tag = new byte[16];
        using var aes = new AesGcm(_key, tag.Length);
        aes.Encrypt(nonce, source, cipher, tag, Encoding.UTF8.GetBytes(purpose));
        var payload = new byte[nonce.Length + tag.Length + cipher.Length];
        Buffer.BlockCopy(nonce, 0, payload, 0, nonce.Length);
        Buffer.BlockCopy(tag, 0, payload, nonce.Length, tag.Length);
        Buffer.BlockCopy(cipher, 0, payload, nonce.Length + tag.Length, cipher.Length);
        return Convert.ToBase64String(payload);
    }

    public string Unprotect(string protectedValue, string purpose)
    {
        var payload = Convert.FromBase64String(protectedValue);
        if (payload.Length < 29) throw new CryptographicException("The protected credential is invalid.");
        var nonce = payload[..12];
        var tag = payload[12..28];
        var cipher = payload[28..];
        var plaintext = new byte[cipher.Length];
        using var aes = new AesGcm(_key, tag.Length);
        aes.Decrypt(nonce, cipher, tag, plaintext, Encoding.UTF8.GetBytes(purpose));
        return Encoding.UTF8.GetString(plaintext);
    }
}
