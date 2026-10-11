import { ContactMasterPicker } from '../components/ContactMasterPicker'
import { RowActions } from '../components/RowActions'
import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Form, Input, Modal, Segmented, Select, Tag, message } from 'antd'
import { EnvironmentOutlined, MailOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { pickupsApi, quotationsApi, salesApi } from '../api'
import type { Pickup, PickupStatus, Quotation, SalesLead, Vehicle } from '../types'
import { PageHeader } from '../components/PageHeader'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { ResponsiveDataView } from '../components/ResponsiveDataView'
import { useInfiniteRows } from '../hooks/useInfiniteRows'
import { PickupDetailPage } from './PickupDetailPage'

type Source = 'QUOTATION' | 'LEAD' | 'DIRECT'
type CreateForm = { quotationId?: string; salesLeadId?: string; customerName: string; phone: string; email: string; address: string; scheduledAtLocal: string; statusId: string; vehicleId?: string; notes: string }
const tomorrow = () => { const d = new Date(Date.now() + 86400000); d.setHours(9, 0, 0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

/** Pickup register; each pickup opens in its own workspace. */
export function PickupsPage({ companyName, userName, mode = 'pickup' }: { companyName: string; userName: string; mode?: 'pickup' | 'packing' }) {
  const [pickups, setPickups] = useState<Pickup[]>([]), [statuses, setStatuses] = useState<PickupStatus[]>([]), [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [quotes, setQuotes] = useState<Quotation[]>([]), [leads, setLeads] = useState<SalesLead[]>([]), [query, setQuery] = useState(''), [statusFilter, setStatusFilter] = useState<string>()
  const [createOpen, setCreateOpen] = useState(false), [source, setSource] = useState<Source>('QUOTATION'), [saving, setSaving] = useState(false), [openId, setOpenId] = useState<string | null>(null)
  const [form] = Form.useForm<CreateForm>()
  const load = () => Promise.all([pickupsApi.list(), pickupsApi.statuses(), pickupsApi.vehicles(), quotationsApi.list(), salesApi.leads()])
    .then(([a, b, c, d, e]) => { setPickups(a); setStatuses(b); setVehicles(c); setQuotes(d); setLeads(e) }).catch(e => message.error(e instanceof Error ? e.message : 'Unable to load pickups'))
  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => pickups.filter(x => (!statusFilter || x.statusId === statusFilter) && `${x.pickupNumber} ${x.customerName} ${x.address} ${x.vehicleNumber ?? ''} ${x.quotationNumber ?? ''} ${x.leadNumber ?? ''}`.toLowerCase().includes(query.toLowerCase())), [pickups, query, statusFilter])
  const { visibleRows, onScroll, hasMore } = useInfiniteRows(filtered, `${query}|${statusFilter}`)

  const openCreate = () => { form.resetFields(); setSource('QUOTATION'); form.setFieldsValue({ scheduledAtLocal: tomorrow(), statusId: statuses.find(s => s.isActive)?.id, email: '', notes: '' }); setCreateOpen(true) }
  const changeSource = (value: Source) => { setSource(value); form.setFieldsValue({ quotationId: undefined, salesLeadId: undefined }) }
  const quoteChanged = (id: string) => { const q = quotes.find(x => x.id === id); if (q) form.setFieldsValue({ quotationId: id, salesLeadId: q.salesLeadId ?? undefined, customerName: q.customerName, phone: q.phone, email: q.email ?? '', address: q.origin }) }
  const leadChanged = (id: string) => { const l = leads.find(x => x.id === id); if (l) form.setFieldsValue({ salesLeadId: id, customerName: l.customerName, phone: l.phone, email: l.email ?? '', address: l.origin }) }
  const create = async () => {
    const v = await form.validateFields(); setSaving(true)
    try {
      const created = await pickupsApi.create({ ...v, quotationId: source === 'QUOTATION' ? v.quotationId : null, salesLeadId: source === 'DIRECT' ? null : v.salesLeadId ?? null, vehicleId: v.vehicleId ?? null, scheduledAtUtc: new Date(v.scheduledAtLocal).toISOString() })
      setCreateOpen(false); await load(); setOpenId(created.id); message.success(`Pickup ${created.pickupNumber} created`)
    } catch (e) { message.error(e instanceof Error ? e.message : 'Unable to create the pickup') } finally { setSaving(false) }
  }

  if (openId) return <PickupDetailPage initialTab={mode === 'packing' ? 'packing' : 'plan'} pickupId={openId} companyName={companyName} userName={userName} onBack={() => { setOpenId(null); void load() }} onChanged={() => void load()} />

  const columns: ColumnsType<Pickup> = [
    { title: 'Pickup', dataIndex: 'pickupNumber', width: 240, render: (_, x) => <div className="primary-cell"><strong>{x.pickupNumber}</strong><small>#{x.serialNo} · {x.customerName}</small></div> },
    { title: 'Source', key: 'source', width: 220, render: (_, x) => x.quotationNumber ? `Quotation ${x.quotationNumber}` : x.leadNumber ? `Lead ${x.leadNumber}` : 'Direct' },
    { title: 'Schedule', dataIndex: 'scheduledAtUtc', width: 190, render: (_, x) => new Date(x.scheduledAtUtc).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) },
    { title: 'Vehicle', dataIndex: 'vehicleNumber', width: 150, render: (_, x) => x.vehicleNumber ?? <Tag>Not assigned</Tag> },
    { title: 'Trip', key: 'trip', width: 150, render: (_, x) => x.endedAtUtc ? <Tag color="green">Back at office</Tag> : x.isPaused ? <Tag color="orange">Paused</Tag> : x.startedAtUtc ? <Tag color="blue">In progress</Tag> : <Tag>Not started</Tag> },
    { title: 'Status', dataIndex: 'statusName', width: 130, render: (_, x) => <Tag color={x.statusColor ?? 'blue'}>{x.statusName}</Tag> },
    { title: 'Actions', key: 'actions', width: 80, render: (_, x) => <RowActions><Button size="small" onClick={() => setOpenId(x.id)}>{mode === 'packing' ? 'Open packing' : 'Open pickup'}</Button></RowActions> },
  ]

  return <div className="pickup-register-page">
    <PageHeader onRefresh={load} eyebrow="PICKUP OPERATIONS" title={mode === 'packing' ? 'Packing' : 'Pickup'} description="Plan pickups from a quotation or sales lead, pack room by room, collect payments and store boxes in the warehouse." action="Create pickup" onAction={openCreate}
      filters={<AdvancedSearch value={query} onChange={setQuery} active={Boolean(statusFilter)} onReset={() => { setQuery(''); setStatusFilter(undefined) }}><Select allowClear placeholder="Status" value={statusFilter} onChange={setStatusFilter} options={statuses.map(s => ({ value: s.id, label: s.name }))} /></AdvancedSearch>} />
    <Card className="grid-card" title={mode === 'packing' ? 'Packing register' : 'Pickup register'} extra={`${filtered.length} pickups`}>
      <ResponsiveDataView rowKey="id" columns={columns} data={visibleRows} onScroll={onScroll} hasMore={hasMore} total={filtered.length} label="pickups" scrollX={1160}
        renderTile={x => <><div className="tile-heading"><div className="primary-cell"><strong>{x.pickupNumber}</strong><small>{x.customerName}</small></div><Tag color={x.statusColor ?? 'blue'}>{x.statusName}</Tag></div>
          <div className="tile-details"><span>{new Date(x.scheduledAtUtc).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span><span>{x.vehicleNumber ?? 'Vehicle not assigned'}</span><span>{x.quotationNumber ? `Quotation ${x.quotationNumber}` : x.leadNumber ? `Lead ${x.leadNumber}` : 'Direct pickup'}</span></div>
          <div className="tile-actions"><RowActions><Button size="small" onClick={() => setOpenId(x.id)}>{mode === 'packing' ? 'Open packing' : 'Open pickup'}</Button></RowActions></div></>} />
    </Card>

    <Modal centered width={760} className="survey-edit-modal" open={createOpen} title="Create pickup" okText="Create pickup" confirmLoading={saving} onOk={() => void create()} onCancel={() => setCreateOpen(false)} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark="optional" className="survey-edit-form">
        <section><h4>Source</h4>
          <Form.Item><Segmented block value={source} onChange={value => changeSource(value as Source)} options={[{ value: 'QUOTATION', label: 'From quotation' }, { value: 'LEAD', label: 'From sales lead' }, { value: 'DIRECT', label: 'Without either' }]} /></Form.Item>
          {source === 'QUOTATION' && <Form.Item label="Quotation" name="quotationId" rules={[{ required: true, message: 'Select a quotation' }]} extra="Customer details and the item list come from the quotation."><Select showSearch optionFilterProp="label" placeholder="Search quotations" onChange={quoteChanged} options={quotes.map(x => ({ value: x.id, label: `${x.quotationNumber} · ${x.customerName} · ${x.status}` }))} /></Form.Item>}
          {source === 'LEAD' && <Form.Item label="Sales lead" name="salesLeadId" rules={[{ required: true, message: 'Select a sales lead' }]} extra="Items come from the lead's latest survey, if there is one."><Select showSearch optionFilterProp="label" placeholder="Search sales leads" onChange={leadChanged} options={leads.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.leadNumber} · ${x.customerName}` }))} /></Form.Item>}
        </section>
        <section><h4>Customer</h4><ContactMasterPicker kind="customer" getCreateDefaults={() => { const v = form.getFieldsValue(); return { name: v.customerName, phone: v.phone, email: v.email, address: v.address, notes: v.notes } }} onCreated={c => form.setFieldsValue({ customerName: c.name, phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '' })} onSelect={c => { changeSource('DIRECT'); form.setFieldsValue({ customerName: c.name, phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '' }) }} /><div className="master-form-grid">
          <Form.Item className="full-width" label="Customer name" name="customerName" rules={[{ required: true, message: 'Enter the customer name' }]}><Input prefix={<UserOutlined />} /></Form.Item>
          <Form.Item label="Phone" name="phone" rules={[{ required: true, message: 'Enter a phone number' }]}><Input prefix={<PhoneOutlined />} placeholder="Include country code" /></Form.Item>
          <Form.Item label="Email" name="email" rules={[{ type: 'email', message: 'Enter a valid email address' }]}><Input prefix={<MailOutlined />} /></Form.Item>
          <Form.Item className="full-width" label="Pickup address" name="address" rules={[{ required: true, message: 'Enter the pickup address' }]}><Input prefix={<EnvironmentOutlined />} /></Form.Item>
        </div></section>
        <section><h4>Plan</h4><div className="master-form-grid">
          <Form.Item label="Pickup date and time" name="scheduledAtLocal" rules={[{ required: true, message: 'Choose a date and time' }]}><Input type="datetime-local" /></Form.Item>
          <Form.Item label="Status" name="statusId" rules={[{ required: true, message: 'Select a status' }]}><Select options={statuses.filter(x => x.isActive).map(x => ({ value: x.id, label: x.name }))} /></Form.Item>
          <Form.Item className="full-width" label="Vehicle" name="vehicleId"><Select allowClear showSearch optionFilterProp="label" placeholder="Assign now or later" options={vehicles.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.registrationNumber} · ${x.name} · ${x.capacityCbm} CBM` }))} /></Form.Item>
        </div></section>
        <section><h4>Notes</h4><Form.Item name="notes"><Input.TextArea rows={2} maxLength={2000} placeholder="Instructions for the crew" /></Form.Item></section>
      </Form>
    </Modal>
  </div>
}





