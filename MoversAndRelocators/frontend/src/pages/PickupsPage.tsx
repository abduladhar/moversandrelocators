import { nowLocal } from '../dates'
import { ContactMasterPicker } from '../components/ContactMasterPicker'
import { RowActions } from '../components/RowActions'
import { useEffect, useState } from 'react'
import { CustomerReplyTag, CustomerStateFilter, useCustomerReplies } from '../components/CustomerReplyTag'
import { Button, Card, Form, Input, Modal, Segmented, Select, Tag, message } from 'antd'
import { EnvironmentOutlined, MailOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { pickupsApi, quotationsApi, salesApi } from '../api'
import type { Pickup, PickupStatus, Quotation, SalesLead, Vehicle } from '../types'
import { PageHeader } from '../components/PageHeader'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { ResponsiveDataView } from '../components/ResponsiveDataView'
import { useServerList } from '../hooks/useServerList'
import { PickupDetailPage } from './PickupDetailPage'
import { formatDateTime, useT } from '../i18n'

type Source = 'QUOTATION' | 'LEAD' | 'DIRECT'
type CreateForm = { quotationId?: string; salesLeadId?: string; customerName: string; phone: string; email: string; address: string; scheduledAtLocal: string; statusId: string; vehicleId?: string; notes: string }

/** Pickup register; each pickup opens in its own workspace. */
export function PickupsPage({ companyName, userName, mode = 'pickup' }: { companyName: string; userName: string; mode?: 'pickup' | 'packing' }) {
  const [statuses, setStatuses] = useState<PickupStatus[]>([]), [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [quotes, setQuotes] = useState<Quotation[]>([]), [leads, setLeads] = useState<SalesLead[]>([]), [query, setQuery] = useState(''), [statusFilter, setStatusFilter] = useState<string>()
  const [createOpen, setCreateOpen] = useState(false), [source, setSource] = useState<Source>('QUOTATION'), [saving, setSaving] = useState(false), [openId, setOpenId] = useState<string | null>(null)
  const [form] = Form.useForm<CreateForm>()
  const { t } = useT()
  const customer = useCustomerReplies('PICKUP'), [customerState, setCustomerState] = useState<string>()
  const [sortField, setSortField] = useState('serialNo'), [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const list = useServerList(pickupsApi.search, { search: query, statusId: statusFilter, customerState, sort: sortField, desc: direction === 'desc' }, { failMessage: t('pickups.list.loadFailed') })
  // A handled reply can move the row out of the customer-state filter, so the list is fetched again then.
  const customerChanged = () => { void customer.reload(); if (customerState) void list.reload() }
  // The register comes from the server page by page; statuses, vehicles, quotations and leads are full lists for the filter and the create form.
  const loadLookups = () => { void customer.reload(); return Promise.all([pickupsApi.statuses(), pickupsApi.vehicles(), quotationsApi.list(), salesApi.leads()])
    .then(([b, c, d, e]) => { setStatuses(b); setVehicles(c); setQuotes(d); setLeads(e) }).catch(e => message.error(e instanceof Error ? e.message : t('pickups.list.loadFailed'))) }
  const load = () => { void list.reload(); return loadLookups() }
  useEffect(() => { void loadLookups() }, [])

  const openCreate = () => { form.resetFields(); setSource('QUOTATION'); form.setFieldsValue({ scheduledAtLocal: nowLocal(), statusId: statuses.find(s => s.isActive)?.id, email: '', notes: '' }); setCreateOpen(true) }
  const changeSource = (value: Source) => { setSource(value); form.setFieldsValue({ quotationId: undefined, salesLeadId: undefined }) }
  const quoteChanged = (id: string) => { const q = quotes.find(x => x.id === id); if (q) form.setFieldsValue({ quotationId: id, salesLeadId: q.salesLeadId ?? undefined, customerName: q.customerName, phone: q.phone, email: q.email ?? '', address: q.origin }) }
  const leadChanged = (id: string) => { const l = leads.find(x => x.id === id); if (l) form.setFieldsValue({ salesLeadId: id, customerName: l.customerName, phone: l.phone, email: l.email ?? '', address: l.origin }) }
  const create = async () => {
    const v = await form.validateFields(); setSaving(true)
    try {
      const created = await pickupsApi.create({ ...v, quotationId: source === 'QUOTATION' ? v.quotationId : null, salesLeadId: source === 'DIRECT' ? null : v.salesLeadId ?? null, vehicleId: v.vehicleId ?? null, scheduledAtUtc: new Date(v.scheduledAtLocal).toISOString() })
      setCreateOpen(false); await load(); setOpenId(created.id); message.success(t('pickups.list.created', { number: created.pickupNumber }))
    } catch (e) { message.error(e instanceof Error ? e.message : t('pickups.list.createFailed')) } finally { setSaving(false) }
  }

  if (openId) return <PickupDetailPage initialTab={mode === 'packing' ? 'packing' : 'plan'} pickupId={openId} companyName={companyName} userName={userName} onBack={() => { setOpenId(null); void load() }} onChanged={() => void load()} />

  const columns: ColumnsType<Pickup> = [
    { title: t('pickups.list.colPickup'), dataIndex: 'pickupNumber', width: 240, render: (_, x) => <div className="primary-cell"><strong>{x.pickupNumber}</strong><small>#{x.serialNo} · {x.customerName}</small></div> },
    { title: t('pickups.list.colSource'), key: 'source', width: 220, render: (_, x) => x.quotationNumber ? t('pickups.quotationNumber', { number: x.quotationNumber }) : x.leadNumber ? t('pickups.leadNumber', { number: x.leadNumber }) : t('pickups.list.direct') },
    { title: t('pickups.list.colSchedule'), dataIndex: 'scheduledAtUtc', width: 190, render: (_, x) => formatDateTime(x.scheduledAtUtc) },
    { title: t('pickups.vehicle'), dataIndex: 'vehicleNumber', width: 150, render: (_, x) => x.vehicleNumber ?? <Tag>{t('pickups.notAssigned')}</Tag> },
    { title: t('pickups.list.colTrip'), key: 'trip', width: 150, render: (_, x) => x.endedAtUtc ? <Tag color="green">{t('pickups.list.tripBack')}</Tag> : x.isPaused ? <Tag color="orange">{t('pickups.list.tripPaused')}</Tag> : x.startedAtUtc ? <Tag color="blue">{t('pickups.list.tripInProgress')}</Tag> : <Tag>{t('pickups.list.tripNotStarted')}</Tag> },
    { title: t('common.status'), dataIndex: 'statusName', width: 130, render: (_, x) => <span className="status-stack"><Tag color={x.statusColor ?? 'blue'}>{x.statusName}</Tag><CustomerReplyTag reply={customer.get(x.id)} onChanged={customerChanged} /></span> },
    { title: t('common.actions'), key: 'actions', width: 80, render: (_, x) => <RowActions><Button size="small" onClick={() => setOpenId(x.id)}>{mode === 'packing' ? t('pickups.list.openPacking') : t('pickups.list.openPickup')}</Button></RowActions> },
  ]

  return <div className="pickup-register-page">
    <PageHeader onRefresh={load} eyebrow={t('pickups.list.eyebrow')} title={mode === 'packing' ? t('pickups.list.titlePacking') : t('pickups.list.title')} description={t('pickups.list.description')} action={t('pickups.list.create')} onAction={openCreate}
      filters={<AdvancedSearch value={query} onChange={setQuery} active={Boolean(statusFilter) || Boolean(customerState) || sortField !== 'serialNo' || direction !== 'desc'} sortField={sortField} onSortField={setSortField} sortDirection={direction} onSortDirection={setDirection} sortOptions={[{ value: 'serialNo', label: t('common.createdAt') }, { value: 'scheduledAtUtc', label: t('pickups.list.colSchedule') }, { value: 'customerName', label: t('pickups.customerName') }, { value: 'pickupNumber', label: t('pickups.list.colPickup') }, { value: 'statusName', label: t('common.status') }]} onReset={() => { setQuery(''); setStatusFilter(undefined); setCustomerState(undefined); setSortField('serialNo'); setDirection('desc') }}><CustomerStateFilter value={customerState} onChange={setCustomerState} /><Select allowClear placeholder={t('common.status')} value={statusFilter} onChange={setStatusFilter} options={statuses.map(s => ({ value: s.id, label: s.name }))} /></AdvancedSearch>} />
    <Card className="grid-card" title={mode === 'packing' ? t('pickups.list.registerPacking') : t('pickups.list.register')} extra={t('pickups.list.count', { count: list.total })}>
      <ResponsiveDataView rowKey="id" columns={columns} data={list.rows} onScroll={list.onScroll} hasMore={list.hasMore} total={list.total} loading={list.loading}label={t('pickups.list.rowsLabel')} scrollX={1160}
        renderTile={x => <><div className="tile-heading"><div className="primary-cell"><strong>{x.pickupNumber}</strong><small>{x.customerName}</small></div><span className="status-stack"><Tag color={x.statusColor ?? 'blue'}>{x.statusName}</Tag><CustomerReplyTag reply={customer.get(x.id)} onChanged={customerChanged} /></span></div>
          <div className="tile-details"><span>{formatDateTime(x.scheduledAtUtc)}</span><span>{x.vehicleNumber ?? t('pickups.list.vehicleNotAssigned')}</span><span>{x.quotationNumber ? t('pickups.quotationNumber', { number: x.quotationNumber }) : x.leadNumber ? t('pickups.leadNumber', { number: x.leadNumber }) : t('pickups.directPickup')}</span></div>
          <div className="tile-actions"><RowActions><Button size="small" onClick={() => setOpenId(x.id)}>{mode === 'packing' ? t('pickups.list.openPacking') : t('pickups.list.openPickup')}</Button></RowActions></div></>} />
    </Card>

    <Modal centered width={760} className="survey-edit-modal" open={createOpen} title={t('pickups.list.create')} okText={t('pickups.list.create')} confirmLoading={saving} onOk={() => void create()} onCancel={() => setCreateOpen(false)} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark="optional" className="survey-edit-form">
        <section><h4>{t('pickups.list.colSource')}</h4>
          <Form.Item><Segmented block value={source} onChange={value => changeSource(value as Source)} options={[{ value: 'QUOTATION', label: t('pickups.list.sourceQuotation') }, { value: 'LEAD', label: t('pickups.list.sourceLead') }, { value: 'DIRECT', label: t('pickups.list.sourceDirect') }]} /></Form.Item>
          {source === 'QUOTATION' && <Form.Item label={t('pickups.list.quotation')} name="quotationId" rules={[{ required: true, message: t('pickups.list.selectQuotation') }]} extra={t('pickups.list.quotationHelp')}><Select showSearch optionFilterProp="label" placeholder={t('pickups.list.searchQuotations')} onChange={quoteChanged} options={quotes.map(x => ({ value: x.id, label: `${x.quotationNumber} · ${x.customerName} · ${x.status}` }))} /></Form.Item>}
          {source === 'LEAD' && <Form.Item label={t('pickups.list.salesLead')} name="salesLeadId" rules={[{ required: true, message: t('pickups.list.selectLead') }]} extra={t('pickups.list.leadHelp')}><Select showSearch optionFilterProp="label" placeholder={t('pickups.list.searchLeads')} onChange={leadChanged} options={leads.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.leadNumber} · ${x.customerName}` }))} /></Form.Item>}
        </section>
        <section><h4>{t('common.customer')}</h4><ContactMasterPicker kind="customer" getCreateDefaults={() => { const v = form.getFieldsValue(); return { name: v.customerName, phone: v.phone, email: v.email, address: v.address, notes: v.notes } }} onCreated={c => form.setFieldsValue({ customerName: c.name, phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '' })} onSelect={c => { changeSource('DIRECT'); form.setFieldsValue({ customerName: c.name, phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '' }) }} /><div className="master-form-grid">
          <Form.Item className="full-width" label={t('pickups.customerName')} name="customerName" rules={[{ required: true, message: t('pickups.enterCustomerName') }]}><Input prefix={<UserOutlined />} /></Form.Item>
          <Form.Item label={t('common.phone')} name="phone" rules={[{ required: true, message: t('pickups.enterPhone') }]}><Input prefix={<PhoneOutlined />} placeholder={t('pickups.list.phonePlaceholder')} /></Form.Item>
          <Form.Item label={t('common.email')} name="email" rules={[{ type: 'email', message: t('pickups.enterValidEmail') }]}><Input prefix={<MailOutlined />} /></Form.Item>
          <Form.Item className="full-width" label={t('pickups.pickupAddress')} name="address" rules={[{ required: true, message: t('pickups.list.enterAddress') }]}><Input prefix={<EnvironmentOutlined />} /></Form.Item>
        </div></section>
        <section><h4>{t('pickups.list.sectionPlan')}</h4><div className="master-form-grid">
          <Form.Item label={t('pickups.pickupDateTime')} name="scheduledAtLocal" rules={[{ required: true, message: t('pickups.list.chooseDateTime') }]}><Input type="datetime-local" /></Form.Item>
          <Form.Item label={t('common.status')} name="statusId" rules={[{ required: true, message: t('pickups.list.selectStatus') }]}><Select options={statuses.filter(x => x.isActive).map(x => ({ value: x.id, label: x.name }))} /></Form.Item>
          <Form.Item className="full-width" label={t('pickups.vehicle')} name="vehicleId"><Select allowClear showSearch optionFilterProp="label" placeholder={t('pickups.list.assignNowOrLater')} options={vehicles.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.registrationNumber} · ${x.name} · ${x.capacityCbm} m³` }))} /></Form.Item>
        </div></section>
        <section><h4>{t('common.notes')}</h4><Form.Item name="notes"><Input.TextArea rows={2} maxLength={2000} placeholder={t('pickups.crewInstructions')} /></Form.Item></section>
      </Form>
    </Modal>
  </div>
}





