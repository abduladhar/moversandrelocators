using Movers.Domain.Common;

namespace Movers.Domain.Employees;

public sealed class Designation : TenantOwnedEntity
{
    private Designation() { }

    public Designation(Guid tenantId, string code, string name, int level, string? description, bool isSalesman = false) : base(tenantId)
    {
        CreatedAtUtc = DateTimeOffset.UtcNow;
        Update(code, name, level, description, isSalesman);
        IsActive = true;
    }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public int Level { get; private set; }
    public string? Description { get; private set; }
    public bool IsActive { get; private set; }
    public bool IsSalesman { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public void Update(string code, string name, int level, string? description, bool isSalesman = false)
    {
        if (level < 1) throw new ArgumentOutOfRangeException(nameof(level), "Level must be at least 1.");
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Level = level;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        IsSalesman = isSalesman;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void SetActive(bool active) { IsActive = active; UpdatedAtUtc = DateTimeOffset.UtcNow; }
}
