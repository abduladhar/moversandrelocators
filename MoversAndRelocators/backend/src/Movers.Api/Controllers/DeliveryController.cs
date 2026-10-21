using Movers.Api.Configuration;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Delivery;
using Movers.Services.Operations;
using Movers.Services.Security;

namespace Movers.Api.Controllers;

public sealed record SaveDeliveryRequest(DateTimeOffset ScheduledAtUtc, [Range(15, 1440)] int DurationMinutes = 240, [StringLength(2000)] string? Notes = null)
{ public SaveDeliveryCommand Command() => new(ScheduledAtUtc, DurationMinutes, Notes); }
public sealed record LoadDeliveryRequest(IReadOnlyList<Guid>? WarehouseBoxIds, IReadOnlyList<DeliveryJobBoxInput>? JobBoxes);
public sealed record DeliveryCrewRequest(IReadOnlyList<DeliveryCrewInput>? Crew, Guid? DriverEmployeeId, Guid? VehicleId);
public sealed record DeliveryItemStatusRequest([Required] string Status, [StringLength(160)] string? ReceivedBy, [StringLength(500)] string? Notes);
public sealed record DeliveryNoteRequest([StringLength(160)] string? ContactName, [StringLength(40)] string? Phone, [StringLength(500)] string? Address);
public sealed record SignDeliveryNoteRequest([Required, StringLength(160)] string SignerName, [Required] string SignaturePng, [StringLength(1000)] string? Remarks, IReadOnlyList<Guid>? DeliveredItemIds);
public sealed record DeliveryTripRequest(DateTimeOffset? At = null, [StringLength(500)] string? Reason = null, [Range(0, 5000)] decimal? DistanceKm = null);
public sealed record DeliveryShareRequest([Required] string Purpose, [Range(1, 30)] int ValidDays = 7);
public sealed record RespondDeliveryDateRequest(bool Confirmed, DateTimeOffset? PreferredAtUtc);
public sealed record ShareDeliveryLocationRequest(decimal? Latitude, decimal? Longitude, [StringLength(500)] string? Address, [StringLength(500)] string? Notes);
public sealed record DeliveryDistanceRequest([Range(0, 5000)] decimal? DistanceKm);
public sealed record AddDeliveryTransactionRequest([Required] string Type, [Required, StringLength(120)] string Category, [Range(.01, 999999999)] decimal Amount, [Required, StringLength(40)] string PaymentMethod,
    [StringLength(500)] string? Notes, string? Currency = null, decimal? ExchangeRate = null, Guid? DeliveryNoteId = null, Guid? PaidByEmployeeId = null)
{ public AddDeliveryTransactionCommand Command() => new(Type, Category, Amount, PaymentMethod, Notes, Currency, ExchangeRate, DeliveryNoteId, PaidByEmployeeId); }

/// <summary>Delivery module: runs, packages from warehouse or jobs, customer delivery notes and signatures, crew, trip and money.</summary>
[ApiController, Authorize(Policy = SecurityPermissions.DeliveryManage), Route("api/delivery")]
public sealed class DeliveryController(DeliveryService service, PublicLinks links) : ControllerBase
{
    [HttpGet("masters")] public Task<ActionResult> Masters(CancellationToken t) => Run(() => service.Masters(t));
    /// <summary>Packages that can be loaded: warehouse stock, and boxes on departed or arrived transport jobs.</summary>
    [HttpGet("available")] public Task<ActionResult> Available(CancellationToken t) => Run(() => service.Available(t));
    [HttpGet] public Task<ActionResult> List(CancellationToken t) => Run(() => service.List(t));
    /// <summary>Advanced search: ?search=&amp;sort=&amp;desc=&amp;skip=&amp;take= plus status and customerState.</summary>
    [HttpGet("search")] public Task<ActionResult> Search([FromQuery] Movers.Services.Common.ListQuery query, [FromQuery] string? status, [FromQuery] string? customerState, CancellationToken t) => Run(() => service.Search(new DeliveryListFilter(status, customerState), query, t));
    [HttpPost] public Task<ActionResult> Create(SaveDeliveryRequest r, CancellationToken t) => Run(() => service.Create(r.Command(), t));
    [HttpGet("{id:guid}")] public Task<ActionResult> Get(Guid id, CancellationToken t) => Run(() => service.Get(id, t));
    [HttpPut("{id:guid}")] public Task<ActionResult> Update(Guid id, SaveDeliveryRequest r, CancellationToken t) => Run(() => service.Update(id, r.Command(), t));
    [HttpPost("{id:guid}/load")] public Task<ActionResult> Load(Guid id, LoadDeliveryRequest r, CancellationToken t) => Run(() => service.Load(id, new(r.WarehouseBoxIds, r.JobBoxes), t));
    [HttpDelete("{id:guid}/items/{itemId:guid}")] public Task<ActionResult> Unload(Guid id, Guid itemId, CancellationToken t) => Run(() => service.Unload(id, itemId, t));
    [HttpPut("{id:guid}/items/{itemId:guid}/status")] public Task<ActionResult> ItemStatus(Guid id, Guid itemId, DeliveryItemStatusRequest r, CancellationToken t) => Run(() => service.SetItemStatus(id, itemId, new(r.Status, r.ReceivedBy, r.Notes), t));
    [HttpPut("{id:guid}/notes/{noteId:guid}")] public Task<ActionResult> Note(Guid id, Guid noteId, DeliveryNoteRequest r, CancellationToken t) => Run(() => service.UpdateNote(id, noteId, new(r.ContactName, r.Phone, r.Address), t));
    [HttpPost("{id:guid}/notes/{noteId:guid}/sign"), RequestSizeLimit(1_000_000)] public Task<ActionResult> Sign(Guid id, Guid noteId, SignDeliveryNoteRequest r, CancellationToken t) => Run(() => service.Sign(id, noteId, new(r.SignerName, r.SignaturePng, r.Remarks, r.DeliveredItemIds ?? []), t));
    /// <summary>Creates a customer link for one delivery note (SCHEDULE or LOCATION), replacing the previous link for it.</summary>
    [HttpPost("{id:guid}/notes/{noteId:guid}/links")] public Task<ActionResult> CreateLink(Guid id, Guid noteId, DeliveryShareRequest r, CancellationToken t) => Run(async () =>
    {
        var link = await service.CreateLink(id, noteId, r.Purpose, r.ValidDays, t);
        var baseUrl = links.BaseUrl;
        return link is null ? null : new { link.Purpose, url = $"{baseUrl}/{(link.Purpose == "SCHEDULE" ? "delivery-date" : "delivery-location")}/{link.Token}", link.ExpiresAtUtc };
    });
    [HttpDelete("{id:guid}/notes/{noteId:guid}/links/{purpose}")] public Task<ActionResult> RevokeLink(Guid id, Guid noteId, string purpose, CancellationToken t) => Run(() => service.RevokeLink(id, noteId, purpose, t));
    [HttpPut("{id:guid}/crew")] public Task<ActionResult> Crew(Guid id, DeliveryCrewRequest r, CancellationToken t) => Run(() => service.SaveCrew(id, new(r.Crew ?? [], r.DriverEmployeeId, r.VehicleId), t));

