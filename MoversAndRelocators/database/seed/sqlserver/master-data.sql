/*
  Movers & Relocators: starter master data, employees and customers for ONE tenant (SQL Server).

  How to use
    1. Set @TenantId below to the tenant's Id (Platform › Tenant workspace, or: SELECT Id, Name FROM Tenants).
    2. Check @Currency (must be an active currency of the tenant; the default location currency is AED unless changed)
       and @EmailDomain.
    3. Run the whole script. It is safe to run more than once: every row is matched on its code (employee number,
       registration number) and skipped when it already exists, so nothing created in the app is changed.

  What it adds
    designations, employees (with reporting lines), customers, vendors, warehouses, vehicles, pickup statuses,
    extra household items / packing material / box type, and (only if missing) the sales statuses and move types
    a new tenant normally starts with. Taxes and charges are country-specific: set @SeedTaxesAndCharges = 1 to add
    the UAE VAT 5% set below; leave 0 if the tenant already has its own (for example Indian GST).

  Employees are not users. To let one sign in, create a user for them (tenant › Users) and link the employee.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @TenantId            uniqueidentifier = '00000000-0000-0000-0000-000000000000';  -- <<< SET THIS
DECLARE @Currency            nvarchar(3)      = N'AED';
DECLARE @EmailDomain         nvarchar(100)    = N'example.com';
DECLARE @SeedTaxesAndCharges bit              = 0;

DECLARE @Now datetimeoffset = SYSDATETIMEOFFSET();

IF NOT EXISTS (SELECT 1 FROM dbo.Tenants WHERE Id = @TenantId)
    THROW 50001, 'Tenant not found. Set @TenantId to an existing dbo.Tenants.Id.', 1;

BEGIN TRANSACTION;

/* ---------------------------------------------------------------- designations */
INSERT INTO dbo.Designations (Id, TenantId, Code, Name, [Level], Description, IsActive, IsSalesman, CreatedAtUtc, UpdatedAtUtc)
SELECT NEWID(), @TenantId, v.Code, v.Name, v.Lvl, v.Description, 1, v.IsSalesman, @Now, @Now
FROM (VALUES
    (N'GM',         N'General Manager',     1, N'Runs the branch',                       0),
    (N'OPS_MGR',    N'Operations Manager',  2, N'Plans pickups, packing and deliveries',  0),
    (N'SALES_EXEC', N'Sales Executive',     3, N'Handles enquiries and quotations',       1),
    (N'SURVEYOR',   N'Surveyor',            3, N'Surveys goods at the customer site',     0),
    (N'ACCOUNTANT', N'Accountant',          3, N'Invoices, bills and posting',            0),
    (N'SUPERVISOR', N'Crew Supervisor',     4, N'Leads the crew on site',                 0),
    (N'PACKER',     N'Packer',              5, N'Packs and labels boxes',                 0),
    (N'DRIVER',     N'Driver',              5, N'Drives the moving truck',                0),
    (N'HELPER',     N'Helper',              6, N'Loading and unloading',                  0)
) AS v (Code, Name, Lvl, Description, IsSalesman)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Designations d WHERE d.TenantId = @TenantId AND d.Code = v.Code);

