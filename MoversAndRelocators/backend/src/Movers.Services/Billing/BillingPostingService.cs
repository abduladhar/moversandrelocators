using Movers.Services.Operations;
namespace Movers.Services.Billing;
public sealed partial class BillingService {
 public Task<Guid> PostToAccounting(Guid id,string kind,Selection input,CancellationToken ct)=>unit.Transaction(async()=>{
  var row=await Require(id,kind,ct);
  if(input.Id!=id)throw new InvalidOperationException("Posting selection does not match the document.");
  if(kind=="DOCUMENT"?Read<Document>(row).Voided:Read<Voucher>(row).Voided)throw new InvalidOperationException("A voided document cannot be posted.");
  // A retry returns the original journal, including after the version changed on posting.
  if(row.JournalId.HasValue)return row.JournalId.Value;
  Check(row,input.Version);
  var accounts=await Accounts(ct);
  if(kind=="DOCUMENT"){
   var d=Read<Document>(row);Date(d.Date);var income=d.Type=="INVOICE";
   var lines=new List<JournalLineInput>();var baseLines=new List<JournalLineInput>();
   foreach(var l in d.Lines){
    if(!accounts.Any(a=>a.Code==l.AccountCode&&a.IsActive&&a.Type==(income?"Revenue":"Expense")))throw new InvalidOperationException("A charge account is inactive. Review the account setup before posting.");
    var charge=Read<Charge>(await Require(l.ChargeId,"CHARGE",ct));
    if(charge.DocumentId!=id||charge.Cancelled||charge.BaseAmount is null)throw new OperationConflictException("A charge changed or has no saved exchange-rate value.");
    lines.Add(new(l.AccountCode,income?0:l.Amount,income?l.Amount:0));
    baseLines.Add(new(l.AccountCode,income?0:charge.BaseAmount.Value,income?charge.BaseAmount.Value:0));
   }
   var baseTotal=baseLines.Sum(l=>income?l.Credit:l.Debit);
   if(d.BaseAmount!=baseTotal||d.Amount!=d.Lines.Sum(l=>l.Amount))throw new InvalidOperationException("Document totals do not match the saved charges.");
   lines.Add(new(income?"1100":"2000",income?d.Amount:0,income?0:d.Amount));
   baseLines.Add(new(income?"1100":"2000",income?baseTotal:0,income?0:baseTotal));
   row.JournalId=Post(row.Number,d.Currency,d.Date,lines);
   await currencies.SaveBaseJournal(row.JournalId.Value,baseLines,ct);
  }else if(kind=="VOUCHER"){
   var v=Read<Voucher>(row);Date(v.Date);var receipt=v.Type=="RECEIPT";
   if(!accounts.Any(a=>a.Code==v.AccountCode&&a.IsActive&&a.IsCashBank))throw new InvalidOperationException("Select an active cash/bank account before posting.");
   var documents=await Documents(ct);
   foreach(var a in v.Allocations){
    var d=documents.Single(x=>x.Id==a.DocumentId);
    if(!d.JournalId.HasValue||d.Details.Voided||d.Details.PartyCode!=v.PartyCode||d.Details.Type!=(receipt?"INVOICE":"BILL")||d.Balance<a.Amount||d.Details.Date>v.Date)
     throw new OperationConflictException("An allocated invoice/bill is unposted, voided or has insufficient balance. Cancel this draft voucher and create a corrected one.");
    (await Require(a.DocumentId,"DOCUMENT",ct)).Version=Guid.NewGuid();
   }
   var fx=v.Fx??throw new InvalidOperationException("This voucher has no saved exchange rate.");
   var valued=await ValueAllocations(v.Allocations,documents,fx,ct);
   if(valued.Sum(a=>a.PaymentAmount)!=v.Amount||v.BaseAmount is null)throw new InvalidOperationException("Voucher total does not match its allocations.");
   row.JournalId=Post(row.Number,v.Currency,v.Date,receipt?[new(v.AccountCode,v.Amount,0),new("1100",0,v.Amount)]:[new("2000",v.Amount,0),new(v.AccountCode,0,v.Amount)]);
   await SaveSettlementBase(row.JournalId.Value,receipt,v.AccountCode,v.BaseAmount.Value,valued,documents,ct);
   Write(row,v with{Allocations=valued});
  }else throw new InvalidOperationException("Only documents and vouchers can be posted.");
  row.Version=Guid.NewGuid();await unit.Save(ct);return row.JournalId!.Value;
 },ct);
}
