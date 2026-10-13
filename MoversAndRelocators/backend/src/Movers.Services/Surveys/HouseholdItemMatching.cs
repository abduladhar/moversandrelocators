using Movers.Domain.Surveys;

namespace Movers.Services.Surveys;

/// <summary>
/// Matches a free-text item name — typed by a surveyor, read off a lead video by the AI, or sent by a customer —
/// to the household item master that carries its volume. Used wherever a lead inventory becomes priced or surveyed
/// work, so the same name resolves to the same master everywhere.
/// </summary>
public static class HouseholdItemMatching
{
    public static string Normalise(string value) => new(value.ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());

    /// <param name="masters">Candidates; filter to the active ones before calling when inactive masters must not match.</param>
    public static HouseholdItem? Find(IEnumerable<HouseholdItem> masters, string name)
    {
        var list = masters as IReadOnlyCollection<HouseholdItem> ?? masters.ToList();
        var n = Normalise(name);
        if (n.Length == 0) return null;
        return list.FirstOrDefault(m => Normalise(m.Name) == n)
            // A more specific name may contain the master name ("Television 55 inch" -> Television), never the reverse:
            // a plain "Sofa" must not take the volume of "Large sofa". The longest master wins when several fit.
            ?? list.Where(m => Normalise(m.Name).Length >= 4 && n.Contains(Normalise(m.Name))).OrderByDescending(m => m.Name.Length).FirstOrDefault();
    }

    /// <summary>
    /// The master for a lead-inventory line, creating one when no active master fits so the item is not lost on the way
    /// into a survey or quotation. A new master takes the line's name and per-unit volume; it is not created when the line
    /// has no volume, or when a deactivated master already has that name (deactivating it was deliberate).
    /// </summary>
    /// <param name="active">Active masters; a created master is added to it, so later lines with the same name reuse it.</param>
    /// <param name="all">Every master of the tenant (active or not), for the deactivated-name check and code uniqueness.</param>
    /// <param name="created">Receives the new master, to be saved with the import.</param>
    public static HouseholdItem? FindOrCreate(List<HouseholdItem> active, IReadOnlyCollection<HouseholdItem> all, string name, decimal unitCbm, Guid tenantId, string source, Action<HouseholdItem> created)
    {
        if (Find(active, name) is { } found) return found;
        var n = Normalise(name);
        if (n.Length == 0 || unitCbm <= 0 || all.Any(m => !m.IsActive && Normalise(m.Name) == n)) return null;
        var clean = name.Trim();
        // Readable, unique code: LI-<name>-<4 hex> (LI = from a lead inventory), within the 40-character limit.
        string code;
        do code = $"LI-{new string(n.ToUpperInvariant().Take(29).ToArray())}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";
        while (all.Any(m => m.Code == code) || active.Any(m => m.Code == code));
        var item = new HouseholdItem(tenantId, code, clean.Length > 160 ? clean[..160] : clean, Math.Round(Math.Min(unitCbm, 100m), 3), $"Added automatically from {source}. Check the volume.");
        active.Add(item);
        created(item);
        return item;
    }
}
