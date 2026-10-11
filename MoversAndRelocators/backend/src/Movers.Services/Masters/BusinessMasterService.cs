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
 public static readonly string[] Kinds = ["crew-role", "payment-method", "payment-purpose", "expense-category", "customer", "vendor"];
 private static void CheckKind(string kind) { if (!Kinds.Contains(kind)) throw new InvalidOperationException("Unknown master type."); }
 private static IEnumerable<MasterModel> Defaults(string kind) {
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
  var existing = code is null ? null : await repository.Get(kind, code, ct);
  if (code is not null && existing is null && !Defaults(kind).Any(x => x.Code == code)) throw new KeyNotFoundException("Master record not found.");
  var prefix = kind switch { "customer" => "CUS", "vendor" => "VEN", "crew-role" => "ROLE", "payment-method" => "PAY", "payment-purpose" => "PUR", _ => "EXP" };
  code ??= await numbers.Next(prefix, ct);
  var payload = JsonSerializer.Serialize(input);
  if (existing is null) { existing = new BusinessMaster(tenant.TenantId, kind, code, payload); repository.Add(existing); } else existing.Update(payload);
  await repository.Save(ct); return Map(existing);
 }
 public async Task EnsureActive(string kind, string value, CancellationToken ct) {
  if (!(await List(kind, ct)).Any(x => x.IsActive && x.Code.Equals(value, StringComparison.OrdinalIgnoreCase))) throw new InvalidOperationException("Select an active " + kind.Replace('-', ' ') + ".");
 }
}



