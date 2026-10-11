using Movers.Domain.Operations;
using Movers.Services.Aws;
using Movers.Services.Billing;
using Movers.Services.Pickups;
using Movers.Services.Sales;
using Movers.Services.Security;
using Movers.Services.Tenancy;

namespace Movers.Services.Operations;

public sealed record ExpenseReceiptModel(Guid Id, string Kind, Guid ExpenseId, string OriginalFileName, string ContentType, long SizeBytes, string UploadedBy, DateTimeOffset? UploadedAtUtc);

public interface IExpenseAttachmentRepository
{
    Task<IReadOnlyList<ExpenseAttachment>> ForExpenses(IReadOnlyCollection<Guid> expenseIds, CancellationToken ct);
    Task<ExpenseAttachment?> Get(Guid id, CancellationToken ct);
    /// <summary>True when an expense of this kind with this id exists in the current tenant.</summary>
    Task<bool> ExpenseExists(string kind, Guid expenseId, CancellationToken ct);
    void Add(ExpenseAttachment attachment);
    Task Save(CancellationToken ct);
}

/// <summary>
/// Receipts (photos or documents) attached to any expense. Uploads use the same secure two-step flow as other
/// files: request an upload URL, send the file there, then confirm. Receipts of an expense already posted to the
/// ledger cannot be removed, so the accountant's evidence stays intact.
/// </summary>
public sealed class ExpenseReceiptService(IExpenseAttachmentRepository files, IBillingRepository billing, IPickupWorkRepository settings,
    IAwsObjectStorage storage, ISecretProtector protector, ITenantContext tenant, IUserContext user, TimeProvider clock)
{
    public const long MaxReceiptBytes = 25L * 1024 * 1024;

    /// <summary>Who may add or remove receipts per kind; viewing is also allowed with billing.view (accountants).</summary>
    public static IReadOnlyList<string> EditPermissions(string kind) => kind switch
    {
        ExpenseReceiptKinds.Survey => [SecurityPermissions.SurveysManage],
        ExpenseReceiptKinds.Pickup => [SecurityPermissions.OperationsManage],
        ExpenseReceiptKinds.Packing => [SecurityPermissions.PackingManage, SecurityPermissions.OperationsManage],
        ExpenseReceiptKinds.Delivery => [SecurityPermissions.DeliveryManage, SecurityPermissions.OperationsManage],
        ExpenseReceiptKinds.Operations => [SecurityPermissions.AccountingManage],
        ExpenseReceiptKinds.Cash => [SecurityPermissions.BillingCapture],
        _ => []
    };

    public static string Kind(string? kind)
    {
        var k = (kind ?? "").Trim().ToUpperInvariant();
        return ExpenseReceiptKinds.All.Contains(k) ? k : throw new KeyNotFoundException();
    }

    public bool CanEdit(string kind) => EditPermissions(kind).Any(user.HasPermission);
    public bool CanView(string kind) => CanEdit(kind) || user.HasPermission(SecurityPermissions.BillingView);

    /// <summary>Receipts of one or more expenses (any kind), grouped by the caller.</summary>
    public async Task<IReadOnlyList<ExpenseReceiptModel>> List(IReadOnlyCollection<Guid> expenseIds, CancellationToken ct)
    {
        if (expenseIds.Count > 5000) throw new InvalidOperationException("Ask for at most 5000 expenses at a time.");
        return (await files.ForExpenses(expenseIds, ct)).Where(x => x.IsUploaded && !x.IsDeleted && CanView(x.Kind)).OrderBy(x => x.CreatedAtUtc).Select(Map).ToList();
    }

    public async Task<PresignedUploadModel> Create(string kind, Guid expenseId, UploadRequestModel input, CancellationToken ct)
    {
        Authorize(kind, edit: true);
        if (!await files.ExpenseExists(kind, expenseId, ct)) throw new KeyNotFoundException();
        var (name, type) = UploadPolicy.Validate(input);
        var mediaType = type.Split(';')[0].Trim();
        if (mediaType.StartsWith("video/") || mediaType.StartsWith("audio/")) throw new InvalidOperationException("Attach a photo, PDF, Word or Excel file as the receipt.");
        if (input.SizeBytes > MaxReceiptBytes) throw new InvalidOperationException("A receipt can be at most 25 MB.");
        var credentials = StorageCredentials.Resolve(storage, protector, await settings.AwsAsync(ct));
        var attachment = new ExpenseAttachment(tenant.TenantId, kind, expenseId, name, type, input.SizeBytes, string.IsNullOrWhiteSpace(user.Email) ? "Staff" : user.Email);
        var expires = clock.GetUtcNow().AddMinutes(15);
        var url = await storage.CreateUploadUrlAsync(credentials, attachment.ObjectKey, type, expires, ct);
        files.Add(attachment); await files.Save(ct);
        return new(attachment.Id, url, expires);
    }

    public async Task<ExpenseReceiptModel> Complete(Guid id, CancellationToken ct)
    {
        var file = await Require(id, edit: true, ct);
        if (file.IsUploaded) return Map(file);
        var info = await storage.GetObjectInfoAsync(StorageCredentials.Resolve(storage, protector, await settings.AwsAsync(ct)), file.ObjectKey, ct)
            ?? throw new InvalidOperationException("The file has not reached storage yet.");
        UploadPolicy.EnsureStoredSize(info, file.DeclaredSizeBytes);
        file.MarkUploaded(info.SizeBytes, clock.GetUtcNow()); await files.Save(ct);
        return Map(file);
    }

    public async Task<string> Download(Guid id, CancellationToken ct)
    {
        var file = await Require(id, edit: false, ct);
        if (!file.IsUploaded) throw new KeyNotFoundException();
        return await storage.CreateDownloadUrlAsync(StorageCredentials.Resolve(storage, protector, await settings.AwsAsync(ct)), file.ObjectKey, file.OriginalFileName, clock.GetUtcNow().AddMinutes(10), ct);
    }

    public async Task<bool> Remove(Guid id, CancellationToken ct)
    {
        var file = await Require(id, edit: true, ct);
        if (await billing.CashIsPosted(file.ExpenseId, ct)) throw new InvalidOperationException("This expense is posted to the ledger; its receipts can no longer be removed.");
        file.Delete(); await files.Save(ct); return true;
    }

    private void Authorize(string kind, bool edit)
    {
        if (!(edit ? CanEdit(kind) : CanView(kind))) throw new UnauthorizedAccessException("You do not have access to these receipts.");
    }

    private async Task<ExpenseAttachment> Require(Guid id, bool edit, CancellationToken ct)
    {
        var file = await files.Get(id, ct);
        if (file is null || file.IsDeleted) throw new KeyNotFoundException();
        Authorize(file.Kind, edit);
        return file;
    }

    private static ExpenseReceiptModel Map(ExpenseAttachment x) => new(x.Id, x.Kind, x.ExpenseId, x.OriginalFileName, x.ContentType, x.StoredSizeBytes ?? x.DeclaredSizeBytes, x.UploadedBy, x.UploadedAtUtc);
}
