using Movers.Api.Configuration;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Operations;
using Movers.Services.Packing;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

public sealed record SavePackingJobRequest([Required, StringLength(160)] string CustomerName, [Required, StringLength(40)] string Phone, [StringLength(254)] string? Email, [Required, StringLength(500)] string Address, DateTimeOffset ScheduledAtUtc, [StringLength(2000)] string? Notes, Guid? PickupId = null, Guid? QuotationId = null, Guid? SalesLeadId = null)
{ public SavePackingJobCommand Command() => new(CustomerName, Phone, Email, Address, ScheduledAtUtc, Notes, PickupId, QuotationId, SalesLeadId); }
public sealed record PackingStatusRequest([Required] string Status, DateTimeOffset? At = null);
public sealed record PackingClockRequest(DateTimeOffset? At = null, [StringLength(500)] string? Reason = null);
public sealed record PackingCrewRequest(IReadOnlyList<PackingCrewInput> Crew);
public sealed record PackingBoxItemRequest([Required, StringLength(160)] string ItemName, [Range(1, 10000)] int Quantity, [StringLength(500)] string? Notes, Guid? HouseholdItemId = null);
public sealed record SavePackingBoxRequest(Guid BoxTypeId, [StringLength(120)] string? RoomName, bool IsFragile, [StringLength(500)] string? Notes, IReadOnlyList<PackingBoxItemRequest>? Items, [Range(1, 50)] int Copies = 1, IReadOnlyList<PackingBoxMaterialInput>? Materials = null)
{ public SavePackingBoxCommand Command() => new(BoxTypeId, RoomName, IsFragile, Notes, (Items ?? []).Select(i => new PackingBoxItemInput(i.ItemName, i.Quantity, i.Notes, i.HouseholdItemId)).ToList(), Copies, Materials); }
public sealed record PackingMaterialsRequest(IReadOnlyList<PackingMaterialInput> Materials);
public sealed record PackingLabelsPrintedRequest(IReadOnlyList<Guid> BoxIds);
public sealed record PackingShareRequest([Required] string Purpose, [Range(1, 30)] int ValidDays = 7);
public sealed record ConfirmPackingScheduleRequest(DateTimeOffset ScheduledAtUtc);
public sealed record SharePackingLocationRequest(decimal Latitude, decimal Longitude, [StringLength(500)] string? Address, [StringLength(500)] string? Notes);
public sealed record RespondPackingItemsRequest([Required, StringLength(160)] string Name, bool Confirmed, [StringLength(2000)] string? Notes, [Required, StringLength(64)] string SnapshotHash);
public sealed record AddPackingTransactionRequest([Required] string Type, [Required, StringLength(120)] string Category, [Range(.01, 999999999)] decimal Amount, [Required, StringLength(40)] string PaymentMethod, [StringLength(500)] string? Notes, string? Currency = null, decimal? ExchangeRate = null)
{ public AddPackingTransactionCommand Command() => new(Type, Category, Amount, PaymentMethod, Notes, Currency, ExchangeRate); }

/// <summary>Packing module: jobs, crew, boxes and labels, materials, and income/expense.</summary>
[ApiController, Authorize(Policy = SecurityPermissions.PackingManage), Route("api/packing")]
public sealed class PackingController(PackingService service, PublicLinks links) : ControllerBase
{
    [HttpGet("masters")] public Task<ActionResult> Masters(CancellationToken t) => Run(() => service.Masters(t));
    [HttpGet("sources")] public Task<ActionResult> Sources(CancellationToken t) => Run(() => service.Sources(t));
    [HttpGet] public Task<ActionResult> List(CancellationToken t) => Run(() => service.List(t));
    [HttpPost] public Task<ActionResult> Create(SavePackingJobRequest r, CancellationToken t) => Run(() => service.Create(r.Command(), t));
    [HttpGet("{id:guid}")] public Task<ActionResult> Get(Guid id, CancellationToken t) => Run(() => service.Get(id, t));
    [HttpPut("{id:guid}")] public Task<ActionResult> Update(Guid id, SavePackingJobRequest r, CancellationToken t) => Run(() => service.Update(id, r.Command(), t));
    [HttpPut("{id:guid}/status")] public Task<ActionResult> Status(Guid id, PackingStatusRequest r, CancellationToken t) => Run(() => service.SetStatus(id, r.Status, t, r.At));