/* ---------------------------------------------------------------- employees */
DECLARE @Employees TABLE (Number nvarchar(40), FirstName nvarchar(100), LastName nvarchar(100), Phone nvarchar(40), Joined date, Designation nvarchar(40), ReportsTo nvarchar(40));
INSERT INTO @Employees VALUES
    (N'EMP-S001', N'Ahmed',   N'Rashid',   N'+971 50 100 0001', '2023-01-02', N'GM',         NULL),
    (N'EMP-S002', N'Priya',   N'Nair',     N'+971 50 100 0002', '2023-02-01', N'OPS_MGR',    N'EMP-S001'),
    (N'EMP-S003', N'Omar',    N'Khalid',   N'+971 50 100 0003', '2023-03-15', N'SALES_EXEC', N'EMP-S001'),
    (N'EMP-S004', N'Sara',    N'Thomas',   N'+971 50 100 0004', '2023-06-01', N'SALES_EXEC', N'EMP-S001'),
    (N'EMP-S005', N'Vikram',  N'Menon',    N'+971 50 100 0005', '2023-04-10', N'SURVEYOR',   N'EMP-S002'),
    (N'EMP-S006', N'Fatima',  N'Ali',      N'+971 50 100 0006', '2023-05-20', N'ACCOUNTANT', N'EMP-S001'),
    (N'EMP-S007', N'Joseph',  N'Mathew',   N'+971 50 100 0007', '2023-07-01', N'SUPERVISOR', N'EMP-S002'),
    (N'EMP-S008', N'Ravi',    N'Kumar',    N'+971 50 100 0008', '2023-08-01', N'PACKER',     N'EMP-S007'),
    (N'EMP-S009', N'Anil',    N'Das',      N'+971 50 100 0009', '2023-08-01', N'PACKER',     N'EMP-S007'),
    (N'EMP-S010', N'Bilal',   N'Hussain',  N'+971 50 100 0010', '2023-09-01', N'DRIVER',     N'EMP-S002'),
    (N'EMP-S011', N'Suresh',  N'Pillai',   N'+971 50 100 0011', '2024-01-15', N'DRIVER',     N'EMP-S002'),
    (N'EMP-S012', N'Imran',   N'Sheikh',   N'+971 50 100 0012', '2024-02-01', N'HELPER',     N'EMP-S007');

INSERT INTO dbo.Employees (Id, TenantId, EmployeeNumber, FirstName, LastName, WorkEmail, Phone, JoiningDate, DesignationId, ReportsToEmployeeId, IsActive, CreatedAtUtc, UpdatedAtUtc)
SELECT NEWID(), @TenantId, e.Number, e.FirstName, e.LastName,
       LOWER(e.FirstName + N'.' + e.LastName) + N'@' + @EmailDomain, e.Phone, e.Joined, d.Id, NULL, 1, @Now, @Now
FROM @Employees e
JOIN dbo.Designations d ON d.TenantId = @TenantId AND d.Code = e.Designation
WHERE NOT EXISTS (SELECT 1 FROM dbo.Employees x WHERE x.TenantId = @TenantId AND x.EmployeeNumber = e.Number);

-- Reporting lines (only where not already set).
UPDATE emp SET ReportsToEmployeeId = mgr.Id, UpdatedAtUtc = @Now
FROM dbo.Employees emp
JOIN @Employees e   ON e.Number = emp.EmployeeNumber
JOIN dbo.Employees mgr ON mgr.TenantId = @TenantId AND mgr.EmployeeNumber = e.ReportsTo
WHERE emp.TenantId = @TenantId AND emp.ReportsToEmployeeId IS NULL;

/* ---------------------------------------------------------------- customers and vendors
   Stored in BusinessMasters with a JSON payload (property names are case-sensitive). */
DECLARE @Parties TABLE (Kind nvarchar(30), Code nvarchar(40), Name nvarchar(120), Phone nvarchar(40), Email nvarchar(254), Address nvarchar(600),
                        ContactName nvarchar(160), TaxReference nvarchar(80), Notes nvarchar(400), VendorType nvarchar(80), IsAgent bit);
