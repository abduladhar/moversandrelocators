using Movers.Domain.Common;
namespace Movers.Domain.Masters;
public sealed class BusinessMaster : TenantOwnedEntity
{
    private BusinessMaster() { }
    public BusinessMaster(Guid tenantId, string kind, string code, string payload) : base(tenantId) { Kind = kind; Code = code; Payload = payload; }
    public string Kind { get; private set; } = "";
    public string Code { get; private set; } = "";
    public string Payload { get; private set; } = "";
    public void Update(string payload) => Payload = payload;
}
