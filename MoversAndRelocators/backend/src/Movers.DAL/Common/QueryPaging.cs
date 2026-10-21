using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Movers.Services.Common;

namespace Movers.DAL.Common;

/// <summary>Advanced search in the database: keyword, named sorts and one page, plus the number of matching rows.</summary>
public static class QueryPaging
{
    /// <summary>Keeps rows where every keyword word matches; <paramref name="term"/> builds the test for one lower-case word
    /// (compare lower-cased columns, e.g. x =&gt; x.Name.ToLower().Contains(word), so every database behaves the same).</summary>
    public static IQueryable<T> Search<T>(this IQueryable<T> query, ListQuery list, Func<string, Expression<Func<T, bool>>> term)
    {
        foreach (var word in list.Terms) query = query.Where(term(word));
        return query;
    }

    /// <summary>Sorts by the named sort (or the default), then by the tie-breaker so pages never overlap.</summary>
    public static IQueryable<T> Sort<T>(this IQueryable<T> query, ListQuery list, SortMap<T> sorts) => sorts.Apply(query, list);

    public static async Task<(List<T> Items, int Total)> PageAsync<T>(this IQueryable<T> query, ListQuery list, CancellationToken t)
    {
        var total = await query.CountAsync(t);
        var items = total == 0 ? [] : await query.Skip(list.Skip).Take(list.Take).ToListAsync(t);
        return (items, total);
    }
}

/// <summary>The sorts a list offers, by name. Build once (static) and reuse.</summary>
public sealed class SortMap<T>(string defaultSort, bool defaultDesc, Expression<Func<T, int>> tieBreaker)
{
    private readonly Dictionary<string, Func<IQueryable<T>, bool, IOrderedQueryable<T>>> sorts = new(StringComparer.OrdinalIgnoreCase);

    public SortMap<T> Add<TKey>(string name, Expression<Func<T, TKey>> key)
    {
        sorts[name] = (q, desc) => desc ? q.OrderByDescending(key) : q.OrderBy(key);
        return this;
    }

    public IQueryable<T> Apply(IQueryable<T> query, ListQuery list)
    {
        var name = list.Sort is { } s && sorts.ContainsKey(s) ? s : defaultSort;
        var desc = list.Desc ?? defaultDesc;
        var ordered = sorts[name](query, desc);
        return desc ? ordered.ThenByDescending(tieBreaker) : ordered.ThenBy(tieBreaker);
    }
}
