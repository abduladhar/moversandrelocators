import { ReportTemplatesPage } from '../reportingV2/ReportTemplatesPage'
import { BrandMark, PRODUCT_NAME } from '../components/BrandMark'
import { AccountingReportsPage } from '../pages/AccountingReportsPage'
import { AccountingDocumentQueue } from '../components/AccountingDocumentQueue'
import { CurrencyConfigurationPage } from '../pages/CurrencyConfigurationPage'
import { CashPostingPanel } from '../components/CashPostingPanel'
import { BillingPanel, billingPages } from '../components/BillingPanel'
import { BillingPermissions } from '../billingApi'
import { BusinessMastersPage } from '../pages/BusinessMastersPage'
import { JobsPage } from '../pages/JobsPage'
import { WarehousePage } from '../pages/WarehousePage'
import { NavigationMenuDialog } from '../components/NavigationMenuDialog'
import { MasterDataPage } from '../pages/MasterDataPage'
import { ShipmentsPage } from '../pages/ShipmentsPage'
import { OperationsCostsPage } from '../pages/OperationsCostsPage'
import { TransportTripsPage } from '../pages/TransportTripsPage'
import { useState } from 'react'
import { Avatar, Button, Grid, Layout, Menu, Modal, Select, Space, Tag, Typography, message } from 'antd'
import { DownOutlined, RightOutlined, InboxOutlined, SendOutlined, AppstoreOutlined, ApartmentOutlined, AuditOutlined, BankOutlined, CarOutlined, CloudServerOutlined, DollarOutlined, FileDoneOutlined, FileSearchOutlined, HomeOutlined, IdcardOutlined, LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, RobotOutlined, ExperimentOutlined, SafetyCertificateOutlined, ShopOutlined, TagsOutlined, TeamOutlined, ToolOutlined, UserSwitchOutlined, ClusterOutlined } from '@ant-design/icons'
import { authApi } from '../api'
import type { AuthSession, Tenant } from '../types'
import { TenantsPage } from '../pages/TenantsPage'
import { UsersPage } from '../pages/UsersPage'
import { RolesPage } from '../pages/RolesPage'
import { DesignationsPage } from '../pages/DesignationsPage'
import { CrewPage } from '../pages/CrewPage'
import { EmployeesPage } from '../pages/EmployeesPage'
import { AuditPage } from '../pages/AuditPage'
import { SalesLeadsPage } from '../pages/SalesLeadsPage'
import { SalesStatusMastersPage } from '../pages/SalesStatusMastersPage'
import { MyTasksPage } from '../pages/MyTasksPage'
import { AwsConfigurationPage } from '../pages/AwsConfigurationPage'
import { OpenAiConfigurationPage } from '../pages/OpenAiConfigurationPage'
import { ClaudeConfigurationPage } from '../pages/ClaudeConfigurationPage'
import { SurveysPage } from '../pages/SurveysPage'
import { SurveyMastersPage } from '../pages/SurveyMastersPage'
import { QuotationsPage } from '../pages/QuotationsPage'
import { ChargeMastersPage } from '../pages/ChargeMastersPage'
import { TaxMastersPage } from '../pages/TaxMastersPage'
import { PickupsPage } from '../pages/PickupsPage'
import { PackingJobsPage } from '../pages/PackingJobsPage'
import { DeliveryJobsPage } from '../pages/DeliveryJobsPage'
import { PickupMastersPage } from '../pages/PickupMastersPage'
import { CompaniesPage } from '../pages/CompaniesPage'
import { rememberCompany } from '../session'

type PageKey = 'delivery' | 'report-designs' | 'accounting-reports' | `billing-${string}` | 'currency-settings' | 'posting' | 'billing' | 'customers' | 'vendors' | 'jobs' | 'warehouse' | 'master-data' | 'shipments' | 'costs' | 'trips' | 'dashboard' | 'tenants' | 'users' | 'roles' | 'designations' | 'employees' | 'crew' | 'sales' | 'sales-statuses' | 'surveys' | 'survey-masters' | 'quotations' | 'charge-masters' | 'tax-masters' | 'pickups' | 'packing' | 'pickup-masters' | 'vehicle-master' | 'warehouse-master' | 'box-type-master' | 'packing-material-master' | 'aws-settings' | 'openai-settings' | 'claude-settings' | 'audit' | 'companies'

