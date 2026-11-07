using System.Globalization;
using System.Text.Json;

namespace Movers.Services.Assistant;

/// <summary>
/// Runs the assistant's query tool over the rows of one dataset: filter, group (with day/week/month/quarter/year
/// buckets for dates), count / sum / average / min / max, sort and limit, or list records. It works in memory on rows
/// the data layer already limited to the current company, so the model can ask anything about the catalog's fields
/// and nothing else. Invalid requests come back as an error text the model can read and correct.
/// </summary>
public static class AssistantQueryEngine
{
    public const int MaxRecords = 200, DefaultRecords = 50, MaxGroups = 200;
    private static readonly string[] Ops = ["eq", "ne", "gt", "gte", "lt", "lte", "between", "contains", "starts_with", "in", "not_in", "is_empty", "not_empty"];
    private static readonly string[] Functions = ["count", "count_distinct", "sum", "avg", "min", "max"];
    private static readonly string[] Buckets = ["day", "week", "month", "quarter", "year"];

    /// <summary>Thrown for a request the model got wrong; the message is sent back to it as the tool result.</summary>
    public sealed class QueryError(string message) : Exception(message);

    public sealed record Spec(string Dataset, IReadOnlyList<Filter> Filters, IReadOnlyList<string> GroupBy, IReadOnlyList<Metric> Metrics, IReadOnlyList<string> Fields, IReadOnlyList<SortBy> Sort, int? Limit);
    public sealed record Filter(string Field, string Op, JsonElement Value);
    public sealed record Metric(string Fn, string? Field);
    public sealed record SortBy(string By, bool Desc);

    /// <summary>The tool's answer: a compact table (rows as arrays) plus how many records matched.</summary>
    public sealed record Result(string Dataset, string Mode, int Matched, IReadOnlyList<string> Columns, IReadOnlyList<object?[]> Rows, bool Truncated, string? Note);

    public static Spec Parse(JsonElement input)
    {
        if (input.ValueKind != JsonValueKind.Object) throw new QueryError("The query must be a JSON object.");
        string? Str(JsonElement e, string name) => e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
        IEnumerable<JsonElement> Arr(string name) => input.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Array ? v.EnumerateArray() : [];
        var dataset = Str(input, "dataset") ?? throw new QueryError("Name a dataset.");
        var filters = Arr("filters").Select(f => new Filter(Str(f, "field") ?? throw new QueryError("Each filter needs a field."), (Str(f, "op") ?? "eq").ToLowerInvariant(),
            f.TryGetProperty("value", out var v) ? v.Clone() : default)).ToList();
        var groups = Arr("group_by").Where(g => g.ValueKind == JsonValueKind.String).Select(g => g.GetString()!).ToList();
        var metrics = Arr("metrics").Select(m => new Metric((Str(m, "fn") ?? "count").ToLowerInvariant(), Str(m, "field"))).ToList();
        var fields = Arr("fields").Where(g => g.ValueKind == JsonValueKind.String).Select(g => g.GetString()!).ToList();
        var sort = Arr("sort").Select(s => new SortBy(Str(s, "by") ?? "", s.TryGetProperty("desc", out var d) && d.ValueKind == JsonValueKind.True)).Where(s => s.By != "").ToList();
        int? limit = input.TryGetProperty("limit", out var l) && l.ValueKind == JsonValueKind.Number && l.TryGetInt32(out var n) ? n : null;
        return new(dataset, filters, groups, metrics, fields, sort, limit);
    }