    /* Trip: start → pause (reason) / resume → complete (distance). Times default to now. */
    [HttpPost("{id:guid}/trip/start")] public Task<ActionResult> Start(Guid id, DeliveryTripRequest r, CancellationToken t) => Run(() => service.Start(id, r.At, t));
    [HttpPost("{id:guid}/trip/pause")] public Task<ActionResult> Pause(Guid id, DeliveryTripRequest r, CancellationToken t) => Run(() => service.Pause(id, r.Reason, r.At, t));
    [HttpPost("{id:guid}/trip/resume")] public Task<ActionResult> Resume(Guid id, DeliveryTripRequest r, CancellationToken t) => Run(() => service.Resume(id, r.At, t));
    [HttpPost("{id:guid}/trip/complete")] public Task<ActionResult> Complete(Guid id, DeliveryTripRequest r, CancellationToken t) => Run(() => service.Complete(id, r.At, r.DistanceKm, t));
    [HttpPut("{id:guid}/trip/distance")] public Task<ActionResult> Distance(Guid id, DeliveryDistanceRequest r, CancellationToken t) => Run(() => service.RecordDistance(id, r.DistanceKm, t));
    [HttpPost("{id:guid}/cancel")] public Task<ActionResult> Cancel(Guid id, CancellationToken t) => Run(() => service.Cancel(id, t));
    [HttpPost("{id:guid}/transactions")] public Task<ActionResult> Transaction(Guid id, AddDeliveryTransactionRequest r, CancellationToken t) => Run(() => service.AddTransaction(id, r.Command(), t));

    private async Task<ActionResult> Run<T>(Func<Task<T>> action)
    {
        try { var x = await action(); return x is null ? NotFound() : Ok(x); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (OperationConflictException e) { return Conflict(new { message = e.Message }); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
    }
}

/// <summary>Anonymous customer side of a delivery note link: confirm the delivery date, or share the delivery location.</summary>
[ApiController, AllowAnonymous, Route("api/public/delivery-notes/{token}")]
public sealed class PublicDeliveryNotesController(DeliveryService service) : ControllerBase
{
    private const string Invalid = "This delivery link is invalid or has expired.";
    [HttpGet] public Task<ActionResult> Get(string token, CancellationToken t) => Run(() => service.Shared(token, t));
    [HttpPost("schedule")] public Task<ActionResult> Schedule(string token, RespondDeliveryDateRequest r, CancellationToken t) => Run(() => service.RespondDate(token, new(r.Confirmed, r.PreferredAtUtc), t));
    [HttpPost("location")] public Task<ActionResult> Location(string token, ShareDeliveryLocationRequest r, CancellationToken t) => Run(() => service.ShareLocation(token, new(r.Latitude, r.Longitude, r.Address, r.Notes), t));

    private async Task<ActionResult> Run<T>(Func<Task<T?>> action) where T : class
    {
        try { var x = await action(); return x is null ? NotFound(new { message = Invalid }) : Ok(x); }
        catch (InvalidOperationException e) { return BadRequest(new { message = e.Message }); }
    }
}