    /* Packing clock: start → pause (reason) / resume → complete. Times default to now. */
    [HttpPost("{id:guid}/clock/start")] public Task<ActionResult> Start(Guid id, PackingClockRequest r, CancellationToken t) => Run(() => service.Start(id, r.At, t));
    [HttpPost("{id:guid}/clock/pause")] public Task<ActionResult> Pause(Guid id, PackingClockRequest r, CancellationToken t) => Run(() => service.Pause(id, r.Reason, r.At, t));
    [HttpPost("{id:guid}/clock/resume")] public Task<ActionResult> Resume(Guid id, PackingClockRequest r, CancellationToken t) => Run(() => service.Resume(id, r.At, t));
    [HttpPost("{id:guid}/clock/complete")] public Task<ActionResult> Complete(Guid id, PackingClockRequest r, CancellationToken t) => Run(() => service.Complete(id, r.At, t));
    /// <summary>Working hours per job and per crew member for jobs started in the period.</summary>
    [HttpGet("working-hours")] public Task<ActionResult> WorkingHours([FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken t) => Run(() => service.WorkingHours(from, to, t));
    [HttpPut("{id:guid}/crew")] public Task<ActionResult> Crew(Guid id, PackingCrewRequest r, CancellationToken t) => Run(() => service.SaveCrew(id, r.Crew ?? [], t));
    [HttpPost("{id:guid}/boxes")] public Task<ActionResult> AddBox(Guid id, SavePackingBoxRequest r, CancellationToken t) => Run(() => service.AddBox(id, r.Command(), t));
    [HttpPut("{id:guid}/boxes/{boxId:guid}")] public Task<ActionResult> UpdateBox(Guid id, Guid boxId, SavePackingBoxRequest r, CancellationToken t) => Run(() => service.UpdateBox(id, boxId, r.Command(), t));
    [HttpDelete("{id:guid}/boxes/{boxId:guid}")] public Task<ActionResult> DeleteBox(Guid id, Guid boxId, CancellationToken t) => Run(() => service.DeleteBox(id, boxId, t));
    [HttpPost("{id:guid}/labels-printed")] public Task<ActionResult> LabelsPrinted(Guid id, PackingLabelsPrintedRequest r, CancellationToken t) => Run(() => service.LabelsPrinted(id, r.BoxIds ?? [], t));
    [HttpPut("{id:guid}/materials")] public Task<ActionResult> Materials(Guid id, PackingMaterialsRequest r, CancellationToken t) => Run(() => service.SaveMaterials(id, r.Materials ?? [], t));
    /// <summary>Creates the customer link for one purpose (SCHEDULE, LOCATION or ITEMS), replacing the previous link for it.</summary>
    [HttpPost("{id:guid}/links")] public Task<ActionResult> CreateLink(Guid id, PackingShareRequest r, CancellationToken t) => Run(async () =>
    {
        var link = await service.CreateLink(id, r.Purpose, r.ValidDays, t);
        var baseUrl = links.BaseUrl;
        return link is null ? null : new { link.Purpose, url = $"{baseUrl}/{PublicPath(link.Purpose)}/{link.Token}", link.ExpiresAtUtc };
    });
    [HttpDelete("{id:guid}/links/{purpose}")] public Task<ActionResult> RevokeLink(Guid id, string purpose, CancellationToken t) => Run(() => service.RevokeLink(id, purpose, t));

    /// <summary>Each purpose opens its own customer page.</summary>
    public static string PublicPath(string purpose) => purpose switch { "SCHEDULE" => "packing-date", "LOCATION" => "packing-location", _ => "packing-items" };
    [HttpPost("{id:guid}/transactions")] public Task<ActionResult> Transaction(Guid id, AddPackingTransactionRequest r, CancellationToken t) => Run(() => service.AddTransaction(id, r.Command(), t));

    private async Task<ActionResult> Run<T>(Func<Task<T>> action)
    {
        try { var x = await action(); return x is null ? NotFound() : Ok(x); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (OperationConflictException e) { return Conflict(new { message = e.Message }); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
    }
}

/// <summary>Anonymous customer side of the packing job link.</summary>
[ApiController, AllowAnonymous, Route("api/public/packing-jobs/{token}")]
public sealed class PublicPackingJobsController(PackingService service) : ControllerBase
{
    private const string Invalid = "This packing confirmation link is invalid or has expired.";
    [HttpGet] public Task<ActionResult> Get(string token, CancellationToken t) => Run(() => service.Shared(token, t));
    [HttpPost("schedule")] public Task<ActionResult> Schedule(string token, ConfirmPackingScheduleRequest r, CancellationToken t) => Run(() => service.ConfirmSchedule(token, new(r.ScheduledAtUtc), t));
    [HttpPost("location")] public Task<ActionResult> Location(string token, SharePackingLocationRequest r, CancellationToken t) => Run(() => service.ShareLocation(token, new(r.Latitude, r.Longitude, r.Address, r.Notes), t));
    [HttpPost("items")] public Task<ActionResult> Items(string token, RespondPackingItemsRequest r, CancellationToken t) => Run(() => service.RespondItems(token, new(r.Name, r.Confirmed, r.Notes, r.SnapshotHash), t));

    private async Task<ActionResult> Run<T>(Func<Task<T?>> action) where T : class
    {
        try { var x = await action(); return x is null ? NotFound(new { message = Invalid }) : Ok(x); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
    }
}
