using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Movers.Services.Reporting;
using Movers.Api.Contracts.Tenants;
namespace Movers.Api.Tests;
public sealed partial class BillingApiTests
{
 private static string V2Layout(string text="{{title}}",string color="#111111",string src="")=>JsonSerializer.Serialize(new{
  mode="fixed",activePage=0,repeatPath="",
  pages=new[]{new{id="p1",size="A4",w=794,h=1123,margin=38,elements=new object[]{
   new{id="e1",type="text",x=10,y=10,w=200,h=24,text,color,fontFamily="Arial, sans-serif",bg="transparent"},
   new{id="e2",type="image",x=10,y=40,w=100,h=50,src}}}}
 });
 private async Task<JsonElement> GetOne(string url)=>await _client.GetFromJsonAsync<JsonElement>(url);
 [Fact]
 public async Task Report_v2_templates_default_first_save_enforce_concurrency_and_keep_history()
 {
  await LoginAndSelectTenant();
  var first=await Post("/api/report-v2/templates",new SaveReportTemplateV2(null,"INVOICE","Invoice A",V2Layout(),false));
  Assert.True(first.GetProperty("details").GetProperty("isDefault").GetBoolean());
  var second=await Post("/api/report-v2/templates",new SaveReportTemplateV2(null,"INVOICE","Invoice B",V2Layout(),false));
  Assert.False(second.GetProperty("details").GetProperty("isDefault").GetBoolean());
  Assert.Single(await Get("/api/report-v2/templates?type=INVOICE"));
  Assert.Equal(2,(await Get("/api/report-v2/templates/manage?type=INVOICE")).Count);
  var listed=await Put($"/api/report-v2/templates/{Id(second)}/flags",new ReportTemplateV2Flags(Version(second),null,true));
  Assert.Equal(2,(await Get("/api/report-v2/templates?type=INVOICE")).Count);
  Assert.Equal(HttpStatusCode.Conflict,(await _client.PutAsJsonAsync($"/api/report-v2/templates/{Id(second)}",new SaveReportTemplateV2(Version(second),"INVOICE","Stale",V2Layout(),false))).StatusCode);
  var promoted=await Put($"/api/report-v2/templates/{Id(second)}/flags",new ReportTemplateV2Flags(Version(listed),true,null));
  var rows=await Get("/api/report-v2/templates/manage?type=INVOICE");
  Assert.Equal(Id(second),Id(rows.Single(r=>r.GetProperty("details").GetProperty("isDefault").GetBoolean())));
  var edited=await Put($"/api/report-v2/templates/{Id(second)}",new SaveReportTemplateV2(Version(promoted),"INVOICE","Invoice B2",V2Layout("{{number}}"),true));
  Assert.Equal(2,edited.GetProperty("details").GetProperty("revision").GetInt32());
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.PutAsJsonAsync($"/api/report-v2/templates/{Id(second)}",new SaveReportTemplateV2(Version(edited),"BILL","Retyped",V2Layout(),false))).StatusCode);
  var copy=await Post($"/api/report-v2/templates/{Id(second)}/duplicate",new{});
  Assert.Equal("Invoice B2 (copy)",copy.GetProperty("details").GetProperty("name").GetString());
  Assert.False(copy.GetProperty("details").GetProperty("isDefault").GetBoolean());
  Assert.Equal(HttpStatusCode.OK,(await _client.DeleteAsync($"/api/report-v2/templates/{Id(first)}")).StatusCode);
  Assert.Equal(HttpStatusCode.NotFound,(await _client.GetAsync($"/api/report-v2/templates/{Id(first)}")).StatusCode);
  Assert.Equal(2,(await Get("/api/report-v2/templates/manage?type=INVOICE")).Count);
  var history=await Get($"/api/report-v2/templates/{Id(second)}/history");
  Assert.Equal(["Created","Flags changed","Flags changed","Saved"],history.Select(h=>h.GetProperty("action").GetString()).ToArray());
 }
 [Fact]
 public async Task Report_v2_templates_reject_markup_injection_and_unknown_types()
 {
  await LoginAndSelectTenant();
  var invalid=new[]{
   new SaveReportTemplateV2(null,"INVOICE","Style",V2Layout(color:"red\" onmouseover=\"alert(1)"),false),
   new SaveReportTemplateV2(null,"INVOICE","Style",V2Layout(color:"red;background:url(x)"),false),
   new SaveReportTemplateV2(null,"INVOICE","Image",V2Layout(src:"javascript:alert(1)"),false),
   new SaveReportTemplateV2(null,"INVOICE","Mode","{\"mode\":\"script\",\"pages\":[{}]}",false),
   new SaveReportTemplateV2(null,"INVOICE","Json","not json",false),
   new SaveReportTemplateV2(null,"UNKNOWN","Type",V2Layout(),false),
   new SaveReportTemplateV2(null,"INVOICE","",V2Layout(),false)
  };
  foreach(var c in invalid)Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/report-v2/templates",c)).StatusCode);
  Assert.Empty(await Get("/api/report-v2/templates/manage"));
  // Free text is escaped by the renderer, so markup typed into a text element is stored as typed.
  var saved=await Post("/api/report-v2/templates",new SaveReportTemplateV2(null,"INVOICE","Text",V2Layout("<script>literal</script>",src:"data:image/png;base64,iVBORw0KGgo="),false));
  var layout=JsonDocument.Parse(saved.GetProperty("details").GetProperty("layout").GetString()!).RootElement;
  Assert.Equal("<script>literal</script>",layout.GetProperty("pages")[0].GetProperty("elements")[0].GetProperty("text").GetString());
 }
 [Fact]
 public async Task Report_v2_print_permission_cannot_design_and_data_follows_source_permissions_and_tenant()
 {
  var f=await Setup();
  var saved=await Post("/api/report-v2/templates",new SaveReportTemplateV2(null,"PACKING_LIST","Private design",V2Layout(),false));
  var data=await GetOne($"/api/report-v2/data/PACKING_LIST?id={f.Pickup}");
  Assert.Equal(f.Pickup,data.GetProperty("pickup").GetProperty("id").GetGuid());
  Assert.False(string.IsNullOrEmpty(data.GetProperty("company").GetProperty("name").GetString()));
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync("/api/report-v2/data/PACKING_LIST")).StatusCode);
  Assert.Equal(HttpStatusCode.NotFound,(await _client.GetAsync($"/api/report-v2/data/QUOTATION?id={Guid.NewGuid()}")).StatusCode);
  var admin=_client.DefaultRequestHeaders.Authorization;
  var permissions=await Get("/api/security/permissions");
  var role=await Post("/api/security/roles",new{name="Report printer",permissionIds=permissions.Where(p=>Code(p)=="reports.print").Select(Id).ToArray()});
  var designation=await Post("/api/designations",new{code="REPORT",name="Report printer",level=1});
  var employee=await Post("/api/employees",new{employeeNumber="",firstName="Report",lastName="Printer",workEmail="printer@example.test",phone="123",joiningDate="2026-01-01",designationId=Id(designation)});
  await Post("/api/security/users",new{fullName="Report printer",email="printer@example.test",password="PrinterPass123!",roleId=Id(role),employeeId=Id(employee)});
  SetToken(await Post("/api/auth/login",new{email="printer@example.test",password="PrinterPass123!"}));
  Assert.Single(await Get("/api/report-v2/templates?type=PACKING_LIST"));
  Assert.Equal(HttpStatusCode.Forbidden,(await _client.GetAsync($"/api/report-v2/data/PACKING_LIST?id={f.Pickup}")).StatusCode);
  Assert.Equal(HttpStatusCode.Forbidden,(await _client.GetAsync("/api/report-v2/templates/manage")).StatusCode);
  Assert.Equal(HttpStatusCode.Forbidden,(await _client.GetAsync("/api/report-v2/sample/PACKING_LIST")).StatusCode);
  Assert.Equal(HttpStatusCode.Forbidden,(await _client.PostAsJsonAsync("/api/report-v2/templates",new SaveReportTemplateV2(null,"INVOICE","No access",V2Layout(),false))).StatusCode);
  Assert.Equal(HttpStatusCode.Forbidden,(await _client.PutAsJsonAsync($"/api/report-v2/templates/{Id(saved)}/flags",new ReportTemplateV2Flags(Version(saved),true,null))).StatusCode);
  Assert.Equal(HttpStatusCode.Forbidden,(await _client.DeleteAsync($"/api/report-v2/templates/{Id(saved)}")).StatusCode);
  _client.DefaultRequestHeaders.Authorization=admin;
  var other=await Post("/api/platform/tenants",new SaveTenantRequest("Other reports","other-reports",null,null,null));
  SetToken(await Post("/api/auth/select-tenant",new{tenantId=Id(other)}));
  Assert.Empty(await Get("/api/report-v2/templates/manage"));
  Assert.Equal(HttpStatusCode.NotFound,(await _client.GetAsync($"/api/report-v2/templates/{Id(saved)}")).StatusCode);
  Assert.Equal(HttpStatusCode.NotFound,(await _client.PutAsJsonAsync($"/api/report-v2/templates/{Id(saved)}",new SaveReportTemplateV2(Version(saved),"PACKING_LIST","Cross tenant",V2Layout(),false))).StatusCode);
  Assert.Equal(HttpStatusCode.NotFound,(await _client.GetAsync($"/api/report-v2/data/PACKING_LIST?id={f.Pickup}")).StatusCode);
  _client.DefaultRequestHeaders.Authorization=null;
  Assert.Equal(HttpStatusCode.Unauthorized,(await _client.GetAsync("/api/report-v2/templates?type=INVOICE")).StatusCode);
 }
 [Fact]
 public async Task Report_v2_branding_applies_to_every_report_and_is_validated()
 {
  var f=await Setup();
  var initial=await GetOne("/api/report-v2/branding");
  Assert.Equal(JsonValueKind.Null,initial.GetProperty("version").ValueKind);
  var before=await GetOne($"/api/report-v2/data/PACKING_LIST?id={f.Pickup}");
  Assert.False(string.IsNullOrEmpty(before.GetProperty("company").GetProperty("name").GetString()));
  const string logo="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  var saved=await Put("/api/report-v2/branding",new SaveReportBranding(null,new ReportBranding("Acme Movers LLC",logo,"12 Harbour Road\nDubai",null,"hello@acme.test","acme.test","TRN 123",null)));
  var data=await GetOne($"/api/report-v2/data/PACKING_LIST?id={f.Pickup}");
  var company=data.GetProperty("company");
  Assert.Equal("Acme Movers LLC",company.GetProperty("name").GetString());
  Assert.Equal(logo,company.GetProperty("logo").GetString());
  Assert.Equal("12 Harbour Road\nDubai",company.GetProperty("address").GetString());
  Assert.Equal("TRN 123",company.GetProperty("taxId").GetString());
  Assert.Equal(HttpStatusCode.Conflict,(await _client.PutAsJsonAsync("/api/report-v2/branding",new SaveReportBranding(null,new ReportBranding("Stale",null,null,null,null,null,null,null)))).StatusCode);
  foreach(var bad in new[]{new ReportBranding(null,"javascript:alert(1)",null,null,null,null,null,null),new ReportBranding(null,"data:image/svg+xml;base64,PHN2Zz4=",null,null,null,null,null,null),new ReportBranding(new string('x',201),null,null,null,null,null,null,null)})
   Assert.Equal(HttpStatusCode.BadRequest,(await _client.PutAsJsonAsync("/api/report-v2/branding",new SaveReportBranding(Version(saved),bad))).StatusCode);
  var cleared=await Put("/api/report-v2/branding",new SaveReportBranding(Version(saved),new ReportBranding(null,null,null,null,null,null,null,"Thank you for moving with us")));
  var after=await GetOne($"/api/report-v2/data/PACKING_LIST?id={f.Pickup}");
  Assert.Equal(before.GetProperty("company").GetProperty("name").GetString(),after.GetProperty("company").GetProperty("name").GetString());
  Assert.Equal("Thank you for moving with us",after.GetProperty("company").GetProperty("footerNote").GetString());
  Assert.Equal(JsonValueKind.Null,after.GetProperty("company").GetProperty("logo").ValueKind);
  Assert.Equal("Thank you for moving with us",(await GetOne("/api/report-v2/branding")).GetProperty("branding").GetProperty("footerNote").GetString());
  Assert.NotEqual(Version(saved),Version(cleared));
 }
 [Fact]
 public async Task Report_v2_sample_data_builds_for_every_report_type()
 {
  await Setup();
  var types=await Get("/api/report-v2/types");
  Assert.Equal(18+26,types.Count); // 18 documents (incl. the 2 delivery types) + 26 accounting reports
  foreach(var t in types){
   var type=t.GetProperty("type").GetString();
   var r=await _client.GetAsync($"/api/report-v2/sample/{type}");
   Assert.True(r.IsSuccessStatusCode,$"{type}: {await r.Content.ReadAsStringAsync()}");
   var data=await r.Content.ReadFromJsonAsync<JsonElement>();
   Assert.True(data.TryGetProperty("company",out _),type);
   Assert.False(string.IsNullOrEmpty(data.GetProperty("title").GetString()),type);
  }
  var pickup=await GetOne("/api/report-v2/sample/PACKING_LIST");
  Assert.True(pickup.TryGetProperty("pickup",out _));
 }
 [Fact]
 public async Task Report_v2_public_packing_exposes_default_layout_and_snapshot_for_valid_link_only()
 {
  var f=await Setup();var box=(await Get("/api/surveys/masters/box-types"))[0];
  await Put($"/api/pickups/{f.Pickup}/details",new{assignments=Array.Empty<object>(),materials=Array.Empty<object>(),packages=new[]{new{boxTypeId=Id(box),roomName="Room",items=new[]{new{itemName="Books",quantity=2}}}}});
  await Post("/api/report-v2/templates",new SaveReportTemplateV2(null,"PACKING_LIST","Packing",V2Layout("Public {{title}}"),false));
  await Post("/api/report-v2/templates",new SaveReportTemplateV2(null,"INVOICE","Private invoice",V2Layout("Invoice only"),false));
  var share=await Post($"/api/shipments/{f.Pickup}/share",new{validDays=7,leftBehindNotes="Nothing"});
  var token=share.GetProperty("url").GetString()!.Split('/').Last();
  var admin=_client.DefaultRequestHeaders.Authorization;_client.DefaultRequestHeaders.Authorization=null;
  var visible=await GetOne($"/api/public/packing/{token}/report-v2");
  Assert.Contains("Public {{title}}",visible.GetProperty("layout").GetString());
  Assert.Equal("Books",visible.GetProperty("data").GetProperty("snapshot").GetProperty("packages")[0].GetProperty("items")[0].GetProperty("itemName").GetString());
  Assert.Equal(1,visible.GetProperty("data").GetProperty("packageCount").GetInt32());
  // The customer sees the snapshot fields only, reshaped like the staff record; nothing else from the pickup.
  var pickup=visible.GetProperty("data").GetProperty("pickup");
  Assert.Equal(["pickupNumber","customerName","address"],pickup.EnumerateObject().Select(p=>p.Name).ToArray());
  Assert.Equal("Books",visible.GetProperty("data").GetProperty("packages")[0].GetProperty("items")[0].GetProperty("itemName").GetString());
  Assert.Equal(HttpStatusCode.NotFound,(await _client.GetAsync("/api/public/packing/invalid-token/report-v2")).StatusCode);
  _client.DefaultRequestHeaders.Authorization=admin;
  await Post($"/api/shipments/{f.Pickup}/revoke",new{});
  _client.DefaultRequestHeaders.Authorization=null;
  Assert.Equal(HttpStatusCode.NotFound,(await _client.GetAsync($"/api/public/packing/{token}/report-v2")).StatusCode);
 }
}
