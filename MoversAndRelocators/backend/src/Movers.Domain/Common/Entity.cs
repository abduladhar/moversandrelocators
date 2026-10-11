namespace Movers.Domain.Common;

/// <summary>
/// Common identity for every persisted table. SerialNo is database-generated and
/// provides a stable, sortable creation sequence; Id remains the public identifier.
/// </summary>
public abstract class Entity
{
    protected Entity() => Id = Guid.NewGuid();

    public int SerialNo { get; private set; }
    public Guid Id { get; protected set; }
}
