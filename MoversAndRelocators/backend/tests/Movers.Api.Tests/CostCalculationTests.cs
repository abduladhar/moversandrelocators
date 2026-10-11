using Movers.Services.Operations;
namespace Movers.Api.Tests;

public sealed class CostCalculationTests
{
    [Fact] public void Crew_hours_and_overtime_cost_use_individual_time()
    {
        var start = DateTimeOffset.Parse("2026-09-01T08:00:00Z");
        var entry = CostCalculations.Labour(start, start.AddHours(4), 30, 1, 200, 300);
        Assert.Equal(10.5m, (entry.Regular + entry.Overtime) * 3);
        Assert.Equal(800m, entry.Cost);
        Assert.Throws<InvalidOperationException>(() => CostCalculations.Labour(start, start.AddHours(4), 30, 4, 200, 300));
    }
    [Fact] public void Fuel_uses_odometer_difference_and_efficiency()
    {
        Assert.Equal(2000m, CostCalculations.Fuel(12300, 12480, 9, 100));
        Assert.Throws<InvalidOperationException>(() => CostCalculations.Fuel(12480, 12300, 9, 100));
        Assert.Throws<InvalidOperationException>(() => CostCalculations.Fuel(0, 180, 0, 100));
    }
    [Fact] public void Allocation_conserves_cents_without_negative_residuals()
    {
        Assert.Equal(new[] { 1800m, 1200m }, CostCalculations.Allocate(3000, [6, 4]));
        var shares = CostCalculations.Allocate(0.01m, Enumerable.Repeat(1m, 100).ToArray());
        Assert.Equal(0.01m, shares.Sum()); Assert.All(shares, x => Assert.True(x >= 0));
        Assert.Throws<InvalidOperationException>(() => CostCalculations.Allocate(10, [1, 0]));
    }
}
