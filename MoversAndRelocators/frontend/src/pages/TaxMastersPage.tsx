import { RowActions } from '../components/RowActions'
import { useCompanyScopes } from '../companyScope'
import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Checkbox, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined } from '@ant-design/icons'
import { quotationsApi } from '../api'
import type { TaxMaster } from '../types'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { PageHeader } from '../components/PageHeader'
import { ResponsiveDataView } from '../components/ResponsiveDataView'
import { StatusTag } from '../components/StatusTag'
import { useInfiniteRows } from '../hooks/useInfiniteRows'

type TaxInput = Omit<TaxMaster, 'id' | 'serialNo' | 'isActive' | 'createdAtUtc' | 'updatedAtUtc'>

export function TaxMastersPage() {
  const scopes = useCompanyScopes('tax')
  const [items, setItems] = useState<TaxMaster[]>([]), [query, setQuery] = useState(''), [kind, setKind] = useState<string>(), [open, setOpen] = useState(false), [editing, setEditing] = useState<TaxMaster | null>(null), [saving, setSaving] = useState(false)
  const [form] = Form.useForm<TaxInput>()
  const selectedKind = Form.useWatch('kind', form)
  const load = () => quotationsApi.taxes().then(setItems).catch(error => message.error(error.message))
  useEffect(() => { void load() }, [])
  const filtered = useMemo(() => items.filter(x => `${x.code} ${x.name}`.toLowerCase().includes(query.toLowerCase()) && (!kind || x.kind === kind)), [items, query, kind])
  const { visibleRows, onScroll, hasMore } = useInfiniteRows(filtered, `${query}|${kind}`)
  const show = (item?: TaxMaster) => { setEditing(item ?? null); form.setFieldsValue(item ? { code: item.code, name: item.name, kind: item.kind, calculationBasis: item.calculationBasis, rate: item.rate, isDefault: item.isDefault, description: item.description } : { code: '', name: '', kind: 'TAX', calculationBasis: 'TAXABLE_AMOUNT', rate: 0, isDefault: false, description: '' }); setOpen(true) }
  const save = async () => { const values = await form.validateFields(); setSaving(true); try { editing ? await quotationsApi.updateTax(editing.id, values) : await quotationsApi.createTax(values); await load(); setOpen(false); message.success('Tax configuration saved') } catch (error) { message.error(error instanceof Error ? error.message : 'Unable to save tax') } finally { setSaving(false) } }
  const columns: ColumnsType<TaxMaster> = [
    { title: 'Tax', sorter: (a, b) => a.name.localeCompare(b.name), render: (_, x) => <div className="primary-cell"><strong>{x.name}</strong><small>#{x.serialNo} · {x.code}</small></div> },
    { title: 'Type', dataIndex: 'kind', render: value => <Tag color={value === 'CESS' ? 'orange' : 'blue'}>{value}</Tag> },
    { title: 'Calculation', render: (_, x) => x.calculationBasis === 'QUANTITY' ? `${x.rate} per unit` : `${x.rate}% of ${x.calculationBasis === 'TAX_AMOUNT' ? 'tax amount' : 'taxable amount'}` },
    { title: 'Default', dataIndex: 'isDefault', render: value => value ? <Tag color="green">Auto selected</Tag> : 'Optional' },
    ...scopes.column<TaxMaster>(x => x.id),
    { title: 'Status', dataIndex: 'isActive', render: value => <StatusTag active={value} /> },
    { title: 'Actions', align: 'right', render: (_, x) => <RowActions><Space wrap><Button size="small" icon={<EditOutlined />} onClick={() => show(x)}>Edit</Button><Popconfirm title={`${x.isActive ? 'Deactivate' : 'Activate'} this tax?`} onConfirm={async () => { await quotationsApi.setTaxStatus(x.id, !x.isActive); await load() }}><Button size="small">{x.isActive ? 'Deactivate' : 'Activate'}</Button></Popconfirm></Space></RowActions> },
  ]
  return <><PageHeader onRefresh={load} eyebrow="QUOTATION CONFIGURATION" title="Tax configuration" description="Configure taxes and cess components that can be combined on each quotation charge." action="Add tax" onAction={() => show()} filters={<AdvancedSearch value={query} onChange={setQuery} onReset={() => { setQuery(''); setKind(undefined) }} active={Boolean(kind)}><Select allowClear showSearch optionFilterProp="label" placeholder="Type" value={kind} onChange={setKind} options={[{ value: 'TAX', label: 'Tax' }, { value: 'CESS', label: 'Cess' }]} /></AdvancedSearch>} /><Card className="grid-card" title="Taxes and cess" extra={`${filtered.length} configurations`}><ResponsiveDataView rowKey="id" columns={columns} data={visibleRows} onScroll={onScroll} hasMore={hasMore} total={filtered.length} label="tax configurations" scrollX={800} renderTile={x => <><div className="tile-heading"><div className="primary-cell"><strong>{x.name}</strong><small>{x.code}</small></div><Tag color={x.kind === 'CESS' ? 'orange' : 'blue'}>{x.kind}</Tag></div><div className="tile-details"><span>{x.calculationBasis === 'QUANTITY' ? `${x.rate} per unit` : `${x.rate}% · ${x.calculationBasis.replaceAll('_', ' ')}`}</span><span>{x.isDefault ? 'Selected by default' : 'Optional'}</span><StatusTag active={x.isActive} /></div><div className="tile-actions"><RowActions><Space wrap><Button size="small" onClick={() => show(x)}>Edit</Button><Button size="small" onClick={async () => { await quotationsApi.setTaxStatus(x.id, !x.isActive); await load() }}>{x.isActive ? 'Deactivate' : 'Activate'}</Button></Space></RowActions></div></>} /></Card><Modal centered title={editing ? 'Edit tax configuration' : 'Add tax configuration'} open={open} onCancel={() => setOpen(false)} onOk={() => void save()} confirmLoading={saving} destroyOnHidden><Form form={form} layout="vertical"><div className="master-form-grid"><Form.Item label="Code" name="code" rules={[{ required: true }]}><Input /></Form.Item><Form.Item label="Name" name="name" rules={[{ required: true }]}><Input /></Form.Item><Form.Item label="Type" name="kind" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={[{ value: 'TAX', label: 'Tax' }, { value: 'CESS', label: 'Cess' }]} onChange={value => { if (value === 'TAX' && form.getFieldValue('calculationBasis') === 'TAX_AMOUNT') form.setFieldValue('calculationBasis', 'TAXABLE_AMOUNT') }} /></Form.Item><Form.Item label="Calculation basis" name="calculationBasis" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={[{ value: 'TAXABLE_AMOUNT', label: 'Percentage of taxable amount' }, ...(selectedKind === 'CESS' ? [{ value: 'TAX_AMOUNT', label: 'Percentage of selected tax amount' }] : []), { value: 'QUANTITY', label: 'Fixed amount per quantity' }]} /></Form.Item><Form.Item className="amount-field" label={form.getFieldValue('calculationBasis') === 'QUANTITY' ? 'Amount per unit' : 'Rate percentage'} name="rate" rules={[{ required: true }]}><InputNumber min={0} precision={4} style={{ width: '100%' }} /></Form.Item></div><Form.Item name="isDefault" valuePropName="checked"><Checkbox>Auto-select this component when adding a charge</Checkbox></Form.Item><Form.Item label="Description" name="description"><Input.TextArea rows={3} /></Form.Item></Form></Modal></>
}

