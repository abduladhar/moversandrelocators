using Movers.Domain.Common;

namespace Movers.Domain.Security;

public sealed class Permission : Entity
{
    private Permission() { }

    public Permission(string code, string name, string module)
    {
        Code = code.Trim();
        Name = name.Trim();
        Module = module.Trim();
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Module { get; private set; } = string.Empty;
}
