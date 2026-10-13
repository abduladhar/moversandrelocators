using Movers.Services.Currencies;
using Movers.Domain.Employees;
using Movers.Domain.Surveys;
using Movers.Services.Security;
using Movers.Services.Tenancy;

namespace Movers.Services.Surveys;

public interface ISurveyTripService
{
    Task<SurveyDetailModel?> StartAsync(Guid surveyId, TripStepCommand command, CancellationToken t);
    Task<SurveyDetailModel?> PauseAsync(Guid surveyId, TripStepCommand command, CancellationToken t);
    Task<SurveyDetailModel?> ResumeAsync(Guid surveyId, TripStepCommand command, CancellationToken t);
    Task<SurveyDetailModel?> CompleteAsync(Guid surveyId, CompleteSurveyCommand command, CancellationToken t);
    Task<SurveyDetailModel?> UpdateTripAsync(Guid surveyId, UpdateSurveyTripCommand command, CancellationToken t);
    Task<SurveyDetailModel?> AddExpenseAsync(Guid surveyId, SaveSurveyExpenseCommand command, CancellationToken t);
    Task<SurveyDetailModel?> UpdateExpenseAsync(Guid surveyId, Guid expenseId, SaveSurveyExpenseCommand command, CancellationToken t);
    Task<SurveyDetailModel?> DeleteExpenseAsync(Guid surveyId, Guid expenseId, CancellationToken t);
}

/// <summary>
/// The survey trip clock (leave office → pause/resume → back at office), distance, the surveyor who went, and travel expenses.
/// Every step is time-stamped now unless a correction time is supplied; steps must stay in chronological order.
/// </summary>
public sealed class SurveyTripService(ISurveyRepository repository, ISurveyService surveys, ITenantContext tenantContext, IUserContext user, TimeProvider clock, CurrencyService currencies, Movers.Services.Billing.IBillingRepository? billing = null) : ISurveyTripService
{
    private const decimal MaxDistanceKm = 5000;

    public Task<SurveyDetailModel?> StartAsync(Guid surveyId, TripStepCommand c, CancellationToken t) =>
        Step(surveyId, c.At, null, SurveyTimeEventTypes.Started, (survey, at) => survey.Start(at), t);
    public Task<SurveyDetailModel?> PauseAsync(Guid surveyId, TripStepCommand c, CancellationToken t)
    {
        if (string.IsNullOrWhiteSpace(c.Reason)) throw new InvalidOperationException("Enter why the survey is being paused.");
        return Step(surveyId, c.At, c.Reason, SurveyTimeEventTypes.Paused, (survey, _) => survey.Pause(), t);
    }
    public Task<SurveyDetailModel?> ResumeAsync(Guid surveyId, TripStepCommand c, CancellationToken t) =>
        Step(surveyId, c.At, c.Reason, SurveyTimeEventTypes.Resumed, (survey, _) => survey.Resume(), t);

    public async Task<SurveyDetailModel?> CompleteAsync(Guid surveyId, CompleteSurveyCommand c, CancellationToken t)
    {
        if (c.DistanceKm is null) throw new InvalidOperationException("Enter the distance travelled for the survey.");
        var survey = await repository.GetSurveyAsync(surveyId, false, t); if (survey is null) return null;
        var conductedBy = await ValidTrip(c.DistanceKm, c.ConductedByEmployeeId ?? survey.AssignedEmployeeId, t);
        return await Step(surveyId, c.At, null, SurveyTimeEventTypes.Completed, (x, at) => x.Complete(at, c.DistanceKm.Value, conductedBy!.Value), t);
    }

    public async Task<SurveyDetailModel?> UpdateTripAsync(Guid surveyId, UpdateSurveyTripCommand c, CancellationToken t)
    {
        var survey = await repository.GetSurveyAsync(surveyId, true, t); if (survey is null) return null;
        survey.RecordTrip(c.DistanceKm, await ValidTrip(c.DistanceKm, c.ConductedByEmployeeId, t));
        await repository.SaveChangesAsync(t); return await surveys.GetSurveyAsync(surveyId, t);
    }

    public async Task<SurveyDetailModel?> AddExpenseAsync(Guid surveyId, SaveSurveyExpenseCommand c, CancellationToken t)
    {
        if (await repository.GetSurveyAsync(surveyId, false, t) is null) return null;
        await ValidateExpense(c, t);
        var expense=new SurveyExpense(tenantContext.TenantId, surveyId, c.Category, c.Amount, c.Currency, c.IncurredAtUtc, c.PaidByEmployeeId, c.Notes);
        var fx=await currencies.Resolve(c.Currency,DateOnly.FromDateTime(c.IncurredAtUtc.UtcDateTime),c.ExchangeRate,t);CurrencyService.Amount(c.Amount,fx);await currencies.SaveSnapshot(expense.Id,fx,t);repository.AddExpense(expense);
        await repository.SaveChangesAsync(t); return await surveys.GetSurveyAsync(surveyId, t);
    }

