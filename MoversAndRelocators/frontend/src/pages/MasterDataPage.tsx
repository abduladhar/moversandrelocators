import { CurrencyMasters, CurrencyExchangeRates } from '../components/CurrencyMasters'
import { BusinessMastersPage } from './BusinessMastersPage'
import { RefreshButton } from '../components/RefreshButton'
import { useRef, useState, type ReactNode } from 'react'
import { Button, Empty, Input } from 'antd'
import { AppstoreOutlined, ArrowLeftOutlined, CarOutlined, CheckSquareOutlined, DollarOutlined, HomeOutlined, IdcardOutlined, InboxOutlined, SafetyCertificateOutlined, SearchOutlined, TagsOutlined, ToolOutlined } from '@ant-design/icons'
import { NavigationMenuDialog } from '../components/NavigationMenuDialog'
import { DesignationsPage } from './DesignationsPage'
import { SalesStatusMastersPage } from './SalesStatusMastersPage'
import { SurveyMastersPage } from './SurveyMastersPage'
import { PickupMastersPage } from './PickupMastersPage'
import { ChargeMastersPage } from './ChargeMastersPage'
import { TaxMastersPage } from './TaxMastersPage'

type MasterTile = { id: string; label: string; icon: ReactNode; editor: () => ReactNode }
type MasterGroup = { title: string; permission: string; tiles: MasterTile[] }

const groups: MasterGroup[] = [
  { title: 'Currencies', permission: 'billing.view', tiles: [{ id: 'currencies', label: 'Currency', icon: <IdcardOutlined />, editor: () => <CurrencyMasters/> }, { id: 'exchange-rates', label: 'Currency Exchange Rates', icon: <DollarOutlined />, editor: () => <CurrencyExchangeRates/> }] },
  { title: 'Customers & vendors', permission: 'operations.manage', tiles: [
    { id: 'customers', label: 'Customer', icon: <IdcardOutlined />, editor: () => <BusinessMastersPage kind="customer" /> },
    { id: 'vendors', label: 'Vendor', icon: <HomeOutlined />, editor: () => <BusinessMastersPage kind="vendor" /> },
  ] },
  { title: 'Pickup & payment setup', permission: 'operations.manage', tiles: [
    { id: 'crew-roles', label: 'Crew roles', icon: <IdcardOutlined />, editor: () => <BusinessMastersPage kind="crew-role" /> },
    { id: 'payment-methods', label: 'Payment method', icon: <DollarOutlined />, editor: () => <BusinessMastersPage kind="payment-method" /> },
    { id: 'payment-purposes', label: 'Payment for', icon: <TagsOutlined />, editor: () => <BusinessMastersPage kind="payment-purpose" /> },
    { id: 'expense-categories', label: 'Expense category', icon: <ToolOutlined />, editor: () => <BusinessMastersPage kind="expense-category" /> },
  ] },
  { title: 'People', permission: 'designations.manage', tiles: [
    { id: 'designations', label: 'Employee designation', icon: <IdcardOutlined />, editor: () => <DesignationsPage /> },
  ] },
  { title: 'Sales', permission: 'sales.statuses.manage', tiles: [
    { id: 'lead-statuses', label: 'Lead status', icon: <CheckSquareOutlined />, editor: () => <SalesStatusMastersPage initialMode="Lead statuses" /> },
    { id: 'follow-up-statuses', label: 'Follow-up status', icon: <SafetyCertificateOutlined />, editor: () => <SalesStatusMastersPage initialMode="Follow-up statuses" /> },
    { id: 'move-types', label: 'Move type', icon: <AppstoreOutlined />, editor: () => <SalesStatusMastersPage initialMode="Move types" /> },
  ] },
  { title: 'Survey & packing', permission: 'surveys.manage', tiles: [
    { id: 'household-items', label: 'Household items', icon: <HomeOutlined />, editor: () => <SurveyMastersPage initialTab="items" /> },
    { id: 'box-types', label: 'Box types', icon: <InboxOutlined />, editor: () => <SurveyMastersPage initialTab="box-types" /> },
    { id: 'packing-materials', label: 'Packing materials', icon: <ToolOutlined />, editor: () => <SurveyMastersPage initialTab="materials" /> },
  ] },
  { title: 'Pickup & transport', permission: 'operations.manage', tiles: [
    { id: 'pickup-statuses', label: 'Pickup status', icon: <CheckSquareOutlined />, editor: () => <PickupMastersPage initialTab="status" /> },
    { id: 'vehicles', label: 'Vehicles', icon: <CarOutlined />, editor: () => <PickupMastersPage initialTab="vehicle" /> },
    { id: 'warehouses', label: 'Warehouses', icon: <HomeOutlined />, editor: () => <PickupMastersPage initialTab="warehouse" /> },
  ] },
  { title: 'Quotation & finance', permission: 'quotes.manage', tiles: [
    { id: 'charges', label: 'Charge master', icon: <DollarOutlined />, editor: () => <ChargeMastersPage /> },
    { id: 'taxes', label: 'Tax configuration', icon: <TagsOutlined />, editor: () => <TaxMastersPage /> },
  ] },
]

