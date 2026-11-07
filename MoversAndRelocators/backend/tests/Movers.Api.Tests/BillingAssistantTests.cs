using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Movers.Services.Assistant;

namespace Movers.Api.Tests;

/// <summary>The assistant's money datasets, read over real billing data (same database, the AI replaced by the scripted fake).</summary>
public sealed partial class BillingApiTests
{
    [Fact]
    public async Task Assistant_reads_every_money_dataset()
    {
        var f = await Setup();
        var invoiced = await Charge("PICKUP", f.Pickup, "INCOME", f.Customer, 100m);
        await Issue(invoiced);
        await Charge("JOB", f.Job, "EXPENSE", f.Vendor1, 40m, "5000");
        await Post($"/api/pickups/{f.Pickup}/expenses", new { category = "TOLL", amount = 15m, currency = "INR", incurredAtUtc = DateTimeOffset.UtcNow.AddMinutes(-5), notes = "Highway" });
        await Put("/api/settings/openai", new { apiKey = "sk-test-0123456789abcdefghij", extractionModel = "gpt-5", transcriptionModel = "whisper-1" });

        using var assistant = _factory.WithWebHostBuilder(b => b.ConfigureServices(s => { s.RemoveAll<IAssistantModelGateway>(); s.AddScoped<IAssistantModelGateway, AssistantApiTests.ScriptedGateway>(); }));
        using var client = assistant.CreateClient();
        client.DefaultRequestHeaders.Authorization = _client.DefaultRequestHeaders.Authorization;
        async Task<JsonElement> Query(object spec)
        {
            var r = await client.PostAsJsonAsync("/api/assistant/ask", new { question = "QUERY " + JsonSerializer.Serialize(spec), timezoneOffsetMinutes = 0 });
            Assert.True(r.IsSuccessStatusCode, await r.Content.ReadAsStringAsync());
            var text = (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("answer").GetProperty("text").GetString()!;
            var result = JsonDocument.Parse(text["RESULT ".Length..text.LastIndexOf(" history=", StringComparison.Ordinal)]).RootElement;
            Assert.False(result.TryGetProperty("error", out var error), $"{JsonSerializer.Serialize(spec)}: {error}");
            return result;
        }
        decimal First(JsonElement result, int column = 0) => result.GetProperty("rows")[0][column].GetDecimal();
        object Sum(string field) => new { fn = "sum", field };

        // Crew money on operations: the pickup toll, with its category split from the notes.
        var crew = await Query(new { dataset = "operation_money", filters = new[] { new { field = "operation_type", op = "eq", value = "PICKUP" } }, fields = new[] { "category", "amount", "currency", "type" } });
        Assert.Equal(("TOLL", 15m, "INR", "EXPENSE"), (crew.GetProperty("rows")[0][0].GetString(), crew.GetProperty("rows")[0][1].GetDecimal(), crew.GetProperty("rows")[0][2].GetString(), crew.GetProperty("rows")[0][3].GetString()));

        // Charges: the invoiced income and the unbilled vendor cost.
        var charges = await Query(new { dataset = "charges", group_by = new[] { "billed" }, metrics = new[] { Sum("amount") }, sort = new[] { new { by = "billed", desc = false } } });
        Assert.Equal(40m, First(charges, 1));
        Assert.Equal(100m, charges.GetProperty("rows")[1][1].GetDecimal());

        // Ledger and profitability agree on the posted revenue (100 INR at 0.012 = 1.2 in the base currency).
        var revenue = await Query(new { dataset = "ledger", filters = new[] { new { field = "account_type", op = "eq", value = "Revenue" } }, metrics = new[] { Sum("credit") } });
        Assert.Equal(1.2m, First(revenue));
        var profit = await Query(new { dataset = "operation_profitability", group_by = new[] { "operation_type" }, metrics = new[] { Sum("revenue") } });
        Assert.Equal(("PICKUP", 1.2m), (profit.GetProperty("rows")[0][0].GetString(), First(profit, 1)));

        // Pickup cost sheet includes the crew expense.
        var costs = await Query(new { dataset = "pickup_costs", metrics = new[] { Sum("total_cost") } });
        Assert.Equal(15m, First(costs));

        // The rest load without errors (no payments, memos or advances yet); ai_usage already has the runs above.
        foreach (var name in new[] { "payments", "memos", "customer_advances", "invoices", "receipts", "bills", "receivables", "payables" })
            await Query(new { dataset = name, metrics = new[] { new { fn = "count", field = (string?)null } } });
        var usage = await Query(new { dataset = "ai_usage", metrics = new[] { new { fn = "count", field = (string?)null } } });
        Assert.True(First(usage) >= 5);
    }
}