INSERT INTO @Parties VALUES
    (N'customer', N'CUS-S001', N'Abdul Rahman',                   N'+971 55 200 0001', N'abdul.rahman@example.com',  N'Villa 12, Street 4, Al Barsha 2, Dubai',              NULL,               NULL,              N'Household move, 3-bedroom villa', NULL, 0),
    (N'customer', N'CUS-S002', N'Meera Krishnan',                 N'+971 55 200 0002', N'meera.k@example.com',       N'Apt 1804, Marina Heights, Dubai Marina',             NULL,               NULL,              N'Relocating to Bengaluru',          NULL, 0),
    (N'customer', N'CUS-S003', N'John Williams',                  N'+971 55 200 0003', N'john.williams@example.com', N'Apt 305, Building 7, JLT Cluster D, Dubai',           NULL,               NULL,              NULL,                               NULL, 0),
    (N'customer', N'CUS-S004', N'Layla Hassan',                   N'+971 55 200 0004', N'layla.hassan@example.com',  N'Villa 8, Mirdif, Dubai',                             NULL,               NULL,              NULL,                               NULL, 0),
    (N'customer', N'CUS-S005', N'Gulf Tech Solutions LLC',        N'+971 4 300 0005',  N'admin@gulftech.example',    N'Office 1201, Bay Square 3, Business Bay, Dubai',     N'Rania Saeed',     N'100000000000003', N'Office move, 40 workstations',     NULL, 0),
    (N'customer', N'CUS-S006', N'Al Noor Trading Co.',            N'+971 6 300 0006',  N'accounts@alnoor.example',   N'Warehouse 14, Industrial Area 13, Sharjah',          N'Faisal Noor',     N'100000000000004', N'Monthly storage customer',         NULL, 0),
    (N'customer', N'CUS-S007', N'Horizon Hospitality Group',      N'+971 2 300 0007',  N'facilities@horizon.example',N'Tower B, Al Reem Island, Abu Dhabi',                N'David Fernandes', N'100000000000005', N'Corporate relocations',            NULL, 0),
    (N'customer', N'CUS-S008', N'Sunita Sharma',                  N'+971 55 200 0008', N'sunita.sharma@example.com', N'Apt 702, Al Nahda 1, Dubai',                         NULL,               NULL,              N'Partial move, single room',        NULL, 0),
    (N'vendor',   N'VEN-S001', N'Speedline Truck Rentals',        N'+971 4 400 0001',  N'bookings@speedline.example',N'Al Quoz Industrial 3, Dubai',                        N'Kamal',           NULL,              N'Truck hire on demand',             N'Transport', 0),
    (N'vendor',   N'VEN-S002', N'PackRight Materials Trading',    N'+971 6 400 0002',  N'sales@packright.example',   N'Industrial Area 6, Sharjah',                         N'Nisha',           NULL,              N'Cartons, tape, bubble wrap',       N'Packing materials', 0),
    (N'vendor',   N'VEN-S003', N'Overseas Movers Network (India)',N'+91 80 4000 0003', N'ops@omn.example',           N'Whitefield, Bengaluru, India',                       N'Arun',            NULL,              N'Destination agent for India',      N'Agent', 1);

INSERT INTO dbo.BusinessMasters (Id, TenantId, Kind, Code, Payload)
SELECT NEWID(), @TenantId, p.Kind, p.Code,
       N'{"Name":' + ISNULL(N'"' + STRING_ESCAPE(p.Name, 'json') + N'"', N'null')
     + N',"IsActive":true'
     + N',"Phone":' + ISNULL(N'"' + STRING_ESCAPE(p.Phone, 'json') + N'"', N'null')
     + N',"Email":' + ISNULL(N'"' + STRING_ESCAPE(p.Email, 'json') + N'"', N'null')
     + N',"Address":' + ISNULL(N'"' + STRING_ESCAPE(p.Address, 'json') + N'"', N'null')
     + N',"ContactName":' + ISNULL(N'"' + STRING_ESCAPE(p.ContactName, 'json') + N'"', N'null')
     + N',"TaxReference":' + ISNULL(N'"' + STRING_ESCAPE(p.TaxReference, 'json') + N'"', N'null')
     + N',"Notes":' + ISNULL(N'"' + STRING_ESCAPE(p.Notes, 'json') + N'"', N'null')
     + N',"VendorType":' + ISNULL(N'"' + STRING_ESCAPE(p.VendorType, 'json') + N'"', N'null')
     + N',"IsAgent":' + CASE WHEN p.IsAgent = 1 THEN N'true' ELSE N'false' END
     + N',"Currency":"' + @Currency + N'"}'
FROM @Parties p
WHERE NOT EXISTS (SELECT 1 FROM dbo.BusinessMasters b WHERE b.TenantId = @TenantId AND b.Kind = p.Kind AND b.Code = p.Code);

/* ---------------------------------------------------------------- warehouses and vehicles */
INSERT INTO dbo.Warehouses (Id, TenantId, Code, Name, Address, IsActive)
SELECT NEWID(), @TenantId, v.Code, v.Name, v.Address, 1
FROM (VALUES
    (N'WH-DXB', N'Dubai main warehouse',   N'Plot 22, Al Quoz Industrial 4, Dubai'),
    (N'WH-SHJ', N'Sharjah storage depot',  N'Warehouse 9, Industrial Area 15, Sharjah')
) AS v (Code, Name, Address)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Warehouses w WHERE w.TenantId = @TenantId AND w.Code = v.Code);

