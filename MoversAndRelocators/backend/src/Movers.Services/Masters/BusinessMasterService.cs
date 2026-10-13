using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Movers.Domain.Masters;
using Movers.Services.Numbering;
using Movers.Services.Tenancy;
namespace Movers.Services.Masters;
public sealed record MasterInput(string Name, bool IsActive = true, string? Phone = null, string? Email = null, string? Address = null, string? ContactName = null, string? TaxReference = null, string? Notes = null, string? VendorType = null, bool IsAgent = false, string? Currency = null);
public sealed record MasterModel(string Code, string Name, bool IsActive, string? Phone = null, string? Email = null, string? Address = null, string? ContactName = null, string? TaxReference = null, string? Notes = null, string? VendorType = null, bool IsAgent = false, string? Currency = null);
public interface IBusinessMasterRepository {
 Task<IReadOnlyList<BusinessMaster>> List(string kind, CancellationToken ct);
 Task<BusinessMaster?> Get(string kind, string code, CancellationToken ct);
 void Add(BusinessMaster entity);
 Task Save(CancellationToken ct);
}
public sealed class BusinessMasterService(IBusinessMasterRepository repository, ITenantContext tenant, IRecordNumbers numbers, Movers.Services.Currencies.CurrencyService currencies)
{
 public static readonly string[] Kinds = ["crew-role", "payment-method", "payment-purpose", "expense-category", "customer", "vendor", "message-template"];
 /// <summary>
 /// The wording sent with each customer link. The code is fixed because a share dialog looks its template up by it;
 /// only the text is the tenant's to change. Placeholders are filled in by the screen that sends the message, and an
 /// unknown one is left as written rather than blanked, so a typo is visible instead of silently losing a sentence.
 /// </summary>
 private static readonly MasterModel[] MessageTemplates = [
  new("SURVEY_CONFIRM", "Survey confirmation", true, Notes: "Hello {{customer}}, please confirm your moving survey {{reference}}, scheduled for {{date}}: {{link}}"),
  new("QUOTATION", "Quotation approval", true, Notes: "Hello {{customer}}, please review quotation {{reference}} for your move from {{origin}} to {{destination}}, valued at {{amount}}, and approve or reject it here: {{link}}"),
  new("LEAD_UPLOAD", "Sales lead · upload request", true, Notes: "Hello {{customer}}, please upload your moving documents, photos, videos or audio: {{link}}"),
  new("LEAD_INVENTORY", "Sales lead · moving list review", true, Notes: "Hello {{customer}}, please check your moving list and mark anything you do not need moved: {{link}}"),
  new("PICKUP_CONFIRM", "Pickup confirmation", true, Notes: "Hello {{customer}}, please confirm your pickup {{reference}}: {{link}}"),
  new("PICKUP_PACKING_LIST", "Pickup packing list", true, Notes: "Hello {{customer}}, please check and confirm your packing list for {{reference}}: {{link}}"),
  new("PACKING_DATE", "Packing date confirmation", true, Notes: "Hello {{customer}}, please confirm your packing date and time ({{reference}}): {{link}}"),
  new("PACKING_LOCATION", "Packing location request", true, Notes: "Hello {{customer}}, please share your location for packing ({{reference}}): {{link}}"),
  new("PACKING_ITEMS", "Packed items review", true, Notes: "Hello {{customer}}, please review and confirm your packed items ({{reference}}): {{link}}"),
  new("DELIVERY_DATE", "Delivery date confirmation", true, Notes: "Hello {{customer}}, please confirm your delivery date and time (delivery {{reference}}): {{link}}"),
  new("DELIVERY_LOCATION", "Delivery location request", true, Notes: "Hello {{customer}}, please share your delivery location (delivery {{reference}}): {{link}}"),
 ];
 private static void CheckKind(string kind) { if (!Kinds.Contains(kind)) throw new InvalidOperationException("Unknown master type."); }
 private static IEnumerable<MasterModel> Defaults(string kind) {
  if (kind == "message-template") return MessageTemplates;
  var pairs = kind switch {
   "crew-role" => new[] { "LEAD|Crew lead", "SUPERVISOR|Supervisor", "PACKER|Packer", "DRIVER|Driver", "HELPER|Helper", "CARPENTER|Carpenter" },
   "payment-method" => ["CASH|Cash", "UPI|UPI", "CARD|Card", "BANK|Bank transfer", "CHEQUE|Cheque"],
   "payment-purpose" => ["ADVANCE|Advance payment", "BALANCE|Balance payment", "FULL|Full payment", "PACKING|Packing charges", "ADDITIONAL|Additional charges"],
   "expense-category" => ["FUEL|Fuel / petrol", "TAXI|Taxi / cab", "METRO|Metro", "BUS|Bus", "TOLL|Toll", "PARKING|Parking", "FOOD|Food", "OTHER|Other"],
   _ => Array.Empty<string>() };
  return pairs.Select(pair => { var parts = pair.Split('|'); return new MasterModel(parts[0], parts[1], true); });
 }
 private static MasterModel Map(BusinessMaster entity) {
  var value = JsonSerializer.Deserialize<MasterInput>(entity.Payload)!;
  return new(entity.Code, value.Name, value.IsActive, value.Phone, value.Email, value.Address, value.ContactName, value.TaxReference, value.Notes, value.VendorType, value.IsAgent, value.Currency);
 }
 public async Task<IReadOnlyList<MasterModel>> List(string kind, CancellationToken ct) {
  CheckKind(kind); var values = Defaults(kind).ToDictionary(x => x.Code);
  foreach (var entity in await repository.List(kind, ct)) values[entity.Code] = Map(entity);
  return values.Values.OrderBy(x => x.Name).ToList();
 }
 public async Task<MasterModel> Save(string kind, string? code, MasterInput input, CancellationToken ct) {
  CheckKind(kind);
  if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 120) throw new InvalidOperationException("Enter a name up to 120 characters.");
  if (kind == "crew-role" && input.Name.Trim().Length > 80) throw new InvalidOperationException("Crew role names must be 80 characters or fewer.");
  if (input.Phone?.Length > 40 || input.Email?.Length > 254 || input.Address?.Length > 600 || input.ContactName?.Length > 160 || input.TaxReference?.Length > 80 || input.Notes?.Length > 2000) throw new InvalidOperationException("One or more fields exceed the allowed length.");
  if (!string.IsNullOrWhiteSpace(input.Email) && !new EmailAddressAttribute().IsValid(input.Email.Trim())) throw new InvalidOperationException("Enter a valid email or leave it blank.");
  input = input with { Name = input.Name.Trim(), Email = string.IsNullOrWhiteSpace(input.Email) ? null : input.Email.Trim() };
  if (input.VendorType?.Length > 80) throw new InvalidOperationException("Vendor type must be 80 characters or fewer.");
  input = input with { VendorType = kind == "vendor" ? input.VendorType?.Trim() : null, IsAgent = kind == "vendor" && input.IsAgent };
  if (kind is "customer" or "vendor") input = input with { Currency = (await currencies.Require(input.Currency ?? (await currencies.Settings(ct)).DefaultCurrency, ct)).Code };
  if (kind == "message-template") {
   if (code is null) throw new InvalidOperationException("Message templates cannot be added: each one belongs to a screen that sends it. Edit the wording of an existing template instead.");
   if (string.IsNullOrWhiteSpace(input.Notes)) throw new InvalidOperationException("Enter the message to send.");
   if (!input.Notes.Contains("{{link}}")) throw new InvalidOperationException("Keep {{link}} in the message: without it the customer has nothing to open.");
  }
  var existing = code is null ? null : await repository.Get(kind, code, ct);
  if (code is not null && existing is null && !Defaults(kind).Any(x => x.Code == code)) throw new KeyNotFoundException("Master record not found.");
  var prefix = kind switch { "customer" => "CUS", "vendor" => "VEN", "crew-role" => "ROLE", "payment-method" => "PAY", "payment-purpose" => "PUR", _ => "EXP" };
  code ??= await numbers.NextShared(prefix, ct);
  var payload = JsonSerializer.Serialize(input);
  if (existing is null) { existing = new BusinessMaster(tenant.TenantId, kind, code, payload); repository.Add(existing); } else existing.Update(payload);
  await repository.Save(ct); return Map(existing);
 }
 public async Task EnsureActive(string kind, string value, CancellationToken ct) {
  if (!(await List(kind, ct)).Any(x => x.IsActive && x.Code.Equals(value, StringComparison.OrdinalIgnoreCase))) throw new InvalidOperationException("Select an active " + kind.Replace('-', ' ') + ".");
 }
}