    public static Result Run(AssistantDataset dataset, IReadOnlyList<IReadOnlyDictionary<string, object?>> rows, Spec spec)
    {
        AssistantField FieldOf(string name) => dataset.Field(name) ?? throw new QueryError($"Dataset {dataset.Name} has no field \"{name}\". Its fields are: {string.Join(", ", dataset.Fields.Select(f => f.Name))}.");
        var predicates = spec.Filters.Select(f =>
        {
            var field = FieldOf(f.Field);
            if (!Ops.Contains(f.Op)) throw new QueryError($"Unknown operator \"{f.Op}\". Use one of: {string.Join(", ", Ops)}.");
            return Predicate(field, f.Op, f.Value);
        }).ToList();
        var matched = rows.Where(r => predicates.All(p => p(r))).ToList();

        if (spec.GroupBy.Count == 0 && spec.Metrics.Count == 0)
        {
            var fields = (spec.Fields.Count > 0 ? spec.Fields : dataset.ListFields).Select(FieldOf).ToList();
            IEnumerable<IReadOnlyDictionary<string, object?>> ordered = matched;
            foreach (var s in spec.Sort.AsEnumerable().Reverse())
            {
                var field = FieldOf(s.By);
                ordered = s.Desc ? ordered.OrderByDescending(r => r.GetValueOrDefault(field.Name), ValueComparer.Instance) : ordered.OrderBy(r => r.GetValueOrDefault(field.Name), ValueComparer.Instance);
            }
            var take = Math.Clamp(spec.Limit ?? DefaultRecords, 1, MaxRecords);
            var page = ordered.Take(take).Select(r => fields.Select(f => Show(r.GetValueOrDefault(f.Name))).ToArray()).ToList();
            return new(dataset.Name, "records", matched.Count, fields.Select(f => f.Name).ToList(), page, matched.Count > take,
                dataset.ListKey is null ? null : $"Records open in the app with a link like [{(dataset.NumberField ?? "number")}](open:{dataset.ListKey}/<{dataset.NumberField}>).");
        }

        // Grouping keys: "field" or "field:bucket" for dates.
        var keys = spec.GroupBy.Select(g =>
        {
            var parts = g.Split(':', 2, StringSplitOptions.TrimEntries);
            var field = FieldOf(parts[0]);
            var bucket = parts.Length > 1 ? parts[1].ToLowerInvariant() : null;
            if (bucket is not null && !Buckets.Contains(bucket)) throw new QueryError($"Unknown date bucket \"{bucket}\". Use day, week, month, quarter or year.");
            if (bucket is not null && field.Type is not (AssistantFieldTypes.Date or AssistantFieldTypes.DateTime)) throw new QueryError($"\"{field.Name}\" is not a date, so it cannot be bucketed.");
            return (Name: bucket is null ? field.Name : $"{field.Name}:{bucket}", Field: field, Bucket: bucket);
        }).ToList();
        var metrics = (spec.Metrics.Count > 0 ? spec.Metrics : [new Metric("count", null)]).Select(m =>
        {
            if (!Functions.Contains(m.Fn)) throw new QueryError($"Unknown metric \"{m.Fn}\". Use count, count_distinct, sum, avg, min or max.");
            if (m.Fn == "count") return (Name: "count", Fn: m.Fn, Field: (AssistantField?)null);
            var field = FieldOf(m.Field ?? throw new QueryError($"Metric {m.Fn} needs a field."));
            if (m.Fn is "sum" or "avg" && field.Type != AssistantFieldTypes.Number) throw new QueryError($"{m.Fn} needs a number field; \"{field.Name}\" is {field.Type}.");
            return (Name: $"{m.Fn}_{field.Name}", Fn: m.Fn, Field: (AssistantField?)field);
        }).ToList();

        var groups = matched.GroupBy(r => string.Join("\u001f", keys.Select(k => Key(r.GetValueOrDefault(k.Field.Name), k.Bucket))), StringComparer.OrdinalIgnoreCase)
            .Select(g => (Keys: keys.Select(k => (object?)Key(g.First().GetValueOrDefault(k.Field.Name), k.Bucket)).ToArray(),
                Values: metrics.Select(m => Aggregate(m.Fn, m.Field, g.ToList())).ToArray())).ToList();
        var columns = keys.Select(k => k.Name).Concat(metrics.Select(m => m.Name)).ToList();
        var table = groups.Select(g => g.Keys.Concat(g.Values).ToArray()).ToList();

        IEnumerable<object?[]> sorted = table;
        if (spec.Sort.Count > 0)
            foreach (var s in spec.Sort.AsEnumerable().Reverse())
            {
                var i = columns.FindIndex(c => string.Equals(c, s.By, StringComparison.OrdinalIgnoreCase));
                if (i < 0) throw new QueryError($"Sort by one of the result columns: {string.Join(", ", columns)}.");
                sorted = s.Desc ? sorted.OrderByDescending(r => r[i], ValueComparer.Instance) : sorted.OrderBy(r => r[i], ValueComparer.Instance);
            }
        // Time buckets read best in time order; otherwise the biggest first.
        else if (keys.Any(k => k.Bucket is not null)) sorted = sorted.OrderBy(r => r[keys.FindIndex(k => k.Bucket is not null)], ValueComparer.Instance);
        else if (keys.Count > 0) sorted = sorted.OrderByDescending(r => r[keys.Count], ValueComparer.Instance);
        var limit = Math.Clamp(spec.Limit ?? MaxGroups, 1, MaxGroups);
        var rowsOut = sorted.Take(limit).Select(r => r.Select(Show).ToArray()).ToList();
        return new(dataset.Name, "groups", matched.Count, columns, rowsOut, table.Count > limit, null);
    }