INSERT INTO dbo.Vehicles (Id, TenantId, RegistrationNumber, Name, Type, CapacityCbm, DriverName, DriverPhone, IsActive)
SELECT NEWID(), @TenantId, v.Reg, v.Name, v.Type, v.Cbm, v.Driver, v.Phone, 1
FROM (VALUES
    (N'DXB-A-12345', N'Truck 1 (3 ton)',  N'Closed truck', 18.000, N'Bilal Hussain', N'+971 50 100 0010'),
    (N'DXB-B-67890', N'Truck 2 (7 ton)',  N'Closed truck', 35.000, N'Suresh Pillai', N'+971 50 100 0011'),
    (N'DXB-C-24680', N'Van 1',            N'Panel van',     8.000, NULL,            NULL)
) AS v (Reg, Name, Type, Cbm, Driver, Phone)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Vehicles x WHERE x.TenantId = @TenantId AND x.RegistrationNumber = v.Reg);

/* ---------------------------------------------------------------- pickup statuses (the app's default set) */
INSERT INTO dbo.PickupStatuses (Id, TenantId, Code, Name, DisplayOrder, Color, IsCompleted, IsActive)
SELECT NEWID(), @TenantId, v.Code, v.Name, v.Ord, v.Color, v.Done, 1
FROM (VALUES
    (N'PLANNED',   N'Planned',            10, N'blue',   0),
    (N'CONFIRMED', N'Customer Confirmed', 20, N'cyan',   0),
    (N'PACKING',   N'Packing',            30, N'orange', 0),
    (N'PICKED_UP', N'Picked Up',          40, N'green',  1)
) AS v (Code, Name, Ord, Color, Done)
WHERE NOT EXISTS (SELECT 1 FROM dbo.PickupStatuses s WHERE s.TenantId = @TenantId AND s.Code = v.Code);

/* ---------------------------------------------------------------- sales statuses and move types (only if missing) */
INSERT INTO dbo.LeadStatuses (Id, TenantId, Code, Name, DisplayOrder, Color, IsClosed, IsActive, CreatedAtUtc, UpdatedAtUtc)
SELECT NEWID(), @TenantId, v.Code, v.Name, v.Ord, v.Color, v.Closed, 1, @Now, @Now
FROM (VALUES
    (N'NEW', N'New enquiry', 10, N'#1677ff', 0), (N'CONTACTED', N'Contacted', 20, N'#13c2c2', 0), (N'SURVEY', N'Survey scheduled', 30, N'#722ed1', 0),
    (N'QUOTED', N'Quotation sent', 40, N'#fa8c16', 0), (N'WON', N'Accepted', 50, N'#52c41a', 1), (N'LOST', N'Rejected', 60, N'#ff4d4f', 1)
) AS v (Code, Name, Ord, Color, Closed)
WHERE NOT EXISTS (SELECT 1 FROM dbo.LeadStatuses s WHERE s.TenantId = @TenantId AND s.Code = v.Code);

INSERT INTO dbo.FollowUpStatuses (Id, TenantId, Code, Name, DisplayOrder, Color, IsCompleted, IsActive, CreatedAtUtc, UpdatedAtUtc)
SELECT NEWID(), @TenantId, v.Code, v.Name, v.Ord, v.Color, v.Done, 1, @Now, @Now
FROM (VALUES
    (N'PLANNED', N'Planned', 10, N'#1677ff', 0), (N'CONTACTED', N'Contacted', 20, N'#13c2c2', 1), (N'NO_ANSWER', N'No answer', 30, N'#faad14', 1),
    (N'RESCHEDULED', N'Rescheduled', 40, N'#722ed1', 1), (N'COMPLETED', N'Completed', 50, N'#52c41a', 1)
) AS v (Code, Name, Ord, Color, Done)
WHERE NOT EXISTS (SELECT 1 FROM dbo.FollowUpStatuses s WHERE s.TenantId = @TenantId AND s.Code = v.Code);

