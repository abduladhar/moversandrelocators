using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Operations;
using Movers.Services.Security;
namespace Movers.Api.Controllers;

[ApiController, Authorize(Policy = SecurityPermissions.AccountingManage), Route("api/operations-costs")]
public sealed class OperationsCostsController(IOperationsService service, Movers.Services.Billing.BillingService billing) : ControllerBase
{
    [HttpGet("choices")] public async Task<IActionResult> Choices(CancellationToken ct) => Ok(await service.Choices(ct));
    [HttpGet("catalogue")] public async Task<IActionResult> Catalogue(CancellationToken ct) => Ok(new { activities = OperationsService.Activities, expenseCategories = OperationsService.ExpenseCategories, reportColumns = OperationsService.ReportColumns, accounts = await billing.Accounts(ct) });
    [HttpGet("labour")] public async Task<IActionResult> Labour(CancellationToken ct) => Ok(await service.Labour(ct));
    [HttpPost("labour")] public Task<IActionResult> Labour(RecordLabour c, CancellationToken ct) => Run(() => service.RecordLabour(c, ct));
    [HttpGet("expenses")] public async Task<IActionResult> Expenses(CancellationToken ct) => Ok(await service.Expenses(ct));
    [HttpPost("expenses")] public Task<IActionResult> Expenses(RecordExpense c, CancellationToken ct) => Run(() => service.RecordExpense(c, ct));
    [HttpGet("summary")] public Task<IActionResult> Summary(CancellationToken ct,string mode="TRANSACTION",DateOnly? date=null) => Run(()=>service.Costs(ct,mode,date));
    [HttpGet("reports")] public async Task<IActionResult> Reports(CancellationToken ct) => Ok(await service.Reports(ct));
    [HttpPost("reports")] public Task<IActionResult> Report(SaveReport c, CancellationToken ct) => Run(() => service.SaveReport(null, c, ct));
    [HttpPut("reports/{id:guid}")] public Task<IActionResult> Report(Guid id, SaveReport c, CancellationToken ct) => Run(() => service.SaveReport(id, c, ct));
    [HttpGet("reports/{id:guid}/csv")]
    public async Task<IActionResult> Export(Guid id, CancellationToken ct,string mode="TRANSACTION",DateOnly? date=null)
    {
        try { return File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(await service.ExportReport(id, ct,mode,date))).ToArray(), "text/csv; charset=utf-8", "move-costs.csv"); }
        catch (KeyNotFoundException) { return NotFound(); }
    }
    [HttpGet("journals")] public async Task<IActionResult> Journals(CancellationToken ct) => Ok(await service.Journals(ct));
    [HttpPost("journals")] public Task<IActionResult> Journal(JournalInput c, CancellationToken ct) => Run(() => service.PostJournal(c, ct));
    [HttpPost("journals/{id:guid}/reverse")] public Task<IActionResult> Reverse(Guid id, ReverseRequest c, CancellationToken ct) => Run(() => service.ReverseJournal(id, c.RequestId, c.Date, ct));
    [HttpGet("trial-balance")] public Task<IActionResult> Balance([FromQuery] string currency, CancellationToken ct) => Run(() => currency=="BASE"?billing.BaseTrialBalance(ct):service.TrialBalance(currency, ct));
    private async Task<IActionResult> Run<T>(Func<Task<T>> action)
    {
        try { return Ok(await action()); }
        catch (OperationConflictException ex) { return Conflict(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (KeyNotFoundException) { return NotFound(); }
    }
    public sealed record ReverseRequest(Guid RequestId, DateOnly Date);
}
[ApiController, Authorize(Policy = SecurityPermissions.TransportationManage), Route("api/transport-trips")]
public sealed class TransportTripsController(IOperationsService service) : ControllerBase
{
    [HttpGet("choices")] public async Task<IActionResult> Choices(CancellationToken ct) { var choices = await service.Choices(ct); return Ok(new { choices.Pickups, choices.Vehicles }); }
    [HttpGet] public async Task<IActionResult> List(CancellationToken ct) => Ok(await service.Trips(ct));
    [HttpPost] public Task<IActionResult> Create(CreateTrip c, CancellationToken ct) => Run(() => service.CreateTrip(c, ct));
    [HttpPost("{id:guid}/complete")] public Task<IActionResult> Complete(Guid id, CompleteTrip c, CancellationToken ct) => Run(() => service.CompleteTrip(id, c, ct));
    private async Task<IActionResult> Run<T>(Func<Task<T>> action)
    {
        try { return Ok(await action()); }
        catch (OperationConflictException ex) { return Conflict(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (KeyNotFoundException) { return NotFound(); }
    }
}


