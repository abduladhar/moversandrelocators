import { CurrencyMasters, CurrencyExchangeRates } from '../components/CurrencyMasters'
import { BusinessMastersPage } from './BusinessMastersPage'
import { RefreshButton } from '../components/RefreshButton'
import { useRef, useState, type ReactNode } from 'react'
import { Button, Empty, Input } from 'antd'
import { AppstoreOutlined, ArrowLeftOutlined, CarOutlined, CheckSquareOutlined, DollarOutlined, HomeOutlined, IdcardOutlined, InboxOutlined, MessageOutlined, SafetyCertificateOutlined, SearchOutlined, TagsOutlined, ToolOutlined } from '@ant-design/icons'
import { NavigationMenuDialog } from '../components/NavigationMenuDialog'
import { DesignationsPage } from './DesignationsPage'
import { SalesStatusMastersPage } from './SalesStatusMastersPage'
import { SurveyMastersPage } from './SurveyMastersPage'
import { PickupMastersPage } from './PickupMastersPage'
import { ChargeMastersPage } from './ChargeMastersPage'
import { TaxMastersPage } from './TaxMastersPage'
import { useT } from '../i18n'

/** id: the group's / tile's key under masters.data.groups / masters.data.tiles. */
type MasterTile = { id: string; icon: ReactNode; editor: () => ReactNode }
type MasterGroup = { id: string; permission: string; tiles: MasterTile[] }

const groups: MasterGroup[] = [
  { id: 'currencies', permission: 'billing.view', tiles: [{ id: 'currencies', icon: <IdcardOutlined />, editor: () => <CurrencyMasters/> }, { id: 'exchange-rates', icon: <DollarOutlined />, editor: () => <CurrencyExchangeRates/> }] },
  { id: 'contacts', permission: 'operations.manage', tiles: [
    { id: 'customers', icon: <IdcardOutlined />, editor: () => <BusinessMastersPage kind="customer" /> },
    { id: 'vendors', icon: <HomeOutlined />, editor: () => <BusinessMastersPage kind="vendor" /> },
  ] },
  { id: 'pickupPayment', permission: 'operations.manage', tiles: [
    { id: 'crew-roles', icon: <IdcardOutlined />, editor: () => <BusinessMastersPage kind="crew-role" /> },
    { id: 'payment-methods', icon: <DollarOutlined />, editor: () => <BusinessMastersPage kind="payment-method" /> },
    { id: 'payment-purposes', icon: <TagsOutlined />, editor: () => <BusinessMastersPage kind="payment-purpose" /> },
    { id: 'expense-categories', icon: <ToolOutlined />, editor: () => <BusinessMastersPage kind="expense-category" /> },
    { id: 'message-templates', icon: <MessageOutlined />, editor: () => <BusinessMastersPage kind="message-template" /> },
  ] },
  { id: 'people', permission: 'designations.manage', tiles: [
    { id: 'designations', icon: <IdcardOutlined />, editor: () => <DesignationsPage /> },
  ] },
  { id: 'sales', permission: 'sales.statuses.manage', tiles: [
    { id: 'lead-statuses', icon: <CheckSquareOutlined />, editor: () => <SalesStatusMastersPage initialMode="Lead statuses" /> },
    { id: 'follow-up-statuses', icon: <SafetyCertificateOutlined />, editor: () => <SalesStatusMastersPage initialMode="Follow-up statuses" /> },
    { id: 'move-types', icon: <AppstoreOutlined />, editor: () => <SalesStatusMastersPage initialMode="Move types" /> },
  ] },
  { id: 'surveyPacking', permission: 'surveys.manage', tiles: [
    { id: 'household-items', icon: <HomeOutlined />, editor: () => <SurveyMastersPage initialTab="items" /> },
    { id: 'box-types', icon: <InboxOutlined />, editor: () => <SurveyMastersPage initialTab="box-types" /> },
    { id: 'packing-materials', icon: <ToolOutlined />, editor: () => <SurveyMastersPage initialTab="materials" /> },
  ] },
  { id: 'pickupTransport', permission: 'operations.manage', tiles: [
    { id: 'pickup-statuses', icon: <CheckSquareOutlined />, editor: () => <PickupMastersPage initialTab="status" /> },
    { id: 'vehicles', icon: <CarOutlined />, editor: () => <PickupMastersPage initialTab="vehicle" /> },
    { id: 'warehouses', icon: <HomeOutlined />, editor: () => <PickupMastersPage initialTab="warehouse" /> },
  ] },
  { id: 'quotationFinance', permission: 'quotes.manage', tiles: [
    { id: 'charges', icon: <DollarOutlined />, editor: () => <ChargeMastersPage /> },
    { id: 'taxes', icon: <TagsOutlined />, editor: () => <TaxMastersPage /> },
  ] },
]