    private static Func<IReadOnlyDictionary<string, object?>, bool> Predicate(AssistantField field, string op, JsonElement value)
    {
        if (op == "is_empty") return r => IsEmpty(r.GetValueOrDefault(field.Name));
        if (op == "not_empty") return r => !IsEmpty(r.GetValueOrDefault(field.Name));
        if (op is "in" or "not_in")
        {
            if (value.ValueKind != JsonValueKind.Array) throw new QueryError($"\"{op}\" needs a list of values.");
            var list = value.EnumerateArray().Select(v => Convert(field, v, false)).ToList();
            return r => list.Any(v => Equal(field, r.GetValueOrDefault(field.Name), v)) == (op == "in");
        }
        if (op == "between")
        {
            if (value.ValueKind != JsonValueKind.Array || value.GetArrayLength() != 2) throw new QueryError("\"between\" needs [from, to] (both included).");
            var from = Convert(field, value[0], false); var to = Convert(field, value[1], true);
            return r => r.GetValueOrDefault(field.Name) is { } x && Compare(x, from) >= 0 && Compare(x, to) <= 0;
        }
        if (op is "contains" or "starts_with")
        {
            var text = value.ValueKind == JsonValueKind.String ? value.GetString() ?? "" : value.ToString();
            return r => r.GetValueOrDefault(field.Name) is { } x && (op == "contains"
                ? Show(x)?.ToString()?.Contains(text, StringComparison.OrdinalIgnoreCase) == true
                : Show(x)?.ToString()?.StartsWith(text, StringComparison.OrdinalIgnoreCase) == true);
        }
        // A whole day given for a date-time: "eq" means that day, "lte"/"gt" compare with the end of it.
        var dayOnly = field.Type == AssistantFieldTypes.DateTime && value.ValueKind == JsonValueKind.String && DateOnly.TryParseExact(value.GetString(), "yyyy-MM-dd", out _);
        var start = Convert(field, value, false);
        var end = dayOnly ? Convert(field, value, true) : start;
        return op switch
        {
            "eq" => r => dayOnly ? r.GetValueOrDefault(field.Name) is { } x && Compare(x, start) >= 0 && Compare(x, end) <= 0 : Equal(field, r.GetValueOrDefault(field.Name), start),
            "ne" => r => dayOnly ? !(r.GetValueOrDefault(field.Name) is { } x && Compare(x, start) >= 0 && Compare(x, end) <= 0) : !Equal(field, r.GetValueOrDefault(field.Name), start),
            "gt" => r => r.GetValueOrDefault(field.Name) is { } x && Compare(x, end) > 0,
            "gte" => r => r.GetValueOrDefault(field.Name) is { } x && Compare(x, start) >= 0,
            "lt" => r => r.GetValueOrDefault(field.Name) is { } x && Compare(x, start) < 0,
            _ => r => r.GetValueOrDefault(field.Name) is { } x && Compare(x, end) <= 0,
        };
    }

