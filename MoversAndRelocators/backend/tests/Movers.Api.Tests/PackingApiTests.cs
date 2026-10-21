using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Movers.Api.Contracts.Tenants;
namespace Movers.Api.Tests;
public sealed partial class BillingApiTests
{
 private static decimal Num(JsonElement e,string p)=>e.GetProperty(p).GetDecimal();
 private static decimal Qty(JsonElement detail,string material,bool recipe)=>detail.GetProperty("materials").EnumerateArray().Where(m=>m.GetProperty("materialName").GetString()==material&&m.GetProperty("isBoxRecipe").GetBoolean()==recipe).Sum(m=>Num(m,"quantity"));
 private async Task<JsonElement> Profit(Guid jobId)=>(await GetOne($"/api/billing/reports/operation-profitability?from=2000-01-01&to=2100-01-01&currency=BASE&sourceKind=PACKING&sourceId={jobId}"));

 [Fact]
 public async Task Packing_job_tracks_crew_boxes_labels_recipe_materials_money_and_posts_material_cost()
 {
  var f=await Setup();
  var tape=await Post("/api/surveys/masters/materials",new{code="PK_TAPE",name="Tape",unit="roll",currentUnitCost=20,description=(string?)null});
  var carton=await Post("/api/surveys/masters/materials",new{code="PK_CARTON",name="Carton sheet",unit="sheet",currentUnitCost=15,description=(string?)null});
  var medium=await Post("/api/surveys/masters/box-types",new{code="PK_MED",name="Medium carton",capacityCbm=1m,description=(string?)null,materials=new[]{new{materialId=Id(tape),quantity=1},new{materialId=Id(carton),quantity=2}}});
  var designation=await Post("/api/designations",new{code="PACKER",name="Packer",level=1});
  var packer=await Post("/api/employees",new{employeeNumber="",firstName="Pat",lastName="Packer",workEmail="pat@example.test",phone="1",joiningDate="2026-01-01",designationId=Id(designation)});

  var masters=await GetOne("/api/packing/masters");
  var recipe=masters.GetProperty("boxTypes").EnumerateArray().Single(b=>Id(b)==Id(medium)).GetProperty("recipe");
  Assert.Equal(2,recipe.GetArrayLength());
  Assert.Contains(masters.GetProperty("employees").EnumerateArray(),e=>Id(e)==Id(packer));
  var source=(await Get("/api/packing/sources")).Single(s=>Id(s)==f.Pickup);
  Assert.Equal("Billing customer",source.GetProperty("customerName").GetString());

  var job=await Post("/api/packing",new{customerName="Billing customer",phone="123",address="Origin",scheduledAtUtc=DateTimeOffset.UtcNow,pickupId=f.Pickup});
  var jobId=job.GetProperty("job").GetProperty("id").GetGuid();
  Assert.StartsWith("PK-",job.GetProperty("job").GetProperty("jobNumber").GetString());
  Assert.Equal("PLANNED",job.GetProperty("job").GetProperty("status").GetString());
  Assert.NotNull(job.GetProperty("job").GetProperty("pickupNumber").GetString());

  var crew=await Put($"/api/packing/{jobId}/crew",new{crew=new[]{new{employeeId=Id(packer),role="LEAD"}}});
  Assert.Equal("Pat Packer",crew.GetProperty("crew")[0].GetProperty("employeeName").GetString());
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.PutAsJsonAsync($"/api/packing/{jobId}/crew",new{crew=new[]{new{employeeId=Guid.NewGuid(),role="LEAD"}}})).StatusCode);

  // Two identical boxes in one step: each gets its own tracking number; recipe = 2 tape, 4 carton.
  var packed=await Post($"/api/packing/{jobId}/boxes",new{boxTypeId=Id(medium),roomName="Kitchen",isFragile=true,notes="Plates",items=new[]{new{itemName="Plates",quantity=12}},copies=2});
  var boxes=packed.GetProperty("boxes");
  Assert.Equal(2,boxes.GetArrayLength());
  Assert.NotEqual(boxes[0].GetProperty("trackingNumber").GetString(),boxes[1].GetProperty("trackingNumber").GetString());
  Assert.StartsWith("PKB-",boxes[0].GetProperty("trackingNumber").GetString());
  Assert.Equal("IN_PROGRESS",packed.GetProperty("job").GetProperty("status").GetString());
  Assert.Equal(2,packed.GetProperty("job").GetProperty("labelsPending").GetInt32());
  Assert.Equal(2m,Qty(packed,"Tape",true));Assert.Equal(4m,Qty(packed,"Carton sheet",true));

  // Editing keeps the box id and tracking number, so printed labels stay valid.
  var first=boxes[0];var firstId=Id(first);var tracking=first.GetProperty("trackingNumber").GetString();
  var edited=await Put($"/api/packing/{jobId}/boxes/{firstId}",new{boxTypeId=Id(medium),roomName="Kitchen",isFragile=true,notes="Plates and bowls",items=new[]{new{itemName="Plates",quantity=12},new{itemName="Bowls",quantity=6}}});
  var editedBox=edited.GetProperty("boxes").EnumerateArray().Single(b=>Id(b)==firstId);
  Assert.Equal(tracking,editedBox.GetProperty("trackingNumber").GetString());
  Assert.Equal(2,editedBox.GetProperty("items").GetArrayLength());

  var withExtras=await Put($"/api/packing/{jobId}/materials",new{materials=new[]{new{materialId=Id(tape),quantity=3m,unitCost=(decimal?)null}}});
  Assert.Equal(3m,Qty(withExtras,"Tape",false));Assert.Equal(2m,Qty(withExtras,"Tape",true));
  Assert.Equal(5*20m+4*15m,Num(withExtras.GetProperty("accounting"),"materialCost"));

  var printed=await Post($"/api/packing/{jobId}/labels-printed",new{boxIds=new[]{firstId}});
  Assert.Equal(1,printed.GetProperty("job").GetProperty("labelsPending").GetInt32());
  Assert.Equal(1,printed.GetProperty("boxes").EnumerateArray().Single(b=>Id(b)==firstId).GetProperty("labelPrintCount").GetInt32());

  // Materials actually used for one box replace its recipe: box 1 recipe (1 tape, 2 carton) + box 2 recorded (0.5 tape, 3 carton).
  var secondId=Id(boxes[1]);
  var custom=await Put($"/api/packing/{jobId}/boxes/{secondId}",new{boxTypeId=Id(medium),roomName="Kitchen",isFragile=true,items=new[]{new{itemName="Plates",quantity=12}},materials=new[]{new{materialId=Id(tape),quantity=.5m},new{materialId=Id(carton),quantity=3m}}});
  var customBox=custom.GetProperty("boxes").EnumerateArray().Single(b=>Id(b)==secondId);
  Assert.True(customBox.GetProperty("customMaterials").GetBoolean());
  Assert.Equal(2,customBox.GetProperty("materials").GetArrayLength());
  Assert.Equal(1.5m,Qty(custom,"Tape",true));Assert.Equal(5m,Qty(custom,"Carton sheet",true));
  Assert.False(custom.GetProperty("boxes").EnumerateArray().Single(b=>Id(b)==firstId).GetProperty("customMaterials").GetBoolean());
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.PutAsJsonAsync($"/api/packing/{jobId}/boxes/{secondId}",new{boxTypeId=Id(medium),items=new[]{new{itemName="Plates",quantity=1}},materials=new[]{new{materialId=Id(tape),quantity=0m}}})).StatusCode);

  var deleted=await _client.DeleteAsync($"/api/packing/{jobId}/boxes/{Id(boxes[1])}");
  var afterDelete=await deleted.Content.ReadFromJsonAsync<JsonElement>();
  Assert.Equal(1,afterDelete.GetProperty("boxes").GetArrayLength());
  Assert.Equal(1m,Qty(afterDelete,"Tape",true));Assert.Equal(2m,Qty(afterDelete,"Carton sheet",true));
  Assert.Equal(0,afterDelete.GetProperty("job").GetProperty("labelsPending").GetInt32());

  // Income and expense: FX snapshot per transaction and both reach the accountant's cash queue as PACKING.
  var income=await Post($"/api/packing/{jobId}/transactions",new{type="INCOME",category="Advance",amount=500m,paymentMethod="CASH",currency="INR",notes="Advance"});
  var expense=await Post($"/api/packing/{jobId}/transactions",new{type="EXPENSE",category="FUEL",amount=120m,paymentMethod="CASH",currency="INR",notes="Van fuel"});
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync($"/api/packing/{jobId}/transactions",new{type="EXPENSE",category="NOT_A_CATEGORY",amount=10m,paymentMethod="CASH",currency="INR"})).StatusCode);
  var txs=expense.GetProperty("transactions");
  Assert.Equal(2,txs.GetArrayLength());
  Assert.All(txs.EnumerateArray(),x=>{Assert.Equal("INR",x.GetProperty("currency").GetString());Assert.StartsWith("PKT-",x.GetProperty("transactionNumber").GetString());});
  Assert.Contains(expense.GetProperty("accounting").GetProperty("totals").EnumerateArray(),x=>x.GetProperty("currency").GetString()=="INR"&&Num(x,"income")==500m&&Num(x,"expense")==120m);
  var queue=(await Get("/api/billing/cash")).Where(x=>x.GetProperty("details").GetProperty("sourceKind").GetString()=="PACKING"&&x.GetProperty("details").GetProperty("sourceId").GetGuid()==jobId).ToList();
  Assert.Equal(["EXPENSE_PAID","RECEIPT"],queue.Select(x=>x.GetProperty("details").GetProperty("type").GetString()).OrderBy(x=>x).ToArray());
  var sources=(await GetOne("/api/billing/choices")).GetProperty("sources");
  Assert.Contains(sources.EnumerateArray(),s=>s.GetProperty("kind").GetString()=="PACKING"&&Id(s)==jobId);

  // Completing posts Dr 5100 / Cr 1300 for the material cost and locks the job.
  var cost=1*20m+3*20m+2*15m;
  var completed=await Put($"/api/packing/{jobId}/status",new{status="COMPLETED"});
  Assert.True(completed.GetProperty("accounting").GetProperty("materialPosted").GetBoolean());
  Assert.Equal(cost,Num(completed.GetProperty("accounting"),"materialCost"));
  var profit=await Profit(jobId);
  Assert.Equal(cost,Num(profit.GetProperty("totals"),"expense"));
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync($"/api/packing/{jobId}/boxes",new{boxTypeId=Id(medium),items=Array.Empty<object>()})).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.PutAsJsonAsync($"/api/packing/{jobId}/materials",new{materials=Array.Empty<object>()})).StatusCode);

  // Reopening reverses the material journal, so the operation nets to zero material cost.
  var reopened=await Put($"/api/packing/{jobId}/status",new{status="IN_PROGRESS"});
  Assert.False(reopened.GetProperty("accounting").GetProperty("materialPosted").GetBoolean());
  Assert.Equal(0m,Num((await Profit(jobId)).GetProperty("totals"),"expense"));
  await Put($"/api/packing/{jobId}/status",new{status="COMPLETED"});
  Assert.Equal(cost,Num((await Profit(jobId)).GetProperty("totals"),"expense"));

  // Report Engine: labels only for the selected boxes, receipt for a transaction.
  var labels=await GetOne($"/api/report-v2/data/PACKING_LABELS?id={jobId}&boxIds={firstId}");
  Assert.Equal(1,labels.GetProperty("boxes").GetArrayLength());
  Assert.Equal(tracking,labels.GetProperty("boxes")[0].GetProperty("trackingNumber").GetString());
  Assert.Equal(1,labels.GetProperty("boxes")[0].GetProperty("boxCount").GetInt32());
  var receipt=await GetOne($"/api/report-v2/data/PACKING_RECEIPT?id={jobId}&transactionId={Id(income.GetProperty("transactions").EnumerateArray().Single(x=>x.GetProperty("type").GetString()=="INCOME"))}");
  Assert.Equal(500m,Num(receipt.GetProperty("payment"),"amount"));
  Assert.Equal(18,(await GetOne($"/api/report-v2/data/PACKING_SHEET?id={jobId}")).GetProperty("itemCount").GetInt32());

  var list=await Get("/api/packing");
  Assert.Equal("COMPLETED",list.Single(x=>Id(x)==jobId).GetProperty("status").GetString());
  // The register's server search returns the same row (references, box counts, labels, clock loaded for the page only).
  var found=await GetOne("/api/packing/search?search=billing%20origin&status=COMPLETED");
  Assert.Equal(1,found.GetProperty("total").GetInt32());
  Assert.Equal(list.Single(x=>Id(x)==jobId).GetRawText(),found.GetProperty("items")[0].GetRawText());
  Assert.Equal(0,(await GetOne("/api/packing/search?search=billing&status=PLANNED")).GetProperty("total").GetInt32());
 }

 [Fact]
 public async Task Customer_confirms_date_shares_location_and_confirms_items_through_separate_links()
 {
  await LoginAndSelectTenant();
  var box=await Post("/api/surveys/masters/box-types",new{code="PK_CUST",name="Customer carton",capacityCbm=1m,description=(string?)null,materials=Array.Empty<object>()});
  var job=await Post("/api/packing",new{customerName="Link customer",phone="+971 50 123",address="Old address",scheduledAtUtc=DateTimeOffset.UtcNow.AddDays(2)});
  var jobId=job.GetProperty("job").GetProperty("id").GetGuid();
  Assert.Equal(0,job.GetProperty("customer").GetProperty("links").GetArrayLength());
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync($"/api/packing/{jobId}/links",new{purpose="SCHEDULE",validDays=31})).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync($"/api/packing/{jobId}/links",new{purpose="OTHER",validDays=7})).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync($"/api/packing/{jobId}/links",new{purpose="ITEMS",validDays=7})).StatusCode);
  static string Token(JsonElement link)=>link.GetProperty("url").GetString()!.Split('/')[^1];
  var dateLink=await Post($"/api/packing/{jobId}/links",new{purpose="SCHEDULE",validDays=7});
  var locationLink=await Post($"/api/packing/{jobId}/links",new{purpose="LOCATION",validDays=7});
  Assert.Contains("/packing-date/",dateLink.GetProperty("url").GetString());
  Assert.Contains("/packing-location/",locationLink.GetProperty("url").GetString());
  var dateToken=Token(dateLink);var locationToken=Token(locationLink);
  Assert.NotEqual(dateToken,locationToken);

  using var customer=_factory.CreateClient();
  var page=await customer.GetFromJsonAsync<JsonElement>($"/api/public/packing-jobs/{dateToken}");
  Assert.Equal("SCHEDULE",page.GetProperty("purpose").GetString());
  Assert.Equal(0,page.GetProperty("boxes").GetArrayLength());
  Assert.Equal(HttpStatusCode.NotFound,(await customer.GetAsync("/api/public/packing-jobs/not-a-token")).StatusCode);

  // Date link: confirms the date only; it cannot be used to share a location.
  var when=DateTimeOffset.UtcNow.AddDays(3);
  Assert.Equal(HttpStatusCode.BadRequest,(await customer.PostAsJsonAsync($"/api/public/packing-jobs/{dateToken}/schedule",new{scheduledAtUtc=DateTimeOffset.UtcNow.AddDays(-2)})).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await customer.PostAsJsonAsync($"/api/public/packing-jobs/{dateToken}/location",new{latitude=25.2m,longitude=55.27m})).StatusCode);
  var confirmed=await (await customer.PostAsJsonAsync($"/api/public/packing-jobs/{dateToken}/schedule",new{scheduledAtUtc=when})).Content.ReadFromJsonAsync<JsonElement>();
  Assert.NotEqual(JsonValueKind.Null,confirmed.GetProperty("scheduleConfirmedAtUtc").ValueKind);

  // Location link: GPS is required; address and directions are optional.
  Assert.Equal(HttpStatusCode.BadRequest,(await customer.PostAsJsonAsync($"/api/public/packing-jobs/{locationToken}/location",new{latitude=95m,longitude=55.27m})).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await customer.PostAsJsonAsync($"/api/public/packing-jobs/{locationToken}/schedule",new{scheduledAtUtc=when})).StatusCode);
  var located=await (await customer.PostAsJsonAsync($"/api/public/packing-jobs/{locationToken}/location",new{latitude=25.2048493m,longitude=55.2707828m,address="Villa 12, Dubai",notes="Gate 3, blue door"})).Content.ReadFromJsonAsync<JsonElement>();
  Assert.Equal("Villa 12, Dubai",located.GetProperty("address").GetString());
  Assert.Equal(25.204849m,located.GetProperty("latitude").GetDecimal());
  var staff=await GetOne($"/api/packing/{jobId}");
  var c=staff.GetProperty("customer");
  Assert.NotEqual(JsonValueKind.Null,c.GetProperty("scheduleConfirmedAtUtc").ValueKind);
  Assert.Equal("Gate 3, blue door",c.GetProperty("locationNotes").GetString());
  Assert.Equal(2,c.GetProperty("links").GetArrayLength());

  // Items link: needs packed boxes; the response is bound to the exact list reviewed.
  var packed=await Post($"/api/packing/{jobId}/boxes",new{boxTypeId=Id(box),roomName="Kitchen",isFragile=false,items=new[]{new{itemName="Plates",quantity=6}}});
  var boxId=Id(packed.GetProperty("boxes")[0]);
  var itemsToken=Token(await Post($"/api/packing/{jobId}/links",new{purpose="ITEMS",validDays=7}));
  Assert.Equal(0,(await customer.GetFromJsonAsync<JsonElement>($"/api/public/packing-jobs/{locationToken}")).GetProperty("boxes").GetArrayLength());
  page=await customer.GetFromJsonAsync<JsonElement>($"/api/public/packing-jobs/{itemsToken}");
  Assert.Equal("ITEMS",page.GetProperty("purpose").GetString());
  Assert.Equal("Plates",page.GetProperty("boxes")[0].GetProperty("items")[0].GetProperty("itemName").GetString());
  var hash=page.GetProperty("itemsHash").GetString();
  Assert.Equal(HttpStatusCode.BadRequest,(await customer.PostAsJsonAsync($"/api/public/packing-jobs/{dateToken}/items",new{name="Customer",confirmed=true,snapshotHash=hash})).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await customer.PostAsJsonAsync($"/api/public/packing-jobs/{itemsToken}/items",new{name="Customer",confirmed=true,snapshotHash="stale"})).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await customer.PostAsJsonAsync($"/api/public/packing-jobs/{itemsToken}/items",new{name="Customer",confirmed=false,snapshotHash=hash})).StatusCode);
  var responded=await (await customer.PostAsJsonAsync($"/api/public/packing-jobs/{itemsToken}/items",new{name="Link Customer",confirmed=true,notes="All good",snapshotHash=hash})).Content.ReadFromJsonAsync<JsonElement>();
  Assert.Equal("CONFIRMED",responded.GetProperty("itemsResponse").GetString());
  Assert.True(responded.GetProperty("itemsResponseCurrent").GetBoolean());
  Assert.Equal(HttpStatusCode.BadRequest,(await customer.PostAsJsonAsync($"/api/public/packing-jobs/{itemsToken}/items",new{name="Again",confirmed=true,snapshotHash=hash})).StatusCode);

  // Changing boxes makes the confirmation outdated; the customer can respond to the new list.
  var changed=await Put($"/api/packing/{jobId}/boxes/{boxId}",new{boxTypeId=Id(box),roomName="Kitchen",isFragile=false,items=new[]{new{itemName="Plates",quantity=8}}});
  Assert.False(changed.GetProperty("customer").GetProperty("itemsResponseCurrent").GetBoolean());
  page=await customer.GetFromJsonAsync<JsonElement>($"/api/public/packing-jobs/{itemsToken}");
  var corrections=await (await customer.PostAsJsonAsync($"/api/public/packing-jobs/{itemsToken}/items",new{name="Link Customer",confirmed=false,notes="Only 7 plates",snapshotHash=page.GetProperty("itemsHash").GetString()})).Content.ReadFromJsonAsync<JsonElement>();
  Assert.Equal("CORRECTIONS",corrections.GetProperty("itemsResponse").GetString());

  // A new date link replaces the old one; an office date change asks for confirmation again; revoking kills one link only.
  var newDateToken=Token(await Post($"/api/packing/{jobId}/links",new{purpose="SCHEDULE",validDays=3}));
  Assert.Equal(HttpStatusCode.NotFound,(await customer.GetAsync($"/api/public/packing-jobs/{dateToken}")).StatusCode);
  Assert.Equal(HttpStatusCode.OK,(await customer.GetAsync($"/api/public/packing-jobs/{newDateToken}")).StatusCode);
  var edited=await Put($"/api/packing/{jobId}",new{customerName="Link customer",phone="+971 50 123",address="Villa 12, Dubai",scheduledAtUtc=when.AddDays(1)});
  Assert.Equal(JsonValueKind.Null,edited.GetProperty("customer").GetProperty("scheduleConfirmedAtUtc").ValueKind);
  var revoked=await (await _client.DeleteAsync($"/api/packing/{jobId}/links/location")).Content.ReadFromJsonAsync<JsonElement>();
  Assert.DoesNotContain(revoked.GetProperty("customer").GetProperty("links").EnumerateArray(),l=>l.GetProperty("purpose").GetString()=="LOCATION");
  Assert.Equal(HttpStatusCode.NotFound,(await customer.GetAsync($"/api/public/packing-jobs/{locationToken}")).StatusCode);
  Assert.Equal(HttpStatusCode.OK,(await customer.GetAsync($"/api/public/packing-jobs/{itemsToken}")).StatusCode);
 }

 [Fact]
 public async Task Packing_clock_starts_pauses_with_reason_resumes_completes_and_reports_working_hours()
 {
  await LoginAndSelectTenant();
  var box=await Post("/api/surveys/masters/box-types",new{code="PK_CLOCK",name="Clock carton",capacityCbm=1m,description=(string?)null,materials=Array.Empty<object>()});
  var designation=await Post("/api/designations",new{code="CLKPACK",name="Packer",level=1});
  var lead=await Post("/api/employees",new{employeeNumber="",firstName="Lia",lastName="Lead",workEmail="lia.clock@example.test",phone="1",joiningDate="2026-01-01",designationId=Id(designation)});
  var helper=await Post("/api/employees",new{employeeNumber="",firstName="Hal",lastName="Helper",workEmail="hal.clock@example.test",phone="2",joiningDate="2026-01-01",designationId=Id(designation)});
  var job=await Post("/api/packing",new{customerName="Clock customer",phone="1",address="Home",scheduledAtUtc=DateTimeOffset.UtcNow});
  var jobId=job.GetProperty("job").GetProperty("id").GetGuid();
  await Put($"/api/packing/{jobId}/crew",new{crew=new[]{new{employeeId=Id(lead),role="Lead"},new{employeeId=Id(helper),role="Packer"}}});
  var t0=DateTimeOffset.UtcNow.AddHours(-5);
  async Task<HttpStatusCode> Step(string step,object body)=>(await _client.PostAsJsonAsync($"/api/packing/{jobId}/clock/{step}",body)).StatusCode;

  Assert.Equal(HttpStatusCode.BadRequest,await Step("pause",new{reason="Lunch"}));
  Assert.Equal(HttpStatusCode.BadRequest,await Step("start",new{at=DateTimeOffset.UtcNow.AddHours(2)}));
  var started=await Post($"/api/packing/{jobId}/clock/start",new{at=t0});
  Assert.Equal("IN_PROGRESS",started.GetProperty("job").GetProperty("status").GetString());
  Assert.Equal(HttpStatusCode.BadRequest,await Step("start",new{}));
  Assert.Equal(HttpStatusCode.BadRequest,await Step("pause",new{reason=" ",at=t0.AddHours(1)}));
  Assert.Equal(HttpStatusCode.BadRequest,await Step("pause",new{reason="Lunch break",at=t0.AddHours(-1)}));
  var paused=await Post($"/api/packing/{jobId}/clock/pause",new{reason="Lunch break",at=t0.AddHours(1)});
  Assert.True(paused.GetProperty("clock").GetProperty("isPaused").GetBoolean());
  Assert.Equal(HttpStatusCode.BadRequest,await Step("pause",new{reason="Again",at=t0.AddHours(1.5)}));
  await Post($"/api/packing/{jobId}/clock/resume",new{at=t0.AddHours(2)});
  Assert.Equal(HttpStatusCode.BadRequest,await Step("resume",new{at=t0.AddHours(2.5)}));
  Assert.Equal(HttpStatusCode.BadRequest,await Step("complete",new{at=t0.AddHours(4)}));
  await Post($"/api/packing/{jobId}/boxes",new{boxTypeId=Id(box),isFragile=false,items=new[]{new{itemName="Books",quantity=10}}});
  var done=await Post($"/api/packing/{jobId}/clock/complete",new{at=t0.AddHours(4)});
  Assert.Equal("COMPLETED",done.GetProperty("job").GetProperty("status").GetString());
  var c=done.GetProperty("clock");
  Assert.Equal(3*3600,c.GetProperty("workingSeconds").GetInt64());
  Assert.Equal(3600,c.GetProperty("pausedSeconds").GetInt64());
  Assert.Equal(2*3*3600,c.GetProperty("crewSeconds").GetInt64());
  Assert.Equal(new[]{"STARTED","PAUSED","RESUMED","COMPLETED"},c.GetProperty("events").EnumerateArray().Select(e=>e.GetProperty("type").GetString()).ToArray());
  Assert.Equal("Lunch break",c.GetProperty("events")[1].GetProperty("reason").GetString());
  Assert.Equal(3*3600,(await Get("/api/packing")).Single(x=>Id(x)==jobId).GetProperty("workingSeconds").GetInt64());
  Assert.Equal(3*3600,(await GetOne("/api/packing/search?search=clock")).GetProperty("items")[0].GetProperty("workingSeconds").GetInt64());

  // Reopen continues the clock from the reopen time; the gap while completed is not counted.
  var reopened=await Put($"/api/packing/{jobId}/status",new{status="IN_PROGRESS",at=t0.AddHours(4.5)});
  Assert.Equal("REOPENED",reopened.GetProperty("clock").GetProperty("events")[4].GetProperty("type").GetString());
  var again=await Put($"/api/packing/{jobId}/status",new{status="COMPLETED",at=t0.AddHours(5)});
  Assert.Equal(3.5*3600,again.GetProperty("clock").GetProperty("workingSeconds").GetInt64());

  var today=DateOnly.FromDateTime(DateTime.UtcNow);
  var hours=await GetOne($"/api/packing/working-hours?from={today.AddDays(-1):yyyy-MM-dd}&to={today:yyyy-MM-dd}");
  var row=hours.GetProperty("jobs").EnumerateArray().Single(x=>Id(x)==jobId);
  Assert.Equal(3.5*3600,row.GetProperty("workingSeconds").GetInt64());
  Assert.Equal(7*3600,row.GetProperty("crewSeconds").GetInt64());
  var people=hours.GetProperty("employees").EnumerateArray().ToList();
  Assert.Equal(2,people.Count);
  Assert.All(people,p=>Assert.Equal(3.5*3600,p.GetProperty("seconds").GetInt64()));
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync($"/api/packing/working-hours?from={today:yyyy-MM-dd}&to={today.AddDays(-3):yyyy-MM-dd}")).StatusCode);
 }

 [Fact]
 public async Task Expense_receipts_can_be_photographed_or_attached_listed_downloaded_and_removed()
 {
  await LoginAndSelectTenant();
  var job=await Post("/api/packing",new{customerName="Receipt customer",phone="1",address="Home",scheduledAtUtc=DateTimeOffset.UtcNow});
  var jobId=job.GetProperty("job").GetProperty("id").GetGuid();
  var withMoney=await Post($"/api/packing/{jobId}/transactions",new{type="EXPENSE",category="FUEL",amount=40m,paymentMethod="CASH",notes="Diesel",currency="AED",exchangeRate=0.2723m});
  withMoney=await Post($"/api/packing/{jobId}/transactions",new{type="INCOME",category="ADVANCE",amount=100m,paymentMethod="CASH",currency="AED",exchangeRate=0.2723m});
  var txs=withMoney.GetProperty("transactions").EnumerateArray().ToList();
  var expenseId=Id(txs.Single(x=>x.GetProperty("type").GetString()=="EXPENSE"));
  var incomeId=Id(txs.Single(x=>x.GetProperty("type").GetString()=="INCOME"));
  object Photo(long size,string type="image/jpeg")=>new{fileName="fuel receipt.jpg",contentType=type,sizeBytes=size};

  // Only real expenses of a known kind, and only receipt-like files up to 25 MB.
  Assert.Equal(HttpStatusCode.NotFound,(await _client.PostAsJsonAsync($"/api/expense-receipts/PACKING/{incomeId}/upload-requests",Photo(3))).StatusCode);
  Assert.Equal(HttpStatusCode.NotFound,(await _client.PostAsJsonAsync($"/api/expense-receipts/PACKING/{Guid.NewGuid()}/upload-requests",Photo(3))).StatusCode);
  Assert.Equal(HttpStatusCode.NotFound,(await _client.PostAsJsonAsync($"/api/expense-receipts/OTHER/{expenseId}/upload-requests",Photo(3))).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync($"/api/expense-receipts/PACKING/{expenseId}/upload-requests",Photo(3,"video/mp4"))).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync($"/api/expense-receipts/PACKING/{expenseId}/upload-requests",Photo(26L*1024*1024))).StatusCode);

  var upload=await Post($"/api/expense-receipts/packing/{expenseId}/upload-requests",Photo(3));
  var receiptId=upload.GetProperty("attachmentId").GetGuid();
  Assert.Empty(await Get($"/api/expense-receipts?ids={expenseId}"));
  (await _client.PutAsync(upload.GetProperty("uploadUrl").GetString(),new ByteArrayContent([1,2,3]))).EnsureSuccessStatusCode();
  var done=await Post($"/api/expense-receipts/{receiptId}/complete",new{});
  Assert.Equal("PACKING",done.GetProperty("kind").GetString());
  var listed=await Get($"/api/expense-receipts?ids={expenseId},{incomeId}");
  Assert.Equal("fuel_receipt.jpg",Assert.Single(listed).GetProperty("originalFileName").GetString());
  Assert.False(string.IsNullOrEmpty((await GetOne($"/api/expense-receipts/{receiptId}/download")).GetProperty("url").GetString()));
  Assert.Single((await (await _client.PostAsJsonAsync("/api/expense-receipts/query",new{expenseIds=new[]{expenseId,incomeId}})).Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray());

  // The receipt also shows against the same id in the accountant's cash queue.
  Assert.Contains(await Get("/api/billing/cash"),x=>Id(x)==expenseId);

  Assert.Equal(HttpStatusCode.OK,(await _client.DeleteAsync($"/api/expense-receipts/{receiptId}")).StatusCode);
  Assert.Empty(await Get($"/api/expense-receipts?ids={expenseId}"));
  Assert.Equal(HttpStatusCode.NotFound,(await _client.GetAsync($"/api/expense-receipts/{receiptId}/download")).StatusCode);
 }

 [Fact]
 public async Task Packing_requires_its_permission_and_is_tenant_isolated()
 {
  await LoginAndSelectTenant();
  var job=await Post("/api/packing",new{customerName="Private",phone="1",address="Home",scheduledAtUtc=DateTimeOffset.UtcNow});
  var jobId=job.GetProperty("job").GetProperty("id").GetGuid();
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.PutAsJsonAsync($"/api/packing/{jobId}/status",new{status="COMPLETED"})).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.PutAsJsonAsync($"/api/packing/{jobId}/status",new{status="SHIPPED"})).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/packing",new{customerName="",phone="1",address="x",scheduledAtUtc=DateTimeOffset.UtcNow})).StatusCode);
  var admin=_client.DefaultRequestHeaders.Authorization;
  var permissions=await Get("/api/security/permissions");
  Assert.Contains(permissions,p=>Code(p)=="packing.manage");
  var role=await Post("/api/security/roles",new{name="Viewer",permissionIds=permissions.Where(p=>Code(p)=="reports.print").Select(Id).ToArray()});
  var designation=await Post("/api/designations",new{code="VIEW",name="Viewer",level=1});
  var employee=await Post("/api/employees",new{employeeNumber="",firstName="No",lastName="Packing",workEmail="nopack@example.test",phone="1",joiningDate="2026-01-01",designationId=Id(designation)});
  await Post("/api/security/users",new{fullName="No packing",email="nopack@example.test",password="NoPackPass123!",roleId=Id(role),employeeId=Id(employee)});
  SetToken(await Post("/api/auth/login",new{email="nopack@example.test",password="NoPackPass123!"}));
  Assert.Equal(HttpStatusCode.Forbidden,(await _client.GetAsync("/api/packing")).StatusCode);
  Assert.Equal(HttpStatusCode.Forbidden,(await _client.GetAsync($"/api/report-v2/data/PACKING_LABELS?id={jobId}")).StatusCode);
  _client.DefaultRequestHeaders.Authorization=admin;
  var other=await Post("/api/platform/tenants",new SaveTenantRequest("Other packing","other-packing",null,null,null));
  SetToken(await Post("/api/auth/select-tenant",new{tenantId=Id(other)}));
  Assert.Empty(await Get("/api/packing"));
  Assert.Equal(HttpStatusCode.NotFound,(await _client.GetAsync($"/api/packing/{jobId}")).StatusCode);
 }
}
