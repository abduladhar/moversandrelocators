using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Movers.Services.Billing;
using Movers.Services.Operations;
using Movers.Services.Security;
namespace Movers.Api.Controllers;
[ApiController,Authorize(Policy=SecurityPermissions.BillingView),Route("api/billing")]
public sealed class BillingController(BillingService service):ControllerBase {
 [HttpGet("choices")] public Task<IActionResult> Choices(CancellationToken ct)=>Run(()=>service.Choices(ct));
 [HttpGet("charges")] public Task<IActionResult> Charges(CancellationToken ct)=>Run(()=>service.Charges(ct));
 [HttpGet("documents")] public Task<IActionResult> Documents(CancellationToken ct)=>Run(()=>service.Documents(ct));
 [HttpGet("vouchers")] public Task<IActionResult> Vouchers(CancellationToken ct)=>Run(()=>service.Vouchers(ct));
 [HttpGet("accounts")] public Task<IActionResult> Accounts(CancellationToken ct)=>Run(()=>service.Accounts(ct));
 [HttpPost("accounts"),Authorize(Policy=SecurityPermissions.BillingAccounts)] public Task<IActionResult> Account(Account input,CancellationToken ct)=>Run(()=>service.SaveAccount(input,ct));
 [HttpPost("charges"),Authorize(Policy=SecurityPermissions.BillingCapture)] public Task<IActionResult> Charge(ChargeInput input,CancellationToken ct)=>Run(()=>service.Capture(input,ct));
 [HttpPost("charges/{id:guid}/cancel"),Authorize(Policy=SecurityPermissions.BillingCapture)] public Task<IActionResult> Cancel(Guid id,Selection input,CancellationToken ct)=>Run(()=>service.CancelCharge(id,input,ct));
 [HttpPost("documents"),Authorize(Policy=SecurityPermissions.BillingIssue)] public Task<IActionResult> Issue(IssueInput input,CancellationToken ct)=>Run(()=>service.Issue(input,ct));
 [HttpPost("documents/new"),Authorize(Policy=SecurityPermissions.BillingIssue),Authorize(Policy=SecurityPermissions.BillingCapture)] public Task<IActionResult> CreateDocument(NewDocumentInput input,CancellationToken ct)=>Run(()=>service.CreateDocument(input,ct));
 [HttpPost("documents/{id:guid}/post"),Authorize(Policy=SecurityPermissions.BillingPay)] public Task<IActionResult> PostDocument(Guid id,Selection input,CancellationToken ct)=>Run(()=>service.PostToAccounting(id,"DOCUMENT",input,ct));
 [HttpPost("vouchers/{id:guid}/post"),Authorize(Policy=SecurityPermissions.BillingPay)] public Task<IActionResult> PostVoucher(Guid id,Selection input,CancellationToken ct)=>Run(()=>service.PostToAccounting(id,"VOUCHER",input,ct));
 [HttpPost("payments"),Authorize(Policy=SecurityPermissions.BillingPay)] public Task<IActionResult> Pay(PaymentInput input,CancellationToken ct)=>Run(()=>service.Pay(input,ct));
 [HttpPost("documents/{id:guid}/void"),Authorize(Policy=SecurityPermissions.BillingIssue)] public Task<IActionResult> VoidDocument(Guid id,VoidInput input,CancellationToken ct)=>Run(()=>service.Void(id,"DOCUMENT",input,ct));
 [HttpPost("vouchers/{id:guid}/void"),Authorize(Policy=SecurityPermissions.BillingPay)] public Task<IActionResult> VoidVoucher(Guid id,VoidInput input,CancellationToken ct)=>Run(()=>service.Void(id,"VOUCHER",input,ct));
 [HttpPost("charge-masters"),Authorize(Policy=SecurityPermissions.BillingAccounts)] public Task<IActionResult> NewMaster(NewMappedCharge input,CancellationToken ct)=>Run(()=>service.CreateMappedCharge(input,ct));
 [HttpGet("charge-masters")] public Task<IActionResult> ChargeMasters(CancellationToken ct)=>Run(()=>service.MappedCharges(ct));
 [HttpPost("charge-mappings"),Authorize(Policy=SecurityPermissions.BillingAccounts)] public Task<IActionResult> Mapping(ChargeMapping input,CancellationToken ct)=>Run(()=>service.MapCharge(input,ct));
 [HttpPost("charge-batches"),Authorize(Policy=SecurityPermissions.BillingCapture)] public Task<IActionResult> Batch(ChargeBatch input,CancellationToken ct)=>Run(()=>service.CaptureBatch(input,ct));
 [HttpGet("cash")] public Task<IActionResult> Cash(CancellationToken ct)=>Run(()=>service.CashQueue(ct));
 [HttpPost("cash"),Authorize(Policy=SecurityPermissions.BillingCapture)] public Task<IActionResult> Cash(CashCapture input,CancellationToken ct)=>Run(()=>service.CaptureCash(input,ct));
 [HttpPost("cash/{id:guid}/post"),Authorize(Policy=SecurityPermissions.BillingPay)] public Task<IActionResult> PostCash(Guid id,CashPostInput input,CancellationToken ct)=>Run(()=>service.PostCash(id,input,ct));
 [HttpGet("currency-report")] public Task<IActionResult> CurrencyReport(string mode,DateOnly date,string? sourceKind,Guid? sourceId,CancellationToken ct)=>Run(()=>service.CurrencyReport(mode,date,sourceKind,sourceId,ct));
 [HttpGet("base-trial-balance")] public Task<IActionResult> BaseBalance(CancellationToken ct)=>Run(()=>service.BaseTrialBalance(ct));
 [HttpGet("memos")] public Task<IActionResult> Memos(CancellationToken ct)=>Run(()=>service.Memos(ct));
 [HttpPost("memos"),Authorize(Policy=SecurityPermissions.BillingIssue)] public Task<IActionResult> Memo(MemoInput c,CancellationToken ct)=>Run(()=>service.CreateMemo(c,ct));
 [HttpPost("memos/{id:guid}/post"),Authorize(Policy=SecurityPermissions.BillingPay)] public Task<IActionResult> PostMemo(Guid id,Selection c,CancellationToken ct)=>Run(()=>service.PostMemo(id,c,ct));
 [HttpPost("memos/{id:guid}/void"),Authorize(Policy=SecurityPermissions.BillingPay)] public Task<IActionResult> VoidMemo(Guid id,VoidInput c,CancellationToken ct)=>Run(()=>service.VoidMemo(id,c,ct));
 [HttpGet("reports/trial-balance")] public Task<IActionResult> TrialBalance(DateOnly from,DateOnly to,string currency,CancellationToken ct)=>Run(()=>service.TrialBalanceReport(from,to,currency,ct));
 [HttpGet("reports/general-ledger")] public Task<IActionResult> GeneralLedger(DateOnly from,DateOnly to,string currency,string accountCode,CancellationToken ct)=>Run(()=>service.GeneralLedgerReport(from,to,currency,accountCode,ct));
 [HttpGet("reports/journal-register")] public Task<IActionResult> JournalRegister(DateOnly from,DateOnly to,string currency,CancellationToken ct,string status="ALL")=>Run(()=>service.JournalRegister(from,to,currency,status,ct));
 [HttpGet("reports/profit-and-loss")] public Task<IActionResult> ProfitAndLoss(DateOnly from,DateOnly to,string currency,CancellationToken ct)=>Run(()=>service.ProfitAndLossReport(from,to,currency,ct));
 [HttpGet("reports/balance-sheet")] public Task<IActionResult> BalanceSheet(DateOnly date,string currency,CancellationToken ct)=>Run(()=>service.BalanceSheetReport(date,currency,ct));
 [HttpGet("reports/cash-flow")] public Task<IActionResult> CashFlow(DateOnly from,DateOnly to,string currency,CancellationToken ct)=>Run(()=>service.CashFlowReport(from,to,currency,ct));
 [HttpGet("reports/cash-flow/mappings")] public Task<IActionResult> CashFlowMappings(CancellationToken ct)=>Run(()=>service.CashFlowMappings(ct));
 [HttpPost("reports/cash-flow/mappings"),Authorize(Policy=SecurityPermissions.BillingAccounts)] public Task<IActionResult> SaveCashFlowMapping(CashFlowMapping c,CancellationToken ct)=>Run(()=>service.SaveCashFlowMapping(c,ct));
 [HttpGet("reports/cash-book")] public Task<IActionResult> CashBook(DateOnly from,DateOnly to,string currency,string accountCode,CancellationToken ct)=>Run(()=>service.CashBookReport(from,to,currency,accountCode,ct));
 [HttpGet("reports/employee-expenses")] public Task<IActionResult> EmployeeExpenses(DateOnly from,DateOnly to,string currency,Guid? employeeId,string? sourceKind,string? status,CancellationToken ct)=>Run(()=>service.EmployeeExpenses(from,to,currency,employeeId,sourceKind??"ALL",status??"ALL",ct));
 [HttpGet("reports/operation-profitability")] public Task<IActionResult> OperationProfitability(DateOnly from,DateOnly to,string currency,string sourceKind,Guid? sourceId,CancellationToken ct)=>Run(()=>service.OperationProfitability(from,to,currency,sourceKind,sourceId,ct));
 [HttpGet("reports/currency-exposure")] public Task<IActionResult> CurrencyExposure(DateOnly from,DateOnly to,string currency,CancellationToken ct)=>Run(()=>service.CurrencyExposure(from,to,currency,ct));
 [HttpGet("reports/posting-audit")] public Task<IActionResult> PostingAudit(DateOnly from,DateOnly to,string currency,string status,Guid? userId,string? document,CancellationToken ct)=>Run(()=>service.PostingAudit(from,to,currency,status,userId,document,ct));
 [HttpGet("reports/tax-summary")] public Task<IActionResult> TaxSummary(DateOnly from,DateOnly to,string currency,CancellationToken ct)=>Run(()=>service.TaxSummary(from,to,currency,ct));
 [HttpGet("reports/expense-analysis")] public Task<IActionResult> ExpenseAnalysis(DateOnly from,DateOnly to,string currency,string? accountCode,CancellationToken ct)=>Run(()=>service.ExpenseAnalysis(from,to,currency,accountCode,ct));
 [HttpGet("reports/revenue-analysis")] public Task<IActionResult> RevenueAnalysis(DateOnly from,DateOnly to,string currency,string? accountCode,CancellationToken ct)=>Run(()=>service.RevenueAnalysis(from,to,currency,accountCode,ct));
 [HttpGet("reports/customer-advances")] public Task<IActionResult> CustomerAdvances(DateOnly date,string currency,string? customerCode,CancellationToken ct)=>Run(()=>service.CustomerAdvances(date,currency,customerCode,ct));
 [HttpGet("reports/outstanding-customers")] public Task<IActionResult> OutstandingCustomers(DateOnly date,string currency,string? customerCode,CancellationToken ct)=>Run(()=>service.OutstandingCustomers(date,currency,customerCode,ct));
 [HttpGet("reports/outstanding-vendors")] public Task<IActionResult> OutstandingVendors(DateOnly date,string currency,string? vendorCode,CancellationToken ct)=>Run(()=>service.OutstandingVendors(date,currency,vendorCode,ct));
 [HttpGet("reports/receivable-aging")] public Task<IActionResult> ReceivableAging(DateOnly date,string currency,string? customerCode,CancellationToken ct)=>Run(()=>service.ReceivableAging(date,currency,customerCode,ct));
 [HttpGet("reports/credit-memo-register")] public Task<IActionResult> CreditMemoRegister(DateOnly from,DateOnly to,string currency,string status,string partyType,string? partyCode,CancellationToken ct)=>Run(()=>service.CreditMemoRegister(from,to,currency,status,partyType,partyCode,ct));
 [HttpGet("reports/debit-memo-register")] public Task<IActionResult> DebitMemoRegister(DateOnly from,DateOnly to,string currency,string status,string partyType,string? partyCode,CancellationToken ct)=>Run(()=>service.DebitMemoRegister(from,to,currency,status,partyType,partyCode,ct));
 [HttpGet("reports/receipt-register")] public Task<IActionResult> ReceiptRegister(DateOnly from,DateOnly to,string currency,string status,string? customerCode,CancellationToken ct)=>Run(()=>service.ReceiptRegister(from,to,currency,status,customerCode,ct));
 [HttpGet("reports/payment-voucher-register")] public Task<IActionResult> PaymentVoucherRegister(DateOnly from,DateOnly to,string currency,string status,string? vendorCode,CancellationToken ct)=>Run(()=>service.PaymentVoucherRegister(from,to,currency,status,vendorCode,ct));
 [HttpGet("reports/invoice-register")] public Task<IActionResult> InvoiceRegister(DateOnly from,DateOnly to,string currency,string status,string? customerCode,CancellationToken ct)=>Run(()=>service.InvoiceRegister(from,to,currency,status,customerCode,ct));
 [HttpGet("reports/bill-register")] public Task<IActionResult> BillRegister(DateOnly from,DateOnly to,string currency,string status,string? vendorCode,CancellationToken ct)=>Run(()=>service.BillRegister(from,to,currency,status,vendorCode,ct));
 [HttpGet("reports/payable-aging")] public Task<IActionResult> PayableAging(DateOnly date,string currency,string? vendorCode,CancellationToken ct)=>Run(()=>service.PayableAging(date,currency,vendorCode,ct));
 [HttpGet("reports/customer-statement")] public Task<IActionResult> CustomerStatement(DateOnly from,DateOnly to,string currency,string customerCode,CancellationToken ct)=>Run(()=>service.CustomerStatement(from,to,currency,customerCode,ct));
 [HttpGet("reports/vendor-statement")] public Task<IActionResult> VendorStatement(DateOnly from,DateOnly to,string currency,string vendorCode,CancellationToken ct)=>Run(()=>service.VendorStatement(from,to,currency,vendorCode,ct));
 private async Task<IActionResult> Run<T>(Func<Task<T>> action) {
  try{return Ok(await action());}catch(OperationConflictException e){return Conflict(new{message=e.Message});}
  catch(InvalidOperationException e){return BadRequest(new{message=e.Message});}catch(KeyNotFoundException){return NotFound();}
  catch(UnauthorizedAccessException){return Forbid();}
 }
}

