INSERT INTO dbo.MoveTypes (Id, TenantId, Code, Name, DisplayOrder, Description, IsActive, CreatedAtUtc, UpdatedAtUtc)
SELECT NEWID(), @TenantId, v.Code, v.Name, v.Ord, v.Description, 1, @Now, @Now
FROM (VALUES
    (N'HOUSEHOLD', N'Household move', 10, N'Residential household relocation'),
    (N'OFFICE', N'Office move', 20, N'Office and commercial relocation'),
    (N'VEHICLE', N'Vehicle transport', 30, N'Car and two-wheeler transportation'),
    (N'INTERNATIONAL', N'International move', 40, N'International household or office relocation'),
    (N'STORAGE', N'Storage only', 50, N'Warehouse storage without an immediate move')
) AS v (Code, Name, Ord, Description)
WHERE NOT EXISTS (SELECT 1 FROM dbo.MoveTypes m WHERE m.TenantId = @TenantId AND m.Code = v.Code);

/* ---------------------------------------------------------------- survey masters (extras; the tenant's starter set is kept) */
INSERT INTO dbo.HouseholdItems (Id, TenantId, Code, Name, VolumeCbm, Description, IsActive)
SELECT NEWID(), @TenantId, v.Code, v.Name, v.Cbm, N'Seed master data', 1
FROM (VALUES
    (N'FRIDGE_DOUBLE', N'Refrigerator (double door)', 1.200), (N'WASHING_MACHINE', N'Washing machine', 0.600),
    (N'MICROWAVE', N'Microwave oven', 0.100), (N'BOOKSHELF', N'Bookshelf', 0.800),
    (N'OFFICE_DESK', N'Office desk', 1.000), (N'OFFICE_CHAIR', N'Office chair', 0.300),
    (N'BICYCLE', N'Bicycle', 0.500), (N'PLANT_POT', N'Plant pot (large)', 0.200)
) AS v (Code, Name, Cbm)
WHERE NOT EXISTS (SELECT 1 FROM dbo.HouseholdItems h WHERE h.TenantId = @TenantId AND h.Code = v.Code);

INSERT INTO dbo.PackingMaterials (Id, TenantId, Code, Name, Unit, CurrentUnitCost, Description, IsActive)
SELECT NEWID(), @TenantId, v.Code, v.Name, v.Unit, v.Cost, v.Description, 1
FROM (VALUES
    (N'PACKING_PAPER', N'Packing paper', N'kg', 8.0000, N'Wrapping for crockery and glass'),
    (N'WARDROBE_RAIL', N'Wardrobe hanging rail', N'piece', 15.0000, N'Rail for wardrobe cartons')
) AS v (Code, Name, Unit, Cost, Description)
WHERE NOT EXISTS (SELECT 1 FROM dbo.PackingMaterials m WHERE m.TenantId = @TenantId AND m.Code = v.Code);

INSERT INTO dbo.BoxTypes (Id, TenantId, Code, Name, CapacityCbm, Description, IsActive)
SELECT NEWID(), @TenantId, N'WARDROBE_BOX', N'Wardrobe carton', 0.500, N'Tall carton with hanging rail', 1
WHERE NOT EXISTS (SELECT 1 FROM dbo.BoxTypes b WHERE b.TenantId = @TenantId AND b.Code = N'WARDROBE_BOX');

-- Recipe of the wardrobe carton: uses materials only when they exist for this tenant.
INSERT INTO dbo.BoxTypeMaterials (Id, TenantId, BoxTypeId, MaterialId, Quantity)
SELECT NEWID(), @TenantId, b.Id, m.Id, r.Qty
FROM (VALUES (N'CARDBOARD', 4.000), (N'TAPE', 0.250), (N'WARDROBE_RAIL', 1.000)) AS r (Material, Qty)
JOIN dbo.BoxTypes b ON b.TenantId = @TenantId AND b.Code = N'WARDROBE_BOX'
JOIN dbo.PackingMaterials m ON m.TenantId = @TenantId AND m.Code = r.Material
WHERE NOT EXISTS (SELECT 1 FROM dbo.BoxTypeMaterials x WHERE x.TenantId = @TenantId AND x.BoxTypeId = b.Id AND x.MaterialId = m.Id);

