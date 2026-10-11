using Movers.Domain.Employees; using Movers.Domain.Pickups; using Movers.Domain.Quotations; using Movers.Domain.Surveys; using Movers.Domain.Tenants;
namespace Movers.Services.Pickups;
public interface IPickupRepository {
 Task<IReadOnlyList<PickupStatus>> Statuses(CancellationToken t); Task<PickupStatus?> Status(Guid id,bool track,CancellationToken t); void Add(PickupStatus x);
 Task<IReadOnlyList<Vehicle>> Vehicles(CancellationToken t); Task<Vehicle?> Vehicle(Guid id,bool track,CancellationToken t); void Add(Vehicle x);
 Task<IReadOnlyList<Pickup>> Pickups(CancellationToken t); Task<Pickup?> Pickup(Guid id,bool track,CancellationToken t); Task<bool> NumberExists(string number,Guid? excluding,CancellationToken t); void Add(Pickup x);
 Task<Quotation?> Quotation(Guid id,CancellationToken t); Task<Employee?> Employee(Guid id,CancellationToken t); Task<BoxType?> Box(Guid id,CancellationToken t); Task<PackingMaterial?> Material(Guid id,CancellationToken t);
 Task<IReadOnlyList<PickupAssignment>> Assignments(Guid id,CancellationToken t); Task<IReadOnlyList<PickupPackage>> Packages(Guid id,CancellationToken t); Task<IReadOnlyList<PickupPackageItem>> PackageItems(IReadOnlyList<Guid> ids,CancellationToken t); Task<IReadOnlyList<PickupMaterialUsage>> Materials(Guid id,CancellationToken t); Task<IReadOnlyList<PickupTransaction>> Transactions(Guid id,CancellationToken t);
 void Replace(IEnumerable<PickupAssignment> oldA,IEnumerable<PickupPackage> oldP,IEnumerable<PickupMaterialUsage> oldM,IEnumerable<PickupAssignment> a,IEnumerable<PickupPackage> p,IEnumerable<PickupPackageItem> pi,IEnumerable<PickupMaterialUsage> m); void Add(PickupTransaction x);
 Task<(Pickup Pickup,Tenant Tenant)?> Public(string hash,CancellationToken t); Task Save(CancellationToken t);
}
