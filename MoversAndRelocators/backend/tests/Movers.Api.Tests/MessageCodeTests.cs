using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Movers.Api.Localization;

namespace Movers.Api.Tests;

/// <summary>Error responses carry a message code the client translates (English, Arabic, Turkish, Spanish, French, Portuguese).</summary>
public sealed class MessageCodeTests : IAsyncLifetime
{
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"movers-codes-{Guid.NewGuid():N}.db");
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public Task InitializeAsync()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder => { builder.UseEnvironment("Testing"); builder.UseSetting("Database:Provider", "Sqlite"); builder.UseSetting("ConnectionStrings:Sqlite", $"Data Source={_databasePath}"); });
        _client = _factory.CreateClient(); return Task.CompletedTask;
    }

    [Fact]
    public void Every_plain_exception_message_in_the_code_has_a_code()
    {
        // The full check (interpolated and joined messages too) is `node tools/i18n/extract-server-messages.mjs --check`;
        // this catches the common case in CI: a new message added without re-running the extractor.
        var src = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(ThisFile())!, "../../src"));
        Assert.True(Directory.Exists(src), "backend/src not found at " + src);
        var missing = Directory.EnumerateFiles(src, "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}") && !f.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}") && !f.Contains($"{Path.DirectorySeparatorChar}Localization{Path.DirectorySeparatorChar}"))
            .SelectMany(f => Regex.Matches(File.ReadAllText(f), @"throw new \w*Exception\(""((?:[^""\\]|\\.)*)""\s*[,)]").Select(m => Regex.Unescape(m.Groups[1].Value)))
            .Where(text => text.Trim().Length >= 8 && text.Contains(' '))
            .Where(text => ServerMessages.Describe(text).Code == ServerMessages.Unknown)
            .Distinct().ToList();
        Assert.True(missing.Count == 0, "Run node tools/i18n/extract-server-messages.mjs; no code for: " + string.Join(" | ", missing.Take(10)));
    }

    [Fact]
    public void Messages_with_values_return_the_values_as_params()
    {
        var (code, values) = ServerMessages.Describe("Box PKG-0042 is already stored or delivered. Refresh the list.");
        Assert.Equal("BOX_ALREADY_STORED_DELIVERED_REFRESH_LIST", code);
        Assert.Equal("PKG-0042", values!["trackingNumber"]);
        Assert.Equal(ServerMessages.Unknown, ServerMessages.Describe("Something nobody wrote.").Code);
        Assert.All(ServerMessages.Catalog, entry => Assert.Matches("^[A-Z0-9_]+$", entry.Key));
    }

    [Fact]
    public async Task Error_responses_carry_the_code_and_keep_the_english_text()
    {
        var wrong = await _client.PostAsJsonAsync("/api/auth/login", new { email = "admin@movers.local", password = "not-the-password" });
        var body = await wrong.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("INVALID_EMAIL_PASSWORD", body.GetProperty("code").GetString());
        Assert.Equal("Invalid email or password.", body.GetProperty("message").GetString());

        var login = await (await _client.PostAsJsonAsync("/api/auth/login", new { email = "admin@movers.local", password = "ChangeMe123!" })).Content.ReadFromJsonAsync<JsonElement>();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.GetProperty("accessToken").GetString());

        // Data-annotation validation: one code and the fields, not English sentences.
        var invalid = await _client.PostAsJsonAsync("/api/platform/tenants", new { name = "", slug = "" });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        var problem = await invalid.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("VALIDATION_FAILED", problem.GetProperty("code").GetString());
        Assert.Contains("Name", problem.GetProperty("params").GetProperty("fields").GetString());

        // A duplicate slug has its own code.
        (await _client.PostAsJsonAsync("/api/platform/tenants", new { name = "Codes", slug = "codes-test" })).EnsureSuccessStatusCode();
        var duplicate = await (await _client.PostAsJsonAsync("/api/platform/tenants", new { name = "Codes 2", slug = "codes-test" })).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("TENANT_SLUG_ALREADY_USE", duplicate.GetProperty("code").GetString());
    }

    private static string ThisFile([System.Runtime.CompilerServices.CallerFilePath] string path = "") => path;

    public async Task DisposeAsync() { _client.Dispose(); await _factory.DisposeAsync(); SqliteConnection.ClearAllPools(); if (File.Exists(_databasePath)) File.Delete(_databasePath); }
}