/* ---------------------------------------------------------------- taxes and charges (optional, UAE VAT example) */
IF @SeedTaxesAndCharges = 1
BEGIN
    INSERT INTO dbo.TaxMasters (Id, TenantId, Code, Name, Kind, CalculationBasis, Rate, IsDefault, Description, IsActive, CreatedAtUtc, UpdatedAtUtc)
    SELECT NEWID(), @TenantId, N'VAT_5', N'VAT 5%', N'TAX', N'TAXABLE_AMOUNT', 5.0000, 1, N'UAE standard rate', 1, @Now, @Now
    WHERE NOT EXISTS (SELECT 1 FROM dbo.TaxMasters t WHERE t.TenantId = @TenantId AND t.Code = N'VAT_5');

    INSERT INTO dbo.ChargeMasters (Id, TenantId, Code, Name, Unit, DefaultRate, TaxPercent, Description, IsActive, CreatedAtUtc, UpdatedAtUtc)
    SELECT NEWID(), @TenantId, v.Code, v.Name, v.Unit, v.Rate, 5.000, v.Description, 1, @Now, @Now
    FROM (VALUES
        (N'PACKING',     N'Packing charges',        N'job',   1500.0000, N'Packing labour and handling'),
        (N'TRANSPORT',   N'Transportation',         N'trip',  1200.0000, N'Truck with driver'),
        (N'LOADING',     N'Loading and unloading',  N'job',    600.0000, N'Crew labour'),
        (N'DISMANTLE',   N'Dismantling / assembly', N'item',   100.0000, N'Furniture dismantling and re-assembly'),
        (N'STORAGE',     N'Storage',                N'cbm/month', 45.0000, N'Warehouse storage per cubic metre'),
        (N'INSURANCE',   N'Transit insurance',      N'job',    250.0000, N'Basic transit cover')
    ) AS v (Code, Name, Unit, Rate, Description)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ChargeMasters c WHERE c.TenantId = @TenantId AND c.Code = v.Code);
END

COMMIT TRANSACTION;

/* ---------------------------------------------------------------- summary */
SELECT 'Designations' AS [Table], COUNT(*) AS [Rows for tenant] FROM dbo.Designations WHERE TenantId = @TenantId
UNION ALL SELECT 'Employees',        COUNT(*) FROM dbo.Employees        WHERE TenantId = @TenantId
UNION ALL SELECT 'Customers',        COUNT(*) FROM dbo.BusinessMasters  WHERE TenantId = @TenantId AND Kind = 'customer'
UNION ALL SELECT 'Vendors',          COUNT(*) FROM dbo.BusinessMasters  WHERE TenantId = @TenantId AND Kind = 'vendor'
UNION ALL SELECT 'Warehouses',       COUNT(*) FROM dbo.Warehouses       WHERE TenantId = @TenantId
UNION ALL SELECT 'Vehicles',         COUNT(*) FROM dbo.Vehicles         WHERE TenantId = @TenantId
UNION ALL SELECT 'Pickup statuses',  COUNT(*) FROM dbo.PickupStatuses   WHERE TenantId = @TenantId
UNION ALL SELECT 'Lead statuses',    COUNT(*) FROM dbo.LeadStatuses     WHERE TenantId = @TenantId
UNION ALL SELECT 'Move types',       COUNT(*) FROM dbo.MoveTypes        WHERE TenantId = @TenantId
UNION ALL SELECT 'Household items',  COUNT(*) FROM dbo.HouseholdItems   WHERE TenantId = @TenantId
UNION ALL SELECT 'Packing materials',COUNT(*) FROM dbo.PackingMaterials WHERE TenantId = @TenantId
UNION ALL SELECT 'Box types',        COUNT(*) FROM dbo.BoxTypes         WHERE TenantId = @TenantId
UNION ALL SELECT 'Taxes',            COUNT(*) FROM dbo.TaxMasters       WHERE TenantId = @TenantId
UNION ALL SELECT 'Charges',          COUNT(*) FROM dbo.ChargeMasters    WHERE TenantId = @TenantId;
