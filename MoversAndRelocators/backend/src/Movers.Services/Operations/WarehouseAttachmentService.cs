using Movers.Domain.Operations;
using Movers.Services.Aws;
using Movers.Services.Pickups;
using Movers.Services.Sales;
using Movers.Services.Security;
using Movers.Services.Tenancy;
namespace Movers.Services.Operations;
public sealed record WarehouseFileModel(Guid Id, string OriginalFileName, string ContentType, long SizeBytes, string UploadedBy, DateTimeOffset? UploadedAtUtc);
public interface IWarehouseAttachmentRepository {
    Task<IReadOnlyList<WarehouseAttachment>> List(Guid receiptId, CancellationToken ct);
    Task<WarehouseAttachment?> Get(Guid id, CancellationToken ct);
}
public sealed class WarehouseAttachmentService(IWarehouseRepository receipts, IWarehouseAttachmentRepository files, IOperationsRepository unit,
    IPickupWorkRepository settings, IAwsObjectStorage storage, ISecretProtector protector, ITenantContext tenant, IUserContext user, TimeProvider clock) {
    public async Task<IReadOnlyList<WarehouseFileModel>> List(Guid receiptId, CancellationToken ct) {
        await RequireReceipt(receiptId, ct); return (await files.List(receiptId, ct)).Select(Map).ToList();
    }
    public async Task<PresignedUploadModel> Create(Guid receiptId, UploadRequestModel input, CancellationToken ct) {
        await RequireReceipt(receiptId, ct); var (name, type) = UploadPolicy.Validate(input);
        var credentials = StorageCredentials.Resolve(storage, protector, await settings.AwsAsync(ct));
        var attachment = new WarehouseAttachment(tenant.TenantId) { ReceiptId = receiptId, OriginalFileName = name, ContentType = type, DeclaredSizeBytes = input.SizeBytes, UploadedBy = user.Email ?? "Staff" };
        attachment.ObjectKey = $"tenants/{tenant.TenantId:N}/warehouse-receipts/{receiptId:N}/attachments/{attachment.Id:N}/{name}";
        var expires = clock.GetUtcNow().AddMinutes(15);
        var url = await storage.CreateUploadUrlAsync(credentials, attachment.ObjectKey, type, expires, ct);
        unit.Add(attachment); await unit.Save(ct); return new(attachment.Id, url, expires);
    }
    public async Task<WarehouseFileModel> Complete(Guid receiptId, Guid id, CancellationToken ct) {
        var file = await RequireFile(receiptId, id, ct);
        if (file.IsUploaded) return Map(file);
        var info = await storage.GetObjectInfoAsync(StorageCredentials.Resolve(storage, protector, await settings.AwsAsync(ct)), file.ObjectKey, ct)
            ?? throw new InvalidOperationException("The file has not reached storage yet.");
        UploadPolicy.EnsureStoredSize(info, file.DeclaredSizeBytes);
        file.IsUploaded = true; file.StoredSizeBytes = info.SizeBytes; file.UploadedAtUtc = clock.GetUtcNow(); await unit.Save(ct); return Map(file);
    }
    public async Task<string> Download(Guid receiptId, Guid id, CancellationToken ct) {
        var file = await RequireFile(receiptId, id, ct);
        if (!file.IsUploaded) throw new KeyNotFoundException();
        return await storage.CreateDownloadUrlAsync(StorageCredentials.Resolve(storage, protector, await settings.AwsAsync(ct)), file.ObjectKey, file.OriginalFileName, clock.GetUtcNow().AddMinutes(10), ct);
    }
    public async Task<bool> Remove(Guid receiptId, Guid id, CancellationToken ct) {
        var file = await RequireFile(receiptId, id, ct); file.IsDeleted = true; await unit.Save(ct); return true;
    }
    private async Task RequireReceipt(Guid id, CancellationToken ct) { if (await receipts.Receipt(id, ct) is null) throw new KeyNotFoundException(); }
    private async Task<WarehouseAttachment> RequireFile(Guid receiptId, Guid id, CancellationToken ct) {
        await RequireReceipt(receiptId, ct); var file = await files.Get(id, ct);
        return file is not null && file.ReceiptId == receiptId && !file.IsDeleted ? file : throw new KeyNotFoundException();
    }
    private static WarehouseFileModel Map(WarehouseAttachment x) => new(x.Id, x.OriginalFileName, x.ContentType, x.StoredSizeBytes ?? x.DeclaredSizeBytes, x.UploadedBy, x.UploadedAtUtc);
}
