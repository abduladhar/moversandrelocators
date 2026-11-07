using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Movers.Api.Assistant;
using Movers.Api.Contracts.Tenants;
using Movers.Services.Assistant;

namespace Movers.Api.Tests;

/// <summary>
/// Ask Crateway: the query tool answers from the company's data, respects the user's permissions, and conversations
/// are kept per user. The AI is a scripted fake that runs the query written in the question, so the tool, the
/// datasets and the permission checks are the real ones.
/// </summary>
public sealed class AssistantApiTests : IAsyncLifetime
{
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"movers-assistant-{Guid.NewGuid():N}.db");
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    public Task InitializeAsync()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
        {
            b.UseEnvironment("Testing"); b.UseSetting("Database:Provider", "Sqlite"); b.UseSetting("ConnectionStrings:Sqlite", $"Data Source={_databasePath}");
            b.ConfigureServices(s => { s.RemoveAll<IAssistantModelGateway>(); s.AddScoped<IAssistantModelGateway, ScriptedGateway>(); });
        });
        _client = _factory.CreateClient(); return Task.CompletedTask;
    }

    [Fact]
    public async Task Assistant_answers_from_the_companys_data_and_keeps_the_conversation()
    {
        await SignInAsync();
        // No AI configured yet: the question is refused with a clear message.
        var unconfigured = await _client.PostAsJsonAsync("/api/assistant/ask", new { question = "How many leads?", timezoneOffsetMinutes = 0 });
        Assert.Equal(HttpStatusCode.BadRequest, unconfigured.StatusCode);
        (await _client.PutAsJsonAsync("/api/settings/openai", new { apiKey = "sk-test-0123456789abcdefghij", extractionModel = "gpt-5", transcriptionModel = "whisper-1" })).EnsureSuccessStatusCode();

        var moveType = (await _client.GetFromJsonAsync<List<JsonElement>>("/api/sales/statuses/move-types"))![0].GetProperty("id").GetGuid();
        var newStatus = (await _client.GetFromJsonAsync<List<JsonElement>>("/api/sales/statuses/leads"))!.Single(x => x.GetProperty("code").GetString() == "NEW").GetProperty("id").GetGuid();
        foreach (var (name, source) in new[] { ("Ali", "Website"), ("Beth", "website"), ("Chen", "Referral") })
            await Post<JsonElement>("/api/sales/leads", new { leadNumber = "", customerName = name, phone = "+971 50 000 0000", email = (string?)null, source, moveTypeId = moveType,
                origin = "Dubai", destination = "Abu Dhabi", expectedMoveDate = (string?)null, statusId = newStatus, assignedEmployeeId = (Guid?)null, notes = (string?)null });

        var status = await _client.GetFromJsonAsync<JsonElement>("/api/assistant/status");
        Assert.Equal("openai", Assert.Single(status.GetProperty("providers").EnumerateArray()).GetProperty("key").GetString());
        Assert.Contains("invoices", status.GetProperty("datasets").EnumerateArray().Select(x => x.GetString()));

        var first = await Ask(null, Query(new { dataset = "leads", group_by = new[] { "source" }, sort = new[] { new { by = "count", desc = true } } }));
        var result = Result(first);
        Assert.Equal("groups", result.GetProperty("mode").GetString());
        Assert.Equal(3, result.GetProperty("matched").GetInt32());
        var top = result.GetProperty("rows")[0];
        Assert.Equal(("Website", 2), (top[0].GetString(), top[1].GetInt32())); // text groups ignore case
        var step = Assert.Single(first.GetProperty("answer").GetProperty("steps").EnumerateArray());
        Assert.Equal("leads", step.GetProperty("dataset").GetString());
        Assert.Equal("OpenAI", first.GetProperty("answer").GetProperty("provider").GetString());

        // A follow-up in the same conversation: the earlier question and answer go to the AI as history.
        var conversationId = first.GetProperty("conversationId").GetGuid();
        var second = await Ask(conversationId, Query(new { dataset = "leads", filters = new[] { new { field = "created", op = "eq", value = DateTime.UtcNow.ToString("yyyy-MM-dd") } }, fields = new[] { "number", "customer" } }));
        Assert.Equal(3, Result(second).GetProperty("matched").GetInt32());
        Assert.Contains("history=2", second.GetProperty("answer").GetProperty("text").GetString());
        Assert.Contains("open:sales/", Result(second).GetProperty("note").GetString());

        // A wrong field comes back to the AI as an error it can correct, listing the real fields.
        var wrong = await Ask(conversationId, Query(new { dataset = "leads", group_by = new[] { "colour" } }));
        Assert.Contains("has no field", Result(wrong).GetProperty("error").GetString());

        var conversations = await _client.GetFromJsonAsync<List<JsonElement>>("/api/assistant/conversations");
        Assert.Equal(conversationId, Assert.Single(conversations!).GetProperty("id").GetGuid());
        var saved = await _client.GetFromJsonAsync<JsonElement>($"/api/assistant/conversations/{conversationId}");
        Assert.Equal(6, saved.GetProperty("messages").GetArrayLength());

        // Usage is recorded with the other AI runs.
        var usage = await _client.GetFromJsonAsync<JsonElement>("/api/settings/openai/usage");
        Assert.Equal(3, usage.GetProperty("allTime").GetProperty("runs").GetInt32());

        // Another user with the assistant but without sales: cannot read leads, cannot see the admin's conversation.
        var permissions = await _client.GetFromJsonAsync<List<JsonElement>>("/api/security/permissions");
        Guid Permission(string code) => permissions!.Single(p => p.GetProperty("code").GetString() == code).GetProperty("id").GetGuid();
        var role = await Post<JsonElement>("/api/security/roles", new { name = "Ops manager", permissionIds = new[] { Permission("ai.assistant"), Permission("operations.manage") } });
        var designation = await Post<JsonElement>("/api/designations", new { code = "MGR", name = "Manager", level = 2, description = "Office" });
        var employee = await Post<JsonElement>("/api/employees", new { employeeNumber = "E-9", firstName = "Omar", lastName = "Haddad", workEmail = "omar@example.test", phone = "1",
            joiningDate = "2026-01-01", designationId = designation.GetProperty("id").GetGuid(), reportsToEmployeeId = (Guid?)null });
        (await _client.PostAsJsonAsync("/api/security/users", new { fullName = "Omar Haddad", email = "omar@example.test", password = "SecurePass123!", roleId = role.GetProperty("id").GetGuid(), employeeId = employee.GetProperty("id").GetGuid() })).EnsureSuccessStatusCode();
        await SignInAs("omar@example.test", "SecurePass123!");
        var limited = await _client.GetFromJsonAsync<JsonElement>("/api/assistant/status");
        Assert.DoesNotContain("leads", limited.GetProperty("datasets").EnumerateArray().Select(x => x.GetString()));
        Assert.Contains("pickups", limited.GetProperty("datasets").EnumerateArray().Select(x => x.GetString()));
        var denied = await Ask(null, Query(new { dataset = "leads" }));
        Assert.Contains("no permission", Result(denied).GetProperty("error").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/api/assistant/conversations/{conversationId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.PostAsJsonAsync("/api/assistant/ask", new { conversationId, question = "Hi", timezoneOffsetMinutes = 0 })).StatusCode);
    }

    [Fact]
    public async Task Assistant_reads_survey_expenses_for_averages()
    {
        await SignInAsync();
        (await _client.PutAsJsonAsync("/api/settings/openai", new { apiKey = "sk-test-0123456789abcdefghij", extractionModel = "gpt-5", transcriptionModel = "whisper-1" })).EnsureSuccessStatusCode();
        var designation = await Post<JsonElement>("/api/designations", new { code = "SRV", name = "Surveyor", level = 3, description = "Field" });
        var employee = await Post<JsonElement>("/api/employees", new { employeeNumber = "E-1", firstName = "Sara", lastName = "Ali", workEmail = "sara@example.test", phone = "1",
            joiningDate = "2026-01-01", designationId = designation.GetProperty("id").GetGuid(), reportsToEmployeeId = (Guid?)null });
        var surveys = new List<Guid>();
        foreach (var name in new[] { "Ali", "Beth", "Chen" })
            surveys.Add((await Post<JsonElement>("/api/surveys", new { surveyNumber = "AUTO", salesLeadId = (Guid?)null, customerName = name, phone = "1", email = (string?)null,
                assignedEmployeeId = employee.GetProperty("id").GetGuid(), scheduledAtUtc = DateTimeOffset.UtcNow, address = "Marina", notes = (string?)null })).GetProperty("id").GetGuid());
        // Ali: 40 + 20, Beth: 30, Chen: none.
        foreach (var (survey, category, amount) in new[] { (surveys[0], "FUEL", 40m), (surveys[0], "TOLL", 20m), (surveys[1], "TAXI", 30m) })
            await Post<JsonElement>($"/api/surveys/{survey}/expenses", new { category, amount, currency = "USD", incurredAtUtc = DateTimeOffset.UtcNow, paidByEmployeeId = (Guid?)null, notes = (string?)null });

        var perExpense = Result(await Ask(null, Query(new { dataset = "survey_expenses", metrics = new[] { new { fn = "avg", field = "amount" }, new { fn = "count_distinct", field = "survey_number" } } })));
        Assert.Equal(30m, perExpense.GetProperty("rows")[0][0].GetDecimal());
        Assert.Equal(2, perExpense.GetProperty("rows")[0][1].GetInt32());

        var perSurvey = Result(await Ask(null, Query(new { dataset = "surveys", metrics = new[] { new { fn = "avg", field = "expenses" } } })));
        Assert.Equal(30m, perSurvey.GetProperty("rows")[0][0].GetDecimal()); // (60 + 30 + 0) / 3
        var withExpenses = Result(await Ask(null, Query(new { dataset = "surveys", filters = new[] { new { field = "expense_count", op = "gt", value = 0 } }, metrics = new[] { new { fn = "avg", field = "expenses" } } })));
        Assert.Equal(45m, withExpenses.GetProperty("rows")[0][0].GetDecimal());
    }

    [Fact]
    public void Query_engine_filters_groups_and_sums()
    {
        var dataset = AssistantCatalog.Find("quotations")!;
        IReadOnlyDictionary<string, object?> Q(string number, string status, decimal total, DateTime created) =>
            new Dictionary<string, object?> { ["number"] = number, ["status"] = status, ["currency"] = "AED", ["grand_total"] = total, ["created"] = created };
        var rows = new[] { Q("Q-1", "ACCEPTED", 1000, new(2026, 9, 30, 23, 0, 0)), Q("Q-2", "ACCEPTED", 500, new(2026, 10, 1, 9, 0, 0)), Q("Q-3", "SENT", 250, new(2026, 10, 31, 22, 0, 0)), Q("Q-4", "REJECTED", 50, new(2026, 11, 1, 0, 0, 0)) };
        AssistantQueryEngine.Result Run(object spec) => AssistantQueryEngine.Run(dataset, rows, AssistantQueryEngine.Parse(JsonSerializer.SerializeToElement(spec)));

        // October, by whole days (the last day included), summed by status.
        var october = Run(new { filters = new[] { new { field = "created", op = "between", value = (object)new[] { "2026-10-01", "2026-10-31" } } }, group_by = new[] { "status" }, metrics = new[] { new { fn = "sum", field = "grand_total" }, new { fn = "count", field = (string?)null } }, dataset = "quotations" });
        Assert.Equal(2, october.Matched);
        Assert.Equal(["status", "sum_grand_total", "count"], october.Columns);
        Assert.Equal(new object?[] { "ACCEPTED", 500m, 1 }, october.Rows[0]);

        var monthly = Run(new { dataset = "quotations", group_by = new[] { "created:month" } });
        Assert.Equal(["2026-09", "2026-10", "2026-11"], monthly.Rows.Select(r => (string)r[0]!));
        var accepted = Run(new { dataset = "quotations", filters = new[] { new { field = "status", op = "in", value = new[] { "accepted" } } }, fields = new[] { "number" }, sort = new[] { new { by = "grand_total", desc = true } } });
        Assert.Equal(["Q-1", "Q-2"], accepted.Rows.Select(r => (string)r[0]!));
        Assert.Throws<AssistantQueryEngine.QueryError>(() => Run(new { dataset = "quotations", metrics = new[] { new { fn = "sum", field = "status" } } }));
    }

    [Fact]
    public async Task Claude_gateway_returns_tool_results_and_echoes_the_turn()
    {
        var handler = new Sequence(
            """{"id":"m1","type":"message","role":"assistant","model":"claude-opus-5-5","content":[{"type":"thinking","thinking":"","signature":"sig-1"},{"type":"tool_use","id":"tu_1","name":"query_records","input":{"dataset":"leads"}}],"stop_reason":"tool_use","stop_sequence":null,"usage":{"input_tokens":100,"output_tokens":20,"cache_read_input_tokens":0,"cache_creation_input_tokens":50}}""",
            """{"id":"m2","type":"message","role":"assistant","model":"claude-opus-5-5","content":[{"type":"text","text":"You have **3** leads."}],"stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":30,"output_tokens":10,"cache_read_input_tokens":150,"cache_creation_input_tokens":0}}""");
        string? seen = null;
        var result = await new ClaudeAssistantGateway(new HttpClient(handler)).Run("sk-ant-test", "claude-opus-5-5", "medium", "SYSTEM", [new("user", "Earlier"), new("assistant", "Before")], "How many leads?",
            AssistantService.Tools, (name, input, _) => { seen = name + ":" + input.GetProperty("dataset").GetString(); return Task.FromResult("{\"matched\":3}"); }, default);

        Assert.Equal("query_records:leads", seen);
        Assert.Equal("You have **3** leads.", result.Text);
        Assert.Equal((330, 150, 30), (result.InputTokens, result.CachedTokens, result.OutputTokens));
        using var second = JsonDocument.Parse(handler.Bodies[1]);
        var messages = second.RootElement.GetProperty("messages");
        Assert.Equal(5, messages.GetArrayLength());
        var echoed = messages[3].GetProperty("content");
        Assert.Equal("sig-1", echoed[0].GetProperty("signature").GetString());
        Assert.Equal("tu_1", echoed[1].GetProperty("id").GetString());
        Assert.Equal("tu_1", messages[4].GetProperty("content")[0].GetProperty("tool_use_id").GetString());
        Assert.Equal("medium", second.RootElement.GetProperty("output_config").GetProperty("effort").GetString());
        Assert.Equal(2, second.RootElement.GetProperty("tools").GetArrayLength());
    }

    [Fact]
    public async Task OpenAi_gateway_sends_function_outputs_back_with_the_reasoning()
    {
        var handler = new Sequence(
            """{"status":"completed","output":[{"type":"reasoning","id":"rs_1","encrypted_content":"enc"},{"type":"function_call","id":"fc_1","call_id":"call_1","name":"query_records","arguments":"{\"dataset\":\"pickups\"}"}],"usage":{"input_tokens":200,"output_tokens":40,"input_tokens_details":{"cached_tokens":0}}}""",
            """{"status":"completed","output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Two pickups today."}]}],"usage":{"input_tokens":260,"output_tokens":12,"input_tokens_details":{"cached_tokens":200}}}""");
        var result = await new OpenAiAssistantGateway(new HttpClient(handler)).Run("sk-test", "gpt-5", null, "SYSTEM", [], "Pickups today?",
            AssistantService.Tools, (_, input, _) => Task.FromResult("{\"matched\":2,\"dataset\":\"" + input.GetProperty("dataset").GetString() + "\"}"), default);

        Assert.Equal("Two pickups today.", result.Text);
        Assert.Equal((460, 200, 52), (result.InputTokens, result.CachedTokens, result.OutputTokens));
        using var second = JsonDocument.Parse(handler.Bodies[1]);
        var input = second.RootElement.GetProperty("input");
        Assert.False(second.RootElement.GetProperty("store").GetBoolean());
        Assert.Equal("reasoning.encrypted_content", second.RootElement.GetProperty("include")[0].GetString());
        Assert.Equal(["message", "reasoning", "function_call", "function_call_output"], input.EnumerateArray().Select(i => i.TryGetProperty("type", out var t) ? t.GetString() : "message"));
        Assert.Contains("pickups", input[3].GetProperty("output").GetString());
    }

    /// <summary>The fake AI: a question "QUERY {json}" runs that query once and answers with the tool's result.</summary>
    internal sealed class ScriptedGateway : IAssistantModelGateway
    {
        public string Provider => "openai";
        public async Task<AssistantModelResult> Run(string apiKey, string model, string? effort, string system, IReadOnlyList<AssistantHistoryTurn> history, string question,
            IReadOnlyList<AssistantTool> tools, AssistantToolRunner run, CancellationToken ct)
        {
            if (!question.StartsWith("QUERY ")) return new($"Hello history={history.Count}", 10, 0, 5);
            var output = await run("query_records", JsonDocument.Parse(question[6..]).RootElement, ct);
            return new($"RESULT {output} history={history.Count}", 100, 20, 30);
        }
    }

    private sealed class Sequence(params string[] replies) : HttpMessageHandler
    {
        private int _next;
        public List<string> Bodies { get; } = [];
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Bodies.Add(await request.Content!.ReadAsStringAsync(ct));
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(replies[_next++], System.Text.Encoding.UTF8, "application/json") };
        }
    }

    private static string Query(object spec) => "QUERY " + JsonSerializer.Serialize(spec);
    /// <summary>The tool result the fake AI echoed into its answer.</summary>
    private static JsonElement Result(JsonElement answer)
    {
        var text = answer.GetProperty("answer").GetProperty("text").GetString()!;
        return JsonDocument.Parse(text["RESULT ".Length..text.LastIndexOf(" history=", StringComparison.Ordinal)]).RootElement;
    }
    private async Task<JsonElement> Ask(Guid? conversationId, string question) => await Post<JsonElement>("/api/assistant/ask", new { conversationId, question, timezoneOffsetMinutes = 0 });
    private async Task<T> Post<T>(string url, object body) { var r = await _client.PostAsJsonAsync(url, body); if (!r.IsSuccessStatusCode) throw new InvalidOperationException($"{url} {r.StatusCode} {await r.Content.ReadAsStringAsync()}"); return (await r.Content.ReadFromJsonAsync<T>(Web))!; }
    private async Task SignInAsync()
    {
        await SignInAs("admin@movers.local", "ChangeMe123!");
        var tenant = await Post<TenantResponse>("/api/platform/tenants", new SaveTenantRequest("Assistant Test", "assistant-test", null, null, null));
        var selected = await _client.PostAsJsonAsync("/api/auth/select-tenant", new { tenantId = tenant.Id }); selected.EnsureSuccessStatusCode();
        Token((await selected.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("accessToken").GetString()!);
    }
    private async Task SignInAs(string email, string password)
    {
        _client.DefaultRequestHeaders.Authorization = null;
        var login = await _client.PostAsJsonAsync("/api/auth/login", new { email, password }); login.EnsureSuccessStatusCode();
        Token((await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("accessToken").GetString()!);
    }
    private void Token(string token) => _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    public async Task DisposeAsync() { _client.Dispose(); await _factory.DisposeAsync(); SqliteConnection.ClearAllPools(); if (File.Exists(_databasePath)) File.Delete(_databasePath); }
}
