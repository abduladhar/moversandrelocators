using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using System.Text.Json;
using Movers.Domain.Auditing;
using Movers.Domain.Common;
using Movers.Domain.Configuration;
using Movers.Domain.Employees;
using Movers.Domain.Security;
using Movers.Domain.Sales;
using Movers.Domain.Tenants;
using Movers.Domain.Surveys;
using Movers.Domain.Quotations;
using Movers.Domain.Pickups;
using Movers.Services.Security;
using Movers.Services.Tenancy;

namespace Movers.DAL.Persistence;

public sealed class MoversDbContext(
    DbContextOptions<MoversDbContext> options,
    ITenantContext tenantContext,
    IUserContext userContext) : DbContext(options)
{
    public DbSet<Movers.Domain.Masters.BusinessMaster> BusinessMasters => Set<Movers.Domain.Masters.BusinessMaster>();
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Designation> Designations => Set<Designation>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<LeadStatus> LeadStatuses => Set<LeadStatus>();
    public DbSet<FollowUpStatus> FollowUpStatuses => Set<FollowUpStatus>();
    public DbSet<MoveType> MoveTypes => Set<MoveType>();
    public DbSet<SalesLead> SalesLeads => Set<SalesLead>();
    public DbSet<LeadFollowUp> LeadFollowUps => Set<LeadFollowUp>();
    public DbSet<TenantAwsConfiguration> TenantAwsConfigurations => Set<TenantAwsConfiguration>();
    public DbSet<TenantOpenAiConfiguration> TenantOpenAiConfigurations => Set<TenantOpenAiConfiguration>();
    public DbSet<SalesLeadUploadLink> SalesLeadUploadLinks => Set<SalesLeadUploadLink>();
    public DbSet<Movers.Domain.CustomerLinks.CustomerReply> CustomerReplies => Set<Movers.Domain.CustomerLinks.CustomerReply>();
    public DbSet<Movers.Domain.CustomerLinks.CustomerReplyEvent> CustomerReplyEvents => Set<Movers.Domain.CustomerLinks.CustomerReplyEvent>();
    public DbSet<SalesLeadAttachment> SalesLeadAttachments => Set<SalesLeadAttachment>();
    public DbSet<HouseholdItem> HouseholdItems => Set<HouseholdItem>();
    public DbSet<PackingMaterial> PackingMaterials => Set<PackingMaterial>();
    public DbSet<BoxType> BoxTypes => Set<BoxType>();
    public DbSet<BoxTypeMaterial> BoxTypeMaterials => Set<BoxTypeMaterial>();
    public DbSet<Survey> Surveys => Set<Survey>();
    public DbSet<SurveyRoom> SurveyRooms => Set<SurveyRoom>();
    public DbSet<SurveyItem> SurveyItems => Set<SurveyItem>();
    public DbSet<SurveyExtraMaterial> SurveyExtraMaterials => Set<SurveyExtraMaterial>();
    public DbSet<SurveyAttachment> SurveyAttachments => Set<SurveyAttachment>();
    public DbSet<SurveyTimeEvent> SurveyTimeEvents => Set<SurveyTimeEvent>();
    public DbSet<SurveyExpense> SurveyExpenses => Set<SurveyExpense>();
    public DbSet<ChargeMaster> ChargeMasters => Set<ChargeMaster>();
    public DbSet<TaxMaster> TaxMasters => Set<TaxMaster>();
    public DbSet<Quotation> Quotations => Set<Quotation>();
    public DbSet<QuotationLine> QuotationLines => Set<QuotationLine>();
    public DbSet<QuotationItem> QuotationItems => Set<QuotationItem>();
    public DbSet<QuotationLineTax> QuotationLineTaxes => Set<QuotationLineTax>();
    public DbSet<QuotationRequoteRequest> QuotationRequoteRequests => Set<QuotationRequoteRequest>();
    public DbSet<PickupStatus> PickupStatuses => Set<PickupStatus>(); public DbSet<Vehicle> Vehicles => Set<Vehicle>(); public DbSet<Pickup> Pickups => Set<Pickup>(); public DbSet<PickupAssignment> PickupAssignments => Set<PickupAssignment>(); public DbSet<Movers.Domain.Employees.Team> Teams => Set<Movers.Domain.Employees.Team>(); public DbSet<Movers.Domain.Employees.TeamMembership> TeamMemberships => Set<Movers.Domain.Employees.TeamMembership>(); public DbSet<PickupPackage> PickupPackages => Set<PickupPackage>(); public DbSet<PickupPackageItem> PickupPackageItems => Set<PickupPackageItem>(); public DbSet<PickupMaterialUsage> PickupMaterialUsages => Set<PickupMaterialUsage>(); public DbSet<PickupTransaction> PickupTransactions => Set<PickupTransaction>();
    public DbSet<PickupPackingJob> PickupPackingJobs => Set<PickupPackingJob>(); public DbSet<PickupBoxPick> PickupBoxPicks => Set<PickupBoxPick>(); public DbSet<PickupBoxPickEvent> PickupBoxPickEvents => Set<PickupBoxPickEvent>(); public DbSet<PickupCollectionApproval> PickupCollectionApprovals => Set<PickupCollectionApproval>();
    private Guid CurrentTenantId => tenantContext.TenantId;
    private Guid? CurrentCompanyId => tenantContext.CompanyId;

    /// <summary>Tenant records with no company at all: the companies themselves, settings, and children that follow their parent master.</summary>
    public static readonly IReadOnlySet<Type> SharedTypes = new HashSet<Type>
    {
        typeof(Company), typeof(Movers.Domain.Employees.TeamMembership), typeof(BoxTypeMaterial),
        typeof(Movers.Domain.Operations.SavedReport), typeof(TenantAwsConfiguration), typeof(TenantOpenAiConfiguration), typeof(TenantClaudeConfiguration)
    };

    /// <summary>
    /// Masters that are shared by every company (no company, the default) or marked for one company only.
    /// All other tenant records belong to one company.
    /// </summary>
    public static readonly IReadOnlySet<Type> OptionalCompanyTypes = new HashSet<Type>
    {
        typeof(Movers.Domain.Masters.BusinessMaster), typeof(Employee), typeof(Designation), typeof(Movers.Domain.Employees.Team),
        typeof(LeadStatus), typeof(FollowUpStatus), typeof(MoveType),
        typeof(HouseholdItem), typeof(PackingMaterial), typeof(BoxType),
        typeof(ChargeMaster), typeof(TaxMaster), typeof(PickupStatus), typeof(Vehicle), typeof(Warehouse)
    };

    /// <summary>Billing store kinds that are tenant settings (chart of accounts, currencies, mappings, report designs); every other kind is company data.</summary>
    public static readonly IReadOnlySet<string> SharedBillingKinds = new HashSet<string>(StringComparer.Ordinal)
    {
        "ACCOUNT", "CURRENCY", "FXRATE", "FXSETTINGS", "CHARGEMAP", "CASHFLOWMAP",
        "REPORT_TEMPLATE_V2", "REPORT_TEMPLATE_V2_DELETED", "REPORT_HISTORY_V2"
    };

    // SQLite (test databases only) cannot compare or sort DateTimeOffset, which list sorts and filters need; there it is
    // stored as a sortable number. SQL Server and PostgreSQL keep their native types.
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        if (Database.IsSqlite()) configurationBuilder.Properties<DateTimeOffset>().HaveConversion<Microsoft.EntityFrameworkCore.Storage.ValueConversion.DateTimeOffsetToBinaryConverter>();
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        Movers.DAL.Operations.OperationsMapping.Configure(modelBuilder);
        Movers.DAL.Operations.ShipmentMapping.Configure(modelBuilder);
        Movers.DAL.Pickups.PickupWorkMapping.Configure(modelBuilder);
        Movers.DAL.Packing.PackingMapping.Configure(modelBuilder);
        Movers.DAL.Delivery.DeliveryMapping.Configure(modelBuilder);
        Movers.DAL.Operations.ExpenseAttachmentMapping.Configure(modelBuilder);
        Movers.DAL.Sales.LeadInventoryMapping.Configure(modelBuilder);
        Movers.DAL.Configuration.AiUsageMapping.Configure(modelBuilder);
        Movers.DAL.Configuration.ClaudeConfigurationMapping.Configure(modelBuilder);
        var tenant = modelBuilder.Entity<Tenant>();
        tenant.ToTable("Tenants");
        tenant.Property(x => x.Name).HasMaxLength(160).IsRequired();
        tenant.Property(x => x.Slug).HasMaxLength(80).IsRequired();
        tenant.Property(x => x.ContactEmail).HasMaxLength(254);
        tenant.Property(x => x.Phone).HasMaxLength(40);
        tenant.Property(x => x.Address).HasMaxLength(500);
        tenant.HasIndex(x => x.Slug).IsUnique();

        var company = modelBuilder.Entity<Company>();
        company.ToTable("Companies");
        company.Property(x => x.Code).HasMaxLength(20).IsRequired();
        company.Property(x => x.Name).HasMaxLength(160).IsRequired();
        company.Property(x => x.LegalName).HasMaxLength(200);
        company.Property(x => x.TaxNumber).HasMaxLength(40);
        company.Property(x => x.Address).HasMaxLength(500);
        company.Property(x => x.Phone).HasMaxLength(40);
        company.Property(x => x.Email).HasMaxLength(254);
        company.Property(x => x.Website).HasMaxLength(200);
        company.Property(x => x.NumberCode).HasMaxLength(10);
        company.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        company.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var user = modelBuilder.Entity<User>();
        user.ToTable("Users");
        user.Property(x => x.FullName).HasMaxLength(160).IsRequired();
        user.Property(x => x.Email).HasMaxLength(254).IsRequired();
        user.Property(x => x.NormalizedEmail).HasMaxLength(254).IsRequired();
        user.Property(x => x.PasswordHash).HasMaxLength(600).IsRequired();
        user.HasIndex(x => x.NormalizedEmail).IsUnique();
        user.HasIndex(x => x.CompanyId);
        user.HasIndex(x => x.EmployeeId).IsUnique();
        user.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        user.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var role = modelBuilder.Entity<Role>();
        role.ToTable("Roles");
        role.Property(x => x.Name).HasMaxLength(120).IsRequired();
        role.Property(x => x.Code).HasMaxLength(80).IsRequired();
        role.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        role.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var permission = modelBuilder.Entity<Permission>();
        permission.ToTable("Permissions");
        permission.Property(x => x.Code).HasMaxLength(120).IsRequired();
        permission.Property(x => x.Name).HasMaxLength(160).IsRequired();
        permission.Property(x => x.Module).HasMaxLength(80).IsRequired();
        permission.HasIndex(x => x.Code).IsUnique();

        var userRole = modelBuilder.Entity<UserRole>();
        userRole.ToTable("UserRoles");
        userRole.HasIndex(x => new { x.UserId, x.RoleId }).IsUnique();
        userRole.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade);
        userRole.HasOne<Role>().WithMany().HasForeignKey(x => x.RoleId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade);

        var rolePermission = modelBuilder.Entity<RolePermission>();
        rolePermission.ToTable("RolePermissions");
        rolePermission.HasIndex(x => new { x.RoleId, x.PermissionId }).IsUnique();
        rolePermission.HasOne<Role>().WithMany().HasForeignKey(x => x.RoleId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade);
        rolePermission.HasOne<Permission>().WithMany().HasForeignKey(x => x.PermissionId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade);

        var audit = modelBuilder.Entity<AuditLog>();
        audit.ToTable("AuditLogs");
        audit.Property(x => x.ActorEmail).HasMaxLength(254).IsRequired();
        audit.Property(x => x.Action).HasMaxLength(30).IsRequired();
        audit.Property(x => x.EntityType).HasMaxLength(120).IsRequired();
        audit.Property(x => x.EntityId).HasMaxLength(80);
        audit.Property(x => x.IpAddress).HasMaxLength(64);
        audit.Property(x => x.Changes).IsRequired();
        audit.HasIndex(x => new { x.TenantId, x.SerialNo });
        audit.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        audit.HasOne<User>().WithMany().HasForeignKey(x => x.ActorUserId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var designation = modelBuilder.Entity<Designation>();
        designation.ToTable("Designations");
        designation.Property(x => x.Code).HasMaxLength(40).IsRequired();
        designation.Property(x => x.Name).HasMaxLength(120).IsRequired();
        designation.Property(x => x.Description).HasMaxLength(500);
        designation.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        designation.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var employee = modelBuilder.Entity<Employee>();
        employee.ToTable("Employees");
        employee.Ignore(x => x.FullName);
        employee.Property(x => x.EmployeeNumber).HasMaxLength(40).IsRequired();
        employee.Property(x => x.FirstName).HasMaxLength(100).IsRequired();
        employee.Property(x => x.LastName).HasMaxLength(100).IsRequired();
        employee.Property(x => x.WorkEmail).HasMaxLength(254);
        employee.Property(x => x.Phone).HasMaxLength(40);
        employee.HasIndex(x => new { x.TenantId, x.EmployeeNumber }).IsUnique();
        employee.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        employee.HasOne<Designation>().WithMany().HasForeignKey(x => x.DesignationId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        employee.HasOne<Employee>().WithMany().HasForeignKey(x => x.ReportsToEmployeeId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var leadStatus = modelBuilder.Entity<LeadStatus>();
        leadStatus.ToTable("LeadStatuses");
        leadStatus.Property(x => x.Code).HasMaxLength(40).IsRequired(); leadStatus.Property(x => x.Name).HasMaxLength(120).IsRequired(); leadStatus.Property(x => x.Color).HasMaxLength(20);
        leadStatus.HasIndex(x => new { x.TenantId, x.Code }).IsUnique(); leadStatus.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var followStatus = modelBuilder.Entity<FollowUpStatus>();
        followStatus.ToTable("FollowUpStatuses");
        followStatus.Property(x => x.Code).HasMaxLength(40).IsRequired(); followStatus.Property(x => x.Name).HasMaxLength(120).IsRequired(); followStatus.Property(x => x.Color).HasMaxLength(20);
        followStatus.HasIndex(x => new { x.TenantId, x.Code }).IsUnique(); followStatus.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var moveType = modelBuilder.Entity<MoveType>();
        moveType.ToTable("MoveTypes");
        moveType.Property(x => x.Code).HasMaxLength(40).IsRequired(); moveType.Property(x => x.Name).HasMaxLength(120).IsRequired(); moveType.Property(x => x.Description).HasMaxLength(500);
        moveType.HasIndex(x => new { x.TenantId, x.Code }).IsUnique(); moveType.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var lead = modelBuilder.Entity<SalesLead>();
        lead.ToTable("SalesLeads");
        lead.Property(x => x.LeadNumber).HasMaxLength(40).IsRequired(); lead.Property(x => x.CustomerName).HasMaxLength(160).IsRequired(); lead.Property(x => x.Phone).HasMaxLength(40).IsRequired(); lead.Property(x => x.Email).HasMaxLength(254); lead.Property(x => x.Source).HasMaxLength(100); lead.Property(x => x.Origin).HasMaxLength(300).IsRequired(); lead.Property(x => x.Destination).HasMaxLength(300).IsRequired(); lead.Property(x => x.Notes).HasMaxLength(2000);
        lead.HasIndex(x => new { x.TenantId, x.LeadNumber }).IsUnique(); lead.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); lead.HasOne<LeadStatus>().WithMany().HasForeignKey(x => x.StatusId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); lead.HasOne<MoveType>().WithMany().HasForeignKey(x => x.MoveTypeId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); lead.HasOne<Employee>().WithMany().HasForeignKey(x => x.AssignedEmployeeId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var followUp = modelBuilder.Entity<LeadFollowUp>();
        followUp.ToTable("LeadFollowUps"); followUp.Property(x => x.Notes).HasMaxLength(2000).IsRequired();
        followUp.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); followUp.HasOne<SalesLead>().WithMany().HasForeignKey(x => x.SalesLeadId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); followUp.HasOne<FollowUpStatus>().WithMany().HasForeignKey(x => x.StatusId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var aws = modelBuilder.Entity<TenantAwsConfiguration>();
        aws.ToTable("TenantAwsConfigurations");
        aws.Property(x => x.Region).HasMaxLength(60).IsRequired();
        aws.Property(x => x.BucketName).HasMaxLength(63).IsRequired();
        aws.Property(x => x.EncryptedAccessKey).HasMaxLength(1000).IsRequired();
        aws.Property(x => x.AccessKeyLastFour).HasMaxLength(4).IsRequired();
        aws.Property(x => x.EncryptedSecretKey).HasMaxLength(1000).IsRequired();
        aws.HasIndex(x => x.TenantId).IsUnique();
        aws.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var openAi = modelBuilder.Entity<TenantOpenAiConfiguration>();
        openAi.ToTable("TenantOpenAiConfigurations");
        openAi.Property(x => x.EncryptedApiKey).HasMaxLength(1000).IsRequired();
        openAi.Property(x => x.ApiKeyLastFour).HasMaxLength(4).IsRequired();
        openAi.Property(x => x.ExtractionModel).HasMaxLength(120).IsRequired();
        openAi.Property(x => x.TranscriptionModel).HasMaxLength(120).IsRequired();
        openAi.HasIndex(x => x.TenantId).IsUnique();
        openAi.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var customerReply = modelBuilder.Entity<Movers.Domain.CustomerLinks.CustomerReply>();
        customerReply.ToTable("CustomerReplies"); customerReply.Property(x => x.RecordType).HasMaxLength(30).IsRequired(); customerReply.Property(x => x.ReplyKind).HasMaxLength(40); customerReply.Property(x => x.ReplyNote).HasMaxLength(500); customerReply.Property(x => x.HandledBy).HasMaxLength(320); customerReply.Property(x => x.HandledAction).HasMaxLength(40); customerReply.Property(x => x.HandledNote).HasMaxLength(500);
        var customerReplyEvent = modelBuilder.Entity<Movers.Domain.CustomerLinks.CustomerReplyEvent>();
        customerReplyEvent.ToTable("CustomerReplyEvents"); customerReplyEvent.Property(x => x.RecordType).HasMaxLength(30).IsRequired(); customerReplyEvent.Property(x => x.Event).HasMaxLength(20).IsRequired(); customerReplyEvent.Property(x => x.Detail).HasMaxLength(40); customerReplyEvent.Property(x => x.Note).HasMaxLength(500); customerReplyEvent.Property(x => x.Actor).HasMaxLength(200).IsRequired();
        customerReplyEvent.HasIndex(x => new { x.TenantId, x.RecordType, x.RecordId }); customerReplyEvent.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        customerReply.HasIndex(x => new { x.TenantId, x.RecordType, x.RecordId }).IsUnique(); customerReply.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var uploadLink = modelBuilder.Entity<SalesLeadUploadLink>();
        uploadLink.ToTable("SalesLeadUploadLinks"); uploadLink.Property(x => x.TokenHash).HasMaxLength(64).IsRequired(); uploadLink.HasIndex(x => x.TokenHash).IsUnique();
        uploadLink.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); uploadLink.HasOne<SalesLead>().WithMany().HasForeignKey(x => x.SalesLeadId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var attachment = modelBuilder.Entity<SalesLeadAttachment>();
        attachment.ToTable("SalesLeadAttachments"); attachment.Property(x => x.OriginalFileName).HasMaxLength(255).IsRequired(); attachment.Property(x => x.ContentType).HasMaxLength(150).IsRequired(); attachment.Property(x => x.S3ObjectKey).HasMaxLength(700).IsRequired(); attachment.HasIndex(x => new { x.SalesLeadId, x.SerialNo });
        attachment.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); attachment.HasOne<SalesLead>().WithMany().HasForeignKey(x => x.SalesLeadId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); attachment.HasOne<SalesLeadUploadLink>().WithMany().HasForeignKey(x => x.UploadLinkId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var householdItem = modelBuilder.Entity<HouseholdItem>();
        householdItem.ToTable("HouseholdItems"); householdItem.Property(x => x.Code).HasMaxLength(40).IsRequired(); householdItem.Property(x => x.Name).HasMaxLength(160).IsRequired(); householdItem.Property(x => x.VolumeCbm).HasPrecision(12, 3); householdItem.Property(x => x.Description).HasMaxLength(500); householdItem.HasIndex(x => new { x.TenantId, x.Code }).IsUnique(); householdItem.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var packingMaterial = modelBuilder.Entity<PackingMaterial>();
        packingMaterial.ToTable("PackingMaterials"); packingMaterial.Property(x => x.Code).HasMaxLength(40).IsRequired(); packingMaterial.Property(x => x.Name).HasMaxLength(160).IsRequired(); packingMaterial.Property(x => x.Unit).HasMaxLength(40).IsRequired(); packingMaterial.Property(x => x.CurrentUnitCost).HasPrecision(20, 4); packingMaterial.Property(x => x.Description).HasMaxLength(500); packingMaterial.HasIndex(x => new { x.TenantId, x.Code }).IsUnique(); packingMaterial.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var boxType = modelBuilder.Entity<BoxType>();
        boxType.ToTable("BoxTypes"); boxType.Property(x => x.Code).HasMaxLength(40).IsRequired(); boxType.Property(x => x.Name).HasMaxLength(160).IsRequired(); boxType.Property(x => x.CapacityCbm).HasPrecision(12, 3); boxType.Property(x => x.Description).HasMaxLength(500); boxType.HasIndex(x => new { x.TenantId, x.Code }).IsUnique(); boxType.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var boxMaterial = modelBuilder.Entity<BoxTypeMaterial>();
        boxMaterial.ToTable("BoxTypeMaterials"); boxMaterial.Property(x => x.Quantity).HasPrecision(12, 3); boxMaterial.HasIndex(x => new { x.BoxTypeId, x.MaterialId }).IsUnique(); boxMaterial.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); boxMaterial.HasOne<BoxType>().WithMany().HasForeignKey(x => x.BoxTypeId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade); boxMaterial.HasOne<PackingMaterial>().WithMany().HasForeignKey(x => x.MaterialId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var survey = modelBuilder.Entity<Survey>();
        survey.ToTable("Surveys"); survey.Property(x => x.SurveyNumber).HasMaxLength(40).IsRequired(); survey.Property(x => x.CustomerName).HasMaxLength(160).IsRequired(); survey.Property(x => x.Phone).HasMaxLength(40).IsRequired(); survey.Property(x => x.Email).HasMaxLength(254); survey.Property(x => x.Address).HasMaxLength(600).IsRequired(); survey.Property(x => x.Latitude).HasPrecision(10, 7); survey.Property(x => x.Longitude).HasPrecision(10, 7); survey.Property(x => x.Status).HasMaxLength(30).IsRequired(); survey.Property(x => x.Notes).HasMaxLength(2000); survey.Property(x => x.CustomerNotes).HasMaxLength(2000); survey.Property(x => x.ConfirmationTokenHash).HasMaxLength(64); survey.Property(x => x.CustomerChangeRequestJson); survey.Property(x => x.DistanceKm).HasPrecision(10, 2); survey.HasOne<Employee>().WithMany().HasForeignKey(x => x.ConductedByEmployeeId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); survey.HasIndex(x => new { x.TenantId, x.SurveyNumber }).IsUnique(); survey.HasIndex(x => x.ConfirmationTokenHash).IsUnique(); survey.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); survey.HasOne<SalesLead>().WithMany().HasForeignKey(x => x.SalesLeadId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); survey.HasOne<Employee>().WithMany().HasForeignKey(x => x.AssignedEmployeeId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var surveyRoom = modelBuilder.Entity<SurveyRoom>();
        surveyRoom.ToTable("SurveyRooms"); surveyRoom.Property(x => x.Name).HasMaxLength(120).IsRequired(); surveyRoom.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); surveyRoom.HasOne<Survey>().WithMany().HasForeignKey(x => x.SurveyId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade);
        var surveyItem = modelBuilder.Entity<SurveyItem>();
        surveyItem.ToTable("SurveyItems"); surveyItem.Property(x => x.VolumePerUnitCbm).HasPrecision(12, 3); surveyItem.Property(x => x.Notes).HasMaxLength(500); surveyItem.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); surveyItem.HasOne<Survey>().WithMany().HasForeignKey(x => x.SurveyId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade); surveyItem.HasOne<SurveyRoom>().WithMany().HasForeignKey(x => x.RoomId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); surveyItem.HasOne<HouseholdItem>().WithMany().HasForeignKey(x => x.HouseholdItemId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var surveyExtra = modelBuilder.Entity<SurveyExtraMaterial>();
        surveyExtra.ToTable("SurveyExtraMaterials"); surveyExtra.Property(x => x.Quantity).HasPrecision(12, 3); surveyExtra.HasIndex(x => new { x.SurveyId, x.MaterialId }).IsUnique(); surveyExtra.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); surveyExtra.HasOne<Survey>().WithMany().HasForeignKey(x => x.SurveyId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade); surveyExtra.HasOne<PackingMaterial>().WithMany().HasForeignKey(x => x.MaterialId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var surveyAttachment = modelBuilder.Entity<SurveyAttachment>();
        surveyAttachment.ToTable("SurveyAttachments"); surveyAttachment.Property(x => x.Source).HasMaxLength(20).IsRequired(); surveyAttachment.Property(x => x.UploadedBy).HasMaxLength(160).IsRequired(); surveyAttachment.Property(x => x.OriginalFileName).HasMaxLength(255).IsRequired(); surveyAttachment.Property(x => x.ContentType).HasMaxLength(150).IsRequired(); surveyAttachment.Property(x => x.S3ObjectKey).HasMaxLength(700).IsRequired(); surveyAttachment.HasIndex(x => new { x.SurveyId, x.SerialNo }); surveyAttachment.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); surveyAttachment.HasOne<Survey>().WithMany().HasForeignKey(x => x.SurveyId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade);
        var surveyTimeEvent = modelBuilder.Entity<SurveyTimeEvent>();
        surveyTimeEvent.ToTable("SurveyTimeEvents"); surveyTimeEvent.Property(x => x.Type).HasMaxLength(20).IsRequired(); surveyTimeEvent.Property(x => x.Reason).HasMaxLength(500); surveyTimeEvent.Property(x => x.RecordedBy).HasMaxLength(254).IsRequired(); surveyTimeEvent.HasIndex(x => new { x.SurveyId, x.SerialNo }); surveyTimeEvent.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); surveyTimeEvent.HasOne<Survey>().WithMany().HasForeignKey(x => x.SurveyId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade);
        var surveyExpense = modelBuilder.Entity<SurveyExpense>();
        surveyExpense.ToTable("SurveyExpenses"); surveyExpense.Property(x => x.Category).HasMaxLength(30).IsRequired(); surveyExpense.Property(x => x.Amount).HasPrecision(20, 4); surveyExpense.Property(x => x.Currency).HasMaxLength(3).IsRequired(); surveyExpense.Property(x => x.Notes).HasMaxLength(500); surveyExpense.HasIndex(x => new { x.SurveyId, x.SerialNo }); surveyExpense.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); surveyExpense.HasOne<Survey>().WithMany().HasForeignKey(x => x.SurveyId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade); surveyExpense.HasOne<Employee>().WithMany().HasForeignKey(x => x.PaidByEmployeeId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);

        var charge = modelBuilder.Entity<ChargeMaster>();
        charge.ToTable("ChargeMasters"); charge.Property(x => x.Code).HasMaxLength(40).IsRequired(); charge.Property(x => x.Name).HasMaxLength(160).IsRequired(); charge.Property(x => x.Unit).HasMaxLength(40).IsRequired(); charge.Property(x => x.DefaultRate).HasPrecision(20, 4); charge.Property(x => x.TaxPercent).HasPrecision(7, 3); charge.Property(x => x.Description).HasMaxLength(500); charge.HasIndex(x => new { x.TenantId, x.Code }).IsUnique(); charge.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var taxMaster = modelBuilder.Entity<TaxMaster>();
        taxMaster.ToTable("TaxMasters"); taxMaster.Property(x => x.Code).HasMaxLength(40).IsRequired(); taxMaster.Property(x => x.Name).HasMaxLength(160).IsRequired(); taxMaster.Property(x => x.Kind).HasMaxLength(20).IsRequired(); taxMaster.Property(x => x.CalculationBasis).HasMaxLength(30).IsRequired(); taxMaster.Property(x => x.Rate).HasPrecision(12, 4); taxMaster.Property(x => x.Description).HasMaxLength(500); taxMaster.HasIndex(x => new { x.TenantId, x.Code }).IsUnique(); taxMaster.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var quotation = modelBuilder.Entity<Quotation>();
        quotation.Property(x => x.Origin).HasMaxLength(300).IsRequired(); quotation.Property(x => x.Destination).HasMaxLength(300).IsRequired();
        quotation.ToTable("Quotations"); quotation.Property(x => x.QuotationNumber).HasMaxLength(40).IsRequired(); quotation.Property(x => x.CustomerName).HasMaxLength(160).IsRequired(); quotation.Property(x => x.Phone).HasMaxLength(40).IsRequired(); quotation.Property(x => x.Email).HasMaxLength(254); quotation.Property(x => x.Currency).HasMaxLength(3).IsRequired(); quotation.Property(x => x.Terms).HasMaxLength(4000); quotation.Property(x => x.Notes).HasMaxLength(2000); quotation.Property(x => x.Status).HasMaxLength(30).IsRequired(); quotation.Property(x => x.Subtotal).HasPrecision(20, 4); quotation.Property(x => x.DiscountTotal).HasPrecision(20, 4); quotation.Property(x => x.TaxTotal).HasPrecision(20, 4); quotation.Property(x => x.GrandTotal).HasPrecision(20, 4); quotation.Property(x => x.ShareTokenHash).HasMaxLength(64); quotation.Property(x => x.RejectionReason).HasMaxLength(1000); quotation.HasIndex(x => new { x.TenantId, x.QuotationNumber }).IsUnique(); quotation.HasIndex(x => x.ShareTokenHash).IsUnique(); quotation.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); quotation.HasOne<Survey>().WithMany().HasForeignKey(x => x.SurveyId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); quotation.HasOne<SalesLead>().WithMany().HasForeignKey(x => x.SalesLeadId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); quotation.HasOne<Employee>().WithMany().HasForeignKey(x => x.AssignedEmployeeId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var quoteLine = modelBuilder.Entity<QuotationLine>();
        var quoteItem = modelBuilder.Entity<QuotationItem>();
        quoteItem.ToTable("QuotationItems"); quoteItem.Property(x => x.RoomName).HasMaxLength(120).IsRequired(); quoteItem.Property(x => x.ItemName).HasMaxLength(160).IsRequired(); quoteItem.Property(x => x.VolumePerUnitCbm).HasPrecision(12, 3); quoteItem.Property(x => x.Notes).HasMaxLength(500); quoteItem.HasIndex(x => new { x.QuotationId, x.DisplayOrder }); quoteItem.HasOne<Quotation>().WithMany().HasForeignKey(x => x.QuotationId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade); quoteItem.HasOne<HouseholdItem>().WithMany().HasForeignKey(x => x.HouseholdItemId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        quoteLine.ToTable("QuotationLines"); quoteLine.Property(x => x.Description).HasMaxLength(500).IsRequired(); quoteLine.Property(x => x.Unit).HasMaxLength(40).IsRequired(); quoteLine.Property(x => x.Quantity).HasPrecision(12, 3); quoteLine.Property(x => x.Rate).HasPrecision(20, 4); quoteLine.Property(x => x.DiscountPercent).HasPrecision(7, 3); quoteLine.Property(x => x.DiscountAmount).HasPrecision(20, 4); quoteLine.Property(x => x.TaxPercent).HasPrecision(7, 3); quoteLine.Property(x => x.TaxAmount).HasPrecision(20, 4); quoteLine.Property(x => x.LineTotal).HasPrecision(20, 4); quoteLine.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); quoteLine.HasOne<Quotation>().WithMany().HasForeignKey(x => x.QuotationId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade); quoteLine.HasOne<ChargeMaster>().WithMany().HasForeignKey(x => x.ChargeMasterId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var lineTax = modelBuilder.Entity<QuotationLineTax>();
        lineTax.ToTable("QuotationLineTaxes"); lineTax.Property(x => x.Code).HasMaxLength(40).IsRequired(); lineTax.Property(x => x.Name).HasMaxLength(160).IsRequired(); lineTax.Property(x => x.Kind).HasMaxLength(20).IsRequired(); lineTax.Property(x => x.CalculationBasis).HasMaxLength(30).IsRequired(); lineTax.Property(x => x.Rate).HasPrecision(12, 4); lineTax.Property(x => x.TaxableBase).HasPrecision(20, 4); lineTax.Property(x => x.Amount).HasPrecision(20, 4); lineTax.HasIndex(x => new { x.QuotationLineId, x.SerialNo }); lineTax.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); lineTax.HasOne<QuotationLine>().WithMany().HasForeignKey(x => x.QuotationLineId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade); lineTax.HasOne<TaxMaster>().WithMany().HasForeignKey(x => x.TaxMasterId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict);
        var requote = modelBuilder.Entity<QuotationRequoteRequest>();
        requote.ToTable("QuotationRequoteRequests"); requote.Property(x => x.ItemsJson).IsRequired(); requote.Property(x => x.CustomerNotes).HasMaxLength(2000); requote.HasIndex(x => new { x.QuotationId, x.SerialNo }); requote.HasOne<Tenant>().WithMany().HasForeignKey(x => x.TenantId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Restrict); requote.HasOne<Quotation>().WithMany().HasForeignKey(x => x.QuotationId).HasPrincipalKey(x => x.Id).OnDelete(DeleteBehavior.Cascade);
        var pickupStatus=modelBuilder.Entity<PickupStatus>(); pickupStatus.ToTable("PickupStatuses"); pickupStatus.Property(x=>x.Code).HasMaxLength(40).IsRequired(); pickupStatus.Property(x=>x.Name).HasMaxLength(120).IsRequired(); pickupStatus.Property(x=>x.Color).HasMaxLength(30); pickupStatus.HasIndex(x=>new{x.TenantId,x.Code}).IsUnique();
        var vehicle=modelBuilder.Entity<Vehicle>(); vehicle.ToTable("Vehicles"); vehicle.Property(x=>x.RegistrationNumber).HasMaxLength(40).IsRequired(); vehicle.Property(x=>x.Name).HasMaxLength(120).IsRequired(); vehicle.Property(x=>x.Type).HasMaxLength(80).IsRequired(); vehicle.Property(x=>x.CapacityCbm).HasPrecision(12,3); vehicle.Property(x=>x.DriverName).HasMaxLength(120); vehicle.Property(x=>x.DriverPhone).HasMaxLength(40); vehicle.HasIndex(x=>new{x.TenantId,x.RegistrationNumber}).IsUnique();
        var pickup=modelBuilder.Entity<Pickup>(); pickup.ToTable("Pickups"); pickup.Property(x => x.Version).IsConcurrencyToken(); pickup.Property(x=>x.PickupNumber).HasMaxLength(40).IsRequired(); pickup.Property(x=>x.CustomerName).HasMaxLength(160).IsRequired(); pickup.Property(x=>x.Phone).HasMaxLength(40).IsRequired(); pickup.Property(x=>x.Email).HasMaxLength(254); pickup.Property(x=>x.Address).HasMaxLength(500).IsRequired(); pickup.Property(x=>x.Latitude).HasPrecision(10,7); pickup.Property(x=>x.Longitude).HasPrecision(10,7); pickup.Property(x=>x.Notes).HasMaxLength(2000); pickup.Property(x=>x.ConfirmationTokenHash).HasMaxLength(64); pickup.HasIndex(x=>new{x.TenantId,x.PickupNumber}).IsUnique(); pickup.HasIndex(x=>x.ConfirmationTokenHash).IsUnique(); pickup.HasOne<Quotation>().WithMany().HasForeignKey(x=>x.QuotationId).HasPrincipalKey(x=>x.Id).OnDelete(DeleteBehavior.Restrict); pickup.HasOne<PickupStatus>().WithMany().HasForeignKey(x=>x.StatusId).HasPrincipalKey(x=>x.Id).OnDelete(DeleteBehavior.Restrict); pickup.HasOne<Vehicle>().WithMany().HasForeignKey(x=>x.VehicleId).HasPrincipalKey(x=>x.Id).OnDelete(DeleteBehavior.Restrict);
        var pa=modelBuilder.Entity<PickupAssignment>();pa.ToTable("PickupAssignments");pa.Property(x=>x.Role).HasMaxLength(80).IsRequired();pa.HasOne<Pickup>().WithMany().HasForeignKey(x=>x.PickupId).HasPrincipalKey(x=>x.Id).OnDelete(DeleteBehavior.Cascade);pa.HasOne<Employee>().WithMany().HasForeignKey(x=>x.EmployeeId).HasPrincipalKey(x=>x.Id).OnDelete(DeleteBehavior.Restrict);
        var pp=modelBuilder.Entity<PickupPackage>();pp.ToTable("PickupPackages");pp.Property(x=>x.TrackingNumber).HasMaxLength(80).IsRequired();pp.Property(x=>x.Notes).HasMaxLength(500);pp.HasIndex(x=>new{x.TenantId,x.TrackingNumber}).IsUnique();pp.HasOne<Pickup>().WithMany().HasForeignKey(x=>x.PickupId).HasPrincipalKey(x=>x.Id).OnDelete(DeleteBehavior.Cascade);pp.HasOne<BoxType>().WithMany().HasForeignKey(x=>x.BoxTypeId).HasPrincipalKey(x=>x.Id).OnDelete(DeleteBehavior.Restrict);
        var ppi=modelBuilder.Entity<PickupPackageItem>();ppi.ToTable("PickupPackageItems");ppi.Property(x=>x.ItemName).HasMaxLength(160).IsRequired();ppi.Property(x=>x.Notes).HasMaxLength(500);ppi.HasOne<PickupPackage>().WithMany().HasForeignKey(x=>x.PickupPackageId).HasPrincipalKey(x=>x.Id).OnDelete(DeleteBehavior.Cascade);
        var pm=modelBuilder.Entity<PickupMaterialUsage>();pm.ToTable("PickupMaterialUsages");pm.Property(x=>x.Quantity).HasPrecision(12,3);pm.Property(x=>x.UnitCost).HasPrecision(20, 4);pm.HasOne<Pickup>().WithMany().HasForeignKey(x=>x.PickupId).HasPrincipalKey(x=>x.Id).OnDelete(DeleteBehavior.Cascade);pm.HasOne<PackingMaterial>().WithMany().HasForeignKey(x=>x.MaterialId).HasPrincipalKey(x=>x.Id).OnDelete(DeleteBehavior.Restrict);
        var pt=modelBuilder.Entity<PickupTransaction>();pt.ToTable("PickupTransactions");pt.Property(x=>x.TransactionNumber).HasMaxLength(60).IsRequired();pt.Property(x=>x.Type).HasMaxLength(20).IsRequired();pt.Property(x=>x.Category).HasMaxLength(120).IsRequired();pt.Property(x=>x.Amount).HasPrecision(20, 4);pt.Property(x=>x.PaymentMethod).HasMaxLength(40).IsRequired();pt.Property(x=>x.Notes).HasMaxLength(500);pt.HasIndex(x=>new{x.TenantId,x.TransactionNumber}).IsUnique();pt.HasOne<Pickup>().WithMany().HasForeignKey(x=>x.PickupId).HasPrincipalKey(x=>x.Id).OnDelete(DeleteBehavior.Cascade);

        var billing = modelBuilder.Entity<Movers.Domain.Operations.BillingRecord>(); billing.ToTable("BillingRecords");
        billing.Property(x=>x.Kind).HasMaxLength(20); billing.Property(x=>x.Number).HasMaxLength(40); billing.Property(x=>x.RequestHash).HasMaxLength(64); billing.Property(x=>x.Version).IsConcurrencyToken();
        billing.HasIndex(x=>new{x.TenantId,x.Kind,x.Number}).IsUnique(); billing.HasIndex(x=>new{x.TenantId,x.Kind,x.RequestId}).IsUnique();
        var job = modelBuilder.Entity<Movers.Domain.Operations.TransportJob>(); job.ToTable("TransportJobs");
        job.Property(x => x.JobNumber).HasMaxLength(40); job.Property(x => x.RequestHash).HasMaxLength(64); job.Property(x => x.Status).HasMaxLength(20); job.Property(x => x.Version).IsConcurrencyToken();
        job.HasIndex(x => new { x.TenantId, x.JobNumber }).IsUnique(); job.HasIndex(x => new { x.TenantId, x.RequestId }).IsUnique();
        var cargo = modelBuilder.Entity<Movers.Domain.Operations.JobCargo>(); cargo.ToTable("JobCargo");
        cargo.Property(x => x.LoadedBy).HasMaxLength(160); cargo.Property(x => x.UnloadedBy).HasMaxLength(320);
        cargo.HasIndex(x => new { x.TenantId, x.JobId });
        cargo.HasIndex(x => new { x.TenantId, x.BoxId }).IsUnique().HasFilter(Database.IsSqlServer() ? "[IsActive] = 1" : Database.IsNpgsql() ? "\"IsActive\" = true" : "\"IsActive\" = 1");
        var warehouseFile = modelBuilder.Entity<Movers.Domain.Operations.WarehouseAttachment>(); warehouseFile.ToTable("WarehouseAttachments");
        warehouseFile.Property(x => x.OriginalFileName).HasMaxLength(180); warehouseFile.Property(x => x.ContentType).HasMaxLength(150); warehouseFile.Property(x => x.ObjectKey).HasMaxLength(700); warehouseFile.Property(x => x.UploadedBy).HasMaxLength(320);
        warehouseFile.HasIndex(x => new { x.TenantId, x.ReceiptId });
        var receipt = modelBuilder.Entity<Movers.Domain.Operations.WarehouseReceipt>();
        receipt.ToTable("WarehouseReceipts"); receipt.Property(x => x.ReceiptNumber).HasMaxLength(40); receipt.Property(x => x.Source).HasMaxLength(16); receipt.Property(x => x.RequestHash).HasMaxLength(64);
        receipt.HasIndex(x => new { x.TenantId, x.RequestId }).IsUnique(); receipt.HasIndex(x => new { x.TenantId, x.ReceiptNumber }).IsUnique();
        var businessMaster = modelBuilder.Entity<Movers.Domain.Masters.BusinessMaster>(); businessMaster.ToTable("BusinessMasters"); businessMaster.Property(x => x.Kind).HasMaxLength(30); businessMaster.Property(x => x.Code).HasMaxLength(40); businessMaster.HasIndex(x => new { x.TenantId, x.Kind, x.Code }).IsUnique();
        foreach (var entityType in modelBuilder.Model.GetEntityTypes()
                     .Where(x => typeof(Entity).IsAssignableFrom(x.ClrType)))
        {
            typeof(MoversDbContext)
                .GetMethod(nameof(ConfigureEntityIdentity), System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)!
                .MakeGenericMethod(entityType.ClrType)
                .Invoke(this, [modelBuilder]);
        }

        foreach (var entityType in modelBuilder.Model.GetEntityTypes()
                     .Where(x => typeof(ITenantOwned).IsAssignableFrom(x.ClrType)).ToList())
        {
            var configure = !typeof(TenantOwnedEntity).IsAssignableFrom(entityType.ClrType) ? nameof(ConfigureTenantEntity)
                : SharedTypes.Contains(entityType.ClrType) ? nameof(ConfigureSharedEntity) : nameof(ConfigureCompanyEntity);
            typeof(MoversDbContext)
                .GetMethod(configure, System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)!
                .MakeGenericMethod(entityType.ClrType)
                .Invoke(this, [modelBuilder]);
        }
    }

    // Business records and mandatory audit records share EF's single database transaction.
    // GUID identifiers are assigned before persistence, so the audit need not be saved later.
    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        NormalizeTimestamps();
        ValidateTenantWrites();
        var audits = CaptureAudits();
        PersistAudits(audits);
        try { return base.SaveChanges(acceptAllChangesOnSuccess); }
        catch (DbUpdateException e) when (IsUniqueViolation(e)) { DetachPendingAudits(); throw new InvalidOperationException(DuplicateMessage, e); }
        catch { DetachPendingAudits(); throw; }
    }

    private const string DuplicateMessage = "This code or number is already used in this tenant (possibly by a record another company keeps to itself). Use a different one.";
    private static bool IsUniqueViolation(DbUpdateException e) => e is not DbUpdateConcurrencyException && e.InnerException?.Message is { } m
        && (m.Contains("UNIQUE", StringComparison.OrdinalIgnoreCase) || m.Contains("duplicate key", StringComparison.OrdinalIgnoreCase));

    public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        NormalizeTimestamps();
        ValidateTenantWrites();
        var audits = CaptureAudits();
        PersistAudits(audits);
        try { return await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken); }
        catch (DbUpdateException e) when (IsUniqueViolation(e)) { DetachPendingAudits(); throw new InvalidOperationException(DuplicateMessage, e); }
        catch { DetachPendingAudits(); throw; }
    }

    private void DetachPendingAudits()
    {
        foreach (var entry in ChangeTracker.Entries<AuditLog>().Where(x => x.State == EntityState.Added).ToList())
            entry.State = EntityState.Detached;
    }
    private void ConfigureTenantEntity<TEntity>(ModelBuilder modelBuilder) where TEntity : class, ITenantOwned
    {
        modelBuilder.Entity<TEntity>().HasIndex(x => x.TenantId);
        modelBuilder.Entity<TEntity>().HasQueryFilter(x => x.TenantId == CurrentTenantId);
    }

    private void ConfigureSharedEntity<TEntity>(ModelBuilder modelBuilder) where TEntity : TenantOwnedEntity
    {
        modelBuilder.Entity<TEntity>().Ignore(x => x.CompanyId);
        ConfigureTenantEntity<TEntity>(modelBuilder);
    }

    // Company records: the tenant filter plus the request company. With no company resolved (customer links before
    // the record is found, start-up seeding) only the tenant filter applies. Billing rows with no company are tenant
    // settings, and masters with no company are shared, so both stay visible in every company.
    private void ConfigureCompanyEntity<TEntity>(ModelBuilder modelBuilder) where TEntity : TenantOwnedEntity
    {
        var entity = modelBuilder.Entity<TEntity>();
        entity.HasIndex(x => x.TenantId);
        entity.HasIndex(x => new { x.TenantId, x.CompanyId });
        if (typeof(TEntity) == typeof(Movers.Domain.Operations.BillingRecord) || OptionalCompanyTypes.Contains(typeof(TEntity)))
            entity.HasQueryFilter(x => x.TenantId == CurrentTenantId && (CurrentCompanyId == null || x.CompanyId == null || x.CompanyId == CurrentCompanyId));
        else
            entity.HasQueryFilter(x => x.TenantId == CurrentTenantId && (CurrentCompanyId == null || x.CompanyId == CurrentCompanyId));
    }

    private void ConfigureEntityIdentity<TEntity>(ModelBuilder modelBuilder) where TEntity : Entity
    {
        modelBuilder.Entity<TEntity>().HasKey(x => x.SerialNo);
        modelBuilder.Entity<TEntity>().Property(x => x.SerialNo).ValueGeneratedOnAdd();
        modelBuilder.Entity<TEntity>().HasIndex(x => x.Id).IsUnique();
    }

    private void NormalizeTimestamps()
    {
        foreach (var entry in ChangeTracker.Entries().Where(x => x.State is EntityState.Added or EntityState.Modified))
            foreach (var property in entry.Properties)
                if (property.CurrentValue is DateTimeOffset value && value.Offset != TimeSpan.Zero)
                    property.CurrentValue = value.ToUniversalTime();
    }

    private void ValidateTenantWrites()
    {
        var writes = ChangeTracker.Entries<ITenantOwned>()
            .Where(x => x.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .ToList();
        if (writes.Count == 0) return;
        if (!tenantContext.IsResolved)
            throw new InvalidOperationException("A tenant must be resolved before tenant-owned data can be changed.");
        if (writes.Any(x => x.Entity.TenantId != tenantContext.TenantId))
            throw new InvalidOperationException("Cross-tenant writes are not permitted.");
        StampCompanies(writes);
    }

    /// <summary>Records that always belong to one company (stamped when added), as opposed to masters and tenant settings.</summary>
    private static bool IsCompanyRecord(EntityEntry entry) =>
        !OptionalCompanyTypes.Contains(entry.Entity.GetType())
        && !(entry.Entity is Movers.Domain.Operations.BillingRecord billing && SharedBillingKinds.Contains(billing.Kind));

    // New company records get the request company (or the tenant's default company for background work); masters keep
    // the scope they were given (none = shared). Records of another company can never be written.
    private void StampCompanies(IReadOnlyList<EntityEntry<ITenantOwned>> writes)
    {
        Guid? companyId = null;
        foreach (var entry in writes.Where(x => x.Entity is TenantOwnedEntity && !SharedTypes.Contains(x.Entity.GetType())))
        {
            var property = entry.Property(nameof(TenantOwnedEntity.CompanyId));
            var current = (Guid?)property.CurrentValue;
            var original = entry.State == EntityState.Added ? null : (Guid?)property.OriginalValue;
            if (entry.State == EntityState.Added && current is null && IsCompanyRecord(entry))
                property.CurrentValue = companyId ??= tenantContext.Company?.Id ?? DefaultCompanyId();
            else if (tenantContext.CompanyId is { } request && (current is { } owner && owner != request || original is { } before && before != request))
                throw new InvalidOperationException("Cross-company writes are not permitted.");
        }
    }

    private Guid DefaultCompanyId()
    {
        var tenantId = tenantContext.TenantId;
        var pending = ChangeTracker.Entries<Company>().FirstOrDefault(x => x.State == EntityState.Added && x.Entity.TenantId == tenantId && x.Entity.IsDefault);
        if (pending is not null) return pending.Entity.Id;
        var existing = Companies.IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.IsDefault).Select(x => (Guid?)x.Id).FirstOrDefault();
        if (existing is { } id) return id;
        var created = new Company(tenantId, "MAIN", tenantContext.Tenant?.Name ?? "Main company", true);
        Companies.Add(created);
        return created.Id;
    }

    private List<PendingAudit> CaptureAudits()
    {
        ChangeTracker.DetectChanges();
        return ChangeTracker.Entries<Entity>()
            .Where(x => x.Entity is not AuditLog && x.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .Select(CreatePendingAudit)
            .ToList();
    }

    private PendingAudit CreatePendingAudit(EntityEntry<Entity> entry)
    {
        var changes = new Dictionary<string, object?>();
        foreach (var property in entry.Properties.Where(x => x.Metadata.Name != nameof(User.PasswordHash)
                     && x.Metadata.Name is not nameof(TenantAwsConfiguration.EncryptedAccessKey)
                     && x.Metadata.Name is not nameof(TenantAwsConfiguration.EncryptedSecretKey)
                     && x.Metadata.Name is not nameof(TenantOpenAiConfiguration.EncryptedApiKey)))
        {
            if (entry.State == EntityState.Modified && !property.IsModified) continue;
            changes[property.Metadata.Name] = entry.State switch
            {
                EntityState.Added => property.CurrentValue,
                EntityState.Deleted => property.OriginalValue,
                _ => new { Old = property.OriginalValue, New = property.CurrentValue }
            };
        }

        var tenantId = entry.Entity switch
        {
            ITenantOwned owned => owned.TenantId,
            User user => user.TenantId,
            Role role => role.TenantId,
            Tenant tenant => tenant.Id,
            _ => tenantContext.IsResolved ? tenantContext.TenantId : null
        };
        return new PendingAudit(entry.Entity, tenantId, entry.State.ToString().ToUpperInvariant(),
            JsonSerializer.Serialize(changes));
    }

    private void PersistAudits(IEnumerable<PendingAudit> audits)
    {
        foreach (var audit in audits)
        {
            AuditLogs.Add(new AuditLog(audit.TenantId, userContext.UserId,
                userContext.IsAuthenticated ? userContext.Email : "system",
                audit.Action, audit.Entity.GetType().Name, audit.Entity.Id.ToString(),
                audit.Changes, userContext.IpAddress));
        }
    }

    private sealed record PendingAudit(Entity Entity, Guid? TenantId, string Action, string Changes);
}






