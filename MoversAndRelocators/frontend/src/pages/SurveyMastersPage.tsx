import { DataGrid as Table } from '../components/DataGrid'
import { RowActions } from '../components/RowActions'
import { useCompanyScopes } from '../companyScope'
import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Tag, message } from 'antd'
import { ArrowLeftOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { surveysApi } from '../api'
import type { BoxType, HouseholdItem, PackingMaterial } from '../types'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'

type MasterKind = 'items' | 'materials' | 'box-types'

const masterLabels: Record<MasterKind, string> = {
  items: 'Household items',
  'box-types': 'Box types',
  materials: 'Packing materials',
}

export function SurveyMastersPage({ initialTab }: { initialTab?: MasterKind } = {}) {
  const [items, setItems] = useState<HouseholdItem[]>([]), [materials, setMaterials] = useState<PackingMaterial[]>([]), [boxes, setBoxes] = useState<BoxType[]>([])
  const [selectedKind, setSelectedKind] = useState<MasterKind | null>(initialTab ?? null)
  const [query, setQuery] = useState(''), [open, setOpen] = useState(false), [editing, setEditing] = useState<HouseholdItem | PackingMaterial | BoxType | null>(null), [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const load = () => Promise.all([surveysApi.items(), surveysApi.materials(), surveysApi.boxTypes()]).then(([a, b, c]) => { setItems(a); setMaterials(b); setBoxes(c) }).catch(error => message.error(error.message))
  useEffect(() => { void load() }, [])
  useEffect(() => { if (initialTab) setSelectedKind(initialTab) }, [initialTab])
  const tab = selectedKind ?? 'items'
  const scopes = useCompanyScopes(tab === 'items' ? 'household-item' : tab === 'materials' ? 'packing-material' : 'box-type')
  const rows = useMemo(() => (tab === 'items' ? items : tab === 'materials' ? materials : boxes).filter(x => `${x.code} ${x.name} ${x.description ?? ''}`.toLowerCase().includes(query.toLowerCase())), [tab, items, materials, boxes, query])
  const show = (record?: HouseholdItem | PackingMaterial | BoxType) => {
    setEditing(record ?? null)
    if (!record) form.resetFields()
    else if ('volumeCbm' in record) form.setFieldsValue(record)
    else if ('currentUnitCost' in record) form.setFieldsValue(record)
    else form.setFieldsValue({ ...record, materials: record.materials.map(x => ({ materialId: x.materialId, quantity: x.quantity })) })
    setOpen(true)
  }
  const save = async () => {
    const values = await form.validateFields(); setSaving(true)
    try {
      if (tab === 'items') editing ? await surveysApi.updateItem(editing.id, values) : await surveysApi.createItem(values)
      else if (tab === 'materials') editing ? await surveysApi.updateMaterial(editing.id, values) : await surveysApi.createMaterial(values)
      else editing ? await surveysApi.updateBoxType(editing.id, values) : await surveysApi.createBoxType(values)
      await load(); setOpen(false); message.success('Master data saved')
    } catch (error) { message.error(error instanceof Error ? error.message : 'Unable to save') } finally { setSaving(false) }
  }
  const toggle = async (record: HouseholdItem | PackingMaterial | BoxType) => { await surveysApi.setMasterStatus(tab, record.id, !record.isActive); await load() }
  const columns = [
    { title: 'Master data', key: 'name', sorter: (a: any, b: any) => a.name.localeCompare(b.name), render: (_: unknown, x: any) => <div className="primary-cell"><strong>{x.name}</strong><small>#{x.serialNo} · {x.code}</small></div> },
    ...(tab === 'items' ? [{ title: 'Volume', dataIndex: 'volumeCbm', sorter: (a: any, b: any) => a.volumeCbm - b.volumeCbm, render: (x: number) => <Tag color="blue">{x.toFixed(3)} CBM</Tag> }] : []),
    ...(tab === 'materials' ? [{ title: 'Current cost', key: 'cost', sorter: (a: any, b: any) => a.currentUnitCost - b.currentUnitCost, render: (_: unknown, x: any) => `${x.currentUnitCost.toFixed(2)} / ${x.unit}` }] : []),
    ...(tab === 'box-types' ? [{ title: 'Capacity', dataIndex: 'capacityCbm', sorter: (a: any, b: any) => a.capacityCbm - b.capacityCbm, render: (x: number) => `${x.toFixed(3)} CBM` }, { title: 'Build cost', dataIndex: 'buildCost', render: (x: number) => x.toFixed(2) }] : []),
    ...scopes.column<any>(x => x.id),
    { title: 'Status', dataIndex: 'isActive', width: 100, filters: [{ text: 'Active', value: true }, { text: 'Inactive', value: false }], onFilter: (value: any, x: any) => x.isActive === value, render: (x: boolean) => <StatusTag active={x} /> },
    { title: 'Actions', key: 'actions', width: 210, align: 'right' as const, render: (_: unknown, x: any) => <RowActions><Space><Button size="small" icon={<EditOutlined />} onClick={() => show(x)}>Edit</Button><Popconfirm title={`${x.isActive ? 'Deactivate' : 'Activate'} this record?`} onConfirm={() => void toggle(x)}><Button size="small">{x.isActive ? 'Deactivate' : 'Activate'}</Button></Popconfirm></Space></RowActions> },
  ]
  const overview = (
    <div className="master-data-page">
      <div className="master-data-heading">
        <div><h1>Survey master data</h1><p>Choose a master list to manage your company’s survey setup data.</p></div>
      </div>
      <div className="master-data-groups">
        <section className="master-data-group">
          <h2>Survey setup</h2>
          <div className="master-data-tiles">
            {(Object.keys(masterLabels) as MasterKind[]).map(kind => <button key={kind} type="button" className="master-data-tile" onClick={() => setSelectedKind(kind)}>
              <span className="master-data-icon" aria-hidden="true">{kind === 'items' ? '▣' : kind === 'materials' ? '▤' : '◫'}</span>
              <span>{masterLabels[kind]} ({kind === 'items' ? items.length : kind === 'materials' ? materials.length : boxes.length})</span>
            </button>)}
          </div>
        </section>
      </div>
    </div>
  )

  if (!selectedKind) return overview

  return <>
    <PageHeader onRefresh={load} eyebrow="SURVEY CONFIGURATION" title={masterLabels[tab]} description={`Maintain ${masterLabels[tab].toLowerCase()} used by packing and cost calculations.`} action="Add record" onAction={() => show()} filters={<AdvancedSearch value={query} onChange={setQuery} onReset={() => setQuery('')} placeholder="Search code, name or description" />} />
    {!initialTab && <div style={{ marginBottom: 12 }}><Button icon={<ArrowLeftOutlined />} onClick={() => { setSelectedKind(null); setQuery('') }}>Back to master data</Button></div>}
    <Card className="grid-card"><Table rowKey="id" dataSource={rows} columns={columns as any} pagination={false} scroll={{ y: 'calc(100vh - 310px)' }} /></Card>
    <Modal centered width={680} title={`${editing ? 'Edit' : 'Add'} ${tab === 'items' ? 'household item' : tab === 'materials' ? 'material' : 'box type'}`} open={open} onCancel={() => setOpen(false)} onOk={save} confirmLoading={saving} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark="optional"><div className="master-form-grid"><Form.Item label="Code" name="code" rules={[{ required: true }]}><Input /></Form.Item><Form.Item label="Name" name="name" rules={[{ required: true }]}><Input /></Form.Item></div>
        {tab === 'items' && <Form.Item label="Individual volume (CBM)" name="volumeCbm" rules={[{ required: true }]}><InputNumber min={0.001} precision={3} style={{ width: '100%' }} /></Form.Item>}
        {tab === 'materials' && <div className="master-form-grid"><Form.Item label="Unit" name="unit" rules={[{ required: true }]}><Input placeholder="sheet, roll, meter" /></Form.Item><Form.Item className="amount-field" label="Current unit cost" name="currentUnitCost" rules={[{ required: true }]}><InputNumber controls={false} min={0} precision={2} style={{ width: '100%' }} /></Form.Item></div>}
        {tab === 'box-types' && <><Form.Item label="Maximum capacity (CBM)" name="capacityCbm" rules={[{ required: true }]}><InputNumber min={0.001} precision={3} style={{ width: '100%' }} /></Form.Item><Form.List name="materials">{(fields, { add, remove }) => <><Space style={{ justifyContent: 'space-between', width: '100%' }}><strong>Materials used to build one box</strong><Button size="small" icon={<PlusOutlined />} onClick={() => add({ quantity: 1 })}>Material</Button></Space>{fields.map(field => <Space key={field.key} align="baseline" style={{ display: 'flex', marginTop: 10 }}><Form.Item {...field} name={[field.name, 'materialId']} rules={[{ required: true }]} style={{ flex: 1 }}><Select showSearch optionFilterProp="label" placeholder="Material" options={materials.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.name} (${x.unit})` }))} /></Form.Item><Form.Item {...field} name={[field.name, 'quantity']} rules={[{ required: true }]}><InputNumber min={0.001} precision={3} placeholder="Quantity" /></Form.Item><Button danger type="text" onClick={() => remove(field.name)}>Remove</Button></Space>)}</>}</Form.List></>}
        <Form.Item label="Description" name="description"><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Modal>
  </>
}



