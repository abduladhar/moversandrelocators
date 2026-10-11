using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Movers.Api.Contracts.Tenants;

namespace Movers.Api.Tests;

public sealed class AwsConfigurationApiTests : IAsyncLifetime
{
    private const string AccessKey = "AKIAEXAMPLE123456789";
    private const string SecretKey = "example-secret-key-that-must-never-be-returned";
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"movers-aws-{Guid.NewGuid():N}.db");
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public Task InitializeAsync()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Database:Provider", "Sqlite");
            builder.UseSetting("ConnectionStrings:Sqlite", $"Data Source={_databasePath}");
        });
        _client = _factory.CreateClient();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task Tenant_can_save_and_rotate_masked_aws_credentials_without_exposure()
    {
        await LoginAndSelectTenantAsync();

        var initial = await _client.GetAsync("/api/settings/aws");
        Assert.Equal(HttpStatusCode.NoContent, initial.StatusCode);

        var savedResponse = await _client.PutAsJsonAsync("/api/settings/aws", new
            { region = "ap-south-1", bucketName = "movers-test-uploads", accessKey = AccessKey, secretKey = SecretKey });
        savedResponse.EnsureSuccessStatusCode();
        var responseJson = await savedResponse.Content.ReadAsStringAsync();
        Assert.DoesNotContain(AccessKey, responseJson);
        Assert.DoesNotContain(SecretKey, responseJson);
        var saved = (await savedResponse.Content.ReadFromJsonAsync<AwsResponse>())!;
        Assert.Equal("••••6789", saved.MaskedAccessKey);
        Assert.True(saved.HasAccessKey);
        Assert.True(saved.HasSecretKey);

        var updatedResponse = await _client.PutAsJsonAsync("/api/settings/aws", new
            { region = "eu-west-1", bucketName = "movers-test-uploads", accessKey = (string?)null, secretKey = (string?)null });
        updatedResponse.EnsureSuccessStatusCode();
        var updated = (await updatedResponse.Content.ReadFromJsonAsync<AwsResponse>())!;
        Assert.Equal("eu-west-1", updated.Region);
        Assert.Equal("••••6789", updated.MaskedAccessKey);

        var auditResponse = await _client.GetAsync("/api/security/audit");
        auditResponse.EnsureSuccessStatusCode();
        var auditJson = await auditResponse.Content.ReadAsStringAsync();
        Assert.DoesNotContain(AccessKey, auditJson);
        Assert.DoesNotContain(SecretKey, auditJson);
        Assert.DoesNotContain("EncryptedAccessKey", auditJson);
        Assert.DoesNotContain("EncryptedSecretKey", auditJson);
        Assert.Contains("TenantAwsConfiguration", auditJson);
    }

    [Fact]
    public async Task Tenant_can_save_models_and_rotate_masked_openai_key_without_exposure()
    {
        const string apiKey = "sk-proj-example-openai-key-1234567890";
        await LoginAndSelectTenantAsync();

        var initial = await _client.GetAsync("/api/settings/openai");
        Assert.Equal(HttpStatusCode.NoContent, initial.StatusCode);

        var savedResponse = await _client.PutAsJsonAsync("/api/settings/openai", new
        {
            apiKey,
            extractionModel = "gpt-5.6-terra",
            transcriptionModel = "gpt-transcribe"
        });
        savedResponse.EnsureSuccessStatusCode();
        var responseJson = await savedResponse.Content.ReadAsStringAsync();
        Assert.DoesNotContain(apiKey, responseJson);
        var saved = (await savedResponse.Content.ReadFromJsonAsync<OpenAiResponse>())!;
        Assert.Equal("••••7890", saved.MaskedApiKey);
        Assert.Equal("gpt-5.6-terra", saved.ExtractionModel);
        Assert.Equal("gpt-transcribe", saved.TranscriptionModel);

        var updatedResponse = await _client.PutAsJsonAsync("/api/settings/openai", new
        {
            apiKey = (string?)null,
            extractionModel = "gpt-5.6-luna",
            transcriptionModel = "gpt-4o-mini-transcribe"
        });
        updatedResponse.EnsureSuccessStatusCode();
        var updated = (await updatedResponse.Content.ReadFromJsonAsync<OpenAiResponse>())!;
        Assert.Equal("••••7890", updated.MaskedApiKey);
        Assert.Equal("gpt-5.6-luna", updated.ExtractionModel);

        var auditResponse = await _client.GetAsync("/api/security/audit");
        auditResponse.EnsureSuccessStatusCode();
        var auditJson = await auditResponse.Content.ReadAsStringAsync();
        Assert.DoesNotContain(apiKey, auditJson);
        Assert.DoesNotContain("EncryptedApiKey", auditJson);
        Assert.Contains("TenantOpenAiConfiguration", auditJson);
    }

    private async Task LoginAndSelectTenantAsync()
    {
        var login = await _client.PostAsJsonAsync("/api/auth/login", new
            { email = "admin@movers.local", password = "ChangeMe123!" });
        login.EnsureSuccessStatusCode();
        SetToken(await login.Content.ReadFromJsonAsync<LoginResponse>());
        var tenantResponse = await _client.PostAsJsonAsync("/api/platform/tenants",
            new SaveTenantRequest("AWS Test", "aws-test", null, null, null));
        tenantResponse.EnsureSuccessStatusCode();
        var tenant = (await tenantResponse.Content.ReadFromJsonAsync<TenantResponse>())!;
        var selected = await _client.PostAsJsonAsync("/api/auth/select-tenant", new { tenantId = tenant.Id });
        selected.EnsureSuccessStatusCode();
        SetToken(await selected.Content.ReadFromJsonAsync<LoginResponse>());
    }

    private void SetToken(LoginResponse? response)
    {
        Assert.NotNull(response);
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", response.AccessToken);
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
        SqliteConnection.ClearAllPools();
        if (File.Exists(_databasePath)) File.Delete(_databasePath);
    }

    private sealed record LoginResponse(string AccessToken);
    private sealed record AwsResponse(string Region, string BucketName, string MaskedAccessKey, bool HasAccessKey, bool HasSecretKey);
    private sealed record OpenAiResponse(string MaskedApiKey, string ExtractionModel, string TranscriptionModel);
}