    public async Task<SurveyDetailModel?> UpdateExpenseAsync(Guid surveyId, Guid expenseId, SaveSurveyExpenseCommand c, CancellationToken t)
    {
        var expense = await repository.GetExpenseAsync(expenseId, true, t); if (expense is null || expense.SurveyId != surveyId) return null;
        await EnsureNotPosted(expenseId, "changed", t);
        await ValidateExpense(c, t);
        var fx=await currencies.Resolve(c.Currency,DateOnly.FromDateTime(c.IncurredAtUtc.UtcDateTime),c.ExchangeRate,t);CurrencyService.Amount(c.Amount,fx);await currencies.SaveSnapshot(expense.Id,fx,t);
        expense.Update(c.Category, c.Amount, c.Currency, c.IncurredAtUtc, c.PaidByEmployeeId, c.Notes);
        await repository.SaveChangesAsync(t); return await surveys.GetSurveyAsync(surveyId, t);
    }

    /// <summary>Once the accountant has posted an expense to the ledger it is locked, as for pickup expenses.</summary>
    private async Task EnsureNotPosted(Guid expenseId, string action, CancellationToken t)
    {
        if (billing is not null && await billing.CashIsPosted(expenseId, t))
            throw new InvalidOperationException($"This expense is posted to the ledger and cannot be {action}.");
    }

    public async Task<SurveyDetailModel?> DeleteExpenseAsync(Guid surveyId, Guid expenseId, CancellationToken t)
    {
        var expense = await repository.GetExpenseAsync(expenseId, true, t); if (expense is null || expense.SurveyId != surveyId) return null;
        await EnsureNotPosted(expenseId, "deleted", t);
        repository.RemoveExpense(expense); await repository.SaveChangesAsync(t); return await surveys.GetSurveyAsync(surveyId, t);
    }

    private async Task<SurveyDetailModel?> Step(Guid surveyId, DateTimeOffset? requestedAt, string? reason, string type, Action<Survey, DateTimeOffset> apply, CancellationToken t)
    {
        var survey = await repository.GetSurveyAsync(surveyId, true, t); if (survey is null) return null;
        if (reason?.Length > 500) throw new InvalidOperationException("Keep the reason under 500 characters.");
        var previous = (await repository.ListTimeEventsAsync(surveyId, t)).LastOrDefault()?.OccurredAtUtc ?? survey.StartedAtUtc;
        var at = TripClock.StepTime(requestedAt, previous, type == SurveyTimeEventTypes.Started, clock.GetUtcNow());
        apply(survey, at);
        repository.AddTimeEvent(new SurveyTimeEvent(tenantContext.TenantId, surveyId, type, at, reason, RecordedBy()));
        await repository.SaveChangesAsync(t); return await surveys.GetSurveyAsync(surveyId, t);
    }

    private async Task<Guid?> ValidTrip(decimal? distanceKm, Guid? employeeId, CancellationToken t)
    {
        if (distanceKm is < 0 or > MaxDistanceKm) throw new InvalidOperationException($"Distance must be between 0 and {MaxDistanceKm:0} km.");
        if (employeeId is not null && await repository.GetEmployeeAsync(employeeId.Value, t) is null) throw new InvalidOperationException("Select the employee who conducted the survey.");
        return employeeId;
    }

    private async Task ValidateExpense(SaveSurveyExpenseCommand c, CancellationToken t)
    {
        TripClock.ValidateExpense(c.Category, c.Amount, c.Currency, c.IncurredAtUtc, c.Notes, clock.GetUtcNow());
        if (c.PaidByEmployeeId is not null && await repository.GetEmployeeAsync(c.PaidByEmployeeId.Value, t) is null) throw new InvalidOperationException("Select the employee who paid.");
    }

    private string RecordedBy() => string.IsNullOrWhiteSpace(user.Email) ? "Staff" : user.Email;
}

/// <summary>Builds the trip read model, including active and paused durations derived from the step log.</summary>
internal static class SurveyTrip
{
    public static SurveyTripModel Build(Survey survey, IReadOnlyList<SurveyTimeEvent> events, IReadOnlyList<SurveyExpense> expenses, IReadOnlyList<Employee> employees, DateTimeOffset now)
    {
        string? Name(Guid? id) => id is null ? null : employees.FirstOrDefault(e => e.Id == id)?.FullName;
        var (active, paused) = TripClock.Durations(survey.StartedAtUtc, survey.EndedAtUtc, events.Select(e => new TripClock.Step(e.Type, e.OccurredAtUtc)).ToList(), now);
        var expenseModels = expenses.Select(x => new SurveyExpenseModel(x.SerialNo, x.Id, x.Category, x.Amount, x.Currency, x.IncurredAtUtc, x.PaidByEmployeeId, Name(x.PaidByEmployeeId), x.Notes)).ToList();
        return new(survey.ConductedByEmployeeId, Name(survey.ConductedByEmployeeId), survey.DistanceKm, survey.IsPaused, active, paused,
            events.Select(x => new SurveyTimeEventModel(x.Id, x.Type, x.OccurredAtUtc, x.Reason, x.RecordedBy)).ToList(), expenseModels,
            expenseModels.GroupBy(x => x.Currency).OrderBy(g => g.Key).Select(g => new ExpenseTotalModel(g.Key, g.Sum(x => x.Amount))).ToList());
    }
}