export function MasterDataPage({ permissions }: { permissions: string[] }) {
  const { t } = useT()
  const groupTitle = (group: MasterGroup) => t('masters.data.groups.' + group.id)
  const tileLabel = (tile: MasterTile) => t('masters.data.tiles.' + tile.id)
  const [catalogVersion, setCatalogVersion] = useState(0)
  const [query, setQuery] = useState('')
  const [popupGroup, setPopupGroup] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const tileRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const allowed = groups.filter(group => permissions.includes(group.permission))
  const activePopup = allowed.find(group => group.id === popupGroup)
  const selected = allowed.flatMap(group => group.tiles).find(tile => tile.id === selectedId)
  const search = query.trim().toLowerCase()
  const visible = allowed.map(group => ({ ...group, tiles: group.tiles.filter(tile => (groupTitle(group) + ' ' + tileLabel(tile)).toLowerCase().includes(search)) })).filter(group => group.tiles.length)
  const goBack = () => {
    const previous = selectedId
    setSelectedId(null)
    requestAnimationFrame(() => { if (previous) tileRefs.current[previous]?.focus() })
  }

  if (selected) return <div className="master-data-editor">
    <Button className="master-data-back" icon={<ArrowLeftOutlined />} onClick={goBack}>{t('masters.data.back')}</Button>
    <div key={selected.id}>{selected.editor()}</div>
  </div>

  return <div className="master-data-page">
    <NavigationMenuDialog title={activePopup ? groupTitle(activePopup) : ''} open={Boolean(activePopup)}
      items={activePopup?.tiles.map(tile => ({ key: tile.id, label: tileLabel(tile), icon: tile.icon })) ?? []}
      onClose={() => setPopupGroup(null)} onSelect={id => { setPopupGroup(null); setSelectedId(id) }} />
    <div className="master-data-heading">
      <div><h1>{t('masters.data.title')}</h1><p>{t('masters.data.description')}</p></div>
      <RefreshButton onRefresh={() => setCatalogVersion(value => value + 1)} /><Input className="master-data-search" aria-label={t('masters.data.search')} placeholder={t('masters.data.search')} prefix={<SearchOutlined />} allowClear value={query} onChange={event => setQuery(event.target.value)} />
    </div>
    <div className="master-data-groups" key={catalogVersion}>
      {visible.map(group => <section className="master-data-group" key={group.id} aria-labelledby={'master-group-' + group.tiles[0].id}>
        <h2 id={'master-group-' + group.tiles[0].id}><button className="master-group-open" type="button" aria-haspopup="dialog" onClick={() => setPopupGroup(group.id)}>{groupTitle(group)}</button></h2>
        <div className="master-data-tiles">{group.tiles.map(tile => <button
          type="button" className="master-data-tile" key={tile.id}
          ref={element => { tileRefs.current[tile.id] = element }}
          onClick={() => setSelectedId(tile.id)}>
          <span className="master-data-icon" aria-hidden="true">{tile.icon}</span>
          <span>{tileLabel(tile)}</span>
        </button>)}</div>
      </section>)}
      {!visible.length && <Empty description={allowed.length ? t('masters.data.noMatch') : t('masters.data.noPermission')} />}
    </div>
  </div>
}




