using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Currencies;
using Movers.Services.Security;
using Movers.Services.Operations;
namespace Movers.Api.Controllers;
[ApiController,Authorize,Route("api/currencies")]
public sealed class CurrenciesController(CurrencyService service):ControllerBase {
 [HttpGet] public Task<IActionResult> Choices(CancellationToken ct)=>Run(()=>service.Choices(ct));
 [HttpGet("rate")] public Task<IActionResult> Rate(string currency,DateOnly date,CancellationToken ct)=>Run(()=>service.Resolve(currency,date,null,ct));
 [HttpPost,Authorize(Policy=SecurityPermissions.BillingAccounts)] public Task<IActionResult> Save(CurrencyDefinition c,CancellationToken ct)=>Run(()=>service.SaveCurrency(c,ct));
 [HttpPost("rates"),Authorize(Policy=SecurityPermissions.BillingAccounts)] public Task<IActionResult> Rate(ExchangeRate c,CancellationToken ct)=>Run(()=>service.SaveRate(c,ct));
 [HttpPost("rate-periods"),Authorize(Policy=SecurityPermissions.BillingAccounts)] public Task<IActionResult> Period(ExchangeRatePeriod c,CancellationToken ct)=>Run(()=>service.SavePeriod(c,ct));
 [HttpPost("settings"),Authorize(Policy=SecurityPermissions.BillingAccounts)] public Task<IActionResult> Settings(CurrencySettings c,CancellationToken ct)=>Run(()=>service.SaveSettings(c,ct));
 private async Task<IActionResult> Run<T>(Func<Task<T>> a){try{return Ok(await a());}catch(InvalidOperationException e){return BadRequest(new{message=e.Message});}catch(OperationConflictException e){return Conflict(new{message=e.Message});}}
}

