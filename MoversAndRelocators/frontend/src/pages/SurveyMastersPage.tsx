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
import { formatNumber, useT } from '../i18n'

type MasterKind = 'items' | 'materials' | 'box-types'

/** Translation keys under surveys.masters.<key>. */
const masterKeys: Record<MasterKind, string> = {
  items: 'items',
  'box-types': 'boxTypes',
  materials: 'materials',
}
const fixed = (value: number, digits: number) => formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits })

export function SurveyMastersPage({ initialTab }: { initialTab?: MasterKind } = {}) {
  const { t } = useT()
  const masterLabel = (kind: MasterKind) => t(`surveys.masters.${masterKeys[kind]}.title`)
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
      await load(); setOpen(false); message.success(t('surveys.masters.saved'))
    } catch (error) { message.error(error instanceof Error ? error.message : t('surveys.masters.saveFailed')) } finally { setSaving(false) }
  }
  const toggle = async (record: HouseholdItem | PackingMaterial | BoxType) => { await surveysApi.setMasterStatus(tab, record.id, !record.isActive); await load() }
  const columns = [
    { title: t('surveys.masters.masterData'), key: 'name', sorter: (a: any, b: any) => a.name.localeCompare(b.name), render: (_: unknown, x: any) => <div className="primary-cell"><strong>{x.name}</strong><small>#{x.serialNo} · {x.code}</small></div> },
    ...(tab === 'items' ? [{ title: t('surveys.masters.volume'), dataIndex: 'volumeCbm', sorter: (a: any, b: any) => a.volumeCbm - b.volumeCbm, render: (x: number) => <Tag color="blue">{t('surveys.cbmValue', { value: fixed(x, 3) })}</Tag> }] : []),
    ...(tab === 'materials' ? [{ title: t('surveys.masters.currentCost'), key: 'cost', sorter: (a: any, b: any) => a.currentUnitCost - b.currentUnitCost, render: (_: unknown, x: any) => `${fixed(x.currentUnitCost, 2)} / ${x.unit}` }] : []),
    ...(tab === 'box-types' ? [{ title: t('surveys.masters.capacity'), dataIndex: 'capacityCbm', sorter: (a: any, b: any) => a.capacityCbm - b.capacityCbm, render: (x: number) => t('surveys.cbmValue', { value: fixed(x, 3) }) }, { title: t('surveys.masters.buildCost'), dataIndex: 'buildCost', render: (x: number) => fixed(x, 2) }] : []),
    ...scopes.column<any>(x => x.id),
    { title: t('common.status'), dataIndex: 'isActive', width: 100, filters: [{ text: t('common.active'), value: true }, { text: t('common.inactive'), value: false }], onFilter: (value: any, x: any) => x.isActive === value, render: (x: boolean) => <StatusTag active={x} /> },
    { title: t('common.actions'), key: 'actions', width: 210, align: 'right' as const, render: (_: unknown, x: any) => <RowActions><Space><Button size="small" icon={<EditOutlined />} onClick={() => show(x)}>{t('common.edit')}</Button><Popconfirm title={x.isActive ? t('surveys.masters.confirmDeactivate') : t('surveys.masters.confirmActivate')} onConfirm={() => void toggle(x)}><Button size="small">{x.isActive ? t('common.deactivate') : t('common.activate')}</Button></Popconfirm></Space></RowActions> },
  ]
  const overview = (
    <div className="master-data-page">
      <div className="master-data-heading">
        <div><h1>{t('surveys.masters.overviewTitle')}</h1><p>{t('surveys.masters.overviewDescription')}</p></div>
      </div>
      <div className="master-data-groups">
        <section className="master-data-group">
          <h2>{t('surveys.masters.setup')}</h2>
          <div className="master-data-tiles">
            {(Object.keys(masterKeys) as MasterKind[]).map(kind => <button key={kind} type="button" className="master-data-tile" onClick={() => setSelectedKind(kind)}>
              <span className="master-data-icon" aria-hidden="true">{kind === 'items' ? '▣' : kind === 'materials' ? '▤' : '◫'}</span>
              <span>{masterLabel(kind)} ({kind === 'items' ? items.length : kind === 'materials' ? materials.length : boxes.length})</span>
            </button>)}
          </div>
        </section>
      </div>
    </div>
  )

  if (!selectedKind) return overview

  return <>
    <PageHeader onRefresh={load} eyebrow={t('surveys.masters.eyebrow')} title={masterLabel(tab)} description={t(`surveys.masters.${masterKeys[tab]}.description`)} action={t('surveys.masters.addRecord')} onAction={() => show()} filters={<AdvancedSearch value={query} onChange={setQuery} onReset={() => setQuery('')} placeholder={t('surveys.masters.searchPlaceholder')} />} />
    {!initialTab && <div style={{ marginBottom: 12 }}><Button icon={<ArrowLeftOutlined />} onClick={() => { setSelectedKind(null); setQuery('') }}>{t('surveys.masters.back')}</Button></div>}
    <Card className="grid-card"><Table rowKey="id" dataSource={rows} columns={columns as any} pagination={false} scroll={{ y: 'calc(100vh - 310px)' }} /></Card>
    <Modal centered width={680} title={t(`surveys.masters.${masterKeys[tab]}.${editing ? 'edit' : 'add'}`)} open={open} onCancel={() => setOpen(false)} onOk={save} confirmLoading={saving} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark="optional"><div className="master-form-grid"><Form.Item label={t('common.code')} name="code" rules={[{ required: true, message: t('common.required') }]}><Input /></Form.Item><Form.Item label={t('common.name')} name="name" rules={[{ required: true, message: t('common.required') }]}><Input /></Form.Item></div>
        {tab === 'items' && <Form.Item label={t('surveys.masters.individualVolume')} name="volumeCbm" rules={[{ required: true, message: t('common.required') }]}><InputNumber min={0.001} precision={3} style={{ width: '100%' }} /></Form.Item>}
        {tab === 'materials' && <div className="master-form-grid"><Form.Item label={t('surveys.masters.unit')} name="unit" rules={[{ required: true, message: t('common.required') }]}><Input placeholder={t('surveys.masters.unitPlaceholder')} /></Form.Item><Form.Item className="amount-field" label={t('surveys.masters.currentUnitCost')} name="currentUnitCost" rules={[{ required: true, message: t('common.required') }]}><InputNumber controls={false} min={0} precision={2} style={{ width: '100%' }} /></Form.Item></div>}
        {tab === 'box-types' && <><Form.Item label={t('surveys.masters.maxCapacity')} name="capacityCbm" rules={[{ required: true, message: t('common.required') }]}><InputNumber min={0.001} precision={3} style={{ width: '100%' }} /></Form.Item><Form.List name="materials">{(fields, { add, remove }) => <><Space style={{ justifyContent: 'space-between', width: '100%' }}><strong>{t('surveys.masters.boxMaterials')}</strong><Button size="small" icon={<PlusOutlined />} onClick={() => add({ quantity: 1 })}>{t('surveys.masters.material')}</Button></Space>{fields.map(field => <Space key={field.key} align="baseline" style={{ display: 'flex', marginTop: 10 }}><Form.Item {...field} name={[field.name, 'materialId']} rules={[{ required: true, message: t('common.required') }]} style={{ flex: 1 }}><Select showSearch optionFilterProp="label" placeholder={t('surveys.masters.material')} options={materials.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.name} (${x.unit})` }))} /></Form.Item><Form.Item {...field} name={[field.name, 'quantity']} rules={[{ required: true, message: t('common.required') }]}><InputNumber min={0.001} precision={3} placeholder={t('common.quantity')} /></Form.Item><Button danger type="text" onClick={() => remove(field.name)}>{t('common.remove')}</Button></Space>)}</>}</Form.List></>}
        <Form.Item label={t('common.description')} name="description"><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Modal>
  </>
}



