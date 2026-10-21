namespace Movers.Services.Common;

/// <summary>
/// One page of a list screen's advanced search: the keyword (every word must match one of the searched fields), the sort
/// field (a name the list knows; unknown names fall back to its default) and the page window. Bound from the query string:
/// ?search=&amp;sort=&amp;desc=&amp;skip=&amp;take=.
/// </summary>
public sealed record ListQuery(string? Search = null, string? Sort = null, bool? Desc = null, int Skip = 0, int Take = ListQuery.DefaultTake)
{
    public const int DefaultTake = 50, MaxTake = 200;

    public ListQuery Normalized() => this with
    {
        Search = string.IsNullOrWhiteSpace(Search) ? null : Search.Trim()[..Math.Min(Search.Trim().Length, 200)],
        Sort = string.IsNullOrWhiteSpace(Sort) ? null : Sort.Trim(),
        Skip = Math.Max(0, Skip),
        Take = Take <= 0 ? DefaultTake : Math.Min(Take, MaxTake),
    };

    /// <summary>The keyword split into lower-case words (at most 8); each must match.</summary>
    public IReadOnlyList<string> Terms => Search is null ? [] : Search.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Distinct().Take(8).ToList();
}

/// <summary>A page of rows, the number of rows matching the search (all pages), and optional figures for the screen (stats cards, filter options).</summary>
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Total, object? Summary = null);

/// <summary>Search, sort and paging over rows already in memory, for lists whose rows are only known after mapping
/// (values kept as JSON, defaults merged in code). Database lists use Movers.DAL.Common.QueryPaging instead.</summary>
public static class Paging
{
    public static PagedResult<T> Page<T>(IEnumerable<T> rows, ListQuery query, Func<T, IEnumerable<string?>> searchable,
        IReadOnlyDictionary<string, Func<T, object?>> sorts, string defaultSort, bool defaultDesc = true, object? summary = null)
    {
        query = query.Normalized();
        var terms = query.Terms;
        var matched = rows.Where(row => terms.Count == 0 || Matches(searchable(row), terms));
        var key = query.Sort is { } s && sorts.ContainsKey(s) ? s : defaultSort;
        var desc = query.Desc ?? defaultDesc;
        var comparer = Comparer<object?>.Create(Compare);
        var ordered = (desc ? matched.OrderByDescending(sorts[key], comparer) : matched.OrderBy(sorts[key], comparer)).ToList();
        return new(ordered.Skip(query.Skip).Take(query.Take).ToList(), ordered.Count, summary);
    }

    public static bool Matches(IEnumerable<string?> fields, IReadOnlyList<string> terms)
    {
        var text = string.Join(' ', fields.Where(x => !string.IsNullOrEmpty(x))).ToLowerInvariant();
        return terms.All(text.Contains);
    }

    // Empty values sort last whichever way; text compares case-insensitively.
    private static int Compare(object? a, object? b) => (a, b) switch
    {
        (null, null) => 0,
        (null, _) => 1,
        (_, null) => -1,
        (string x, string y) => string.Compare(x, y, StringComparison.OrdinalIgnoreCase),
        (IComparable x, _) => x.CompareTo(b),
        _ => 0,
    };
}
