using Movers.Domain.Operations;
namespace Movers.Services.Billing;
public record Account(string Code, string Name, string Type, bool IsActive = true, bool IsCashBank = false);
public record Source(string Kind, Guid Id, string Label);
public record ChargeInput(Guid RequestId, string SourceKind, Guid SourceId, string Direction, string PartyCode, string Description, string AccountCode, string Currency, decimal Amount,decimal? ExchangeRate = null);
public record Charge(string SourceKind, Guid SourceId, string SourceLabel, string Direction, string PartyCode, string PartyName, string Description, string AccountCode, string Currency, decimal Amount, Guid? DocumentId = null, bool Cancelled = false,Movers.Services.Currencies.FxSnapshot? Fx = null,decimal? BaseAmount = null,decimal Quantity = 1,decimal? UnitPrice = null);
public record Selection(Guid Id, Guid Version);
public record IssueInput(Guid RequestId, IReadOnlyList<Selection> Charges, DateOnly Date, DateOnly DueDate, string? Reference, string? Notes);
public record Document(string Type, string PartyCode, string PartyName, string? Address, string Currency, DateOnly Date, DateOnly DueDate, string? Reference, string? Notes, decimal Amount, IReadOnlyList<DocumentLine> Lines, bool Voided = false, string? VoidReason = null,Movers.Services.Currencies.FxSnapshot? Fx = null,decimal? BaseAmount = null);
public record DocumentLine(Guid ChargeId, string SourceKind, Guid SourceId, string SourceLabel, string Description, string AccountCode, decimal Amount,decimal Quantity = 1,decimal? UnitPrice = null);
public record Allocation(Guid DocumentId, Guid Version, decimal Amount, decimal? PaymentAmount = null, decimal? BaseAmount = null);
public record PaymentGroup(string PartyCode, string Reference, IReadOnlyList<Allocation> Allocations);
public record PaymentInput(Guid RequestId, string Type, string Currency, DateOnly Date, string AccountCode, IReadOnlyList<PaymentGroup> Groups, string? Notes,decimal? ExchangeRate = null);
public record Voucher(string Type, string PartyCode, string PartyName, string Currency, DateOnly Date, string AccountCode, string Reference, string? Notes, decimal Amount, IReadOnlyList<Allocation> Allocations, bool Voided = false, string? VoidReason = null,Movers.Services.Currencies.FxSnapshot? Fx = null,decimal? BaseAmount = null);
public record VoidInput(Guid Version, string Reason, DateOnly Date);
public record BillingView<T>(Guid Id, string Number, Guid Version, Guid? JournalId, T Details);
public record DocumentView(Guid Id, string Number, Guid Version, Guid? JournalId, Document Details, decimal Paid, decimal Balance);
public interface IBillingRepository {
 Task<IReadOnlyList<BillingRecord>> List(string kind, CancellationToken ct);
 Task<BillingRecord?> Get(Guid id, CancellationToken ct);
 Task<BillingRecord?> Request(string kind, Guid requestId, CancellationToken ct);
 Task<IReadOnlyList<Source>> Sources(CancellationToken ct);
 Task<bool> CashIsPosted(Guid id,CancellationToken ct);
 Task<bool> OwnsJournal(Guid id, CancellationToken ct);
}

public record ChargeMapping(Guid ChargeMasterId, string? IncomeAccount, string? ExpenseAccount);
public record MappedCharge(Guid Id,string Code,string Name,decimal DefaultRate,bool IsActive,string? IncomeAccount,string? ExpenseAccount);
public record BatchChargeLine(Guid ChargeMasterId,decimal Amount,string? Description,decimal Quantity = 1,decimal? UnitPrice = null);
public record ChargeBatch(Guid RequestId,string SourceKind,Guid SourceId,string Direction,string PartyCode,string Currency,IReadOnlyList<BatchChargeLine> Lines,decimal? ExchangeRate = null);
public record CashCapture(Guid RequestId,string SourceKind,Guid SourceId,string Type,string PartyCode,decimal Amount,string Currency,DateOnly Date,string Reference,Guid? ChargeMasterId,string? Notes,decimal? ExchangeRate = null);
public record CashData(string SourceKind,Guid SourceId,string SourceLabel,string Type,string? PartyCode,string PartyName,decimal Amount,string Currency,DateOnly Date,string Reference,Guid? ChargeMasterId,string? Notes,Movers.Services.Currencies.FxSnapshot? Fx = null,decimal? BaseAmount = null);
public record CashView(Guid Id,string Number,string Version,CashData Details,bool Posted,string? PostingNumber,Guid? JournalId);
public record CashPostInput(Guid RequestId,string ExpectedVersion,DateOnly Date,string AccountCode,string PartyCode,Guid? ChargeMasterId,IReadOnlyList<Allocation>? Allocations,decimal? ExchangeRate = null);
public record CashPosting(Guid CaptureId,CashData Snapshot,string Number,Guid? VoucherId);

public record NewMappedCharge(string Name,string Unit,decimal DefaultRate,string? IncomeAccount,string? ExpenseAccount);


public record NewDocumentInput(Guid RequestId,string Type,string? SourceKind,Guid? SourceId,string PartyCode,string Currency,DateOnly Date,DateOnly DueDate,string? Reference,string? Notes,IReadOnlyList<BatchChargeLine> Lines,decimal? ExchangeRate=null);


public record MemoInput(Guid RequestId,string Type,Guid DocumentId,Guid ChargeId,decimal Amount,DateOnly Date,string Reason);
public record Memo(string Type,Guid DocumentId,string DocumentNumber,string DocumentType,Guid ChargeId,string PartyCode,string PartyName,string Currency,DateOnly Date,string AccountCode,decimal Amount,decimal BaseAmount,string Reason,bool Voided=false);
