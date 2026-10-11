using Movers.Services.Currencies;
using Movers.Services.Operations;
namespace Movers.Services.Billing;
public sealed partial class BillingService {
 private static BatchChargeLine PriceLine(BatchChargeLine line,FxSnapshot fx) {
  if(line.Quantity<=0||line.Quantity>1000000||decimal.Round(line.Quantity,4)!=line.Quantity)throw new InvalidOperationException("Quantity must be positive, at most 1,000,000, with up to four decimal places.");
  if(line.UnitPrice is null&&line.Quantity!=1)throw new InvalidOperationException("Enter the amount per item.");
  var price=line.UnitPrice??line.Amount;
  CurrencyService.Amount(price,fx);
  var amount=CurrencyService.Round(line.Quantity*price,fx.DecimalPlaces);
  CurrencyService.Amount(amount,fx);
  return line with{Amount=amount,UnitPrice=price};
 }
 public async Task<BillingView<Document>> CreateDocument(NewDocumentInput c,CancellationToken ct) {
  var prior=await Retry("DOCUMENT",c.RequestId,c,ct);if(prior is not null)return View<Document>(prior);
  if(c.Type is not ("INVOICE" or "BILL"))throw new InvalidOperationException("Choose invoice or bill.");
  if(c.Lines is null||c.Lines.Count is <1 or >100)throw new InvalidOperationException("Add 1 to 100 charges.");
  var number=await numbers.Next(c.Type=="INVOICE"?"INV":"BILL",ct);
  var reserved=new List<string>();foreach(var line in c.Lines)reserved.Add(await numbers.Next("CHG",ct));
  return await unit.Transaction(async()=>{
   var retry=await Retry("DOCUMENT",c.RequestId,c,ct);if(retry is not null)return View<Document>(retry);
   Date(c.Date);if(c.DueDate<c.Date)throw new InvalidOperationException("Due date cannot precede the document date.");
   if(c.Reference?.Length>120||c.Notes?.Length>2000)throw new InvalidOperationException("Reference or notes exceed the allowed length.");
   var income=c.Type=="INVOICE";
   Source source;
   if(c.SourceId is null&&string.IsNullOrWhiteSpace(c.SourceKind))source=new("DIRECT",Guid.Empty,"Direct entry");
   else source=(await Sources(ct)).SingleOrDefault(x=>x.Kind==c.SourceKind&&x.Id==c.SourceId)??throw new InvalidOperationException("Select a valid source or leave the operation empty.");
   var party=(await masters.List(income?"customer":"vendor",ct)).SingleOrDefault(x=>x.Code==c.PartyCode&&x.IsActive)??throw new InvalidOperationException("Select an active customer/vendor.");
   var fx=await currencies.Resolve(c.Currency,c.Date,c.ExchangeRate,ct);
   var mapped=await MappedCharges(ct);var accounts=await Accounts(ct);
   var rows=new List<Movers.Domain.Operations.BillingRecord>();var lines=new List<DocumentLine>();
   for(var i=0;i<c.Lines.Count;i++){
    var l=PriceLine(c.Lines[i],fx);
    var master=mapped.SingleOrDefault(x=>x.Id==l.ChargeMasterId&&x.IsActive)??throw new InvalidOperationException("Select an active charge.");
    var account=income?master.IncomeAccount:master.ExpenseAccount;
    if(!accounts.Any(x=>x.Code==account&&x.IsActive&&x.Type==(income?"Revenue":"Expense")))throw new InvalidOperationException("Map an active account in the charge master for "+master.Name+".");
    var amount=CurrencyService.ToBase(l.Amount,fx);
    var charge=new Charge(source.Kind,source.Id,source.Label,income?"INCOME":"EXPENSE",party.Code,party.Name,Text(l.Description??master.Name,500,"Description"),account!,fx.Currency,l.Amount,Fx:fx,BaseAmount:amount,Quantity:l.Quantity,UnitPrice:l.UnitPrice);
    var r=Add("CHARGE",reserved[i],Guid.NewGuid(),l,charge);rows.Add(r);
    lines.Add(new(r.Id,source.Kind,source.Id,source.Label,charge.Description,account!,l.Amount,l.Quantity,l.UnitPrice));

   }
   var baseTotal=rows.Sum(r=>Read<Charge>(r).BaseAmount!.Value);
   var doc=new Document(c.Type,party.Code,party.Name,party.Address,fx.Currency,c.Date,c.DueDate,c.Reference,c.Notes,lines.Sum(l=>l.Amount),lines,Fx:fx,BaseAmount:baseTotal);Money(doc.Amount);
   var row=Add("DOCUMENT",number,c.RequestId,c,doc);
   foreach(var r in rows)Write(r,Read<Charge>(r) with{DocumentId=row.Id});
   await unit.Save(ct);return View<Document>(row);
  },ct);
 }
}