export function MasterDataPage({ permissions }: { permissions: string[] }) {
  const [catalogVersion, setCatalogVersion] = useState(0)
  const [query, setQuery] = useState('')
  const [popupGroup, setPopupGroup] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const tileRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const allowed = groups.filter(group => permissions.includes(group.permission))
  const activePopup = allowed.find(group => group.title === popupGroup)
  const selected = allowed.flatMap(group => group.tiles).find(tile => tile.id === selectedId)
  const search = query.trim().toLowerCase()
  const visible = allowed.map(group => ({ ...group, tiles: group.tiles.filter(tile => (group.title + ' ' + tile.label).toLowerCase().includes(search)) })).filter(group => group.tiles.length)
  const goBack = () => {
    const previous = selectedId
    setSelectedId(null)
    requestAnimationFrame(() => { if (previous) tileRefs.current[previous]?.focus() })
  }

  if (selected) return <div className="master-data-editor">
    <Button className="master-data-back" icon={<ArrowLeftOutlined />} onClick={goBack}>Back to master data</Button>
    <div key={selected.id}>{selected.editor()}</div>
  </div>

  return <div className="master-data-page">
    <NavigationMenuDialog title={activePopup?.title ?? ''} open={Boolean(activePopup)}
      items={activePopup?.tiles.map(tile => ({ key: tile.id, label: tile.label, icon: tile.icon })) ?? []}
      onClose={() => setPopupGroup(null)} onSelect={id => { setPopupGroup(null); setSelectedId(id) }} />
    <div className="master-data-heading">
      <div><h1>Master data</h1><p>Select a tile to manage your company’s setup data.</p></div>
      <RefreshButton onRefresh={() => setCatalogVersion(value => value + 1)} /><Input className="master-data-search" aria-label="Search master data" placeholder="Search master data" prefix={<SearchOutlined />} allowClear value={query} onChange={event => setQuery(event.target.value)} />
    </div>
    <div className="master-data-groups" key={catalogVersion}>
      {visible.map(group => <section className="master-data-group" key={group.title} aria-labelledby={'master-group-' + group.tiles[0].id}>
        <h2 id={'master-group-' + group.tiles[0].id}><button className="master-group-open" type="button" aria-haspopup="dialog" onClick={() => setPopupGroup(group.title)}>{group.title}</button></h2>
        <div className="master-data-tiles">{group.tiles.map(tile => <button
          type="button" className="master-data-tile" key={tile.id}
          ref={element => { tileRefs.current[tile.id] = element }}
          onClick={() => setSelectedId(tile.id)}>
          <span className="master-data-icon" aria-hidden="true">{tile.icon}</span>
          <span>{tile.label}</span>
        </button>)}</div>
      </section>)}
      {!visible.length && <Empty description={allowed.length ? 'No master data matches your search.' : 'You do not have permission to manage master data.'} />}
    </div>
  </div>
}