export function WorkspaceLayout({ session, onSession }: { session: AuthSession; onSession: (session: AuthSession | null) => void }) {
  const isSystem = session.user.isSystemAdmin
  const tenantReady = Boolean(session.tenantId)
  const canManageCurrency = session.user.permissions.includes("billing.accounts")
  const canManageAws = session.user.permissions.includes('settings.aws.manage')
  const canManageOpenAi = session.user.permissions.includes('settings.openai.manage')
  // Whoever manages OpenAI also manages Claude (same rule on the server), so no role change is needed.
  const canManageClaude = canManageOpenAi || session.user.permissions.includes('settings.claude.manage')
  const canManageSurveys = session.user.permissions.includes('surveys.manage')
  const canManageQuotes = session.user.permissions.includes('quotes.manage')
  const canManageOperations = session.user.permissions.includes('operations.manage')
  const canManagePacking = canManageOperations || session.user.permissions.includes('packing.manage')
  const canManageDelivery = canManageOperations || session.user.permissions.includes('delivery.manage')
  // Company users work in one company; tenant users and system administrators can switch and manage companies.
  const tenantWide = isSystem || session.canSwitchCompany !== false
  const canManageCompanies = tenantWide && session.user.permissions.includes('settings.companies.manage')
  const companies = session.companies ?? []
  /** Name printed on documents and shown in headers: the current company, else the tenant. */
  const companyLabel = session.companyName ?? session.tenantName ?? PRODUCT_NAME
  const [page, setPage] = useState<PageKey>(isSystem && !tenantReady ? 'tenants' : 'dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [minimizedSections, setMinimizedSections] = useState<Record<string, boolean>>({})
  const [menuGroup, setMenuGroup] = useState<string | null>(null)
  const screens = Grid.useBreakpoint()
  const selectTenant = async (tenant: Tenant) => {
    try { onSession(await authApi.selectTenant(tenant.id)); setPage('dashboard') }
    catch (reason) { message.error(reason instanceof Error ? reason.message : 'Unable to open tenant.') }
  }
  const switchCompany = (companyId: string) => {
    if (companyId === session.companyId) return
    const target = companies.find(x => x.id === companyId)
    Modal.confirm({
      title: `Switch to ${target?.name ?? 'this company'}?`,
      content: 'Open pages reload with that company\'s records. Unsaved changes on this page are lost.',
      okText: 'Switch company',
      onOk: async () => {
        try { const next = await authApi.selectCompany(companyId); rememberCompany(next.companyId); onSession(next); message.success(`Now working in ${next.companyName ?? target?.name}`) }
        catch (reason) { message.error(reason instanceof Error ? reason.message : 'Unable to switch company.') }
      },
    })
  }
  const items = [
    ...(session.user.permissions.includes('reports.design')?[{key:'report-designs',icon:<FileDoneOutlined/>,label:'Report designs',disabled:!tenantReady}]:[]),
    ...(session.user.permissions.includes('billing.view')?[{key:'accounting-reports',icon:<BankOutlined/>,label:'Accounting reports',disabled:!tenantReady}]:[]),
    ...(session.user.permissions.includes('billing.view') && session.user.permissions.includes('billing.pay') ? [{key:'posting',icon:<BankOutlined/>,label:'Accountant posting',disabled:!tenantReady}] : []),
    ...(session.user.permissions.includes('billing.view') ? [{ key: 'billing', icon: <BankOutlined />, label: 'Invoicing & billing', disabled: !tenantReady, children: billingPages.map(p=>({key:'billing-'+p.key,label:p.label,icon:p.key==='INVOICE'?<FileDoneOutlined/>:p.key==='BILL'?<FileSearchOutlined/>:p.key==='currencies'||p.key==='exchange-rates'?<DollarOutlined/>:p.key==='accounts'?<BankOutlined/>:<AppstoreOutlined/>})) }] : []),
    { key: 'master-data', icon: <AppstoreOutlined />, label: 'Master data', disabled: !tenantReady },
    ...(canManagePacking ? [{ key: 'packing', icon: <InboxOutlined />, label: 'Packing', disabled: !tenantReady }] : []),
    ...(canManageOperations ? [{ key: 'pickups', icon: <CarOutlined />, label: 'Pickup', disabled: !tenantReady }] : []),
    ...(canManageDelivery ? [{ key: 'delivery', icon: <SendOutlined />, label: 'Delivery', disabled: !tenantReady }] : []),
    ...(canManageOperations ? [{ key: 'jobs', icon: <CarOutlined />, label: 'Jobs', disabled: !tenantReady }] : []),
    ...(canManageOperations ? [{ key: 'warehouse', icon: <HomeOutlined />, label: 'Warehouse', disabled: !tenantReady }] : []),
    ...(canManageOperations ? [{ key: 'shipments', icon: <CarOutlined />, label: 'Shipment tracking', disabled: !tenantReady }] : []),
    ...(session.user.permissions.includes('employees.view') ? [{ key: 'crew', icon: <TeamOutlined />, label: 'Crew', disabled: !tenantReady }] : []),
    ...(session.user.permissions.includes('accounting.manage') ? [{ key: 'costs', icon: <BankOutlined />, label: 'Costs & finance', disabled: !tenantReady }] : []),
    ...(session.user.permissions.includes('transportation.manage') ? [{ key: 'trips', icon: <CarOutlined />, label: 'Transport', disabled: !tenantReady }] : []),
    ...(isSystem ? [{ key: 'platform', icon: <ShopOutlined />, label: 'Platform', children: [{ key: 'tenants', icon: <ShopOutlined />, label: 'Tenants' }] }] : []),
    { key: 'workspace', icon: <HomeOutlined />, label: 'Workspace', children: [{ key: 'dashboard', icon: <HomeOutlined />, label: 'My tasks', disabled: !tenantReady }] },
    { key: 'people', icon: <TeamOutlined />, label: 'People', disabled: !tenantReady, children: [{ key: 'customers', icon: <IdcardOutlined />, label: 'Customers' }, { key: 'vendors', icon: <ShopOutlined />, label: 'Vendors' }, { key: 'employees', icon: <TeamOutlined />, label: 'Employees' }, { key: 'designations', icon: <IdcardOutlined />, label: 'Designations' }] },
    { key: 'sales-group', icon: <ApartmentOutlined />, label: 'Sales', disabled: !tenantReady, children: [{ key: 'sales', icon: <ApartmentOutlined />, label: 'Sales leads' }, { key: 'sales-statuses', icon: <TagsOutlined />, label: 'Status masters' }] },
    ...(canManageSurveys ? [{ key: 'survey-group', icon: <FileSearchOutlined />, label: 'Survey', disabled: !tenantReady, children: [{ key: 'surveys', icon: <FileSearchOutlined />, label: 'Surveys' }, { key: 'survey-masters', icon: <ToolOutlined />, label: 'Master data' }] }] : []),
    ...(canManageQuotes ? [{ key: 'quotation-group', icon: <FileDoneOutlined />, label: 'Quotation', disabled: !tenantReady, children: [{ key: 'quotations', icon: <FileDoneOutlined />, label: 'Quotations' }, { key: 'charge-masters', icon: <DollarOutlined />, label: 'Charge master' }, { key: 'tax-masters', icon: <TagsOutlined />, label: 'Tax configuration' }] }] : []),
    ...(canManageOperations ? [{ key: 'operations-group', icon: <CarOutlined />, label: 'Operations setup', disabled: !tenantReady, children: [{ key: 'pickup-masters', icon: <TagsOutlined />, label: 'Pickup statuses' }, { key: 'vehicle-master', icon: <CarOutlined />, label: 'Vehicles' }, { key: 'warehouse-master', icon: <HomeOutlined />, label: 'Warehouses' }, ...(canManageSurveys ? [{ key: 'box-type-master', icon: <AppstoreOutlined />, label: 'Box types' }, { key: 'packing-material-master', icon: <ToolOutlined />, label: 'Packing materials' }] : [])] }] : []),
    { key: 'administration', icon: <SafetyCertificateOutlined />, label: 'Administration', disabled: !tenantReady, children: [{ key: 'users', icon: <UserSwitchOutlined />, label: 'Users' }, { key: 'roles', icon: <SafetyCertificateOutlined />, label: 'Roles & permissions' }, { key: 'audit', icon: <AuditOutlined />, label: 'Audit trail' }] },
    ...((canManageCurrency || canManageAws || canManageOpenAi || canManageClaude || canManageCompanies) ? [{ key: 'settings', icon: <CloudServerOutlined />, label: 'Settings', disabled: !tenantReady, children: [...(canManageCompanies ? [{ key: 'companies', icon: <ClusterOutlined />, label: 'Companies' }] : []), ...(canManageCurrency ? [{ key: 'currency-settings', icon: <DollarOutlined />, label: 'System currency' }] : []), ...(canManageAws ? [{ key: 'aws-settings', icon: <CloudServerOutlined />, label: 'AWS configuration' }] : []), ...(canManageOpenAi ? [{ key: 'openai-settings', icon: <RobotOutlined />, label: 'OpenAI configuration' }] : []), ...(canManageClaude ? [{ key: 'claude-settings', icon: <ExperimentOutlined />, label: 'Claude configuration' }] : [])] }] : []),
  ]
  const permissionByPage: Partial<Record<PageKey, string>> = {
    customers: 'operations.manage', vendors: 'operations.manage', employees: 'employees.view', designations: 'designations.manage', sales: 'sales.view',
    'sales-statuses': 'sales.statuses.manage', users: 'security.users.view',
    roles: 'security.roles.view', audit: 'security.audit.view',
  }
  const visibleItems = items.map(item => ({ ...item, children: item.children?.filter(child => {
    const permission = permissionByPage[child.key as PageKey]
    return !permission || session.user.permissions.includes(permission)
  }) })).filter(item => !item.children || item.children.length > 0)
  const sections = [
    { key: 'workspace-section', label: 'Workspace', keys: ['workspace', 'people'] },
    { key: 'sales-section', label: 'Sales & planning', keys: ['sales-group', 'survey-group', 'quotation-group'] },
    // Order follows the real sequence: pack, collect, store, ship. 'trips' (Transport) is deliberately left out
    // so it stays off the menu; the page and its permission are untouched, so adding the key back restores it.
    { key: 'operations-section', label: 'Operations', keys: ['packing', 'pickups', 'delivery', 'warehouse', 'jobs', 'shipments', 'crew'] },
    { key: 'finance-section', label: 'Finance', keys: ['billing', 'posting', 'accounting-reports', 'costs'] },
    { key: 'setup-section', label: 'Administration & setup', keys: ['report-designs', 'master-data', 'operations-group', 'administration', 'settings', 'platform'] },
  ]
  const groupedItems = sections.filter(section => section.keys.some(key => visibleItems.some(item => item.key === key))).map(section => {
    // The compact icon rail must remain navigable even when a section is minimized.
    const minimized = !collapsed && Boolean(minimizedSections[section.key])
    return {
      type: 'group' as const, key: section.key,
      label: <button type="button" className="sidebar-section-toggle"
        aria-label={(minimized ? 'Expand ' : 'Minimize ') + section.label}
        aria-expanded={!minimized}
        onClick={event => {
          event.stopPropagation()
          setMinimizedSections(previous => ({ ...previous, [section.key]: !previous[section.key] }))
        }}>
        <span>{section.label}</span>{minimized ? <RightOutlined /> : <DownOutlined />}
      </button>,
      children: minimized ? [] : section.keys.flatMap(key => {
        const entry = visibleItems.find(item => item.key === key)
        if (!entry) return []
        const { children: _children, ...item } = entry
        return [item]
      }),
    }
  })
  const activeGroup = visibleItems.find(item => item.key === menuGroup)
  const parentKey = visibleItems.find(item => item.children?.some(child => child.key === page))?.key
  const navigate = (key: string) => {
    setPage(key as PageKey)
    setMenuGroup(null)
    if (!screens.lg) setCollapsed(true)
  }
  return <BillingPermissions.Provider value={session.user.permissions}><Layout className="workspace-layout">
    <NavigationMenuDialog columns={menuGroup==='billing'?3:2} title={activeGroup?.label ?? ''} open={Boolean(activeGroup?.children)}
      items={activeGroup?.children ?? []} onClose={() => setMenuGroup(null)} onSelect={navigate} />
    <Layout.Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} trigger={null} breakpoint="lg" onBreakpoint={broken => setCollapsed(broken)} collapsedWidth={screens.lg ? 72 : 0} width={252} theme="dark" className={`app-sider ${collapsed ? 'is-collapsed' : ''}`}><div className="brand"><BrandMark size={36} /><b>crateway</b></div><div className="tenant-context"><small>ACTIVE WORKSPACE</small><strong>{session.tenantName ?? 'Platform administration'}</strong>{tenantReady && session.companyId && (tenantWide && companies.length > 1
      ? <Select className="company-switcher" size="small" value={session.companyId} onChange={switchCompany} aria-label="Company" popupMatchSelectWidth={false} suffixIcon={<UserSwitchOutlined />} options={companies.map(x => ({ value: x.id, label: x.name }))} />
      : <span className="company-name"><ClusterOutlined /> {session.companyName}</span>)}<Typography.Text>{isSystem ? 'System administrator' : tenantWide ? 'Tenant user · all companies' : 'Company user'}</Typography.Text></div><div className="sidebar-menu-scroll"><Menu theme="dark" mode="inline" inlineCollapsed={collapsed} selectedKeys={[parentKey ?? page]} items={groupedItems} onClick={({ key }) => { const item = visibleItems.find(entry => entry.key === key); if (item?.children) setMenuGroup(key); else navigate(key) }} /></div><div className="user-card"><Avatar>{session.user.fullName.charAt(0)}</Avatar><div><strong>{session.user.fullName}</strong><small>{session.user.email}</small></div><Button type="text" aria-label="Sign out" icon={<LogoutOutlined />} onClick={() => onSession(null)} /></div></Layout.Sider>
    <Layout><Layout.Header className="topbar"><Button type="text" className="menu-toggle" aria-label={collapsed ? 'Expand side menu' : 'Collapse side menu'} icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(value => !value)} /><Space><Tag color="green">Protected session</Tag><Typography.Text type="secondary">{session.tenantName ? [session.tenantName, session.companyName].filter(Boolean).join(' · ') : 'Select a tenant to continue'}</Typography.Text></Space></Layout.Header><Layout.Content className="workspace-content" key={session.companyId ?? 'tenant'}>
      {page === 'report-designs' && tenantReady && session.user.permissions.includes('reports.design') && <ReportTemplatesPage />}
      {page === 'accounting-reports' && tenantReady && session.user.permissions.includes('billing.view') && <AccountingReportsPage/>}
      {page === 'posting' && tenantReady && session.user.permissions.includes('billing.view') && session.user.permissions.includes('billing.pay') && <><h1>Accountant posting</h1><AccountingDocumentQueue/><CashPostingPanel/></>}
      {(page === 'billing'||page.startsWith('billing-')) && tenantReady && <BillingPanel key={page} section={page==='billing'?undefined:page.slice(8)} companyName={companyLabel} />}
      {page === 'master-data' && tenantReady && <MasterDataPage key={session.tenantId} permissions={session.user.permissions} />}
      {page === 'customers' && tenantReady && canManageOperations && <BusinessMastersPage key='customer' kind='customer' />}
      {page === 'vendors' && tenantReady && canManageOperations && <BusinessMastersPage key='vendor' kind='vendor' />}
      {page === 'jobs' && tenantReady && canManageOperations && <JobsPage companyName={companyLabel} userName={session.user.fullName} />}
      {page === 'warehouse' && tenantReady && canManageOperations && <WarehousePage companyName={companyLabel} userName={session.user.fullName} />}
      {page === 'shipments' && tenantReady && canManageOperations && <ShipmentsPage />}
      {page === 'costs' && tenantReady && session.user.permissions.includes('accounting.manage') && <OperationsCostsPage />}
      {page === 'trips' && tenantReady && session.user.permissions.includes('transportation.manage') && <TransportTripsPage />}
      {page === 'tenants' && <TenantsPage onSelect={selectTenant} />}
      {page === 'dashboard' && tenantReady && <MyTasksPage onNavigate={target => setPage(target as PageKey)} />}
      {page === 'users' && tenantReady && <UsersPage tenantWide={tenantWide} />}
      {page === 'companies' && tenantReady && canManageCompanies && <CompaniesPage currentCompanyId={session.companyId} onChanged={rows => onSession({ ...session, companies: rows.filter(x => x.isActive).map(x => ({ id: x.id, code: x.code, name: x.name, isDefault: x.isDefault })), companyName: rows.find(x => x.id === session.companyId)?.name ?? session.companyName })} />}
      {page === 'roles' && tenantReady && <RolesPage />}
      {page === 'designations' && tenantReady && <DesignationsPage />}
      {page === 'sales' && tenantReady && <SalesLeadsPage />}
      {page === 'sales-statuses' && tenantReady && <SalesStatusMastersPage />}
      {page === 'surveys' && tenantReady && canManageSurveys && <SurveysPage />}
      {page === 'survey-masters' && tenantReady && canManageSurveys && <SurveyMastersPage />}
      {page === 'quotations' && tenantReady && canManageQuotes && <QuotationsPage />}
      {page === 'charge-masters' && tenantReady && canManageQuotes && <ChargeMastersPage />}
      {page === 'tax-masters' && tenantReady && canManageQuotes && <TaxMastersPage />}
      {page === 'pickups' && tenantReady && canManageOperations && <PickupsPage key={page} companyName={companyLabel} userName={session.user.fullName} />}
      {page === 'packing' && tenantReady && canManagePacking && <PackingJobsPage />}
      {page === 'delivery' && tenantReady && canManageDelivery && <DeliveryJobsPage />}
      {page === 'pickup-masters' && tenantReady && canManageOperations && <PickupMastersPage key="status" initialTab="status" />}
      {page === 'vehicle-master' && tenantReady && canManageOperations && <PickupMastersPage key="vehicle" initialTab="vehicle" />}
      {page === 'warehouse-master' && tenantReady && canManageOperations && <PickupMastersPage key="warehouse" initialTab="warehouse" />}
      {page === 'box-type-master' && tenantReady && canManageSurveys && <SurveyMastersPage key="box-types" initialTab="box-types" />}
      {page === 'packing-material-master' && tenantReady && canManageSurveys && <SurveyMastersPage key="materials" initialTab="materials" />}
      {page === 'employees' && tenantReady && <EmployeesPage />}
      {page === 'crew' && tenantReady && session.user.permissions.includes('employees.view') && <CrewPage />}
      {page === 'audit' && tenantReady && <AuditPage />}
      {page === 'currency-settings' && tenantReady && canManageCurrency && <CurrencyConfigurationPage/>}
      {page === 'aws-settings' && tenantReady && canManageAws && <AwsConfigurationPage />}
      {page === 'openai-settings' && tenantReady && canManageOpenAi && <OpenAiConfigurationPage />}
      {page === 'claude-settings' && tenantReady && canManageClaude && <ClaudeConfigurationPage />}
    </Layout.Content></Layout>
  </Layout></BillingPermissions.Provider>
}
















