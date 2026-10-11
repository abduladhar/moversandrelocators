namespace Movers.Services.Operations;

public static class CostCalculations
{
    public static decimal Money(decimal value) => decimal.Round(value, 2, MidpointRounding.AwayFromZero);

    public static (decimal Regular, decimal Overtime, decimal Cost) Labour(
        DateTimeOffset start, DateTimeOffset end, decimal breakMinutes, decimal overtime,
        decimal rate, decimal overtimeRate)
    {
        var elapsedMinutes = (decimal)(end - start).TotalMinutes;
        if (elapsedMinutes <= 0 || elapsedMinutes > 24 * 60)
            throw new InvalidOperationException("Work must end after its start and last no more than 24 hours.");
        if (breakMinutes < 0 || breakMinutes >= elapsedMinutes || overtime < 0 || rate < 0 || overtimeRate < 0)
            throw new InvalidOperationException("Check breaks, overtime and hourly rates.");
        var hours = decimal.Round((elapsedMinutes - breakMinutes) / 60m, 4);
        if (overtime > hours) throw new InvalidOperationException("Overtime exceeds worked hours.");
        return (hours - overtime, overtime, Money((hours - overtime) * rate + overtime * overtimeRate));
    }

    public static decimal Fuel(decimal start, decimal end, decimal kmPerLitre, decimal price)
    {
        if (start < 0 || end < start || kmPerLitre <= 0 || price < 0)
            throw new InvalidOperationException("Enter increasing odometer readings, positive efficiency and a valid fuel price.");
        return Money((end - start) / kmPerLitre * price);
    }

    // Largest remainder distribution conserves the amount and never makes an allocation negative.
    public static IReadOnlyList<decimal> Allocate(decimal total, IReadOnlyList<decimal> weights, int decimalPlaces = 2)
    {
        if (total < 0 || weights.Count == 0 || weights.Any(x => x <= 0))
            throw new InvalidOperationException("Allocation weights must be positive.");
        var factor=(decimal)Math.Pow(10,decimalPlaces);
        var cents = decimal.Round(total,decimalPlaces,MidpointRounding.AwayFromZero) * factor;
        var weightTotal = weights.Sum();
        var raw = weights.Select(w => cents * w / weightTotal).ToArray();
        var allocated = raw.Select(decimal.Floor).ToArray();
        var residual = (int)(cents - allocated.Sum());
        foreach (var index in Enumerable.Range(0, raw.Length)
                     .OrderByDescending(i => raw[i] - allocated[i]).ThenBy(i => i).Take(residual))
            allocated[index]++;
        return allocated.Select(x => x / factor).ToArray();
    }
}

