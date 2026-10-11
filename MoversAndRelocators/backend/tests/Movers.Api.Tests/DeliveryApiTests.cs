using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
namespace Movers.Api.Tests;
public sealed partial class BillingApiTests
{
 private static string Str(JsonElement e,string p)=>e.GetProperty(p).GetString()!;
 private static IEnumerable<string> StockTracking(JsonElement available)=>available.GetProperty("warehouse").EnumerateArray().Select(x=>Str(x,"trackingNumber"));

 [Fact]
 public async Task Delivery_loads_from_warehouse_and_jobs_signs_customer_notes_and_returns_undelivered_boxes()
 {
  await Setup();
  // Second customer with two boxes in the warehouse; one of them goes onto a road job that departs.
  var second=await Post("/api/business-masters/customer",new{name="Second customer",address="Second address"});
  var wh=(await Get("/api/pickups/warehouses")).First();
  var receipt=await Post("/api/warehouse/receive-office",new{requestId=Guid.NewGuid(),customerCode=Code(second),warehouseId=Id(wh),deliveredBy="Owner",receivedBy="Keeper",
   boxes=new[]{new{description="Sofa",condition="Good",contents="Sofa",contentsChecked=true},new{description="Lamp",condition="Good",contents="Lamp",contentsChecked=true}}});
  var stock=await Get1("/api/delivery/available");
  var all=stock.GetProperty("warehouse").EnumerateArray().ToList();
  var firstBox=all.Single(x=>Str(x,"customerName")=="Billing customer");
  var sofa=all.Single(x=>Str(x,"description")=="Sofa");var lamp=all.Single(x=>Str(x,"description")=="Lamp");

  var road=await Post("/api/jobs",new{requestId=Guid.NewGuid(),details=new{mode="ROAD",originPort="DXB",destinationPort="AUH",truckNumber="T-1",driverName="Road driver"}});
  road=await Post($"/api/jobs/{Id(road)}/load",new{expectedVersion=Version(road),boxIds=new[]{Id(sofa)},loadedBy="Keeper"});
  road=await Post($"/api/jobs/{Id(road)}/actions/depart",new{expectedVersion=Version(road)});

  // A box on a job is no longer warehouse stock: it can only be loaded from the job.
  stock=await Get1("/api/delivery/available");
  Assert.DoesNotContain(Str(sofa,"trackingNumber"),StockTracking(stock));
  var jobBox=stock.GetProperty("jobs").EnumerateArray().Single(x=>x.GetProperty("box").GetProperty("id").GetGuid()==Id(sofa));
  Assert.Equal("IN_TRANSIT",Str(jobBox,"jobStatus"));

  var created=await Post("/api/delivery",new{scheduledAtUtc=DateTimeOffset.UtcNow,durationMinutes=180,notes="Morning run"});
  var id=created.GetProperty("job").GetProperty("id").GetGuid();
  Assert.StartsWith("DL-",created.GetProperty("job").GetProperty("deliveryNumber").GetString());
  Assert.Equal(HttpStatusCode.Conflict,(await _client.PostAsJsonAsync($"/api/delivery/{id}/load",new{warehouseBoxIds=new[]{Id(sofa)}})).StatusCode);

  var loaded=await Post($"/api/delivery/{id}/load",new{warehouseBoxIds=new[]{Id(firstBox),Id(lamp)},jobBoxes=new[]{new{jobId=Id(road),boxId=Id(sofa)}}});
  var notes=loaded.GetProperty("notes").EnumerateArray().ToList();
  Assert.Equal(2,notes.Count);
  var billingNote=notes.Single(n=>Str(n,"customerName")=="Billing customer");var secondNote=notes.Single(n=>Str(n,"customerName")=="Second customer");
  Assert.StartsWith("DN-",Str(billingNote,"noteNumber"));
  Assert.Equal(2,secondNote.GetProperty("items").GetArrayLength());
  Assert.Contains(secondNote.GetProperty("items").EnumerateArray(),i=>Str(i,"source")=="JOB"&&Str(i,"reference")==Str(road,"jobNumber"));
  // Loaded boxes leave warehouse stock and the job list, and cannot go on a second delivery.
  stock=await Get1("/api/delivery/available");
  Assert.DoesNotContain(Str(lamp,"trackingNumber"),StockTracking(stock));
  Assert.Empty(stock.GetProperty("jobs").EnumerateArray());
  var other=await Post("/api/delivery",new{scheduledAtUtc=DateTimeOffset.UtcNow.AddDays(3),durationMinutes=60});
  Assert.Equal(HttpStatusCode.Conflict,(await _client.PostAsJsonAsync($"/api/delivery/{other.GetProperty("job").GetProperty("id").GetGuid()}/load",new{warehouseBoxIds=new[]{Id(lamp)}})).StatusCode);

  // Customer links: the second customer asks for another time, then shares their location. A link only serves its own purpose.
  var dateLink=await Post($"/api/delivery/{id}/notes/{Id(secondNote)}/links",new{purpose="SCHEDULE",validDays=7});
  Assert.Contains("/delivery-date/",Str(dateLink,"url"));
  var locationLink=await Post($"/api/delivery/{id}/notes/{Id(secondNote)}/links",new{purpose="LOCATION",validDays=7});
  var customer=_factory.CreateClient();
  var dateToken=Str(dateLink,"url").Split('/').Last();var locationToken=Str(locationLink,"url").Split('/').Last();
  var shared=await customer.GetFromJsonAsync<JsonElement>($"/api/public/delivery-notes/{dateToken}");
  Assert.Equal("Second customer",Str(shared,"customerName"));Assert.Equal(2,shared.GetProperty("packageCount").GetInt32());
  Assert.False(shared.TryGetProperty("items",out _));
  Assert.Equal(HttpStatusCode.BadRequest,(await customer.PostAsJsonAsync($"/api/public/delivery-notes/{dateToken}/location",new{latitude=25.2m,longitude=55.3m})).StatusCode);
  var preferred=DateTimeOffset.UtcNow.AddDays(2);
  var answered=await (await customer.PostAsJsonAsync($"/api/public/delivery-notes/{dateToken}/schedule",new{confirmed=false,preferredAtUtc=preferred})).Content.ReadFromJsonAsync<JsonElement>();
  Assert.Equal("RESCHEDULE",Str(answered,"dateResponse"));Assert.True(answered.GetProperty("dateResponseCurrent").GetBoolean());
  await customer.PostAsJsonAsync($"/api/public/delivery-notes/{locationToken}/location",new{latitude=25.204849m,longitude=55.270783m,address="Villa 9, Jumeirah",notes="Blue gate"});
  var withCustomer=(await Get1($"/api/delivery/{id}")).GetProperty("notes").EnumerateArray().Single(n=>Id(n)==Id(secondNote));
  Assert.Equal("Villa 9, Jumeirah",Str(withCustomer,"address"));
  Assert.Equal(25.204849m,Num(withCustomer.GetProperty("customer"),"latitude"));
  // The address alone can be corrected without GPS; the earlier pin stays. An empty save is refused.
  Assert.Equal(HttpStatusCode.BadRequest,(await customer.PostAsJsonAsync($"/api/public/delivery-notes/{locationToken}/location",new{notes="x"})).StatusCode);
  var addressOnly=await (await customer.PostAsJsonAsync($"/api/public/delivery-notes/{locationToken}/location",new{address="Villa 10, Jumeirah 2",notes="White gate"})).Content.ReadFromJsonAsync<JsonElement>();
  Assert.Equal("Villa 10, Jumeirah 2",Str(addressOnly,"address"));Assert.Equal(25.204849m,Num(addressOnly,"latitude"));Assert.Equal("White gate",Str(addressOnly,"locationNotes"));
  Assert.Equal("RESCHEDULE",Str(withCustomer.GetProperty("customer"),"dateResponse"));
  Assert.Equal(2,withCustomer.GetProperty("customer").GetProperty("links").GetArrayLength());
  // Moving the run makes the old answer outdated; revoking a link closes it.
  await Put($"/api/delivery/{id}",new{scheduledAtUtc=DateTimeOffset.UtcNow.AddMinutes(30),durationMinutes=180,notes="Morning run"});
  Assert.False((await customer.GetFromJsonAsync<JsonElement>($"/api/public/delivery-notes/{dateToken}")).GetProperty("dateResponseCurrent").GetBoolean());
  await _client.DeleteAsync($"/api/delivery/{id}/notes/{Id(secondNote)}/links/SCHEDULE");
  Assert.Equal(HttpStatusCode.NotFound,(await customer.GetAsync($"/api/public/delivery-notes/{dateToken}")).StatusCode);

  // Crew, driver and vehicle.
  var designation=await Post("/api/designations",new{code="DRV",name="Driver",level=1});
  var driver=await Post("/api/employees",new{employeeNumber="",firstName="Dee",lastName="Driver",workEmail="dee@example.test",phone="1",joiningDate="2026-01-01",designationId=Id(designation)});
  var helper=await Post("/api/employees",new{employeeNumber="",firstName="Hal",lastName="Helper",workEmail="hal@example.test",phone="2",joiningDate="2026-01-01",designationId=Id(designation)});
  var vehicle=await Post("/api/pickups/vehicles",new{registrationNumber="DL-VAN-1",name="Van",type="Van",capacityCbm=12m});
  var crewed=await Put($"/api/delivery/{id}/crew",new{crew=new[]{new{employeeId=Id(helper),role="Helper"}},driverEmployeeId=Id(driver),vehicleId=Id(vehicle)});
  Assert.Equal("Dee Driver",crewed.GetProperty("job").GetProperty("driverName").GetString());
  Assert.Contains("DL-VAN-1",crewed.GetProperty("job").GetProperty("vehicleName").GetString());
  Assert.Equal("Hal Helper",crewed.GetProperty("crew")[0].GetProperty("employeeName").GetString());
  // The driver is booked: another run at the same time cannot take them as crew.
  var clash=await Post("/api/delivery",new{scheduledAtUtc=DateTimeOffset.UtcNow,durationMinutes=60});
  var clashResponse=await _client.PutAsJsonAsync($"/api/delivery/{clash.GetProperty("job").GetProperty("id").GetGuid()}/crew",new{crew=new[]{new{employeeId=Id(driver),role="Helper"}}});
  Assert.Equal(HttpStatusCode.BadRequest,clashResponse.StatusCode);
  Assert.Contains("is on delivery",await clashResponse.Content.ReadAsStringAsync());

  var lampItem=secondNote.GetProperty("items").EnumerateArray().Single(i=>Str(i,"description")=="Lamp");
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.PutAsJsonAsync($"/api/delivery/{id}/items/{Id(lampItem)}/status",new{status="DELIVERED"})).StatusCode);
  var started=await Post($"/api/delivery/{id}/trip/start",new{});
  Assert.Equal("OUT_FOR_DELIVERY",started.GetProperty("job").GetProperty("status").GetString());

  // First customer signs for their box.
  var firstItem=billingNote.GetProperty("items")[0];
  var signed=await Post($"/api/delivery/{id}/notes/{Id(billingNote)}/sign",new{signerName="Bill Customer",signaturePng=Signature,remarks="All good",deliveredItemIds=new[]{Id(firstItem)}});
  var signedNote=signed.GetProperty("notes").EnumerateArray().Single(n=>Id(n)==Id(billingNote));
  Assert.True(signedNote.GetProperty("isSigned").GetBoolean());
  Assert.Equal("DELIVERED",Str(signedNote.GetProperty("items")[0],"status"));
  Assert.Equal("Bill Customer",Str(signedNote.GetProperty("items")[0],"receivedBy"));
  Assert.Single(signedNote.GetProperty("signedItems").EnumerateArray());
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.PutAsJsonAsync($"/api/delivery/{id}/items/{Id(firstItem)}/status",new{status="RETURNED"})).StatusCode);

  // Second customer takes the sofa but refuses the lamp.
  var sofaItem=secondNote.GetProperty("items").EnumerateArray().Single(i=>Str(i,"description")=="Sofa");
  await Put($"/api/delivery/{id}/items/{Id(sofaItem)}/status",new{status="DELIVERED",receivedBy="Neighbour"});
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync($"/api/delivery/{id}/trip/complete",new{distanceKm=42.5m})).StatusCode);
  await Put($"/api/delivery/{id}/items/{Id(lampItem)}/status",new{status="RETURNED",notes="Customer refused"});

  // Money collected from the second customer, and a fuel expense.
  var paid=await Post($"/api/delivery/{id}/transactions",new{type="INCOME",category="Delivery charge",amount=500m,paymentMethod="CASH",currency="INR",deliveryNoteId=Id(secondNote)});
  Assert.Equal(6m,Num(paid.GetProperty("notes").EnumerateArray().Single(n=>Id(n)==Id(secondNote)),"collected")); // 500 INR at 0.012 in the USD base
  var cash=await Get("/api/billing/cash");
  var collected=cash.Single(c=>c.GetProperty("details").GetProperty("sourceKind").GetString()=="DELIVERY");
  Assert.Equal("Second customer",collected.GetProperty("details").GetProperty("partyName").GetString());
  Assert.Equal("RECEIPT",collected.GetProperty("details").GetProperty("type").GetString());

  var done=await Post($"/api/delivery/{id}/trip/complete",new{distanceKm=42.5m});
  Assert.Equal("COMPLETED",done.GetProperty("job").GetProperty("status").GetString());
  Assert.Equal(42.5m,Num(done.GetProperty("job"),"distanceKm"));
  Assert.Equal(2,done.GetProperty("job").GetProperty("deliveredCount").GetInt32());
  Assert.Equal(1,done.GetProperty("job").GetProperty("returnedCount").GetInt32());
  Assert.Equal(new[]{"STARTED","COMPLETED"},done.GetProperty("clock").GetProperty("events").EnumerateArray().Select(e=>Str(e,"type")));
  Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync($"/api/delivery/{id}/load",new{warehouseBoxIds=new[]{Id(lamp)}})).StatusCode);

  // The refused lamp is warehouse stock again; delivered boxes are not.
  stock=await Get1("/api/delivery/available");
  Assert.Contains(Str(lamp,"trackingNumber"),StockTracking(stock));
  Assert.DoesNotContain(Str(firstBox,"trackingNumber"),StockTracking(stock));

  // Customer-specific delivery note print data carries the signature; the receipt names the payer.
  var print=await Get1($"/api/report-v2/data/DELIVERY_NOTE?id={id}&noteId={Id(billingNote)}");
  Assert.Equal("Bill Customer",print.GetProperty("note").GetProperty("signerName").GetString());
  Assert.StartsWith("data:image/png",print.GetProperty("note").GetProperty("signaturePng").GetString());
  Assert.Equal(1,print.GetProperty("itemCount").GetInt32());
  var receiptPrint=await Get1($"/api/report-v2/data/DELIVERY_RECEIPT?id={id}&transactionId={Id(paid.GetProperty("transactions")[0])}");
  Assert.Equal("Second customer",receiptPrint.GetProperty("customer").GetProperty("name").GetString());
 }
}
