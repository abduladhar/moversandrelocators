using System.Text.Json;
using Movers.Domain.Assistant;

namespace Movers.Services.Assistant;

/// <summary>One step the assistant took to answer: which dataset it read and what it asked for, shown under the answer.</summary>
public sealed record AssistantStep(string Dataset, string Summary, int Matched, string? Error = null);
public sealed record AssistantChartSeries(string Name, IReadOnlyList<decimal> Values);
/// <param name="Type">column (also for time series) or bar (ranked categories).</param>
public sealed record AssistantChart(string Type, string Title, IReadOnlyList<string> Labels, IReadOnlyList<AssistantChartSeries> Series, bool Money);

/// <summary>A question (role user) or an answer (role assistant) in a conversation.</summary>
public sealed record AssistantMessage(string Role, string Text, DateTimeOffset AtUtc, string? Provider = null, string? Model = null,
    IReadOnlyList<AssistantStep>? Steps = null, AssistantChart? Chart = null, decimal? Cost = null);

public sealed record AssistantConversationSummary(Guid Id, string Title, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc);
public sealed record AssistantConversationModel(Guid Id, string Title, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc, IReadOnlyList<AssistantMessage> Messages);
public sealed record AssistantProvider(string Key, string Name, string Model);
/// <param name="Datasets">What this user's assistant can read (drives the suggested questions).</param>
public sealed record AssistantStatus(IReadOnlyList<AssistantProvider> Providers, IReadOnlyList<string> Datasets);
public sealed record AskAssistantCommand(Guid? ConversationId, string Question, string? Provider, int TimezoneOffsetMinutes, string? Language);
public sealed record AssistantAnswer(Guid ConversationId, string Title, AssistantMessage Question, AssistantMessage Answer);

/// <summary>A tool the model may call, with its JSON schema.</summary>
public sealed record AssistantTool(string Name, string Description, JsonElement Schema);
/// <summary>An earlier question or answer, sent as plain text (earlier tool calls are not replayed).</summary>
public sealed record AssistantHistoryTurn(string Role, string Text);
public sealed record AssistantModelResult(string Text, int InputTokens, int CachedTokens, int OutputTokens);
public delegate Task<string> AssistantToolRunner(string name, JsonElement input, CancellationToken ct);

/// <summary>One AI provider's tool-use loop (Claude or OpenAI): it calls tools through <c>run</c> until the model answers.</summary>
public interface IAssistantModelGateway
{
    string Provider { get; }
    Task<AssistantModelResult> Run(string apiKey, string model, string? effort, string system, IReadOnlyList<AssistantHistoryTurn> history, string question,
        IReadOnlyList<AssistantTool> tools, AssistantToolRunner run, CancellationToken ct);
}

/// <summary>Rows of the operational datasets (leads, surveys, jobs, ...), for the current company only, with times in the user's time zone.</summary>
public interface IAssistantData
{
    Task<IReadOnlyList<IReadOnlyDictionary<string, object?>>> Load(string dataset, TimeSpan offset, DateTimeOffset nowUtc, CancellationToken ct);
}

public interface IAssistantConversationRepository
{
    Task<IReadOnlyList<AssistantConversation>> ForUser(Guid userId, CancellationToken ct);
    Task<AssistantConversation?> Get(Guid id, Guid userId, CancellationToken ct);
    void Add(AssistantConversation conversation);
    void Remove(AssistantConversation conversation);
    Task Save(CancellationToken ct);
}
