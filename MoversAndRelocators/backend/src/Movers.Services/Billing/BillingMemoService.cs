using Movers.Services.Currencies;
using Movers.Services.Operations;
namespace Movers.Services.Billing;
public sealed partial class BillingService {
 public async Task<IReadOnlyList<BillingView<Memo>>> Memos(CancellationToken ct)=>(await repository.List("MEMO",ct)).Select(View<Memo>).ToList();
 private async Task<decimal> MemoAdjustment(Guid id,bool baseValue,CancellationToken ct)=>(await Memos(ct)).Where(m=>m.JournalId.HasValue&&!m.Details.Voided&&m.Details.DocumentId==id).Sum(m=>(m.Details.Type=="CREDIT_MEMO"?-1:1)*(baseValue?m.Details.BaseAmount:m.Details.Amount));
 public async Task<BillingView<Memo>> CreateMemo(MemoInput c,CancellationToken ct){
  var prior=await Retry("MEMO",c.RequestId,c,ct);if(prior is not null)return View<Memo>(prior);
  if(c.Type is not ("CREDIT_MEMO" or "DEBIT_MEMO"))throw new InvalidOperationException("Select credit or debit memo.");
  var number=await numbers.Next(c.Type=="CREDIT_MEMO"?"CM":"DM",ct);
  return await unit.Transaction(async()=>{
   var retry=await Retry("MEMO",c.RequestId,c,ct);if(retry is not null)return View<Memo>(retry);
   var document=await Require(c.DocumentId,"DOCUMENT",ct);var d=Read<Document>(document);
   if(!document.JournalId.HasValue||d.Voided||d.BaseAmount is null)throw new InvalidOperationException("Select a posted invoice or bill with a saved exchange rate.");
   Date(c.Date);if(c.Date<d.Date)throw new InvalidOperationException("Memo date cannot precede the original document.");
   var line=d.Lines.SingleOrDefault(x=>x.ChargeId==c.ChargeId)??throw new InvalidOperationException("Select an original document charge.");
   var currency=await currencies.Require(d.Currency,ct);CurrencyService.Amount(c.Amount,new(d.Currency,1,c.Date,currency.DecimalPlaces));
   var baseCurrency=await currencies.Require((await currencies.Settings(ct)).BaseCurrency!,ct);
   var value=CurrencyService.Round(d.BaseAmount.Value*c.Amount/d.Amount,baseCurrency.DecimalPlaces);
   var memo=new Memo(c.Type,document.Id,document.Number,d.Type,c.ChargeId,d.PartyCode,d.PartyName,d.Currency,c.Date,line.AccountCode,c.Amount,value,Text(c.Reason,1000,"Reason"));
   var row=Add("MEMO",number,c.RequestId,c,memo);await unit.Save(ct);return View<Memo>(row);
  },ct);
 }
 public Task<Guid> PostMemo(Guid id,Selection input,CancellationToken ct)=>unit.Transaction(async()=>{
  var row=await Require(id,"MEMO",ct);var m=Read<Memo>(row);
  if(input.Id!=id||m.Voided)throw new InvalidOperationException("Select an active memo.");
  if(row.JournalId.HasValue)return row.JournalId.Value;
  Check(row,input.Version);
  var docRow=await Require(m.DocumentId,"DOCUMENT",ct);var doc=(await Documents(ct)).Single(x=>x.Id==m.DocumentId);
  if(!docRow.JournalId.HasValue||doc.Details.Voided)throw new InvalidOperationException("Original document is no longer posted and active.");
  var credit=m.Type=="CREDIT_MEMO";var invoice=m.DocumentType=="INVOICE";
  if(credit&&m.Amount>doc.Balance)throw new OperationConflictException("Credit memo exceeds the outstanding balance. Reverse the relevant payment before reducing a settled amount.");
  if(!(await Accounts(ct)).Any(a=>a.IsActive&&a.Code==m.AccountCode&&a.Type==(invoice?"Revenue":"Expense")))throw new InvalidOperationException("The original charge account is inactive.");
  // Credit reduces the document; debit increases it, for both customer and supplier documents.
  var debitControl=invoice!=credit;var control=invoice?"1100":"2000";
  var baseValue=m.BaseAmount;
  if(credit&&m.Amount==doc.Balance){
   var used=(await Vouchers(ct)).Where(v=>v.JournalId.HasValue&&!v.Details.Voided).SelectMany(v=>v.Details.Allocations).Where(a=>a.DocumentId==m.DocumentId).Sum(a=>a.BaseAmount??0);
   baseValue=doc.Details.BaseAmount!.Value+await MemoAdjustment(m.DocumentId,true,ct)-used;
  }
  row.JournalId=Post(row.Number,m.Currency,m.Date,[new(control,debitControl?m.Amount:0,debitControl?0:m.Amount),new(m.AccountCode,debitControl?0:m.Amount,debitControl?m.Amount:0)]);
  await currencies.SaveBaseJournal(row.JournalId.Value,[new(control,debitControl?baseValue:0,debitControl?0:baseValue),new(m.AccountCode,debitControl?0:baseValue,debitControl?baseValue:0)],ct);
  Write(row,m with{BaseAmount=baseValue});docRow.Version=Guid.NewGuid();await unit.Save(ct);return row.JournalId.Value;
 },ct);
 public Task<bool> VoidMemo(Guid id,VoidInput input,CancellationToken ct)=>unit.Transaction(async()=>{
  var row=await Require(id,"MEMO",ct);Check(row,input.Version);var m=Read<Memo>(row);
  if(m.Voided)throw new InvalidOperationException("Memo is already cancelled.");
  Date(input.Date);if(input.Date<m.Date)throw new InvalidOperationException("Reversal date cannot precede memo.");
  var reason=Text(input.Reason,500,"Reversal reason");
  var doc=(await Documents(ct)).Single(d=>d.Id==m.DocumentId);
  if(row.JournalId.HasValue&&m.Type=="DEBIT_MEMO"&&doc.Balance<m.Amount)throw new OperationConflictException("Reverse payments against this debit memo before reversing it.");
  if(row.JournalId.HasValue){
   var lines=(await unit.JournalLines(ct)).Where(l=>l.JournalId==row.JournalId).Select(l=>new JournalLineInput(l.AccountCode,l.Credit,l.Debit)).ToList();
   var reversal=Post("REV-"+row.Number,m.Currency,input.Date,lines,row.JournalId);
   await currencies.SaveBaseJournal(reversal,(await currencies.BaseLines(row.JournalId.Value,ct)).Select(l=>new JournalLineInput(l.AccountCode,l.Credit,l.Debit)).ToList(),ct);
  }
  Write(row,m with{Voided=true});(await Require(m.DocumentId,"DOCUMENT",ct)).Version=Guid.NewGuid();
  Add("MEMOREVERSAL",row.Number,Guid.NewGuid(),input,new{MemoId=id,Reason=reason,Date=input.Date});await unit.Save(ct);return true;
 },ct);
}
