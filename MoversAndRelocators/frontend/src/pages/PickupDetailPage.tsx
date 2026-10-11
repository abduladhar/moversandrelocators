import {ReportPrintButton} from '../reportingV2/ReportPrintButton'
import { BillingPanel } from '../components/BillingPanel'
import { useBilling } from '../billingApi'
import { useCurrencies } from '../currency'
import { RefreshButton } from '../components/RefreshButton'
import { useEffect, useState } from 'react'
import { Button, Card, Tabs, Tag, Typography, message } from 'antd'
import { ArrowLeftOutlined, CalendarOutlined, CarOutlined, CheckCircleOutlined, DollarOutlined, InboxOutlined, LinkOutlined, ShoppingOutlined, TeamOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { employeesApi, pickupsApi, surveysApi } from '../api'
import type { BoxType, Employee, PackingMaterial, PickupDetail, PickupPackage, PickupStatus, PickupWork, Vehicle, Warehouse } from '../types'
import { TripClockCard, when } from '../components/TripClockCard'
import { money } from '../components/ExpensesCard'
import { PickupPlanTab } from '../components/pickup/PickupPlanTab'
import { PickupPackingTab, toDraft, type MaterialDraft, type PackageDraft } from '../components/pickup/PickupPackingTab'
import { PickupCollectionTab } from '../components/pickup/PickupCollectionTab'
import { PickupPhotosTab } from '../components/pickup/PickupPhotosTab'
import { PickupPaymentsTab } from '../components/pickup/PickupPaymentsTab'
import { PickupStorageTab } from '../components/pickup/PickupStorageTab'
import { PickupSignoffTab } from '../components/pickup/PickupSignoffTab'
import { BoxLabels, PaymentReceipt, PrintPreview } from '../components/pickup/PrintDocuments'

type Masters = { employees: Employee[]; statuses: PickupStatus[]; vehicles: Vehicle[]; boxTypes: BoxType[]; materials: PackingMaterial[]; warehouses: Warehouse[] }
type Props = { pickupId: string; companyName: string; userName: string; onBack: () => void; onChanged: () => void; initialTab?: string }

/** Pickup workspace: plan, trip clock, room-by-room packing, photos, payments and expenses, warehouse storage and sign-off. */
export function PickupDetailPage({ pickupId, companyName, userName, onBack, onChanged, initialTab = 'plan' }: Props) {
  const [detail, setDetail] = useState<PickupDetail>(), [work, setWork] = useState<PickupWork>(), [masters, setMasters] = useState<Masters>()
  const [tab, setTab] = useState(initialTab), [labels, setLabels] = useState<PickupPackage[] | null>(null), [receipt, setReceipt] = useState<PickupDetail['transactions'][number] | null>(null)

  const canBill = useBilling(), { data: currencyData } = useCurrencies()
  const load = () => Promise.all([pickupsApi.get(pickupId), pickupsApi.work(pickupId), employeesApi.employees(), pickupsApi.statuses(), pickupsApi.vehicles(), surveysApi.boxTypes(), surveysApi.materials(), pickupsApi.warehouses()])
      .then(([d, w, employees, statuses, vehicles, boxTypes, materials, warehouses]) => { setDetail(d); setWork(w); setMasters({ employees, statuses, vehicles, boxTypes, materials, warehouses }) })
      .catch(e => message.error(e instanceof Error ? e.message : 'Unable to load the pickup'))
  useEffect(() => { void load() }, [pickupId])

  if (!detail || !work || !masters) return <Card loading />
  // Older payments without their own currency are shown in the tenant's default transaction currency.
  const p = detail.pickup, currency = currencyData?.settings.defaultCurrency ?? ''
  const updateDetail = (d: PickupDetail) => { setDetail(d); onChanged() }
  const updateWork = (w: PickupWork) => setWork(w)
  const saveDetails = async (changes: { assignments?: { employeeId: string; role: string }[]; packages?: PackageDraft[]; materials?: MaterialDraft[] }) => {
    const updated = await pickupsApi.saveDetails(p.id, {
      assignments: changes.assignments ?? detail.assignments.map(a => ({ employeeId: a.employeeId, role: a.role })),
      packages: changes.packages ?? detail.packages.map(toDraft),
      materials: changes.materials ?? detail.materials.filter(m => !m.isBoxRecipe).map(m => ({ materialId: m.materialId, quantity: m.quantity, unitCost: m.unitCost })),
    })
    updateDetail(updated); setWork(await pickupsApi.work(p.id))
  }
  const trip = async (result: Promise<PickupWork>) => { setWork(await result); setDetail(await pickupsApi.get(p.id)); onChanged() }

  const packedUnits = detail.packages.reduce((s, b) => s + b.items.reduce((n, i) => n + i.quantity, 0), 0), expected = work.expectedInventory.reduce((s, x) => s + x.quantity, 0)
  const status = masters.statuses.find(s => s.id === p.statusId)
  const crewSigned = work.signoffs.some(s => s.party === 'EMPLOYEE')
  const kpis = [
    { key: 'rooms', icon: <InboxOutlined />, label: 'Boxes packed', value: detail.packages.length },
    { key: 'units', icon: <UnorderedListOutlined />, label: 'Items packed', value: expected ? `${packedUnits} / ${expected}` : packedUnits },
    { key: 'volume', icon: <ShoppingOutlined />, label: 'Material cost', value: money(detail.materials.reduce((s, m) => s + m.totalCost, 0)) },
    { key: 'cost', icon: <DollarOutlined />, label: 'Receipts', value: String(detail.transactions.filter(x=>x.type==='INCOME').length) },
  ]
  const facts = [
    { key: 'source', icon: <LinkOutlined />, label: 'Created from', value: p.quotationNumber ? `Quotation ${p.quotationNumber}` : p.leadNumber ? `Sales lead ${p.leadNumber}` : 'Direct pickup' },
    { key: 'schedule', icon: <CalendarOutlined />, label: 'Pickup time', value: when(p.scheduledAtUtc) },
    { key: 'vehicle', icon: <CarOutlined />, label: 'Vehicle', value: p.vehicleNumber ?? <Tag>Not assigned</Tag> },
    { key: 'crew', icon: <TeamOutlined />, label: 'Crew', value: detail.assignments.length ? `${detail.assignments.length} assigned` : <Tag>Not assigned</Tag> },
    { key: 'signoff', icon: <CheckCircleOutlined />, label: 'Sign-off', value: <Tag color={crewSigned ? 'green' : 'default'}>Crew {crewSigned ? '✓' : '—'}</Tag> },
  ]

  return <div className="survey-workspace pickup-workspace">
    <div className="survey-workspace-header"><div className="survey-heading"><Button icon={<ArrowLeftOutlined />} aria-label="Back to pickups" onClick={onBack} /><div><Typography.Text className="eyebrow">PICKUP WORKSPACE</Typography.Text><Typography.Title level={2}>{p.pickupNumber}<span className="survey-heading-customer">{p.customerName}</span></Typography.Title></div></div>
      <div className="survey-heading-actions"><Tag className="survey-status-tag" color={status?.color ?? 'blue'}>{status?.name ?? p.statusName}</Tag></div></div>

    <div className="survey-kpi-row">{kpis.map(k => <div key={k.key} className={`survey-kpi survey-kpi-${k.key}`}><span className="survey-kpi-icon">{k.icon}</span><div><small>{k.label}</small><strong>{k.value}</strong></div></div>)}</div>
    <Card className="survey-customer-strip"><div className="survey-facts pickup-facts">{facts.map(f => <div key={f.key} className="survey-fact"><span className="survey-fact-icon">{f.icon}</span><div><small>{f.label}</small><div className="survey-fact-value">{f.value}</div></div></div>)}</div></Card>

    <TripClockCard noun="pickup" startedAtUtc={p.startedAtUtc} endedAtUtc={p.endedAtUtc} isPaused={work.trip.isPaused} events={work.trip.events} distanceKm={work.trip.distanceKm}
      onStart={at => trip(pickupsApi.startTrip(p.id, at))} onPause={(reason, at) => trip(pickupsApi.pauseTrip(p.id, reason, at))} onResume={at => trip(pickupsApi.resumeTrip(p.id, at))}
      onComplete={x => trip(pickupsApi.completeTrip(p.id, { at: x.at, distanceKm: x.distanceKm }))} onEdit={x => trip(pickupsApi.updateDistance(p.id, x.distanceKm))} />

    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><RefreshButton onRefresh={load} confirmText="Reload the latest pickup and packing data. Save any open form before refreshing." /></div><ReportPrintButton type="PACKING_LIST" title={detail.pickup.pickupNumber+' packing list'} id={detail.pickup.id}/><Tabs className="pickup-tabs" activeKey={tab} onChange={setTab} items={[
      ...(canBill ? [{ key: 'billing', label: 'Invoicing & billing', children: <BillingPanel sourceKind='PICKUP' sourceId={pickupId} companyName={companyName} /> }] : []),
      { key: 'plan', label: 'Plan & crew', children: <PickupPlanTab detail={detail} employees={masters.employees} statuses={masters.statuses} vehicles={masters.vehicles} onDetail={updateDetail} saveCrew={assignments => saveDetails({ assignments })} /> },
      { key: 'packing', label: `Packing (${detail.packages.length})`, children: <PickupPackingTab detail={detail} work={work} boxTypes={masters.boxTypes} materials={masters.materials} savePacking={(packages, materials) => saveDetails({ packages, materials })} onPrintLabels={setLabels} onLoadFromPacking={() => setTab('collection')} /> },
      { key: 'collection', label: 'Collection', children: <PickupCollectionTab pickupId={pickupId} warehouses={masters.warehouses}
        boxTypes={masters.boxTypes} packingKey={detail.packages.map(p => p.trackingNumber).join('|')} /> },
      { key: 'photos', label: `Photos (${work.attachments.length})`, children: <PickupPhotosTab detail={detail} work={work} onWork={updateWork} /> },
      { key: 'payments', label: 'Customer receipts & expenses paid', children: <PickupPaymentsTab detail={detail} work={work} employees={masters.employees} currency={currency} onDetail={updateDetail} onWork={updateWork} onReceipt={setReceipt} /> },
      { key: 'storage', label: 'Warehouse', children: <PickupStorageTab detail={detail} work={work} warehouses={masters.warehouses} onWork={updateWork} /> },
      { key: 'signoff', label: 'Sign-off', children: <PickupSignoffTab detail={detail} work={work} employees={masters.employees} onWork={updateWork} /> },
    ]} />

    <PrintPreview open={labels !== null} title={labels?.length === 1 ? `Label · ${labels[0].trackingNumber}` : `Box labels (${labels?.length ?? 0})`} onClose={() => setLabels(null)} wide print={{ type: 'BOX_LABELS', id: detail.pickup.id, query: { packageIds: (labels ?? []).map(l => l.id).join(',') } }}>
      {labels && <BoxLabels companyName={companyName} detail={detail} packages={labels} />}
    </PrintPreview>
    <PrintPreview open={receipt !== null} title={`Receipt ${receipt?.transactionNumber ?? ''}`} onClose={() => setReceipt(null)} print={{ type: 'PICKUP_RECEIPT', id: detail.pickup.id, query: { transactionId: receipt?.id ?? '' } }}>
      {receipt && <PaymentReceipt companyName={companyName} detail={detail} payment={receipt} currency={receipt.currency || currency} receivedBy={userName} />}
    </PrintPreview>
  </div>
}






