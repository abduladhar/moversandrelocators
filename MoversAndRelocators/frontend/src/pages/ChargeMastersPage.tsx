import { ChargeAccountMappings } from '../components/ChargeAccountMappings'
import { useBilling } from '../billingApi'
import { RowActions } from '../components/RowActions'
import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, message } from 'antd'
import type { TableProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined } from '@ant-design/icons'
import { quotationsApi } from '../api'
import type { ChargeMaster } from '../types'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { PageHeader } from '../components/PageHeader'
import { ResponsiveDataView } from '../components/ResponsiveDataView'
import { StatusTag } from '../components/StatusTag'
import { useInfiniteRows } from '../hooks/useInfiniteRows'
import { sortRecords, type SortDirection } from '../utils/sortRecords'

type ChargeInput = Omit<ChargeMaster, 'id' | 'serialNo' | 'isActive' | 'createdAtUtc' | 'updatedAtUtc'>

export function ChargeMastersPage() {
  const canBill=useBilling(), [mappingOpen,setMappingOpen]=useState(false)
  const [items, setItems] = useState<ChargeMaster[]>([])
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<boolean | undefined>()
  const [sortField, setSortField] = useState<keyof ChargeMaster>('serialNo')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ChargeMaster | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<ChargeInput>()

  const load = () => quotationsApi.charges().then(setItems).catch(error => message.error(error.message))
  useEffect(() => { void load() }, [])
  const filtered = useMemo(() => sortRecords(items.filter(item => `${item.code} ${item.name} ${item.unit} ${item.description ?? ''}`.toLowerCase().includes(query.toLowerCase()) && (active === undefined || item.isActive === active)), sortField, sortDirection), [items, query, active, sortField, sortDirection])
  const { visibleRows, onScroll, hasMore } = useInfiniteRows(filtered, `${query}|${active}|${String(sortField)}|${sortDirection}`)

  const show = (item?: ChargeMaster) => {
    setEditing(item ?? null)
    form.setFieldsValue(item ? { code: item.code, name: item.name, unit: item.unit, defaultRate: item.defaultRate, taxPercent: item.taxPercent, description: item.description } : { code: '', name: '', unit: 'service', defaultRate: 0, taxPercent: 0, description: '' })
    setOpen(true)
  }
  const save = async () => {
    const values = await form.validateFields(); setSaving(true)
    try { editing ? await quotationsApi.updateCharge(editing.id, values) : await quotationsApi.createCharge(values); await load(); setOpen(false); message.success('Charge saved') }
    catch (error) { message.error(error instanceof Error ? error.message : 'Unable to save') }
    finally { setSaving(false) }
  }
  const columns: ColumnsType<ChargeMaster> = [
    { title: 'Charge', dataIndex: 'name', sorter: true, sortOrder: sortField === 'name' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: (_, item) => <div className="primary-cell"><strong>{item.name}</strong><small>#{item.serialNo} · {item.code}</small></div> },
    { title: 'Unit', dataIndex: 'unit', width: 120 },
    { title: 'Default rate', dataIndex: 'defaultRate', sorter: true, sortOrder: sortField === 'defaultRate' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: value => value.toFixed(2) },
    { title: 'Status', dataIndex: 'isActive', width: 100, filters: [{ text: 'Active', value: true }, { text: 'Inactive', value: false }], filteredValue: active === undefined ? null : [active], render: value => <StatusTag active={value} /> },
    { title: 'Actions', width: 210, align: 'right', render: (_, item) => <ChargeActions item={item} onEdit={() => show(item)} onChanged={load} /> },
  ]
  const tableChange: TableProps<ChargeMaster>['onChange'] = (_, filters, sorter) => {
    const selected = Array.isArray(sorter) ? sorter[0] : sorter
    if (selected?.field && selected.order) { setSortField(selected.field as keyof ChargeMaster); setSortDirection(selected.order === 'ascend' ? 'asc' : 'desc') }
    const state = filters.isActive?.[0]; setActive(typeof state === 'boolean' ? state : undefined)
  }

  return <>
    {canBill&&<><Button onClick={()=>setMappingOpen(true)} style={{marginBottom:12}}>Charge account mappings</Button><Modal width={900} open={mappingOpen} title="Charge master account mappings" footer={null} destroyOnHidden onCancel={()=>{setMappingOpen(false);void load()}}><ChargeAccountMappings/></Modal></>}
    <PageHeader onRefresh={load} eyebrow="QUOTATION MASTER" title="Charge master" description="Maintain reusable quotation charges, units, and default rates. Taxes are selected from Tax configuration when pricing a quotation." action="Add charge" onAction={() => show()} filters={<AdvancedSearch value={query} onChange={setQuery} onReset={() => { setQuery(''); setActive(undefined); setSortField('serialNo'); setSortDirection('desc') }} placeholder="Search charges" active={active !== undefined || sortField !== 'serialNo' || sortDirection !== 'desc'} sortField={String(sortField)} onSortField={value => setSortField(value as keyof ChargeMaster)} sortDirection={sortDirection} onSortDirection={setSortDirection} sortOptions={[{ value: 'serialNo', label: 'Created sequence' }, { value: 'name', label: 'Name' }, { value: 'defaultRate', label: 'Default rate' }]}><Select allowClear showSearch optionFilterProp="label" placeholder="Status" value={active} onChange={setActive} options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} /></AdvancedSearch>} />
    <Card className="grid-card" title="Charges" extra={`${filtered.length} records`}><ResponsiveDataView rowKey="id" columns={columns} data={visibleRows} onScroll={onScroll} onChange={tableChange} hasMore={hasMore} total={filtered.length} label="charges" scrollX={680} renderTile={item => <><div className="tile-heading"><div className="primary-cell"><strong>{item.name}</strong><small>#{item.serialNo} · {item.code}</small></div><StatusTag active={item.isActive} /></div><div className="tile-details"><span>Unit: {item.unit}</span><span>Default rate: {item.defaultRate.toFixed(2)}</span></div><div className="tile-actions"><ChargeActions item={item} onEdit={() => show(item)} onChanged={load} /></div></>} /></Card>
    <Modal centered title={editing ? 'Edit charge' : 'Add charge'} open={open} onCancel={() => setOpen(false)} onOk={save} confirmLoading={saving} destroyOnHidden><Form form={form} layout="vertical"><Form.Item name="taxPercent" hidden><InputNumber /></Form.Item><div className="master-form-grid"><Form.Item label="Code" name="code" rules={[{ required: true }]}><Input /></Form.Item><Form.Item label="Name" name="name" rules={[{ required: true }]}><Input /></Form.Item><Form.Item label="Unit" name="unit" rules={[{ required: true }]}><Input placeholder="service, CBM, km, day" /></Form.Item><Form.Item className="amount-field" label="Default rate" name="defaultRate" rules={[{ required: true }]}><InputNumber controls={false} min={0} precision={2} style={{ width: '100%' }} /></Form.Item></div><Form.Item label="Description" name="description"><Input.TextArea rows={3} /></Form.Item></Form></Modal>
  </>
}

function ChargeActions({ item, onEdit, onChanged }: { item: ChargeMaster; onEdit: () => void; onChanged: () => void }) {
  return <RowActions><Space wrap><Button size="small" icon={<EditOutlined />} onClick={onEdit}>Edit</Button><Popconfirm title={`${item.isActive ? 'Deactivate' : 'Activate'} this charge?`} onConfirm={async () => { await quotationsApi.setChargeStatus(item.id, !item.isActive); onChanged() }}><Button size="small">{item.isActive ? 'Deactivate' : 'Activate'}</Button></Popconfirm></Space></RowActions>
}



