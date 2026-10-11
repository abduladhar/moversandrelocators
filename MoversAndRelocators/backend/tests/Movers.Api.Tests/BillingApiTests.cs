using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Movers.Api.Contracts.Tenants;

namespace Movers.Api.Tests;

public sealed partial class BillingApiTests : IAsyncLifetime
{
    private const string Signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"movers-billing-{Guid.NewGuid():N}.db");
    private readonly string _storageRoot = Path.Combine(Path.GetTempPath(), $"movers-pickup-files-{Guid.NewGuid():N}");
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public Task InitializeAsync()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing"); builder.UseSetting("Database:Provider", "Sqlite"); builder.UseSetting("ConnectionStrings:Sqlite", $"Data Source={_databasePath}");
            builder.UseSetting("Storage:Provider", "Local"); builder.UseSetting("Storage:LocalRoot", _storageRoot);
        });
        _client = _factory.CreateClient(); return Task.CompletedTask;
    }

    private static Guid Version(JsonElement r) => r.GetProperty("version").GetGuid();
    private static string Code(JsonElement r) => r.GetProperty("code").GetString()!;
    private async Task<(Guid Pickup,Guid Job,Guid Receipt,string Customer,string Vendor1,string Vendor2)> Setup()
    {
        await LoginAndSelectTenant();
        var customer=await Post("/api/business-masters/customer",new{name="Billing customer",address="Customer address"});
        var v1=await Post("/api/business-masters/vendor",new{name="Vendor one"});
        var v2=await Post("/api/business-masters/vendor",new{name="Vendor two"});
        var statuses=await Get("/api/pickups/statuses");
        var pickup=await Post("/api/pickups",new{customerName="Billing customer",phone="123",address="Origin",scheduledAtUtc=DateTimeOffset.UtcNow,statusId=Id(statuses[0])});
        var job=await Post("/api/jobs",new{requestId=Guid.NewGuid(),details=new{mode="AIR",originPort="DXB",destinationPort="LHR"}});
        var wh=await Post("/api/pickups/warehouses",new{code="BILLING-WH",name="Warehouse",address="Office"});
        var receipt=await Post("/api/warehouse/receive-office",new{requestId=Guid.NewGuid(),customerCode=Code(customer),warehouseId=Id(wh),deliveredBy="Owner",receivedBy="Keeper",boxes=new[]{new{description="Box",condition="Good",contents="Books",contentsChecked=true}}});
        return(Id(pickup),Id(job),Id(receipt),Code(customer),Code(v1),Code(v2));
    }
    private Task<JsonElement> Charge(string kind,Guid source,string direction,string party,decimal amount,string account="4000",string currency="INR") =>
        Post("/api/billing/charges",new{requestId=Guid.NewGuid(),sourceKind=kind,sourceId=source,direction,partyCode=party,description="Service charge",accountCode=account,currency,amount});
    private Task<JsonElement> Issue(params JsonElement[] charges)=>Post("/api/billing/documents",new{requestId=Guid.NewGuid(),charges=charges.Select(c=>new{id=Id(c),version=Version(c)}),date=DateOnly.FromDateTime(DateTime.UtcNow),dueDate=DateOnly.FromDateTime(DateTime.UtcNow).AddDays(30),reference="Supplier/customer ref"});
    private async Task<JsonElement> Current(Guid id)=>(await Get("/api/billing/documents")).Single(x=>Id(x)==id);

    [Fact]
    public async Task Income_from_all_three_sections_posts_once_and_one_receipt_settles_multiple_invoices()
    {
        var f=await Setup();
        await Post("/api/billing/accounts",new{code="4200",name="International freight income",type="Revenue",isActive=true,isCashBank=false});
        var a=await Charge("PICKUP",f.Pickup,"INCOME",f.Customer,100);
        var b=await Charge("JOB",f.Job,"INCOME",f.Customer,200,"4200");
        var c=await Charge("WAREHOUSE",f.Receipt,"INCOME",f.Customer,50,"4100");
        var invoice1=await Issue(a,b);var invoice2=await Issue(c);
        Assert.Equal(300,invoice1.GetProperty("details").GetProperty("amount").GetDecimal());
        Assert.StartsWith("INV-",invoice1.GetProperty("number").GetString());
        Assert.Equal(HttpStatusCode.Conflict,(await _client.PostAsJsonAsync("/api/billing/documents",new{requestId=Guid.NewGuid(),charges=new[]{new{id=Id(a),version=Version(a)}},date=DateOnly.FromDateTime(DateTime.UtcNow),dueDate=DateOnly.FromDateTime(DateTime.UtcNow)})).StatusCode);
        var receiptRequest=new{requestId=Guid.NewGuid(),type="RECEIPT",currency="INR",date=DateOnly.FromDateTime(DateTime.UtcNow),accountCode="1000",groups=new[]{new{partyCode=f.Customer,reference="BANK-RECEIPT-1",allocations=new[]{new{documentId=Id(invoice1),version=Version(invoice1),amount=250m},new{documentId=Id(invoice2),version=Version(invoice2),amount=50m}}}}};
        var receipt=await Post("/api/billing/payments",receiptRequest);
        Assert.Single(receipt.EnumerateArray());
        Assert.Equal(Id(receipt[0]),Id((await Post("/api/billing/payments",receiptRequest))[0]));
        Assert.Equal(50,(await Current(Id(invoice1))).GetProperty("balance").GetDecimal());
        Assert.Equal(0,(await Current(Id(invoice2))).GetProperty("balance").GetDecimal());
        var current=await Current(Id(invoice1));
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync($"/api/billing/documents/{Id(invoice1)}/void",new{version=Version(current),reason="Correction",date=DateOnly.FromDateTime(DateTime.UtcNow)})).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,(await _client.PostAsJsonAsync("/api/billing/payments",new{requestId=Guid.NewGuid(),type="RECEIPT",currency="INR",date=DateOnly.FromDateTime(DateTime.UtcNow),accountCode="1000",groups=new[]{new{partyCode=f.Customer,reference="Overpay",allocations=new[]{new{documentId=Id(current),version=Version(current),amount=51}}}}})).StatusCode);
        var journals=await Get("/api/operations-costs/journals");
        Assert.All(journals,j=>Assert.Equal(j.GetProperty("lines").EnumerateArray().Sum(l=>l.GetProperty("debit").GetDecimal()),j.GetProperty("lines").EnumerateArray().Sum(l=>l.GetProperty("credit").GetDecimal())));
        var balance=await Get("/api/operations-costs/trial-balance?currency=INR");
        Assert.Equal(200,balance.Single(x=>Code(x)=="4200").GetProperty("credit").GetDecimal());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync($"/api/operations-costs/journals/{invoice1.GetProperty("journalId").GetGuid()}/reverse",new{requestId=Guid.NewGuid(),date=DateOnly.FromDateTime(DateTime.UtcNow)})).StatusCode);
        await Post($"/api/billing/vouchers/{Id(receipt[0])}/void",new{version=Version(receipt[0]),reason="Bank receipt corrected",date=DateOnly.FromDateTime(DateTime.UtcNow)});
        Assert.Equal(300,(await Current(Id(invoice1))).GetProperty("balance").GetDecimal());
        current=await Current(Id(invoice1));
        await Post($"/api/billing/documents/{Id(current)}/void",new{version=Version(current),reason="Correct charges",date=DateOnly.FromDateTime(DateTime.UtcNow)});
        Assert.True((await Current(Id(current))).GetProperty("details").GetProperty("voided").GetBoolean());
        var charges=await Get("/api/billing/charges");
        Assert.Equal(JsonValueKind.Null,charges.Single(x=>Id(x)==Id(a)).GetProperty("details").GetProperty("documentId").ValueKind);
        var corrected=await Issue(charges.Single(x=>Id(x)==Id(a)));
        Assert.NotEqual(Id(invoice1),Id(corrected));
    }

    [Fact]
    public async Task Vendor_payment_batch_creates_separate_referenced_vouchers_and_rolls_back_invalid_groups()
    {
        var f=await Setup();
        var a=await Issue(await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,100,"5300"));
        var b=await Issue(await Charge("WAREHOUSE",f.Receipt,"EXPENSE",f.Vendor1,40,"5400"));
        var c=await Issue(await Charge("PICKUP",f.Pickup,"EXPENSE",f.Vendor2,60,"5000"));
        var groups=new[]{
          new{partyCode=f.Vendor1,reference="VENDOR-ONE-REF",allocations=new[]{new{documentId=Id(a),version=Version(a),amount=100m},new{documentId=Id(b),version=Version(b),amount=40m}}},
          new{partyCode=f.Vendor2,reference="VENDOR-TWO-REF",allocations=new[]{new{documentId=Id(c),version=Version(c),amount=60m}}}
        };
        var invalidGroups=new[]{groups[0],new{partyCode=f.Vendor2,reference="TOO MUCH",allocations=new[]{new{documentId=Id(c),version=Version(c),amount=61m}}}};
        var requestId=Guid.NewGuid();
        Assert.Equal(HttpStatusCode.Conflict,(await _client.PostAsJsonAsync("/api/billing/payments",new{requestId,type="PAYMENT",currency="INR",date=DateOnly.FromDateTime(DateTime.UtcNow),accountCode="1000",groups=invalidGroups})).StatusCode);
        Assert.Empty(await Get("/api/billing/vouchers"));
        Assert.Equal(100,(await Current(Id(a))).GetProperty("balance").GetDecimal());
        var command=new{requestId,type="PAYMENT",currency="INR",date=DateOnly.FromDateTime(DateTime.UtcNow),accountCode="1000",groups};
        var paid=await Post("/api/billing/payments",command);
        Assert.Equal(2,paid.GetArrayLength());
        Assert.Equal(2,paid.EnumerateArray().Select(x=>x.GetProperty("number").GetString()).Distinct().Count());
        Assert.Contains(paid.EnumerateArray(),x=>x.GetProperty("details").GetProperty("reference").GetString()=="VENDOR-ONE-REF"&&x.GetProperty("details").GetProperty("amount").GetDecimal()==140);
        Assert.Contains(paid.EnumerateArray(),x=>x.GetProperty("details").GetProperty("reference").GetString()=="VENDOR-TWO-REF"&&x.GetProperty("details").GetProperty("amount").GetDecimal()==60);
        Assert.Equal(2,(await Post("/api/billing/payments",command)).GetArrayLength());
        Assert.All(await Get("/api/billing/documents"),x=>Assert.Equal(0,x.GetProperty("balance").GetDecimal()));
        Assert.Equal(HttpStatusCode.Conflict,(await _client.PostAsJsonAsync("/api/billing/payments",new{requestId=Guid.NewGuid(),type="PAYMENT",currency="INR",date=DateOnly.FromDateTime(DateTime.UtcNow),accountCode="1000",groups})).StatusCode);
    }

    [Fact]
    public async Task Billing_validates_accounts_source_parties_and_requires_separate_permissions()
    {
        var f=await Setup();
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/billing/charges",new{requestId=Guid.NewGuid(),sourceKind="JOB",sourceId=Guid.NewGuid(),direction="INCOME",partyCode=f.Customer,description="Invalid source",accountCode="4000",currency="INR",amount=10})).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/billing/charges",new{requestId=Guid.NewGuid(),sourceKind="JOB",sourceId=f.Job,direction="INCOME",partyCode=f.Customer,description="Wrong account",accountCode="5000",currency="INR",amount=10})).StatusCode);
        var a=await Charge("JOB",f.Job,"INCOME",f.Customer,10);
        var customer2=await Post("/api/business-masters/customer",new{name="Other customer"});
        var b=await Charge("JOB",f.Job,"INCOME",Code(customer2),10);
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/billing/documents",new{requestId=Guid.NewGuid(),charges=new[]{new{id=Id(a),version=Version(a)},new{id=Id(b),version=Version(b)}},date=DateOnly.FromDateTime(DateTime.UtcNow),dueDate=DateOnly.FromDateTime(DateTime.UtcNow)})).StatusCode);
        var invoice=await Issue(a);
        var systemToken=_client.DefaultRequestHeaders.Authorization;
        var permissions=await Get("/api/security/permissions");
        var role=await Post("/api/security/roles",new{name="Billing reader",permissionIds=permissions.Where(p=>Code(p)=="billing.view").Select(Id).ToArray()});
        var designation=await Post("/api/designations",new{code="BILLING",name="Billing",level=1});
        var employee=await Post("/api/employees",new{employeeNumber="",firstName="Billing",lastName="Reader",workEmail="billing.reader@example.test",phone="123",joiningDate="2026-01-01",designationId=Id(designation)});
        await Post("/api/security/users",new{fullName="Billing Reader",email="billing.reader@example.test",password="ReaderPass123!",roleId=Id(role),employeeId=Id(employee)});
        SetToken(await Post("/api/auth/login",new{email="billing.reader@example.test",password="ReaderPass123!"}));
        Assert.Single(await Get("/api/billing/documents"));
        Assert.Equal(HttpStatusCode.Forbidden,(await _client.PostAsJsonAsync("/api/billing/documents",new{requestId=Guid.NewGuid(),charges=new[]{new{id=Id(b),version=Version(b)}},date=DateOnly.FromDateTime(DateTime.UtcNow),dueDate=DateOnly.FromDateTime(DateTime.UtcNow)})).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await _client.PostAsJsonAsync("/api/currencies/rates",new{currency="AED",date="2026-01-01",usdPerUnit=0.25m})).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await _client.PostAsJsonAsync("/api/billing/accounts",new{code="4500",name="No access",type="Revenue"})).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await _client.PostAsJsonAsync("/api/billing/payments",new{requestId=Guid.NewGuid(),type="RECEIPT",currency="INR",date=DateOnly.FromDateTime(DateTime.UtcNow),accountCode="1000",groups=Array.Empty<object>()})).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await _client.PostAsJsonAsync("/api/billing/charge-mappings",new{chargeMasterId=Guid.NewGuid(),incomeAccount="4000"})).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await _client.PostAsJsonAsync($"/api/billing/cash/{Guid.NewGuid()}/post",new{requestId=Guid.NewGuid(),expectedVersion="x",date=DateOnly.FromDateTime(DateTime.UtcNow),accountCode="1000",partyCode=f.Customer})).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await _client.PostAsJsonAsync($"/api/billing/documents/{Guid.NewGuid()}/post",new{id=Guid.NewGuid(),version=Guid.NewGuid()})).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await _client.PostAsJsonAsync($"/api/billing/vouchers/{Guid.NewGuid()}/post",new{id=Guid.NewGuid(),version=Guid.NewGuid()})).StatusCode);
        _client.DefaultRequestHeaders.Authorization=systemToken;
        var tenant=await Post("/api/platform/tenants",new SaveTenantRequest("Other billing","other-billing",null,null,null));
        SetToken(await Post("/api/auth/select-tenant",new{tenantId=Id(tenant)}));
        Assert.Empty(await Get("/api/billing/documents"));
        Assert.Empty(await Get("/api/billing/charges"));
        Assert.Equal(HttpStatusCode.NotFound,(await _client.PostAsJsonAsync($"/api/billing/documents/{Id(invoice)}/void",new{version=Version(invoice),reason="Wrong tenant",date=DateOnly.FromDateTime(DateTime.UtcNow)})).StatusCode);
        _client.DefaultRequestHeaders.Authorization=null;
        Assert.Equal(HttpStatusCode.Unauthorized,(await _client.GetAsync("/api/billing/choices")).StatusCode);
    }
    [Fact]
    public async Task Mapped_charge_batches_are_atomic_and_snapshot_accounts_for_customer_and_vendor()
    {
        var f=await Setup();
        var master=(await Post("/api/billing/charge-masters",new{name="Packing",unit="service",defaultRate=25m,incomeAccount="4000",expenseAccount="5100"})).GetGuid();
        var request=new{requestId=Guid.NewGuid(),sourceKind="JOB",sourceId=f.Job,direction="INCOME",partyCode=f.Customer,currency="INR",lines=new[]{new{chargeMasterId=master,amount=25m,description="First"},new{chargeMasterId=master,amount=15m,description="Second"}}};
        var captured=await Post("/api/billing/charge-batches",request);
        Assert.Equal(2,captured.GetArrayLength());
        Assert.All(captured.EnumerateArray(),x=>Assert.Equal("4000",x.GetProperty("details").GetProperty("accountCode").GetString()));
        Assert.Equal(2,(await Post("/api/billing/charge-batches",request)).GetArrayLength());
        Assert.Equal(2,(await Get("/api/billing/charges")).Count);
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/billing/charge-batches",new{requestId=Guid.NewGuid(),sourceKind="JOB",sourceId=f.Job,direction="INCOME",partyCode=f.Customer,currency="INR",lines=new[]{new{chargeMasterId=master,amount=25m},new{chargeMasterId=Guid.NewGuid(),amount=15m}}})).StatusCode);
        Assert.Equal(2,(await Get("/api/billing/charges")).Count);
        await Post("/api/billing/charge-mappings",new{chargeMasterId=master,incomeAccount="4100",expenseAccount="5400"});
        var vendor=await Post("/api/billing/charge-batches",new{requestId=Guid.NewGuid(),sourceKind="WAREHOUSE",sourceId=f.Receipt,direction="EXPENSE",partyCode=f.Vendor1,currency="INR",lines=new[]{new{chargeMasterId=master,amount=60m}}});
        Assert.Equal("5400",vendor[0].GetProperty("details").GetProperty("accountCode").GetString());
        var invoice=await Issue(captured[0],captured[1]);
        Assert.All(invoice.GetProperty("details").GetProperty("lines").EnumerateArray(),x=>Assert.Equal("4000",x.GetProperty("accountCode").GetString()));
        var bill=await Issue(vendor[0]);
        Assert.Equal("BILL",bill.GetProperty("details").GetProperty("type").GetString());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/billing/charge-mappings",new{chargeMasterId=master,incomeAccount="5100",expenseAccount="5400"})).StatusCode);
    }

    [Fact]
    public async Task Cash_capture_is_unposted_until_accountant_posts_and_allocation_cannot_be_duplicated()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var invoice=await Issue(await Charge("JOB",f.Job,"INCOME",f.Customer,100));
        var captured=await Post("/api/billing/cash",new{requestId=Guid.NewGuid(),sourceKind="JOB",sourceId=f.Job,type="RECEIPT",partyCode=f.Customer,amount=100m,currency="INR",date,reference="Received at office"});
        var queue=(await Get("/api/billing/cash")).Single(x=>Id(x)==Id(captured));
        Assert.False(queue.GetProperty("posted").GetBoolean());
        Assert.Equal(100,(await Current(Id(invoice))).GetProperty("balance").GetDecimal());
        var posting=new{requestId=Guid.NewGuid(),expectedVersion=queue.GetProperty("version").GetString(),date,accountCode="1000",partyCode=f.Customer,allocations=new[]{new{documentId=Id(invoice),version=Version(invoice),amount=100m}}};
        await Post($"/api/billing/cash/{Id(captured)}/post",posting);
        await Post($"/api/billing/cash/{Id(captured)}/post",posting);
        Assert.True((await Get("/api/billing/cash")).Single(x=>Id(x)==Id(captured)).GetProperty("posted").GetBoolean());
        Assert.Equal(0,(await Current(Id(invoice))).GetProperty("balance").GetDecimal());
        Assert.Single(await Get("/api/billing/vouchers"));
        Assert.Equal(HttpStatusCode.Conflict,(await _client.PostAsJsonAsync($"/api/billing/cash/{Id(captured)}/post",new{requestId=Guid.NewGuid(),expectedVersion=queue.GetProperty("version").GetString(),date,accountCode="1000",partyCode=f.Customer})).StatusCode);
        var advance=await Post("/api/billing/cash",new{requestId=Guid.NewGuid(),sourceKind="PICKUP",sourceId=f.Pickup,type="RECEIPT",partyCode=f.Customer,amount=30m,currency="INR",date,reference="Advance"});
        var advanceQueue=(await Get("/api/billing/cash")).Single(x=>Id(x)==Id(advance));
        await Post($"/api/billing/cash/{Id(advance)}/post",new{requestId=Guid.NewGuid(),expectedVersion=advanceQueue.GetProperty("version").GetString(),date,accountCode="1000",partyCode=f.Customer});
        var balance=await Get("/api/operations-costs/trial-balance?currency=INR");
        Assert.Equal(30,balance.Single(x=>Code(x)=="2100").GetProperty("credit").GetDecimal());
    }

    [Fact]
    public async Task Existing_pickup_expense_enters_queue_and_cannot_change_after_posting()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var master=(await Post("/api/billing/charge-masters",new{name="Fuel",unit="service",defaultRate=25m,expenseAccount="5200"})).GetGuid();
        await Post($"/api/pickups/{f.Pickup}/expenses",new{category="FUEL",amount=20m,currency="INR",incurredAtUtc=DateTimeOffset.UtcNow,notes="Fuel paid"});
        var queued=Assert.Single(await Get("/api/billing/cash"));
        var id=Id(queued);
        await Put($"/api/pickups/{f.Pickup}/expenses/{id}",new{category="FUEL",amount=21m,currency="INR",incurredAtUtc=DateTimeOffset.UtcNow,notes="Corrected fuel"});
        Assert.Equal(HttpStatusCode.Conflict,(await _client.PostAsJsonAsync($"/api/billing/cash/{id}/post",new{requestId=Guid.NewGuid(),expectedVersion=queued.GetProperty("version").GetString(),date,accountCode="1000",partyCode=f.Vendor1,chargeMasterId=master})).StatusCode);
        queued=Assert.Single(await Get("/api/billing/cash"));
        await Post($"/api/billing/cash/{id}/post",new{requestId=Guid.NewGuid(),expectedVersion=queued.GetProperty("version").GetString(),date,accountCode="1000",partyCode=f.Vendor1,chargeMasterId=master});
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PutAsJsonAsync($"/api/pickups/{f.Pickup}/expenses/{id}",new{category="FUEL",amount=22m,currency="INR",incurredAtUtc=DateTimeOffset.UtcNow,notes="Not allowed"})).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.DeleteAsync($"/api/pickups/{f.Pickup}/expenses/{id}")).StatusCode);
        var balance=await Get("/api/operations-costs/trial-balance?currency=INR");
        Assert.Equal(21,balance.Single(x=>Code(x)=="5200").GetProperty("debit").GetDecimal());
    }
    [Fact]
    public async Task Currency_defaults_dated_rates_precision_and_tenant_isolation_are_enforced()
    {
        var f=await Setup();
        var choices=await Get1("/api/currencies");
        Assert.Equal("USD",choices.GetProperty("baseCurrency").GetString());
        Assert.Equal("AED",choices.GetProperty("settings").GetProperty("defaultCurrency").GetString());
        await Post("/api/currencies/settings",new{defaultCurrency="KWD"});
        var customer=await Post("/api/business-masters/customer",new{name="Kuwait customer"});
        Assert.Equal("KWD",customer.GetProperty("currency").GetString());
        var vendor=await Post("/api/business-masters/vendor",new{name="Japan supplier",currency="JPY"});
        Assert.Equal("JPY",vendor.GetProperty("currency").GetString());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/currencies/rates",new{currency="USD",date="2026-01-01",usdPerUnit=2})).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/currencies/rates",new{currency="AED",date="2026-01-01",usdPerUnit=0})).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync("/api/currencies/rate?currency=AED&date=2026-01-01")).StatusCode);
        await Post("/api/currencies/rates",new{currency="AED",date="2025-01-01",usdPerUnit=0.25m});
        await Post("/api/currencies/rates",new{currency="AED",date="2026-01-01",usdPerUnit=0.27m});
        Assert.Equal(0.25m,(await Get1("/api/currencies/rate?currency=AED&date=2025-12-31")).GetProperty("usdPerUnit").GetDecimal());
        Assert.Equal(0.27m,(await Get1("/api/currencies/rate?currency=AED&date=2026-02-01")).GetProperty("usdPerUnit").GetDecimal());
        var kwd=await Post("/api/billing/charges",new{requestId=Guid.NewGuid(),sourceKind="JOB",sourceId=f.Job,direction="INCOME",partyCode=f.Customer,description="KWD charge",accountCode="4000",currency="KWD",amount=1.234m,exchangeRate=3m});
        Assert.Equal(1.234m,kwd.GetProperty("details").GetProperty("amount").GetDecimal());
        Assert.Equal(3.70m,kwd.GetProperty("details").GetProperty("baseAmount").GetDecimal());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/billing/charges",new{requestId=Guid.NewGuid(),sourceKind="JOB",sourceId=f.Job,direction="INCOME",partyCode=f.Customer,description="Invalid JPY",accountCode="4000",currency="JPY",amount=1.5m,exchangeRate=0.007m})).StatusCode);
        var other=await Post("/api/platform/tenants",new SaveTenantRequest("FX Other","fx-other",null,null,null));
        SetToken(await Post("/api/auth/select-tenant",new{tenantId=Id(other)}));
        Assert.Empty((await Get1("/api/currencies")).GetProperty("rates").EnumerateArray());
    }

    [Fact]
    public async Task Cross_currency_payment_preserves_invoice_value_posts_gain_and_reverses_exactly()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        await Post("/api/currencies/rates",new{currency="AED",date="2020-01-01",usdPerUnit=0.25m});
        var charge=await Charge("JOB",f.Job,"INCOME",f.Customer,100,currency:"AED");
        await Post("/api/currencies/rates",new{currency="AED",date="2020-01-01",usdPerUnit=0.5m});
        var invoice=await Issue(charge);
        Assert.Equal(25,invoice.GetProperty("details").GetProperty("baseAmount").GetDecimal());
        var paid=await Post("/api/billing/payments",new{requestId=Guid.NewGuid(),type="RECEIPT",currency="USD",date,accountCode="1000",groups=new[]{new{partyCode=f.Customer,reference="USD wire",allocations=new[]{new{documentId=Id(invoice),version=Version(invoice),amount=100m,paymentAmount=30m}}}}});
        Assert.Equal(30,paid[0].GetProperty("details").GetProperty("amount").GetDecimal());
        Assert.Equal(0,(await Current(Id(invoice))).GetProperty("balance").GetDecimal());
        var balance=await Get("/api/billing/base-trial-balance");
        Assert.Equal(0,balance.Single(x=>Code(x)=="1100").GetProperty("balance").GetDecimal());
        Assert.Equal(5,balance.Single(x=>Code(x)=="4200-FX").GetProperty("credit").GetDecimal());
        Assert.Equal(balance.Sum(x=>x.GetProperty("debit").GetDecimal()),balance.Sum(x=>x.GetProperty("credit").GetDecimal()));
        await Post("/api/currencies/rates",new{currency="EUR",date="2020-01-01",usdPerUnit=1.25m});
        await Put("/api/business-masters/customer/"+f.Customer,new{name="Billing customer",currency="EUR"});
        var report=await Get1("/api/billing/currency-report?mode=PARTY&date="+date);
        var row=report.GetProperty("rows").EnumerateArray().Single(x=>x.GetProperty("type").GetString()=="INVOICE");
        Assert.Equal("EUR",row.GetProperty("reportCurrency").GetString());Assert.Equal(20,row.GetProperty("reportAmount").GetDecimal());
        var baseReport=await Get1("/api/billing/currency-report?mode=BASE&date="+date);
        var both=baseReport.GetProperty("rows").EnumerateArray().Single(x=>x.GetProperty("type").GetString()=="INVOICE");
        Assert.Equal("AED",both.GetProperty("transactionCurrency").GetString());
        Assert.Equal(100,both.GetProperty("transactionAmount").GetDecimal());
        Assert.Equal("EUR",both.GetProperty("partyCurrency").GetString());
        Assert.Equal(20,both.GetProperty("partyAmount").GetDecimal());
        Assert.Equal(25,both.GetProperty("reportAmount").GetDecimal());
        await Post("/api/billing/vouchers/"+Id(paid[0])+"/void",new{version=Version(paid[0]),reason="Correction",date});
        var current=await Current(Id(invoice));Assert.Equal(100,current.GetProperty("balance").GetDecimal());
        await Post("/api/billing/documents/"+Id(invoice)+"/void",new{version=Version(current),reason="Correction",date});
        Assert.All(await Get("/api/billing/base-trial-balance"),r=>Assert.Equal(0,r.GetProperty("balance").GetDecimal()));
    }

    [Fact]
    public async Task Partial_payments_at_different_rates_clear_control_balance_without_rounding_residue()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var charge=await Post("/api/billing/charges",new{requestId=Guid.NewGuid(),sourceKind="JOB",sourceId=f.Job,direction="EXPENSE",partyCode=f.Vendor1,description="Freight",accountCode="5300",currency="AED",amount=3m,exchangeRate=0.333333333333m});
        var bill=await Issue(charge);
        foreach(var amount in new[]{1m,1m,1m}){
          var current=await Current(Id(bill));
          await Post("/api/billing/payments",new{requestId=Guid.NewGuid(),type="PAYMENT",currency="AED",exchangeRate=0.4m,date,accountCode="1000",groups=new[]{new{partyCode=f.Vendor1,reference="Partial wire",allocations=new[]{new{documentId=Id(bill),version=Version(current),amount}}}}});
        }
        var balance=await Get("/api/billing/base-trial-balance");
        Assert.Equal(0,balance.Single(x=>Code(x)=="2000").GetProperty("balance").GetDecimal());
        Assert.Equal(0.20m,balance.Single(x=>Code(x)=="5500").GetProperty("debit").GetDecimal());
    }

    [Fact]
    public async Task Cash_rate_is_locked_and_multi_currency_costs_are_not_added_as_one_currency()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var cash=await Post("/api/billing/cash",new{requestId=Guid.NewGuid(),sourceKind="PICKUP",sourceId=f.Pickup,type="RECEIPT",partyCode=f.Customer,amount=100m,currency="AED",exchangeRate=0.25m,date,reference="Office receipt"});
        var queued=Assert.Single(await Get("/api/billing/cash"));
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/billing/cash/"+Id(cash)+"/post",new{requestId=Guid.NewGuid(),expectedVersion=queued.GetProperty("version").GetString(),date,accountCode="1000",partyCode=f.Customer,exchangeRate=0.5m})).StatusCode);
        await Post("/api/billing/cash/"+Id(cash)+"/post",new{requestId=Guid.NewGuid(),expectedVersion=queued.GetProperty("version").GetString(),date,accountCode="1000",partyCode=f.Customer});
        var balance=await Get("/api/billing/base-trial-balance");
        Assert.Equal(25,balance.Single(x=>Code(x)=="2100").GetProperty("credit").GetDecimal());
        foreach(var x in new[]{new{currency="USD",amount=10m,exchangeRate=1m},new{currency="AED",amount=20m,exchangeRate=0.25m}}){
          await Post($"/api/pickups/{f.Pickup}/expenses",new{category="FUEL",x.amount,x.currency,x.exchangeRate,incurredAtUtc=DateTimeOffset.UtcNow});
        }
        var cost=await Get("/api/operations-costs/summary");
        Assert.Equal(2,cost.Count);Assert.Contains(cost,x=>x.GetProperty("currency").GetString()=="USD"&&x.GetProperty("fuelCost").GetDecimal()==10);
        var converted=Assert.Single(await Get("/api/operations-costs/summary?mode=USD"));
        Assert.Equal(15,converted.GetProperty("fuelCost").GetDecimal());
        await Post("/api/operations-costs/expenses",new{requestId=Guid.NewGuid(),pickupId=f.Pickup,category="OTHER",vendor="Vendor one",reference="USD incidental",amount=5m,currency="USD",exchangeRate=1m});
        converted=Assert.Single(await Get("/api/operations-costs/summary?mode=USD"));
        Assert.Equal(20,converted.GetProperty("totalCost").GetDecimal());
    }

    [Fact]
    public async Task Rate_period_saves_all_currencies_atomically_enforces_dates_and_preserves_snapshots()
    {
        var f=await Setup();
        var active=(await Get1("/api/currencies")).GetProperty("currencies").EnumerateArray().Where(x=>x.GetProperty("isActive").GetBoolean()).Select(x=>x.GetProperty("code").GetString()!).ToArray();
        var rates=active.Select(c=>new{currency=c,usdPerUnit=c=="USD"?1m:0.25m}).ToArray();
        var first=new{startDate="2026-01-01",endDate="2026-01-31",rates};
        var saved=await Post("/api/currencies/rate-periods",first);
        Assert.Equal(active.Length,saved.GetArrayLength());
        foreach(var day in new[]{"2026-01-01","2026-01-31"})Assert.Equal(0.25m,(await Get1("/api/currencies/rate?currency=INR&date="+day)).GetProperty("usdPerUnit").GetDecimal());
        // The old open-ended fixture rate must not reappear after the bounded period expires.
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync("/api/currencies/rate?currency=INR&date=2026-02-01")).StatusCode);
        Assert.Equal(1,(await Get1("/api/currencies/rate?currency=USD&date=2026-02-01")).GetProperty("usdPerUnit").GetDecimal());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/currencies/rate-periods",new{startDate="2026-01-15",endDate="2026-02-15",rates})).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/currencies/rate-periods",new{startDate="2026-02-15",endDate="2026-02-01",rates})).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/currencies/rate-periods",new{startDate="2026-02-01",endDate="2026-02-28",rates=rates.Skip(1)})).StatusCode);
        var invalid=rates.Select((x,i)=>new{ x.currency,usdPerUnit=i==rates.Length-1?0m:x.usdPerUnit }).ToArray();
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/currencies/rate-periods",new{startDate="2026-02-01",endDate="2026-02-28",rates=invalid})).StatusCode);
        Assert.DoesNotContain((await Get1("/api/currencies")).GetProperty("rates").EnumerateArray(),x=>x.GetProperty("date").GetString()=="2026-02-01");
        await Post("/api/currencies/rate-periods",new{startDate="2026-02-01",endDate="2026-02-28",rates});
        var today=DateOnly.FromDateTime(DateTime.UtcNow);
        var capture=await Post("/api/billing/cash",new{requestId=Guid.NewGuid(),sourceKind="JOB",sourceId=f.Job,type="RECEIPT",partyCode=f.Customer,amount=100m,currency="AED",exchangeRate=0.25m,date=today,reference="Rate snapshot"});
        await Post("/api/currencies/rate-periods",new{startDate="2026-01-01",endDate="2026-01-31",rates=rates.Select(x=>new{x.currency,usdPerUnit=x.currency=="USD"?1m:0.5m})});
        var captured=(await Get("/api/billing/cash")).Single(x=>Id(x)==Id(capture));
        Assert.Equal(25,captured.GetProperty("details").GetProperty("baseAmount").GetDecimal());
        Assert.Equal(0.5m,(await Get1("/api/currencies/rate?currency=AED&date=2026-01-10")).GetProperty("usdPerUnit").GetDecimal());
    }

    [Fact]
    public async Task Configurable_accounting_currency_drives_rates_precision_reports_and_locks_after_capture()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var settings=await Post("/api/currencies/settings",new{defaultCurrency="AED",baseCurrency="KWD"});
        Assert.Equal("KWD",settings.GetProperty("baseCurrency").GetString());
        var choices=await Get1("/api/currencies");
        Assert.False(choices.GetProperty("baseCurrencyLocked").GetBoolean());
        Assert.Empty(choices.GetProperty("rates").EnumerateArray()); // Old USD-based rates must not be reinterpreted.
        Assert.Equal(1,(await Get1("/api/currencies/rate?currency=KWD&date="+date)).GetProperty("usdPerUnit").GetDecimal());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync("/api/currencies/rate?currency=USD&date="+date)).StatusCode);
        await Post("/api/currencies/rates",new{currency="USD",date="2020-01-01",usdPerUnit=0.307m});
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/currencies/rates",new{currency="KWD",date="2020-01-01",usdPerUnit=2m})).StatusCode);
        var charge=await Charge("JOB",f.Job,"INCOME",f.Customer,1.01m,currency:"USD");
        Assert.Equal(0.310m,charge.GetProperty("details").GetProperty("baseAmount").GetDecimal());
        Assert.Equal("KWD",charge.GetProperty("details").GetProperty("fx").GetProperty("baseCurrency").GetString());
        Assert.Equal(3,charge.GetProperty("details").GetProperty("fx").GetProperty("baseDecimalPlaces").GetInt32());
        Assert.True((await Get1("/api/currencies")).GetProperty("baseCurrencyLocked").GetBoolean());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/currencies/settings",new{defaultCurrency="AED",baseCurrency="USD"})).StatusCode);
        // Updating the transaction default alone preserves the configured accounting base.
        Assert.Equal("KWD",(await Post("/api/currencies/settings",new{defaultCurrency="EUR"})).GetProperty("baseCurrency").GetString());
        var invoice=await Issue(charge);
        var paid=await Post("/api/billing/payments",new{requestId=Guid.NewGuid(),type="RECEIPT",currency="USD",exchangeRate=0.311m,date,accountCode="1000",groups=new[]{new{partyCode=f.Customer,reference="KWD base settlement",allocations=new[]{new{documentId=Id(invoice),version=Version(invoice),amount=1.01m}}}}});
        Assert.Equal(0.314m,paid[0].GetProperty("details").GetProperty("baseAmount").GetDecimal());
        var balance=await Get("/api/billing/base-trial-balance");
        Assert.Equal(0.004m,balance.Single(x=>Code(x)=="4200-FX").GetProperty("credit").GetDecimal());
        Assert.Equal(0,balance.Single(x=>Code(x)=="1100").GetProperty("balance").GetDecimal());
        var report=await Get1("/api/billing/currency-report?mode=BASE&date="+date);
        Assert.Equal("KWD",report.GetProperty("baseCurrency").GetString());
        Assert.All(report.GetProperty("rows").EnumerateArray(),x=>Assert.Equal("KWD",x.GetProperty("reportCurrency").GetString()));
    }

    [Fact]
    public async Task Direct_invoice_and_bill_creation_is_atomic_idempotent_and_uses_dated_rates()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var master=(await Post("/api/billing/charge-masters",new{name="Freight",unit="service",defaultRate=25m,incomeAccount="4000",expenseAccount="5300"})).GetGuid();
        var input=new{requestId=Guid.NewGuid(),type="INVOICE",sourceKind="JOB",sourceId=f.Job,partyCode=f.Customer,currency="INR",date,dueDate=date.AddDays(30),lines=new[]{new{chargeMasterId=master,amount=25m},new{chargeMasterId=master,amount=15m}}};
        var invoice=await Post("/api/billing/documents/new",input);
        Assert.Equal(Id(invoice),Id(await Post("/api/billing/documents/new",input)));
        var details=invoice.GetProperty("details");
        Assert.Equal(40m,details.GetProperty("amount").GetDecimal());
        Assert.Equal(.48m,details.GetProperty("baseAmount").GetDecimal());
        Assert.Equal(.012m,details.GetProperty("fx").GetProperty("usdPerUnit").GetDecimal());
        Assert.Equal(2,details.GetProperty("lines").GetArrayLength());
        Assert.StartsWith("INV-",invoice.GetProperty("number").GetString());
        Assert.All(await Get("/api/billing/charges"),c=>Assert.Equal(Id(invoice),c.GetProperty("details").GetProperty("documentId").GetGuid()));
        var invalid=new{requestId=Guid.NewGuid(),type="BILL",sourceKind="WAREHOUSE",sourceId=f.Receipt,partyCode=f.Vendor1,currency="INR",date,dueDate=date,lines=new[]{new{chargeMasterId=master,amount=25m},new{chargeMasterId=Guid.NewGuid(),amount=15m}}};
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/billing/documents/new",invalid)).StatusCode);
        Assert.Equal(2,(await Get("/api/billing/charges")).Count);
        Assert.Single(await Get("/api/billing/documents"));
        var bill=await Post("/api/billing/documents/new",new{requestId=Guid.NewGuid(),type="BILL",sourceKind="WAREHOUSE",sourceId=f.Receipt,partyCode=f.Vendor1,currency="INR",date,dueDate=date,lines=new[]{new{chargeMasterId=master,amount=60m}}});
        Assert.StartsWith("BILL-",bill.GetProperty("number").GetString());
        Assert.Equal("5300",bill.GetProperty("details").GetProperty("lines")[0].GetProperty("accountCode").GetString());
        var balance=await Get("/api/operations-costs/trial-balance?currency=INR");
        Assert.Equal(40,balance.Single(x=>Code(x)=="1100").GetProperty("debit").GetDecimal());
        Assert.Equal(60,balance.Single(x=>Code(x)=="2000").GetProperty("credit").GetDecimal());
    }
    [Fact]
    public async Task Direct_documents_without_operations_post_and_preserve_optional_source_validation()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var master=(await Post("/api/billing/charge-masters",new{name="Office service",unit="service",defaultRate=10m,incomeAccount="4000",expenseAccount="5300"})).GetGuid();
        foreach(var type in new[]{"INVOICE","BILL"}){
            var doc=await Post("/api/billing/documents/new",new{requestId=Guid.NewGuid(),type,partyCode=type=="INVOICE"?f.Customer:f.Vendor1,currency="INR",date,dueDate=date,lines=new[]{new{chargeMasterId=master,amount=10m}}});
            var line=doc.GetProperty("details").GetProperty("lines")[0];
            Assert.Equal("DIRECT",line.GetProperty("sourceKind").GetString());
            Assert.Equal(Guid.Empty,line.GetProperty("sourceId").GetGuid());
            Assert.Equal(.12m,doc.GetProperty("details").GetProperty("baseAmount").GetDecimal());
            Assert.NotEqual(Guid.Empty,doc.GetProperty("journalId").GetGuid());
        }
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/billing/documents/new",new{requestId=Guid.NewGuid(),type="INVOICE",sourceKind="JOB",sourceId=Guid.NewGuid(),partyCode=f.Customer,currency="INR",date,dueDate=date,lines=new[]{new{chargeMasterId=master,amount=10m}}})).StatusCode);
        Assert.Equal(2,(await Get("/api/billing/documents")).Count);
        Assert.Equal(2,(await Get("/api/billing/charges")).Count);
    }

    [Fact]
    public async Task Sample_rates_are_marked_repeatable_and_preserve_existing_schedules()
    {
        await Setup();
        using var scope=_factory.Services.CreateScope();
        var db=scope.ServiceProvider.GetRequiredService<Movers.DAL.Persistence.MoversDbContext>();
        var tenant=Assert.Single(await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(db.Tenants));
        scope.ServiceProvider.GetRequiredService<Movers.Services.Tenancy.ITenantContext>().SetTenant(tenant);
        var service=scope.ServiceProvider.GetRequiredService<Movers.Services.Currencies.CurrencyService>();
        var start=DateOnly.FromDateTime(DateTime.Today);
        var added=await service.SeedSampleRates(start,CancellationToken.None);
        Assert.NotEmpty(added);
        Assert.All(added,r=>{Assert.True(r.IsSample);Assert.Equal(start,r.Date);Assert.Equal(start.AddDays(364),r.EndDate);});
        Assert.DoesNotContain(added,r=>r.Currency=="INR");
        Assert.Empty(await service.SeedSampleRates(start,CancellationToken.None));
        Assert.Equal(.25m,(await service.Resolve("AED",start,null,CancellationToken.None)).UsdPerUnit);
        Assert.Equal(.012m,(await service.Resolve("INR",start,null,CancellationToken.None)).UsdPerUnit);
    }
    [Fact]
    public async Task Missing_charge_mapping_defaults_support_invoices_and_explicit_mappings_remain_respected()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var master=(await Post("/api/billing/charge-masters",new{name="Default service",unit="service",defaultRate=15m})).GetGuid();
        var mapped=(await Get("/api/billing/charge-masters")).Single(x=>Id(x)==master);
        Assert.Equal("4300",mapped.GetProperty("incomeAccount").GetString());
        Assert.Equal("5600",mapped.GetProperty("expenseAccount").GetString());
        var doc=await Post("/api/billing/documents/new",new{requestId=Guid.NewGuid(),type="INVOICE",partyCode=f.Customer,currency="INR",date,dueDate=date,lines=new[]{new{chargeMasterId=master,amount=15m}}});
        Assert.Equal("4300",doc.GetProperty("details").GetProperty("lines")[0].GetProperty("accountCode").GetString());
        await Post("/api/billing/charge-mappings",new{chargeMasterId=master,incomeAccount="4100",expenseAccount=(string?)null});
        mapped=(await Get("/api/billing/charge-masters")).Single(x=>Id(x)==master);
        Assert.Equal("4100",mapped.GetProperty("incomeAccount").GetString());
        Assert.Equal(JsonValueKind.Null,mapped.GetProperty("expenseAccount").ValueKind);
    }
    [Fact]
    public async Task Quantity_times_unit_price_is_authoritative_rounded_and_saved()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var master=(await Post("/api/billing/charge-masters",new{name="Unit priced service",unit="item",defaultRate=12.35m})).GetGuid();
        foreach(var type in new[]{"INVOICE","BILL"}){
            var doc=await Post("/api/billing/documents/new",new{requestId=Guid.NewGuid(),type,partyCode=type=="INVOICE"?f.Customer:f.Vendor1,currency="INR",date,dueDate=date,lines=new[]{new{chargeMasterId=master,quantity=2.5m,unitPrice=12.35m,amount=999m}}});
            var detail=doc.GetProperty("details");var line=detail.GetProperty("lines")[0];
            Assert.Equal(30.88m,detail.GetProperty("amount").GetDecimal());
            Assert.Equal(2.5m,line.GetProperty("quantity").GetDecimal());
            Assert.Equal(12.35m,line.GetProperty("unitPrice").GetDecimal());
        }
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/billing/documents/new",new{requestId=Guid.NewGuid(),type="INVOICE",partyCode=f.Customer,currency="INR",date,dueDate=date,lines=new[]{new{chargeMasterId=master,quantity=0m,unitPrice=12.35m}}})).StatusCode);
        Assert.Equal(2,(await Get("/api/billing/documents")).Count);
    }
    [Fact]
    public async Task Drafts_post_explicitly_once_and_only_posted_vouchers_settle_balances()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var charges=new[]{await Charge("PICKUP",f.Pickup,"INCOME",f.Customer,30),await Charge("WAREHOUSE",f.Receipt,"INCOME",f.Customer,20),await Charge("JOB",f.Job,"INCOME",f.Customer,50)};
        var draft=await DraftPost("/api/billing/documents",new{requestId=Guid.NewGuid(),charges=charges.Select(c=>new{id=Id(c),version=Version(c)}),date,dueDate=date});
        Assert.Equal(JsonValueKind.Null,draft.GetProperty("journalId").ValueKind);
        Assert.Empty(await Get("/api/operations-costs/journals"));
        var input=new{id=Id(draft),version=Version(draft)};
        var journal=await DraftPost($"/api/billing/documents/{Id(draft)}/post",input);
        Assert.Equal(journal.GetGuid(),(await DraftPost($"/api/billing/documents/{Id(draft)}/post",input)).GetGuid());
        Assert.Single(await Get("/api/operations-costs/journals"));
        var current=await Current(Id(draft));
        var voucher=(await DraftPost("/api/billing/payments",new{requestId=Guid.NewGuid(),type="RECEIPT",currency="INR",date,accountCode="1000",groups=new[]{new{partyCode=f.Customer,reference="Draft receipt",allocations=new[]{new{documentId=Id(current),version=Version(current),amount=100m}}}}}))[0];
        Assert.Equal(JsonValueKind.Null,voucher.GetProperty("journalId").ValueKind);
        Assert.Equal(100m,(await Current(Id(draft))).GetProperty("balance").GetDecimal());
        Assert.Single(await Get("/api/operations-costs/journals"));
        var selection=new{id=Id(voucher),version=Version(voucher)};
        await DraftPost($"/api/billing/vouchers/{Id(voucher)}/post",selection);
        await DraftPost($"/api/billing/vouchers/{Id(voucher)}/post",selection);
        Assert.Equal(0m,(await Current(Id(draft))).GetProperty("balance").GetDecimal());
        var journals=await Get("/api/operations-costs/journals");
        Assert.Equal(2,journals.Count);
        Assert.All(journals,j=>Assert.Equal(j.GetProperty("lines").EnumerateArray().Sum(l=>l.GetProperty("debit").GetDecimal()),j.GetProperty("lines").EnumerateArray().Sum(l=>l.GetProperty("credit").GetDecimal())));
    }

    [Fact]
    public async Task Draft_can_be_cancelled_without_journal_and_unposted_documents_cannot_be_settled()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var charge=await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,20,"5300");
        var draft=await DraftPost("/api/billing/documents",new{requestId=Guid.NewGuid(),charges=new[]{new{id=Id(charge),version=Version(charge)}},date,dueDate=date});
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/billing/payments",new{requestId=Guid.NewGuid(),type="PAYMENT",currency="INR",date,accountCode="1000",groups=new[]{new{partyCode=f.Vendor1,reference="Unposted",allocations=new[]{new{documentId=Id(draft),version=Version(draft),amount=20m}}}}})).StatusCode);
        await DraftPost($"/api/billing/documents/{Id(draft)}/void",new{version=Version(draft),reason="Draft correction",date});
        Assert.Empty(await Get("/api/operations-costs/journals"));
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync($"/api/billing/documents/{Id(draft)}/post",new{id=Id(draft),version=Version(draft)})).StatusCode);
    }
    [Fact]
    public async Task Competing_draft_vouchers_cannot_double_settle_an_invoice()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var invoice=await Issue(await Charge("JOB",f.Job,"INCOME",f.Customer,100));
        async Task<JsonElement> DraftReceipt(){
            var current=await Current(Id(invoice));
            return (await DraftPost("/api/billing/payments",new{requestId=Guid.NewGuid(),type="RECEIPT",currency="INR",date,accountCode="1000",groups=new[]{new{partyCode=f.Customer,reference="Pending receipt",allocations=new[]{new{documentId=Id(current),version=Version(current),amount=100m}}}}}))[0];
        }
        var first=await DraftReceipt();var second=await DraftReceipt();
        await DraftPost($"/api/billing/vouchers/{Id(first)}/post",new{id=Id(first),version=Version(first)});
        Assert.Equal(HttpStatusCode.Conflict,(await _client.PostAsJsonAsync($"/api/billing/vouchers/{Id(second)}/post",new{id=Id(second),version=Version(second)})).StatusCode);
        Assert.Equal(2,(await Get("/api/operations-costs/journals")).Count);
        Assert.Equal(0,(await Current(Id(invoice))).GetProperty("balance").GetDecimal());
    }
    [Fact]
    public async Task Customer_and_vendor_memos_post_balanced_adjustments_and_reverse_once()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        foreach(var vendor in new[]{false,true}){
            var document=await Issue(await Charge("JOB",f.Job,vendor?"EXPENSE":"INCOME",vendor?f.Vendor1:f.Customer,100,vendor?"5300":"4000"));
            var docId=Id(document);var chargeId=document.GetProperty("details").GetProperty("lines")[0].GetProperty("chargeId").GetGuid();
            var credit=await DraftPost("/api/billing/memos",new{requestId=Guid.NewGuid(),type="CREDIT_MEMO",documentId=docId,chargeId,amount=20m,date,reason="Price reduction"});
            Assert.Equal(100,(await Current(docId)).GetProperty("balance").GetDecimal());
            var selection=new{id=Id(credit),version=Version(credit)};
            var journal=await DraftPost($"/api/billing/memos/{Id(credit)}/post",selection);
            Assert.Equal(journal.GetGuid(),(await DraftPost($"/api/billing/memos/{Id(credit)}/post",selection)).GetGuid());
            Assert.Equal(80,(await Current(docId)).GetProperty("balance").GetDecimal());
            var debit=await DraftPost("/api/billing/memos",new{requestId=Guid.NewGuid(),type="DEBIT_MEMO",documentId=docId,chargeId,amount=10m,date,reason="Extra service"});
            await DraftPost($"/api/billing/memos/{Id(debit)}/post",new{id=Id(debit),version=Version(debit)});
            Assert.Equal(90,(await Current(docId)).GetProperty("balance").GetDecimal());
            Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync($"/api/billing/documents/{docId}/void",new{version=Version(await Current(docId)),reason="Cannot bypass memos",date})).StatusCode);
            var postedCredit=(await Get("/api/billing/memos")).Single(m=>Id(m)==Id(credit));
            await DraftPost($"/api/billing/memos/{Id(credit)}/void",new{version=Version(postedCredit),date,reason="Correction"});
            Assert.Equal(110,(await Current(docId)).GetProperty("balance").GetDecimal());
            var current=await Current(docId);
            await Post("/api/billing/payments",new{requestId=Guid.NewGuid(),type=vendor?"PAYMENT":"RECEIPT",currency="INR",date,accountCode="1000",groups=new[]{new{partyCode=vendor?f.Vendor1:f.Customer,reference="Settle adjusted amount",allocations=new[]{new{documentId=docId,version=Version(current),amount=110m}}}}});
            Assert.Equal(0,(await Current(docId)).GetProperty("balance").GetDecimal());
            var postedDebit=(await Get("/api/billing/memos")).Single(m=>Id(m)==Id(debit));
            Assert.Equal(HttpStatusCode.Conflict,(await _client.PostAsJsonAsync($"/api/billing/memos/{Id(debit)}/void",new{version=Version(postedDebit),date,reason="Already settled"})).StatusCode);
        }
        var journals=await Get("/api/operations-costs/journals");
        Assert.All(journals,j=>Assert.Equal(j.GetProperty("lines").EnumerateArray().Sum(l=>l.GetProperty("debit").GetDecimal()),j.GetProperty("lines").EnumerateArray().Sum(l=>l.GetProperty("credit").GetDecimal())));
        var baseBalance=await Get("/api/billing/base-trial-balance");
        Assert.Equal(0,baseBalance.Single(x=>Code(x)=="1100").GetProperty("balance").GetDecimal());
        Assert.Equal(0,baseBalance.Single(x=>Code(x)=="2000").GetProperty("balance").GetDecimal());
    }

    [Fact]
    public async Task Credit_memo_cannot_exceed_outstanding_or_post_again_after_cancellation()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var doc=await Issue(await Charge("PICKUP",f.Pickup,"INCOME",f.Customer,10));
        var memo=await DraftPost("/api/billing/memos",new{requestId=Guid.NewGuid(),type="CREDIT_MEMO",documentId=Id(doc),chargeId=doc.GetProperty("details").GetProperty("lines")[0].GetProperty("chargeId").GetGuid(),amount=11m,date,reason="Too much"});
        Assert.Equal(HttpStatusCode.Conflict,(await _client.PostAsJsonAsync($"/api/billing/memos/{Id(memo)}/post",new{id=Id(memo),version=Version(memo)})).StatusCode);
        await DraftPost($"/api/billing/memos/{Id(memo)}/void",new{version=Version(memo),date,reason="Cancel draft"});
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync($"/api/billing/memos/{Id(memo)}/post",new{id=Id(memo),version=Version(memo)})).StatusCode);
        Assert.Single(await Get("/api/operations-costs/journals"));
    }
    [Fact]
    public async Task Period_trial_balance_separates_opening_movement_and_currency()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        await Issue(await Charge("JOB",f.Job,"INCOME",f.Customer,100));
        var period=await Get1($"/api/billing/reports/trial-balance?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=INR");
        var row=period.GetProperty("rows").EnumerateArray().Single(x=>Code(x)=="1100");
        Assert.Equal(0,row.GetProperty("openingDebit").GetDecimal());
        Assert.Equal(100,row.GetProperty("debit").GetDecimal());
        Assert.Equal(100,row.GetProperty("closingDebit").GetDecimal());
        var next=date.AddDays(1);
        var opening=await Get1($"/api/billing/reports/trial-balance?from={next:yyyy-MM-dd}&to={next:yyyy-MM-dd}&currency=BASE");
        row=opening.GetProperty("rows").EnumerateArray().Single(x=>Code(x)=="1100");
        Assert.Equal(1.2m,row.GetProperty("openingDebit").GetDecimal());
        Assert.Equal(0,row.GetProperty("debit").GetDecimal());
        Assert.Equal(opening.GetProperty("totals").GetProperty("closingDebit").GetDecimal(),opening.GetProperty("totals").GetProperty("closingCredit").GetDecimal());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync($"/api/billing/reports/trial-balance?from={next:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=BASE")).StatusCode);
    }
    [Fact]
    public async Task General_ledger_tracks_running_balances_reversals_and_opening_values()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var invoice=await Issue(await Charge("JOB",f.Job,"INCOME",f.Customer,100));
        var receipt=(await Post("/api/billing/payments",new{requestId=Guid.NewGuid(),type="RECEIPT",currency="INR",date,accountCode="1000",groups=new[]{new{partyCode=f.Customer,reference="GL receipt",allocations=new[]{new{documentId=Id(invoice),version=Version(invoice),amount=40m}}}}}))[0];
        await Post($"/api/billing/vouchers/{Id(receipt)}/void",new{version=Version(receipt),reason="GL reversal",date});
        var report=await Get1($"/api/billing/reports/general-ledger?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=INR&accountCode=1100");
        var rows=report.GetProperty("rows");
        Assert.Equal(3,rows.GetArrayLength());
        Assert.Equal(100,rows[0].GetProperty("balance").GetDecimal());
        Assert.Equal(60,rows[1].GetProperty("balance").GetDecimal());
        Assert.Equal(100,rows[2].GetProperty("balance").GetDecimal());
        Assert.True(rows[2].GetProperty("isReversal").GetBoolean());
        Assert.Equal(140,report.GetProperty("debit").GetDecimal());
        Assert.Equal(40,report.GetProperty("credit").GetDecimal());
        var next=date.AddDays(1);
        var opening=await Get1($"/api/billing/reports/general-ledger?from={next:yyyy-MM-dd}&to={next:yyyy-MM-dd}&currency=BASE&accountCode=1100");
        Assert.Equal(1.2m,opening.GetProperty("opening").GetDecimal());
        Assert.Equal(1.2m,opening.GetProperty("closing").GetDecimal());
        Assert.Equal(0,opening.GetProperty("rows").GetArrayLength());
        var revenue=await Get1($"/api/billing/reports/general-ledger?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=INR&accountCode=4000");
        Assert.Equal(-100,revenue.GetProperty("closing").GetDecimal());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync($"/api/billing/reports/general-ledger?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=INR&accountCode=INVALID")).StatusCode);
    }
    [Fact]
    public async Task Journal_register_filters_posted_entries_and_links_reversals()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var invoice=await Issue(await Charge("JOB",f.Job,"INCOME",f.Customer,100));
        await Post($"/api/billing/documents/{Id(invoice)}/void",new{version=Version(invoice),date,reason="Register test"});
        var draftCharge=await Charge("PICKUP",f.Pickup,"INCOME",f.Customer,30);
        await DraftPost("/api/billing/documents",new{requestId=Guid.NewGuid(),charges=new[]{new{id=Id(draftCharge),version=Version(draftCharge)}},date,dueDate=date});
        var report=await Get1($"/api/billing/reports/journal-register?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=INR&status=ALL");
        var rows=report.GetProperty("rows");Assert.Equal(2,rows.GetArrayLength());
        Assert.Equal(200,report.GetProperty("totals").GetProperty("debit").GetDecimal());
        var original=rows.EnumerateArray().Single(r=>!r.GetProperty("isReversal").GetBoolean());
        var reversal=rows.EnumerateArray().Single(r=>r.GetProperty("isReversal").GetBoolean());
        Assert.Equal("System Administrator",original.GetProperty("postedByName").GetString());
        Assert.Equal(original.GetProperty("reference").GetString(),reversal.GetProperty("reversesReference").GetString());
        Assert.Equal(reversal.GetProperty("reference").GetString(),original.GetProperty("reversedBy")[0].GetString());
        Assert.NotEqual(Guid.Empty,original.GetProperty("postedBy").GetGuid());
        Assert.All(rows.EnumerateArray(),r=>Assert.Equal(r.GetProperty("debit").GetDecimal(),r.GetProperty("lines").EnumerateArray().Sum(l=>l.GetProperty("debit").GetDecimal())));
        var filtered=await Get1($"/api/billing/reports/journal-register?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=BASE&status=REVERSAL");
        Assert.Equal(1,filtered.GetProperty("rows").GetArrayLength());
        Assert.Equal(1.2m,filtered.GetProperty("totals").GetProperty("debit").GetDecimal());
        var tomorrow=date.AddDays(1);
        var empty=await Get1($"/api/billing/reports/journal-register?from={tomorrow:yyyy-MM-dd}&to={tomorrow:yyyy-MM-dd}&currency=INR");
        Assert.Equal(0,empty.GetProperty("rows").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync($"/api/billing/reports/journal-register?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=BASE&status=INVALID")).StatusCode);
    }
    [Fact]
    public async Task Profit_and_loss_includes_memos_reversals_and_excludes_drafts()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var invoice=await Issue(await Charge("JOB",f.Job,"INCOME",f.Customer,100));
        var bill=await Issue(await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,40,"5300"));
        var memo=await DraftPost("/api/billing/memos",new{requestId=Guid.NewGuid(),type="CREDIT_MEMO",documentId=Id(invoice),chargeId=invoice.GetProperty("details").GetProperty("lines")[0].GetProperty("chargeId").GetGuid(),amount=10m,date,reason="Discount"});
        await DraftPost($"/api/billing/memos/{Id(memo)}/post",new{id=Id(memo),version=Version(memo)});
        var charge=await Charge("JOB",f.Job,"INCOME",f.Customer,500);
        await DraftPost("/api/billing/documents",new{requestId=Guid.NewGuid(),charges=new[]{new{id=Id(charge),version=Version(charge)}},date,dueDate=date});
        var url=$"/api/billing/reports/profit-and-loss?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=";
        var report=await Get1(url+"INR");
        Assert.Equal(90,report.GetProperty("revenue").GetDecimal());
        Assert.Equal(40,report.GetProperty("expenses").GetDecimal());
        Assert.Equal(50,report.GetProperty("netProfit").GetDecimal());
        Assert.All(report.GetProperty("rows").EnumerateArray(),r=>Assert.Contains(r.GetProperty("type").GetString(),new[]{"Revenue","Expense"}));
        var baseReport=await Get1(url+"BASE");
        Assert.Equal(.60m,baseReport.GetProperty("netProfit").GetDecimal());
        var empty=await Get1(url+"USD");
        Assert.Equal(0,empty.GetProperty("netProfit").GetDecimal());
        await Post($"/api/billing/documents/{Id(bill)}/void",new{version=Version(bill),date,reason="Expense correction"});
        Assert.Equal(90,(await Get1(url+"INR")).GetProperty("netProfit").GetDecimal());
        await Issue(await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,120,"5300"));
        Assert.Equal(-30,(await Get1(url+"INR")).GetProperty("netProfit").GetDecimal());
        var tomorrow=date.AddDays(1);
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync($"/api/billing/reports/profit-and-loss?from={tomorrow:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=BASE")).StatusCode);
        var next=await Get1($"/api/billing/reports/profit-and-loss?from={tomorrow:yyyy-MM-dd}&to={tomorrow:yyyy-MM-dd}&currency=BASE");
        Assert.Equal(0,next.GetProperty("rows").GetArrayLength());
    }
    [Fact]
    public async Task Balance_sheet_balances_and_does_not_double_count_closed_earnings()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        await Issue(await Charge("JOB",f.Job,"INCOME",f.Customer,100));
        await Issue(await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,40,"5300"));
        var url=$"/api/billing/reports/balance-sheet?date={date:yyyy-MM-dd}&currency=";
        var report=await Get1(url+"INR");
        Assert.Equal(100,report.GetProperty("assets").GetDecimal());
        Assert.Equal(40,report.GetProperty("liabilities").GetDecimal());
        Assert.Equal(60,report.GetProperty("accumulatedEarnings").GetDecimal());
        Assert.True(report.GetProperty("isBalanced").GetBoolean());
        var baseReport=await Get1(url+"BASE");
        Assert.Equal(1.2m,baseReport.GetProperty("assets").GetDecimal());
        Assert.Equal(.72m,baseReport.GetProperty("equity").GetDecimal());
        var prior=date.AddDays(-1);
        Assert.Equal(0,(await Get1($"/api/billing/reports/balance-sheet?date={prior:yyyy-MM-dd}&currency=INR")).GetProperty("assets").GetDecimal());
        Assert.Equal(0,(await Get1(url+"USD")).GetProperty("assets").GetDecimal());
        await Post("/api/operations-costs/journals",new{requestId=Guid.NewGuid(),reference="Year end close",description="Transfer net earnings",currency="INR",postingDate=date,lines=new[]{new{accountCode="4000",debit=100m,credit=0m},new{accountCode="5300",debit=0m,credit=40m},new{accountCode="3000",debit=0m,credit=60m}}});
        report=await Get1(url+"INR");
        Assert.Equal(0,report.GetProperty("accumulatedEarnings").GetDecimal());
        Assert.Equal(60,report.GetProperty("recordedEquity").GetDecimal());
        Assert.Equal(60,report.GetProperty("equity").GetDecimal());
        Assert.True(report.GetProperty("isBalanced").GetBoolean());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync("/api/billing/reports/balance-sheet?currency=BASE")).StatusCode);
    }
    [Fact]
    public async Task Cash_flow_reconciles_and_separates_transfers_mapped_and_mixed_activities()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        await Post("/api/billing/accounts",new{code="1010",name="Bank two",type="Asset",isCashBank=true});
        await Post("/api/billing/accounts",new{code="1500",name="Equipment",type="Asset"});
        async Task Journal(string reference,DateOnly when,object[] lines)=>await Post("/api/operations-costs/journals",new{requestId=Guid.NewGuid(),reference,description=reference,currency="INR",postingDate=when,lines});
        await Journal("Opening funding",date.AddDays(-1),new object[]{new{accountCode="1000",debit=500m,credit=0m},new{accountCode="3000",debit=0m,credit=500m}});
        var invoice=await Issue(await Charge("JOB",f.Job,"INCOME",f.Customer,100));
        await Post("/api/billing/payments",new{requestId=Guid.NewGuid(),type="RECEIPT",currency="INR",date,accountCode="1000",groups=new[]{new{partyCode=f.Customer,reference="Cash received",allocations=new[]{new{documentId=Id(invoice),version=Version(invoice),amount=50m}}}}});
        await Journal("Transfer",date,new object[]{new{accountCode="1010",debit=200m,credit=0m},new{accountCode="1000",debit=0m,credit=200m}});
        await Journal("Equipment purchase",date,new object[]{new{accountCode="1500",debit=150m,credit=0m},new{accountCode="1000",debit=0m,credit=150m}});
        var url=$"/api/billing/reports/cash-flow?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=";
        var report=await Get1(url+"INR");
        Assert.Equal(500,report.GetProperty("opening").GetDecimal());
        Assert.Equal(400,report.GetProperty("closing").GetDecimal());
        Assert.False(report.GetProperty("classificationComplete").GetBoolean());
        await Post("/api/billing/reports/cash-flow/mappings",new{accountCode="1500",category="Investing"});
        report=await Get1(url+"INR");
        Assert.True(report.GetProperty("isReconciled").GetBoolean());
        Assert.True(report.GetProperty("classificationComplete").GetBoolean());
        Assert.Equal(50,report.GetProperty("categories").EnumerateArray().Single(c=>c.GetProperty("category").GetString()=="Operating").GetProperty("net").GetDecimal());
        Assert.Equal(-150,report.GetProperty("categories").EnumerateArray().Single(c=>c.GetProperty("category").GetString()=="Investing").GetProperty("net").GetDecimal());
        var transfer=report.GetProperty("rows").EnumerateArray().Single(r=>r.GetProperty("category").GetString()=="Transfer");
        Assert.Equal(0,transfer.GetProperty("inflow").GetDecimal());
        Assert.Equal(0,transfer.GetProperty("outflow").GetDecimal());
        await Journal("Mixed activity",date,new object[]{new{accountCode="1500",debit=20m,credit=0m},new{accountCode="5300",debit=10m,credit=0m},new{accountCode="1000",debit=0m,credit=30m}});
        report=await Get1(url+"BASE");
        Assert.Equal(4.44m,report.GetProperty("closing").GetDecimal());
        Assert.True(report.GetProperty("isReconciled").GetBoolean());
        Assert.False(report.GetProperty("classificationComplete").GetBoolean());
        Assert.Equal(1,report.GetProperty("unclassifiedCount").GetInt32());
        Assert.Equal(0,(await Get1(url+"USD")).GetProperty("rows").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.PostAsJsonAsync("/api/billing/reports/cash-flow/mappings",new{accountCode="1000",category="Investing"})).StatusCode);
    }
    [Fact]
    public async Task Cash_book_shows_transfer_sides_opening_and_running_balances()
    {
        await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        await Post("/api/billing/accounts",new{code="1010",name="Bank book account",type="Asset",isCashBank=true});
        async Task Journal(string reference,DateOnly when,object[] lines)=>await Post("/api/operations-costs/journals",new{requestId=Guid.NewGuid(),reference,description=reference,currency="INR",postingDate=when,lines});
        await Journal("Opening cash",date.AddDays(-1),new object[]{new{accountCode="1000",debit=500m,credit=0m},new{accountCode="3000",debit=0m,credit=500m}});
        await Journal("Cash to bank",date,new object[]{new{accountCode="1010",debit=200m,credit=0m},new{accountCode="1000",debit=0m,credit=200m}});
        await Journal("Cash expense",date,new object[]{new{accountCode="5300",debit=50m,credit=0m},new{accountCode="1000",debit=0m,credit=50m}});
        var url=$"/api/billing/reports/cash-book?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=INR&accountCode=";
        var cash=await Get1(url+"1000");
        Assert.Equal(500,cash.GetProperty("opening").GetDecimal());
        Assert.Equal(250,cash.GetProperty("credit").GetDecimal());
        Assert.Equal(250,cash.GetProperty("closing").GetDecimal());
        Assert.Equal(300,cash.GetProperty("rows")[0].GetProperty("balance").GetDecimal());
        Assert.True(cash.GetProperty("rows")[0].GetProperty("isTransfer").GetBoolean());
        Assert.False(cash.GetProperty("rows")[1].GetProperty("isTransfer").GetBoolean());
        var bank=await Get1(url+"1010");
        Assert.Equal(200,bank.GetProperty("debit").GetDecimal());
        Assert.Equal(200,bank.GetProperty("closing").GetDecimal());
        Assert.True(bank.GetProperty("rows")[0].GetProperty("isTransfer").GetBoolean());
        var baseCash=await Get1($"/api/billing/reports/cash-book?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=BASE&accountCode=1000");
        Assert.Equal(6m,baseCash.GetProperty("opening").GetDecimal());
        Assert.Equal(3m,baseCash.GetProperty("closing").GetDecimal());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync(url+"4000")).StatusCode);
        var other=await Get1($"/api/billing/reports/cash-book?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=USD&accountCode=1000");
        Assert.Equal(0,other.GetProperty("rows").GetArrayLength());
    }
    [Fact]
    public async Task Customer_statement_includes_posted_activity_reversals_advances_and_currency_balances()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        await Post("/api/currencies/rates",new{currency="AED",date="2020-01-01",usdPerUnit=.25m});
        var invoice=await Issue(await Charge("JOB",f.Job,"INCOME",f.Customer,100));
        var receipt=(await Post("/api/billing/payments",new{requestId=Guid.NewGuid(),type="RECEIPT",currency="INR",date,accountCode="1000",groups=new[]{new{partyCode=f.Customer,reference="Statement receipt",allocations=new[]{new{documentId=Id(invoice),version=Version(invoice),amount=40m}}}}}))[0];
        await Post($"/api/billing/vouchers/{Id(receipt)}/void",new{version=Version(receipt),reason="Receipt correction",date});
        foreach(var value in new[]{(Type:"CREDIT_MEMO",Amount:10m),(Type:"DEBIT_MEMO",Amount:5m)}){
            var memo=await DraftPost("/api/billing/memos",new{requestId=Guid.NewGuid(),type=value.Type,documentId=Id(invoice),chargeId=invoice.GetProperty("details").GetProperty("lines")[0].GetProperty("chargeId").GetGuid(),amount=value.Amount,date,reason="Statement adjustment"});
            await DraftPost($"/api/billing/memos/{Id(memo)}/post",new{id=Id(memo),version=Version(memo)});
        }
        var cash=await Post("/api/billing/cash",new{requestId=Guid.NewGuid(),sourceKind="JOB",sourceId=f.Job,type="RECEIPT",partyCode=f.Customer,amount=20m,currency="INR",date,reference="Advance"});
        var queued=(await Get("/api/billing/cash")).Single(x=>Id(x)==Id(cash));
        await Post($"/api/billing/cash/{Id(cash)}/post",new{requestId=Guid.NewGuid(),expectedVersion=queued.GetProperty("version").GetString(),date,accountCode="1000",partyCode=f.Customer});
        var charge=await Charge("JOB",f.Job,"INCOME",f.Customer,500);
        await DraftPost("/api/billing/documents",new{requestId=Guid.NewGuid(),charges=new[]{new{id=Id(charge),version=Version(charge)}},date,dueDate=date});
        var url=$"/api/billing/reports/customer-statement?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&customerCode={f.Customer}&currency=";
        var report=await Get1(url+"INR");
        Assert.Equal(6,report.GetProperty("rows").GetArrayLength());
        Assert.Equal(145,report.GetProperty("debit").GetDecimal());
        Assert.Equal(70,report.GetProperty("credit").GetDecimal());
        Assert.Equal(75,report.GetProperty("closing").GetDecimal());
        Assert.Single(report.GetProperty("rows").EnumerateArray().Where(r=>r.GetProperty("isReversal").GetBoolean()));
        Assert.Equal(75,report.GetProperty("rows")[5].GetProperty("balance").GetDecimal());
        Assert.Equal(.9m,(await Get1(url+"BASE")).GetProperty("closing").GetDecimal());
        var customer=await Get1(url+"CUSTOMER");
        Assert.Equal("AED",customer.GetProperty("currency").GetString());
        Assert.Equal(3.6m,customer.GetProperty("closing").GetDecimal());
        Assert.Equal(0,(await Get1(url+"USD")).GetProperty("rows").GetArrayLength());
        var tomorrow=date.AddDays(1);
        var opening=await Get1($"/api/billing/reports/customer-statement?from={tomorrow:yyyy-MM-dd}&to={tomorrow:yyyy-MM-dd}&customerCode={f.Customer}&currency=INR");
        Assert.Equal(75,opening.GetProperty("opening").GetDecimal());
        Assert.Equal(0,opening.GetProperty("rows").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync(url.Replace(f.Customer,"MISSING")+"BASE")).StatusCode);
    }
    [Fact]
    public async Task Vendor_statement_tracks_payables_allocated_cash_reversals_and_currency()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        await Post("/api/currencies/rates",new{currency="AED",date="2020-01-01",usdPerUnit=.25m});
        var bill=await Issue(await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,100,"5300"));
        await Issue(await Charge("JOB",f.Job,"EXPENSE",f.Vendor2,900,"5300"));
        var payment=(await Post("/api/billing/payments",new{requestId=Guid.NewGuid(),type="PAYMENT",currency="INR",date,accountCode="1000",groups=new[]{new{partyCode=f.Vendor1,reference="Vendor payment",allocations=new[]{new{documentId=Id(bill),version=Version(bill),amount=40m}}}}}))[0];
        await Post($"/api/billing/vouchers/{Id(payment)}/void",new{version=Version(payment),reason="Payment corrected",date});
        foreach(var value in new[]{(Type:"CREDIT_MEMO",Amount:10m),(Type:"DEBIT_MEMO",Amount:5m)}){
            var memo=await DraftPost("/api/billing/memos",new{requestId=Guid.NewGuid(),type=value.Type,documentId=Id(bill),chargeId=bill.GetProperty("details").GetProperty("lines")[0].GetProperty("chargeId").GetGuid(),amount=value.Amount,date,reason="Vendor adjustment"});
            await DraftPost($"/api/billing/memos/{Id(memo)}/post",new{id=Id(memo),version=Version(memo)});
        }
        var master=(await Post("/api/billing/charge-masters",new{name="Statement freight",unit="service",defaultRate=20m,expenseAccount="5300"})).GetGuid();
        var cash=await Post("/api/billing/cash",new{requestId=Guid.NewGuid(),sourceKind="JOB",sourceId=f.Job,type="EXPENSE_PAID",chargeMasterId=master,partyCode=f.Vendor1,amount=20m,currency="INR",date,reference="Allocated expense"});
        var queued=(await Get("/api/billing/cash")).Single(x=>Id(x)==Id(cash));
        bill=await Current(Id(bill));
        await Post($"/api/billing/cash/{Id(cash)}/post",new{requestId=Guid.NewGuid(),expectedVersion=queued.GetProperty("version").GetString(),date,accountCode="1000",partyCode=f.Vendor1,allocations=new[]{new{documentId=Id(bill),version=Version(bill),amount=20m}}});
        var charge=await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,500,"5300");
        await DraftPost("/api/billing/documents",new{requestId=Guid.NewGuid(),charges=new[]{new{id=Id(charge),version=Version(charge)}},date,dueDate=date});
        var url=$"/api/billing/reports/vendor-statement?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&vendorCode={f.Vendor1}&currency=";
        var report=await Get1(url+"INR");
        Assert.Equal(6,report.GetProperty("rows").GetArrayLength());
        Assert.Equal(70,report.GetProperty("debit").GetDecimal());
        Assert.Equal(145,report.GetProperty("credit").GetDecimal());
        Assert.Equal(75,report.GetProperty("closing").GetDecimal());
        Assert.Equal(75,report.GetProperty("rows")[5].GetProperty("balance").GetDecimal());
        Assert.Single(report.GetProperty("rows").EnumerateArray().Where(r=>r.GetProperty("isReversal").GetBoolean()));
        Assert.Equal(.9m,(await Get1(url+"BASE")).GetProperty("closing").GetDecimal());
        var vendor=await Get1(url+"VENDOR");
        Assert.Equal("AED",vendor.GetProperty("currency").GetString());
        Assert.Equal(3.6m,vendor.GetProperty("closing").GetDecimal());
        Assert.Equal(0,(await Get1(url+"USD")).GetProperty("rows").GetArrayLength());
        var tomorrow=date.AddDays(1);
        var opening=await Get1($"/api/billing/reports/vendor-statement?from={tomorrow:yyyy-MM-dd}&to={tomorrow:yyyy-MM-dd}&vendorCode={f.Vendor1}&currency=INR");
        Assert.Equal(75,opening.GetProperty("opening").GetDecimal());
        Assert.Equal(0,opening.GetProperty("rows").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync(url.Replace(f.Vendor1,"MISSING")+"BASE")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync($"/api/billing/reports/vendor-statement?from={tomorrow:yyyy-MM-dd}&to={date:yyyy-MM-dd}&vendorCode={f.Vendor1}&currency=BASE")).StatusCode);
    }
    [Fact]
    public async Task Receivable_aging_uses_due_boundaries_and_historical_postings()
    {
        var f=await Setup();var today=DateOnly.FromDateTime(DateTime.UtcNow);var date=today.AddDays(-1);
        await Post("/api/currencies/rates",new{currency="AED",date="2020-01-01",usdPerUnit=.25m});
        var invoices=new List<JsonElement>();
        foreach(var days in new[]{0,1,30,31,60,61,90,91}){
            var charge=await Charge("JOB",f.Job,"INCOME",f.Customer,100);
            invoices.Add(await Post("/api/billing/documents",new{requestId=Guid.NewGuid(),charges=new[]{new{id=Id(charge),version=Version(charge)}},date=date.AddDays(-150),dueDate=date.AddDays(-days)}));
        }
        var invoice=invoices[0];
        var receipt=(await Post("/api/billing/payments",new{requestId=Guid.NewGuid(),type="RECEIPT",currency="INR",date,accountCode="1000",groups=new[]{new{partyCode=f.Customer,reference="Historical receipt",allocations=new[]{new{documentId=Id(invoice),version=Version(invoice),amount=40m}}}}}))[0];
        await Post($"/api/billing/vouchers/{Id(receipt)}/void",new{version=Version(receipt),reason="Later reversal",date=today});
        var memo=await DraftPost("/api/billing/memos",new{requestId=Guid.NewGuid(),type="CREDIT_MEMO",documentId=Id(invoice),chargeId=invoice.GetProperty("details").GetProperty("lines")[0].GetProperty("chargeId").GetGuid(),amount=10m,date,reason="Discount"});
        await DraftPost($"/api/billing/memos/{Id(memo)}/post",new{id=Id(memo),version=Version(memo)});
        var draftCharge=await Charge("JOB",f.Job,"INCOME",f.Customer,500);
        await DraftPost("/api/billing/documents",new{requestId=Guid.NewGuid(),charges=new[]{new{id=Id(draftCharge),version=Version(draftCharge)}},date,dueDate=date});
        var url=$"/api/billing/reports/receivable-aging?date={date:yyyy-MM-dd}&customerCode={f.Customer}&currency=";
        var report=await Get1(url+"INR");
        Assert.Equal(8,report.GetProperty("rows").GetArrayLength());
        var totals=report.GetProperty("totals")[0];
        Assert.Equal(50,totals.GetProperty("current").GetDecimal());
        Assert.Equal(200,totals.GetProperty("days1To30").GetDecimal());
        Assert.Equal(200,totals.GetProperty("days31To60").GetDecimal());
        Assert.Equal(200,totals.GetProperty("days61To90").GetDecimal());
        Assert.Equal(100,totals.GetProperty("daysOver90").GetDecimal());
        Assert.Equal(750,totals.GetProperty("outstanding").GetDecimal());
        var summaryUrl=$"/api/billing/reports/outstanding-customers?date={date:yyyy-MM-dd}&customerCode={f.Customer}&currency=";
        var summary=await Get1(summaryUrl+"INR");
        Assert.Single(summary.GetProperty("rows").EnumerateArray());
        var customerRow=summary.GetProperty("rows")[0];
        Assert.Equal(8,customerRow.GetProperty("invoiceCount").GetInt32());
        Assert.Equal(8,customerRow.GetProperty("invoices").GetArrayLength());
        Assert.Equal(50,customerRow.GetProperty("current").GetDecimal());
        Assert.Equal(700,customerRow.GetProperty("overdue").GetDecimal());
        Assert.Equal(750,customerRow.GetProperty("outstanding").GetDecimal());
        Assert.Equal(1,summary.GetProperty("totals")[0].GetProperty("customerCount").GetInt32());
        Assert.Equal(9m,(await Get1(summaryUrl+"BASE")).GetProperty("totals")[0].GetProperty("outstanding").GetDecimal());
        Assert.Equal(36m,(await Get1(summaryUrl+"CUSTOMER")).GetProperty("totals")[0].GetProperty("outstanding").GetDecimal());
        Assert.Equal(790,(await Get1(summaryUrl.Replace(date.ToString("yyyy-MM-dd"),today.ToString("yyyy-MM-dd"))+"INR")).GetProperty("totals")[0].GetProperty("outstanding").GetDecimal());
        Assert.Equal(0,(await Get1(summaryUrl+"USD")).GetProperty("rows").GetArrayLength());
        Assert.Equal(9m,(await Get1(url+"BASE")).GetProperty("totals")[0].GetProperty("outstanding").GetDecimal());
        Assert.Equal(36m,(await Get1(url+"CUSTOMER")).GetProperty("totals")[0].GetProperty("outstanding").GetDecimal());
        Assert.Equal(790,(await Get1(url.Replace(date.ToString("yyyy-MM-dd"),today.ToString("yyyy-MM-dd"))+"INR")).GetProperty("totals")[0].GetProperty("outstanding").GetDecimal());
        Assert.Equal(0,(await Get1(url+"USD")).GetProperty("rows").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync(url.Replace(f.Customer,"MISSING")+"BASE")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync("/api/billing/reports/receivable-aging?currency=BASE")).StatusCode);
    }
    [Fact]
    public async Task Payable_aging_uses_due_boundaries_and_historical_postings()
    {
        var f=await Setup();var today=DateOnly.FromDateTime(DateTime.UtcNow);var date=today.AddDays(-1);
        await Post("/api/currencies/rates",new{currency="AED",date="2020-01-01",usdPerUnit=.25m});
        var invoices=new List<JsonElement>();
        foreach(var days in new[]{0,1,30,31,60,61,90,91}){
            var charge=await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,100,"5300");
            invoices.Add(await Post("/api/billing/documents",new{requestId=Guid.NewGuid(),charges=new[]{new{id=Id(charge),version=Version(charge)}},date=date.AddDays(-150),dueDate=date.AddDays(-days)}));
        }
        var invoice=invoices[0];
        var receipt=(await Post("/api/billing/payments",new{requestId=Guid.NewGuid(),type="PAYMENT",currency="INR",date,accountCode="1000",groups=new[]{new{partyCode=f.Vendor1,reference="Historical receipt",allocations=new[]{new{documentId=Id(invoice),version=Version(invoice),amount=40m}}}}}))[0];
        await Post($"/api/billing/vouchers/{Id(receipt)}/void",new{version=Version(receipt),reason="Later reversal",date=today});
        var memo=await DraftPost("/api/billing/memos",new{requestId=Guid.NewGuid(),type="CREDIT_MEMO",documentId=Id(invoice),chargeId=invoice.GetProperty("details").GetProperty("lines")[0].GetProperty("chargeId").GetGuid(),amount=10m,date,reason="Discount"});
        await DraftPost($"/api/billing/memos/{Id(memo)}/post",new{id=Id(memo),version=Version(memo)});
        var draftCharge=await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,500,"5300");
        await DraftPost("/api/billing/documents",new{requestId=Guid.NewGuid(),charges=new[]{new{id=Id(draftCharge),version=Version(draftCharge)}},date,dueDate=date});
        var url=$"/api/billing/reports/payable-aging?date={date:yyyy-MM-dd}&vendorCode={f.Vendor1}&currency=";
        var report=await Get1(url+"INR");
        Assert.Equal(8,report.GetProperty("rows").GetArrayLength());
        var totals=report.GetProperty("totals")[0];
        Assert.Equal(50,totals.GetProperty("current").GetDecimal());
        Assert.Equal(200,totals.GetProperty("days1To30").GetDecimal());
        Assert.Equal(200,totals.GetProperty("days31To60").GetDecimal());
        Assert.Equal(200,totals.GetProperty("days61To90").GetDecimal());
        Assert.Equal(100,totals.GetProperty("daysOver90").GetDecimal());
        Assert.Equal(750,totals.GetProperty("outstanding").GetDecimal());
        var summaryUrl=$"/api/billing/reports/outstanding-vendors?date={date:yyyy-MM-dd}&vendorCode={f.Vendor1}&currency=";
        var summary=await Get1(summaryUrl+"INR");
        Assert.Single(summary.GetProperty("rows").EnumerateArray());
        var vendorRow=summary.GetProperty("rows")[0];
        Assert.Equal(8,vendorRow.GetProperty("billCount").GetInt32());
        Assert.Equal(8,vendorRow.GetProperty("bills").GetArrayLength());
        Assert.Equal(50,vendorRow.GetProperty("current").GetDecimal());
        Assert.Equal(700,vendorRow.GetProperty("overdue").GetDecimal());
        Assert.Equal(750,vendorRow.GetProperty("outstanding").GetDecimal());
        Assert.Equal(1,summary.GetProperty("totals")[0].GetProperty("vendorCount").GetInt32());
        Assert.Equal(9m,(await Get1(summaryUrl+"BASE")).GetProperty("totals")[0].GetProperty("outstanding").GetDecimal());
        Assert.Equal(36m,(await Get1(summaryUrl+"VENDOR")).GetProperty("totals")[0].GetProperty("outstanding").GetDecimal());
        Assert.Equal(790,(await Get1(summaryUrl.Replace(date.ToString("yyyy-MM-dd"),today.ToString("yyyy-MM-dd"))+"INR")).GetProperty("totals")[0].GetProperty("outstanding").GetDecimal());
        Assert.Equal(0,(await Get1(summaryUrl+"USD")).GetProperty("rows").GetArrayLength());
        Assert.Equal(9m,(await Get1(url+"BASE")).GetProperty("totals")[0].GetProperty("outstanding").GetDecimal());
        Assert.Equal(36m,(await Get1(url+"VENDOR")).GetProperty("totals")[0].GetProperty("outstanding").GetDecimal());
        Assert.Equal(790,(await Get1(url.Replace(date.ToString("yyyy-MM-dd"),today.ToString("yyyy-MM-dd"))+"INR")).GetProperty("totals")[0].GetProperty("outstanding").GetDecimal());
        Assert.Equal(0,(await Get1(url+"USD")).GetProperty("rows").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync(url.Replace(f.Vendor1,"MISSING")+"BASE")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync("/api/billing/reports/payable-aging?currency=BASE")).StatusCode);
    }
    [Fact]
    public async Task Invoice_register_separates_drafts_and_tracks_current_settlement()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        await Post("/api/currencies/rates",new{currency="AED",date="2020-01-01",usdPerUnit=.25m});
        var invoice=await Issue(await Charge("JOB",f.Job,"INCOME",f.Customer,100));
        await Issue(await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,900,"5300"));
        var charge=await Charge("JOB",f.Job,"INCOME",f.Customer,500);
        await DraftPost("/api/billing/documents",new{requestId=Guid.NewGuid(),charges=new[]{new{id=Id(charge),version=Version(charge)}},date,dueDate=date});
        var receipt=(await Post("/api/billing/payments",new{requestId=Guid.NewGuid(),type="RECEIPT",currency="INR",date,accountCode="1000",groups=new[]{new{partyCode=f.Customer,reference="Register payment",allocations=new[]{new{documentId=Id(invoice),version=Version(invoice),amount=40m}}}}}))[0];
        var url=$"/api/billing/reports/invoice-register?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=INR&status=";
        var report=await Get1(url+"ALL");
        Assert.Equal(2,report.GetProperty("rows").GetArrayLength());
        Assert.Equal(0,report.GetProperty("rows").EnumerateArray().Single(r=>r.GetProperty("status").GetString()=="DRAFT").GetProperty("balance").GetDecimal());
        Assert.Equal(60,(await Get1(url+"PART_PAID")).GetProperty("rows")[0].GetProperty("balance").GetDecimal());
        Assert.Equal(.72m,(await Get1(url.Replace("currency=INR","currency=BASE")+"PART_PAID")).GetProperty("rows")[0].GetProperty("balance").GetDecimal());
        Assert.Equal(2.88m,(await Get1(url.Replace("currency=INR","currency=CUSTOMER")+"PART_PAID")).GetProperty("rows")[0].GetProperty("balance").GetDecimal());
        await Post($"/api/billing/vouchers/{Id(receipt)}/void",new{version=Version(receipt),reason="Correct payment",date});
        Assert.Equal(100,(await Get1(url+"UNPAID")).GetProperty("rows")[0].GetProperty("balance").GetDecimal());
        invoice=await Current(Id(invoice));
        await Post($"/api/billing/documents/{Id(invoice)}/void",new{version=Version(invoice),reason="Cancelled",date});
        Assert.Equal(0,(await Get1(url+"VOIDED")).GetProperty("rows")[0].GetProperty("balance").GetDecimal());
        Assert.Equal(0,(await Get1(url.Replace("currency=INR","currency=USD")+"ALL")).GetProperty("rows").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync(url+"INVALID")).StatusCode);
    }
    [Fact]
    public async Task Bill_register_separates_drafts_and_tracks_current_settlement()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        await Post("/api/currencies/rates",new{currency="AED",date="2020-01-01",usdPerUnit=.25m});
        var invoice=await Issue(await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,100,"5300"));
        await Issue(await Charge("JOB",f.Job,"INCOME",f.Customer,900));
        var charge=await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,500,"5300");
        await DraftPost("/api/billing/documents",new{requestId=Guid.NewGuid(),charges=new[]{new{id=Id(charge),version=Version(charge)}},date,dueDate=date});
        var receipt=(await Post("/api/billing/payments",new{requestId=Guid.NewGuid(),type="PAYMENT",currency="INR",date,accountCode="1000",groups=new[]{new{partyCode=f.Vendor1,reference="Register payment",allocations=new[]{new{documentId=Id(invoice),version=Version(invoice),amount=40m}}}}}))[0];
        var url=$"/api/billing/reports/bill-register?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=INR&status=";
        var report=await Get1(url+"ALL");
        Assert.Equal(2,report.GetProperty("rows").GetArrayLength());
        Assert.Equal(0,report.GetProperty("rows").EnumerateArray().Single(r=>r.GetProperty("status").GetString()=="DRAFT").GetProperty("balance").GetDecimal());
        Assert.Equal(60,(await Get1(url+"PART_PAID")).GetProperty("rows")[0].GetProperty("balance").GetDecimal());
        Assert.Equal(.72m,(await Get1(url.Replace("currency=INR","currency=BASE")+"PART_PAID")).GetProperty("rows")[0].GetProperty("balance").GetDecimal());
        Assert.Equal(2.88m,(await Get1(url.Replace("currency=INR","currency=VENDOR")+"PART_PAID")).GetProperty("rows")[0].GetProperty("balance").GetDecimal());
        await Post($"/api/billing/vouchers/{Id(receipt)}/void",new{version=Version(receipt),reason="Correct payment",date});
        Assert.Equal(100,(await Get1(url+"UNPAID")).GetProperty("rows")[0].GetProperty("balance").GetDecimal());
        invoice=await Current(Id(invoice));
        await Post($"/api/billing/documents/{Id(invoice)}/void",new{version=Version(invoice),reason="Cancelled",date});
        Assert.Equal(0,(await Get1(url+"VOIDED")).GetProperty("rows")[0].GetProperty("balance").GetDecimal());
        Assert.Equal(0,(await Get1(url.Replace("currency=INR","currency=USD")+"ALL")).GetProperty("rows").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync(url+"INVALID")).StatusCode);
    }
    [Fact]
    public async Task Receipt_register_deduplicates_operation_receipts_and_separates_statuses()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        await Post("/api/currencies/rates",new{currency="AED",date="2020-01-01",usdPerUnit=.25m});
        var invoice=await Issue(await Charge("JOB",f.Job,"INCOME",f.Customer,100));
        var receipt=(await Post("/api/billing/payments",new{requestId=Guid.NewGuid(),type="RECEIPT",currency="INR",date,accountCode="1000",groups=new[]{new{partyCode=f.Customer,reference="Register receipt",allocations=new[]{new{documentId=Id(invoice),version=Version(invoice),amount=40m}}}}}))[0];
        foreach(var allocate in new[]{true,false}){
            var cash=await Post("/api/billing/cash",new{requestId=Guid.NewGuid(),sourceKind="JOB",sourceId=f.Job,type="RECEIPT",partyCode=f.Customer,amount=20m,currency="INR",date,reference="Operation receipt"});
            var queued=(await Get("/api/billing/cash")).Single(x=>Id(x)==Id(cash));
            invoice=await Current(Id(invoice));
            await Post($"/api/billing/cash/{Id(cash)}/post",new{requestId=Guid.NewGuid(),expectedVersion=queued.GetProperty("version").GetString(),date,accountCode="1000",partyCode=f.Customer,allocations=allocate?new[]{new{documentId=Id(invoice),version=Version(invoice),amount=20m}}:null});
        }
        await Post("/api/billing/cash",new{requestId=Guid.NewGuid(),sourceKind="JOB",sourceId=f.Job,type="RECEIPT",partyCode=f.Customer,amount=15m,currency="INR",date,reference="Draft capture"});
        var advanceUrl=$"/api/billing/reports/customer-advances?date={date:yyyy-MM-dd}&currency=";
        var advances=await Get1(advanceUrl+"INR");
        Assert.Single(advances.GetProperty("rows").EnumerateArray());
        Assert.Equal(20,advances.GetProperty("totals")[0].GetProperty("amount").GetDecimal());
        Assert.Equal(f.Customer,advances.GetProperty("customers")[0].GetProperty("customerCode").GetString());
        Assert.Equal(.24m,(await Get1(advanceUrl+"BASE")).GetProperty("totals")[0].GetProperty("amount").GetDecimal());
        Assert.Equal(.96m,(await Get1(advanceUrl+"CUSTOMER")).GetProperty("totals")[0].GetProperty("amount").GetDecimal());
        Assert.Equal(0,(await Get1(advanceUrl+"USD")).GetProperty("rows").GetArrayLength());
        Assert.Equal(0,(await Get1(advanceUrl.Replace(date.ToString("yyyy-MM-dd"),date.AddDays(-1).ToString("yyyy-MM-dd"))+"INR")).GetProperty("rows").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync(advanceUrl+"INR&customerCode=MISSING")).StatusCode);
        var url=$"/api/billing/reports/receipt-register?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=INR&status=";
        var report=await Get1(url+"POSTED");
        Assert.Equal(3,report.GetProperty("rows").GetArrayLength());
        Assert.Equal(80,report.GetProperty("totals")[0].GetProperty("amount").GetDecimal());
        Assert.Equal(20,report.GetProperty("rows").EnumerateArray().Sum(r=>r.GetProperty("unallocated").GetDecimal()));
        Assert.Equal(2,report.GetProperty("rows").EnumerateArray().Sum(r=>r.GetProperty("allocations").GetArrayLength()));
        Assert.Equal(.96m,(await Get1(url.Replace("currency=INR","currency=BASE")+"POSTED")).GetProperty("totals")[0].GetProperty("amount").GetDecimal());
        Assert.Equal(3.84m,(await Get1(url.Replace("currency=INR","currency=CUSTOMER")+"POSTED")).GetProperty("totals")[0].GetProperty("amount").GetDecimal());
        Assert.Equal(15,(await Get1(url+"DRAFT")).GetProperty("totals")[0].GetProperty("amount").GetDecimal());
        await Post($"/api/billing/vouchers/{Id(receipt)}/void",new{version=Version(receipt),reason="Correction",date});
        Assert.Equal(40,(await Get1(url+"VOIDED")).GetProperty("totals")[0].GetProperty("amount").GetDecimal());
        Assert.Equal(40,(await Get1(url+"POSTED")).GetProperty("totals")[0].GetProperty("amount").GetDecimal());
        Assert.Equal(0,(await Get1(url.Replace("currency=INR","currency=USD")+"ALL")).GetProperty("rows").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync(url+"INVALID")).StatusCode);
    }
    [Fact]
    public async Task Payment_voucher_register_deduplicates_operation_receipts_and_separates_statuses()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        await Post("/api/currencies/rates",new{currency="AED",date="2020-01-01",usdPerUnit=.25m});
        var invoice=await Issue(await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,100,"5300"));
        var receipt=(await Post("/api/billing/payments",new{requestId=Guid.NewGuid(),type="PAYMENT",currency="INR",date,accountCode="1000",groups=new[]{new{partyCode=f.Vendor1,reference="Register receipt",allocations=new[]{new{documentId=Id(invoice),version=Version(invoice),amount=40m}}}}}))[0];
        var master=(await Post("/api/billing/charge-masters",new{name="Register freight",unit="service",defaultRate=20m,expenseAccount="5300"})).GetGuid();
        foreach(var allocate in new[]{true,false}){
            var cash=await Post("/api/billing/cash",new{requestId=Guid.NewGuid(),sourceKind="JOB",sourceId=f.Job,type="EXPENSE_PAID",chargeMasterId=master,partyCode=f.Vendor1,amount=20m,currency="INR",date,reference="Operation receipt"});
            var queued=(await Get("/api/billing/cash")).Single(x=>Id(x)==Id(cash));
            invoice=await Current(Id(invoice));
            await Post($"/api/billing/cash/{Id(cash)}/post",new{requestId=Guid.NewGuid(),expectedVersion=queued.GetProperty("version").GetString(),date,accountCode="1000",partyCode=f.Vendor1,allocations=allocate?new[]{new{documentId=Id(invoice),version=Version(invoice),amount=20m}}:null});
        }
        await Post("/api/billing/cash",new{requestId=Guid.NewGuid(),sourceKind="JOB",sourceId=f.Job,type="EXPENSE_PAID",chargeMasterId=master,partyCode=f.Vendor1,amount=15m,currency="INR",date,reference="Draft capture"});
        var url=$"/api/billing/reports/payment-voucher-register?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=INR&status=";
        var report=await Get1(url+"POSTED");
        Assert.Equal(3,report.GetProperty("rows").GetArrayLength());
        Assert.Equal(80,report.GetProperty("totals")[0].GetProperty("amount").GetDecimal());
        Assert.Equal(20,report.GetProperty("rows").EnumerateArray().Sum(r=>r.GetProperty("unallocated").GetDecimal()));
        Assert.Equal(2,report.GetProperty("rows").EnumerateArray().Sum(r=>r.GetProperty("allocations").GetArrayLength()));
        Assert.Equal(.96m,(await Get1(url.Replace("currency=INR","currency=BASE")+"POSTED")).GetProperty("totals")[0].GetProperty("amount").GetDecimal());
        Assert.Equal(3.84m,(await Get1(url.Replace("currency=INR","currency=VENDOR")+"POSTED")).GetProperty("totals")[0].GetProperty("amount").GetDecimal());
        Assert.Equal(15,(await Get1(url+"DRAFT")).GetProperty("totals")[0].GetProperty("amount").GetDecimal());
        await Post($"/api/billing/vouchers/{Id(receipt)}/void",new{version=Version(receipt),reason="Correction",date});
        Assert.Equal(40,(await Get1(url+"VOIDED")).GetProperty("totals")[0].GetProperty("amount").GetDecimal());
        Assert.Equal(40,(await Get1(url+"POSTED")).GetProperty("totals")[0].GetProperty("amount").GetDecimal());
        Assert.Equal(0,(await Get1(url.Replace("currency=INR","currency=USD")+"ALL")).GetProperty("rows").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync(url+"INVALID")).StatusCode);
    }
    [Fact]
    public async Task Credit_memo_register_filters_parties_status_and_currency()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        await Post("/api/currencies/rates",new{currency="AED",date="2020-01-01",usdPerUnit=.25m});
        JsonElement first=default;
        foreach(var vendor in new[]{false,true}){
            var doc=await Issue(await Charge("JOB",f.Job,vendor?"EXPENSE":"INCOME",vendor?f.Vendor1:f.Customer,100,vendor?"5300":"4000"));
            foreach(var type in new[]{"CREDIT_MEMO","DEBIT_MEMO"}){
                var memo=await DraftPost("/api/billing/memos",new{requestId=Guid.NewGuid(),type,documentId=Id(doc),chargeId=doc.GetProperty("details").GetProperty("lines")[0].GetProperty("chargeId").GetGuid(),amount=10m,date,reason="Register adjustment"});
                await DraftPost($"/api/billing/memos/{Id(memo)}/post",new{id=Id(memo),version=Version(memo)});
                if(!vendor&&type=="CREDIT_MEMO")first=(await Get("/api/billing/memos")).Single(x=>Id(x)==Id(memo));
            }
            await DraftPost("/api/billing/memos",new{requestId=Guid.NewGuid(),type="CREDIT_MEMO",documentId=Id(doc),chargeId=doc.GetProperty("details").GetProperty("lines")[0].GetProperty("chargeId").GetGuid(),amount=5m,date,reason="Draft"});
        }
        var url=$"/api/billing/reports/credit-memo-register?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=INR&status=POSTED&partyType=";
        var report=await Get1(url+"ALL");
        Assert.Equal(2,report.GetProperty("rows").GetArrayLength());
        Assert.Equal(2,report.GetProperty("totals").GetArrayLength());
        Assert.Equal(10,(await Get1(url+"CUSTOMER")).GetProperty("rows")[0].GetProperty("amount").GetDecimal());
        Assert.Equal(.12m,(await Get1(url.Replace("currency=INR","currency=BASE")+"VENDOR")).GetProperty("rows")[0].GetProperty("amount").GetDecimal());
        Assert.Equal(.48m,(await Get1(url.Replace("currency=INR","currency=PARTY")+"CUSTOMER")).GetProperty("rows")[0].GetProperty("amount").GetDecimal());
        Assert.Equal(2,(await Get1(url.Replace("status=POSTED","status=DRAFT")+"ALL")).GetProperty("rows").GetArrayLength());
        await Post($"/api/billing/memos/{Id(first)}/void",new{version=Version(first),reason="Correction",date});
        var reversed=(await Get1(url.Replace("status=POSTED","status=VOIDED")+"CUSTOMER")).GetProperty("rows")[0];
        Assert.StartsWith("REV-",reversed.GetProperty("reversalNumber").GetString());
        Assert.Equal(1,(await Get1(url+"ALL")).GetProperty("rows").GetArrayLength());
        Assert.Equal(0,(await Get1(url.Replace("currency=INR","currency=USD")+"ALL")).GetProperty("rows").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync(url+"ALL&partyCode="+f.Customer)).StatusCode);
    }
    [Fact]
    public async Task Debit_memo_register_filters_parties_status_and_currency()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        await Post("/api/currencies/rates",new{currency="AED",date="2020-01-01",usdPerUnit=.25m});
        JsonElement first=default;
        foreach(var vendor in new[]{false,true}){
            var doc=await Issue(await Charge("JOB",f.Job,vendor?"EXPENSE":"INCOME",vendor?f.Vendor1:f.Customer,100,vendor?"5300":"4000"));
            foreach(var type in new[]{"CREDIT_MEMO","DEBIT_MEMO"}){
                var memo=await DraftPost("/api/billing/memos",new{requestId=Guid.NewGuid(),type,documentId=Id(doc),chargeId=doc.GetProperty("details").GetProperty("lines")[0].GetProperty("chargeId").GetGuid(),amount=10m,date,reason="Register adjustment"});
                await DraftPost($"/api/billing/memos/{Id(memo)}/post",new{id=Id(memo),version=Version(memo)});
                if(!vendor&&type=="DEBIT_MEMO")first=(await Get("/api/billing/memos")).Single(x=>Id(x)==Id(memo));
            }
            await DraftPost("/api/billing/memos",new{requestId=Guid.NewGuid(),type="DEBIT_MEMO",documentId=Id(doc),chargeId=doc.GetProperty("details").GetProperty("lines")[0].GetProperty("chargeId").GetGuid(),amount=5m,date,reason="Draft"});
        }
        var url=$"/api/billing/reports/debit-memo-register?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=INR&status=POSTED&partyType=";
        var report=await Get1(url+"ALL");
        Assert.Equal(2,report.GetProperty("rows").GetArrayLength());
        Assert.Equal(2,report.GetProperty("totals").GetArrayLength());
        Assert.Equal(10,(await Get1(url+"CUSTOMER")).GetProperty("rows")[0].GetProperty("amount").GetDecimal());
        Assert.Equal(.12m,(await Get1(url.Replace("currency=INR","currency=BASE")+"VENDOR")).GetProperty("rows")[0].GetProperty("amount").GetDecimal());
        Assert.Equal(.48m,(await Get1(url.Replace("currency=INR","currency=PARTY")+"CUSTOMER")).GetProperty("rows")[0].GetProperty("amount").GetDecimal());
        Assert.Equal(2,(await Get1(url.Replace("status=POSTED","status=DRAFT")+"ALL")).GetProperty("rows").GetArrayLength());
        await Post($"/api/billing/memos/{Id(first)}/void",new{version=Version(first),reason="Correction",date});
        var reversed=(await Get1(url.Replace("status=POSTED","status=VOIDED")+"CUSTOMER")).GetProperty("rows")[0];
        Assert.StartsWith("REV-",reversed.GetProperty("reversalNumber").GetString());
        Assert.Equal(1,(await Get1(url+"ALL")).GetProperty("rows").GetArrayLength());
        Assert.Equal(0,(await Get1(url.Replace("currency=INR","currency=USD")+"ALL")).GetProperty("rows").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync(url+"ALL&partyCode="+f.Customer)).StatusCode);
    }
    [Fact]
    public async Task Expense_analysis_reconciles_accounts_memos_reversals_and_base_values()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var bill=await Issue(await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,100,"5300"));
        var memo=await DraftPost("/api/billing/memos",new{requestId=Guid.NewGuid(),type="CREDIT_MEMO",documentId=Id(bill),chargeId=bill.GetProperty("details").GetProperty("lines")[0].GetProperty("chargeId").GetGuid(),amount=10m,date,reason="Expense credit"});
        await DraftPost($"/api/billing/memos/{Id(memo)}/post",new{id=Id(memo),version=Version(memo)});
        var reversed=await Issue(await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,20,"5200"));
        await Post($"/api/billing/documents/{Id(reversed)}/void",new{version=Version(reversed),reason="Correction",date});
        var charge=await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,500,"5300");
        await DraftPost("/api/billing/documents",new{requestId=Guid.NewGuid(),charges=new[]{new{id=Id(charge),version=Version(charge)}},date,dueDate=date});
        var url=$"/api/billing/reports/expense-analysis?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=";
        var report=await Get1(url+"INR");
        Assert.Equal(120,report.GetProperty("totals").GetProperty("debit").GetDecimal());
        Assert.Equal(30,report.GetProperty("totals").GetProperty("credit").GetDecimal());
        Assert.Equal(90,report.GetProperty("totals").GetProperty("amount").GetDecimal());
        var fuel=report.GetProperty("rows").EnumerateArray().Single(r=>r.GetProperty("code").GetString()=="5200");
        Assert.Equal(0,fuel.GetProperty("amount").GetDecimal());
        Assert.Single(fuel.GetProperty("entries").EnumerateArray().Where(e=>e.GetProperty("isReversal").GetBoolean()));
        Assert.Equal(1.08m,(await Get1(url+"BASE")).GetProperty("totals").GetProperty("amount").GetDecimal());
        Assert.Single((await Get1(url+"INR&accountCode=5300")).GetProperty("rows").EnumerateArray());
        Assert.Equal(0,(await Get1(url+"USD")).GetProperty("rows").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync(url+"BASE&accountCode=4000")).StatusCode);
    }
    [Fact]
    public async Task Revenue_analysis_reconciles_accounts_memos_reversals_and_base_values()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var bill=await Issue(await Charge("JOB",f.Job,"INCOME",f.Customer,100,"4000"));
        var memo=await DraftPost("/api/billing/memos",new{requestId=Guid.NewGuid(),type="CREDIT_MEMO",documentId=Id(bill),chargeId=bill.GetProperty("details").GetProperty("lines")[0].GetProperty("chargeId").GetGuid(),amount=10m,date,reason="Revenue credit"});
        await DraftPost($"/api/billing/memos/{Id(memo)}/post",new{id=Id(memo),version=Version(memo)});
        var reversed=await Issue(await Charge("JOB",f.Job,"INCOME",f.Customer,20,"4100"));
        await Post($"/api/billing/documents/{Id(reversed)}/void",new{version=Version(reversed),reason="Correction",date});
        var charge=await Charge("JOB",f.Job,"INCOME",f.Customer,500,"4000");
        await DraftPost("/api/billing/documents",new{requestId=Guid.NewGuid(),charges=new[]{new{id=Id(charge),version=Version(charge)}},date,dueDate=date});
        var url=$"/api/billing/reports/revenue-analysis?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=";
        var report=await Get1(url+"INR");
        Assert.Equal(30,report.GetProperty("totals").GetProperty("debit").GetDecimal());
        Assert.Equal(120,report.GetProperty("totals").GetProperty("credit").GetDecimal());
        Assert.Equal(90,report.GetProperty("totals").GetProperty("amount").GetDecimal());
        var fuel=report.GetProperty("rows").EnumerateArray().Single(r=>r.GetProperty("code").GetString()=="4100");
        Assert.Equal(0,fuel.GetProperty("amount").GetDecimal());
        Assert.Single(fuel.GetProperty("entries").EnumerateArray().Where(e=>e.GetProperty("isReversal").GetBoolean()));
        Assert.Equal(1.08m,(await Get1(url+"BASE")).GetProperty("totals").GetProperty("amount").GetDecimal());
        Assert.Single((await Get1(url+"INR&accountCode=4000")).GetProperty("rows").EnumerateArray());
        Assert.Equal(0,(await Get1(url+"USD")).GetProperty("rows").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync(url+"BASE&accountCode=5300")).StatusCode);
    }
    [Fact]
    public async Task Operation_profitability_splits_sources_and_applies_memos_and_reversals()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var pickup=await Charge("PICKUP",f.Pickup,"INCOME",f.Customer,100);
        var job=await Charge("JOB",f.Job,"INCOME",f.Customer,200);
        var warehouse=await Charge("WAREHOUSE",f.Receipt,"INCOME",f.Customer,50,"4100");
        var invoice=await Issue(pickup,job,warehouse);
        await Issue(await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,40,"5300"));
        var reversed=await Issue(await Charge("WAREHOUSE",f.Receipt,"EXPENSE",f.Vendor1,15,"5300"));
        await Post($"/api/billing/documents/{Id(reversed)}/void",new{version=Version(reversed),reason="Correction",date});
        var memo=await DraftPost("/api/billing/memos",new{requestId=Guid.NewGuid(),type="CREDIT_MEMO",documentId=Id(invoice),chargeId=Id(pickup),amount=10m,date,reason="Pickup discount"});
        await DraftPost($"/api/billing/memos/{Id(memo)}/post",new{id=Id(memo),version=Version(memo)});
        var master=(await Post("/api/billing/charge-masters",new{name="Direct fuel",unit="service",defaultRate=5m,expenseAccount="5200"})).GetGuid();
        var cash=await Post("/api/billing/cash",new{requestId=Guid.NewGuid(),sourceKind="JOB",sourceId=f.Job,type="EXPENSE_PAID",partyCode=f.Vendor1,chargeMasterId=master,amount=5m,currency="INR",date,reference="Fuel"});
        var queue=(await Get("/api/billing/cash")).Single(x=>Id(x)==Id(cash));
        await Post($"/api/billing/cash/{Id(cash)}/post",new{requestId=Guid.NewGuid(),expectedVersion=queue.GetProperty("version").GetString(),date,accountCode="1000",partyCode=f.Vendor1});
        await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,500,"5300");
        invoice=await Current(Id(invoice));
        await Post("/api/billing/payments",new{requestId=Guid.NewGuid(),type="RECEIPT",currency="INR",date,accountCode="1000",groups=new[]{new{partyCode=f.Customer,reference="Settlement",allocations=new[]{new{documentId=Id(invoice),version=Version(invoice),amount=20m}}}}});
        var url=$"/api/billing/reports/operation-profitability?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&sourceKind=ALL&currency=";
        var report=await Get1(url+"INR");
        Assert.Equal(3,report.GetProperty("rows").GetArrayLength());
        Assert.Equal(340,report.GetProperty("totals").GetProperty("revenue").GetDecimal());
        Assert.Equal(45,report.GetProperty("totals").GetProperty("expense").GetDecimal());
        Assert.Equal(295,report.GetProperty("totals").GetProperty("profit").GetDecimal());
        Assert.Equal(90,report.GetProperty("rows").EnumerateArray().Single(r=>r.GetProperty("sourceKind").GetString()=="PICKUP").GetProperty("profit").GetDecimal());
        Assert.Equal(155,report.GetProperty("rows").EnumerateArray().Single(r=>r.GetProperty("sourceKind").GetString()=="JOB").GetProperty("profit").GetDecimal());
        Assert.Equal(3.54m,(await Get1(url+"BASE")).GetProperty("totals").GetProperty("profit").GetDecimal());
        Assert.Single((await Get1(url+"INR&sourceId="+f.Job)).GetProperty("rows").EnumerateArray());
        Assert.Equal(0,(await Get1(url+"USD")).GetProperty("rows").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync(url+"INR&sourceId="+Guid.NewGuid())).StatusCode);
    }
    [Fact]
    public async Task Currency_exposure_separates_revaluation_from_posted_exchange_movements()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        await Issue(await Charge("JOB",f.Job,"INCOME",f.Customer,100));
        await Issue(await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,40,"5300"));
        await Post("/api/currencies/rates",new{currency="INR",date,usdPerUnit=.02m});
        await Post("/api/operations-costs/journals",new{requestId=Guid.NewGuid(),reference="Exchange adjustment",description="Posted FX",currency="USD",postingDate=date,lines=new[]{new{accountCode="1000",debit=2m,credit=0m},new{accountCode="4200-FX",debit=0m,credit=2m}}});
        var url=$"/api/billing/reports/currency-exposure?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=";
        var report=await Get1(url+"ALL");
        var row=report.GetProperty("rows")[0];
        Assert.Equal(100,row.GetProperty("receivable").GetDecimal());
        Assert.Equal(40,row.GetProperty("payable").GetDecimal());
        Assert.Equal(60,row.GetProperty("netExposure").GetDecimal());
        Assert.Equal(.72m,row.GetProperty("carryingBase").GetDecimal());
        Assert.Equal(1.2m,row.GetProperty("revaluedBase").GetDecimal());
        Assert.Equal(.48m,row.GetProperty("gainLoss").GetDecimal());
        Assert.Equal(2,report.GetProperty("totals").GetProperty("postedNet").GetDecimal());
        Assert.Equal(0,(await Get1(url+"INR")).GetProperty("posted").GetArrayLength());
        Assert.Equal(0,(await Get1(url+"USD")).GetProperty("rows").GetArrayLength());
        Assert.Equal(2,(await Get1(url+"USD")).GetProperty("totals").GetProperty("postedNet").GetDecimal());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync("/api/billing/reports/currency-exposure?currency=ALL")).StatusCode);
    }
    [Fact]
    public async Task Tax_summary_reports_opening_movements_and_closing_without_inventing_tax()
    {
        await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        await Post("/api/operations-costs/journals",new{requestId=Guid.NewGuid(),reference="Tax opening",description="Tax liability",currency="INR",postingDate=date.AddDays(-1),lines=new[]{new{accountCode="1000",debit=100m,credit=0m},new{accountCode="2200",debit=0m,credit=100m}}});
        await Post("/api/operations-costs/journals",new{requestId=Guid.NewGuid(),reference="Tax payment",description="Payment",currency="INR",postingDate=date,lines=new[]{new{accountCode="2200",debit=40m,credit=0m},new{accountCode="1000",debit=0m,credit=40m}}});
        var url=$"/api/billing/reports/tax-summary?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=";
        var report=await Get1(url+"INR");
        Assert.Equal(-100,report.GetProperty("opening").GetDecimal());
        Assert.Equal(40,report.GetProperty("debit").GetDecimal());
        Assert.Equal(-60,report.GetProperty("closing").GetDecimal());
        Assert.Single(report.GetProperty("rows").EnumerateArray());
        Assert.Equal(-.72m,(await Get1(url+"BASE")).GetProperty("closing").GetDecimal());
        Assert.Equal(0,(await Get1(url+"USD")).GetProperty("closing").GetDecimal());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync("/api/billing/reports/tax-summary?currency=BASE")).StatusCode);
    }
    [Fact]
    public async Task Posting_audit_filters_user_reference_and_reversal_status()
    {
        var f=await Setup();var date=DateOnly.FromDateTime(DateTime.UtcNow);
        var doc=await Issue(await Charge("JOB",f.Job,"INCOME",f.Customer,100));
        await Issue(await Charge("JOB",f.Job,"EXPENSE",f.Vendor1,40,"5300"));
        await Post($"/api/billing/documents/{Id(doc)}/void",new{version=Version(doc),reason="Audit correction",date});
        var url=$"/api/billing/reports/posting-audit?from={date:yyyy-MM-dd}&to={date:yyyy-MM-dd}&currency=INR&status=";
        var report=await Get1(url+"ALL");
        Assert.Equal(3,report.GetProperty("rows").GetArrayLength());
        var users=report.GetProperty("users");Assert.Equal("System Administrator",Assert.Single(users.EnumerateArray()).GetProperty("name").GetString());
        Assert.Equal("System Administrator",(await Get1(url+"ALL&userId="+users[0].GetProperty("id").GetString())).GetProperty("userName").GetString());
        Assert.Single((await Get1(url+"ACTIVE")).GetProperty("rows").EnumerateArray());
        var original=(await Get1(url+"REVERSED")).GetProperty("rows")[0];
        Assert.Single(original.GetProperty("reversedBy").EnumerateArray());
        var reversal=(await Get1(url+"REVERSAL")).GetProperty("rows")[0];
        Assert.Equal(original.GetProperty("reference").GetString(),reversal.GetProperty("reversesReference").GetString());
        Assert.Equal(2,(await Get1(url+"ALL&document="+doc.GetProperty("number").GetString())).GetProperty("rows").GetArrayLength());
        Assert.Equal(3,(await Get1(url+"ALL&userId="+original.GetProperty("postedBy").GetString())).GetProperty("rows").GetArrayLength());
        Assert.Equal(0,(await Get1(url+"ALL&userId="+Guid.NewGuid())).GetProperty("rows").GetArrayLength());
        Assert.Equal(2.88m,(await Get1(url.Replace("currency=INR","currency=BASE")+"ALL")).GetProperty("totals").GetProperty("debit").GetDecimal());
        Assert.Equal(HttpStatusCode.BadRequest,(await _client.GetAsync(url+"INVALID")).StatusCode);
    }
    private async Task LoginAndSelectTenant()
    {
        var login = await Post("/api/auth/login", new { email = "admin@movers.local", password = "ChangeMe123!" }); SetToken(login);
        var tenant = await Post("/api/platform/tenants", new SaveTenantRequest("Pickup Test", "pickup-test", null, null, null));
        SetToken(await Post("/api/auth/select-tenant", new { tenantId = Id(tenant) }));
        await Post("/api/currencies/rates",new{currency="INR",date="2020-01-01",usdPerUnit=0.012m});
    }
    private void SetToken(JsonElement x) => _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", x.GetProperty("accessToken").GetString());
    private static Guid Id(JsonElement x) => x.GetProperty("id").GetGuid();
    private async Task<JsonElement> DraftPost(string url, object body) { var r = await _client.PostAsJsonAsync(url, body); Assert.True(r.IsSuccessStatusCode, $"{url}: {await r.Content.ReadAsStringAsync()}"); return await r.Content.ReadFromJsonAsync<JsonElement>(); }
    // Existing financial scenarios explicitly complete both steps; lifecycle tests use DraftPost.
    private async Task<JsonElement> Post(string url, object body) {
        var result=await DraftPost(url,body);
        if(url=="/api/billing/documents"||url=="/api/billing/documents/new"){
            await DraftPost($"/api/billing/documents/{Id(result)}/post",new{id=Id(result),version=Version(result)});
            return await Current(Id(result));
        }
        if(url=="/api/billing/payments"){
            foreach(var voucher in result.EnumerateArray())await DraftPost($"/api/billing/vouchers/{Id(voucher)}/post",new{id=Id(voucher),version=Version(voucher)});
            var ids=result.EnumerateArray().Select(Id).ToHashSet();
            return JsonSerializer.SerializeToElement((await Get("/api/billing/vouchers")).Where(v=>ids.Contains(Id(v))));
        }
        return result;
    }
    private async Task<JsonElement> Put(string url, object body) { var r = await _client.PutAsJsonAsync(url, body); Assert.True(r.IsSuccessStatusCode, $"{url}: {await r.Content.ReadAsStringAsync()}"); return await r.Content.ReadFromJsonAsync<JsonElement>(); }
    private async Task<List<JsonElement>> Get(string url) => (await _client.GetFromJsonAsync<JsonElement>(url)).EnumerateArray().ToList();
    private async Task<JsonElement> Get1(string url) => await _client.GetFromJsonAsync<JsonElement>(url);
    public async Task DisposeAsync()
    {
        _client.Dispose(); await _factory.DisposeAsync(); SqliteConnection.ClearAllPools();
        if (File.Exists(_databasePath)) File.Delete(_databasePath);
        if (Directory.Exists(_storageRoot)) Directory.Delete(_storageRoot, true);
    }
}























