    /// <summary>A filter value as the field's type. endOfDay: a date given for a date-time means the end of that day.</summary>
    private static object? Convert(AssistantField field, JsonElement value, bool endOfDay)
    {
        if (value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined) return null;
        var text = value.ValueKind == JsonValueKind.String ? value.GetString()!.Trim() : value.ToString();
        switch (field.Type)
        {
            case AssistantFieldTypes.Number:
                return value.ValueKind == JsonValueKind.Number ? value.GetDecimal()
                    : decimal.TryParse(text, NumberStyles.Number, CultureInfo.InvariantCulture, out var n) ? n : throw new QueryError($"\"{text}\" is not a number for {field.Name}.");
            case AssistantFieldTypes.Bool:
                return value.ValueKind is JsonValueKind.True or JsonValueKind.False ? value.GetBoolean()
                    : bool.TryParse(text, out var b) ? b : throw new QueryError($"Use true or false for {field.Name}.");
            case AssistantFieldTypes.Date:
                return DateOnly.TryParse(text, CultureInfo.InvariantCulture, out var d) ? d
                    : DateTime.TryParse(text, CultureInfo.InvariantCulture, out var dt) ? DateOnly.FromDateTime(dt) : throw new QueryError($"Write dates as yyyy-MM-dd ({field.Name}).");
            case AssistantFieldTypes.DateTime:
                if (DateOnly.TryParseExact(text, "yyyy-MM-dd", out var day)) return endOfDay ? day.ToDateTime(TimeOnly.MaxValue) : day.ToDateTime(TimeOnly.MinValue);
                return DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out var at) ? at : throw new QueryError($"Write date-times as yyyy-MM-dd or yyyy-MM-ddTHH:mm ({field.Name}).");
            default: return text;
        }
    }

    private static bool IsEmpty(object? value) => value is null || value is string s && string.IsNullOrWhiteSpace(s);
    private static bool Equal(AssistantField field, object? a, object? b) =>
        a is null || b is null ? a is null && b is null : a is string x && b is string y ? string.Equals(x.Trim(), y.Trim(), StringComparison.OrdinalIgnoreCase) : Compare(a, b) == 0;

    private static int Compare(object? a, object? b) => ValueComparer.Instance.Compare(a, b);

    private static object? Key(object? value, string? bucket)
    {
        if (value is null) return null;
        if (bucket is null) return value is string s ? s.Trim() : value;
        var day = value switch { DateOnly d => d, DateTime t => DateOnly.FromDateTime(t), _ => (DateOnly?)null };
        if (day is not { } x) return value;
        return bucket switch
        {
            "day" => x.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            "week" => "week of " + x.AddDays(-(((int)x.DayOfWeek + 6) % 7)).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            "month" => x.ToString("yyyy-MM", CultureInfo.InvariantCulture),
            "quarter" => $"{x.Year}-Q{(x.Month - 1) / 3 + 1}",
            _ => x.Year.ToString(CultureInfo.InvariantCulture),
        };
    }

    private static object? Aggregate(string fn, AssistantField? field, IReadOnlyList<IReadOnlyDictionary<string, object?>> rows)
    {
        if (fn == "count") return rows.Count;
        var values = rows.Select(r => r.GetValueOrDefault(field!.Name)).Where(v => v is not null).ToList();
        return fn switch
        {
            "count_distinct" => values.Select(v => v is string s ? s.Trim().ToUpperInvariant() : v).Distinct().Count(),
            "sum" => values.Sum(v => System.Convert.ToDecimal(v, CultureInfo.InvariantCulture)),
            "avg" => values.Count == 0 ? null : Math.Round(values.Average(v => System.Convert.ToDecimal(v, CultureInfo.InvariantCulture)), 2),
            "min" => values.Count == 0 ? null : values.Min(ValueComparer.Instance),
            _ => values.Count == 0 ? null : values.Max(ValueComparer.Instance),
        };
    }

    /// <summary>How a value is written into the tool result: dates as ISO text, money rounded to 2 places.</summary>
    private static object? Show(object? value) => value switch
    {
        null => null,
        decimal d => Math.Round(d, 2),
        DateOnly d => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        DateTime t => t.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),
        _ => value,
    };

    /// <summary>Orders mixed values: nulls first, then numbers, dates and text (case-insensitive).</summary>
    private sealed class ValueComparer : IComparer<object?>
    {
        public static readonly ValueComparer Instance = new();
        public int Compare(object? a, object? b)
        {
            if (a is null || b is null) return a is null ? (b is null ? 0 : -1) : 1;
            if (Number(a) is { } x && Number(b) is { } y) return x.CompareTo(y);
            if (When(a) is { } p && When(b) is { } q) return p.CompareTo(q);
            if (a is bool ba && b is bool bb) return ba.CompareTo(bb);
            return string.Compare(a.ToString(), b.ToString(), StringComparison.OrdinalIgnoreCase);
        }
        private static decimal? Number(object v) => v switch { decimal d => d, int i => i, long l => l, double f => (decimal)f, _ => null };
        private static DateTime? When(object v) => v switch { DateTime t => t, DateOnly d => d.ToDateTime(TimeOnly.MinValue), _ => null };
    }
}
