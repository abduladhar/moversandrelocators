import { ChargeAccountMappings } from '../components/ChargeAccountMappings'
import { useBilling } from '../billingApi'
import { RowActions } from '../components/RowActions'
import { useCompanyScopes } from '../companyScope'
import { useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined } from '@ant-design/icons'
import { quotationsApi } from '../api'
import type { ChargeMaster } from '../types'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { PageHeader } from '../components/PageHeader'
import { ResponsiveDataView } from '../components/ResponsiveDataView'
import { StatusTag } from '../components/StatusTag'
import { useServerList } from '../hooks/useServerList'
import type { SortDirection } from '../utils/sortRecords'
import { formatNumber, useT } from '../i18n'

const money2 = (value: number) => formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type ChargeInput = Omit<ChargeMaster, 'id' | 'serialNo' | 'isActive' | 'createdAtUtc' | 'updatedAtUtc'>

export function ChargeMastersPage() {
  const { t } = useT()
  const scopes = useCompanyScopes('charge')
  const canBill=useBilling(), [mappingOpen,setMappingOpen]=useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<boolean | undefined>()
  const [sortField, setSortField] = useState<keyof ChargeMaster>('serialNo')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ChargeMaster | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<ChargeInput>()

  const list = useServerList(quotationsApi.searchCharges, { search: query, active, sort: String(sortField), desc: sortDirection === 'desc' })
  const load = () => list.reload()

  const show = (item?: ChargeMaster) => {
    setEditing(item ?? null)
    form.setFieldsValue(item ? { code: item.code, name: item.name, unit: item.unit, defaultRate: item.defaultRate, taxPercent: item.taxPercent, description: item.description } : { code: '', name: '', unit: 'service', defaultRate: 0, taxPercent: 0, description: '' })
    setOpen(true)
  }
  const save = async () => {
    const values = await form.validateFields(); setSaving(true)
    try { editing ? await quotationsApi.updateCharge(editing.id, values) : await quotationsApi.createCharge(values); await load(); setOpen(false); message.success(t('quotations.charges.saved')) }
    catch (error) { message.error(error instanceof Error ? error.message : t('quotations.charges.saveFailed')) }
    finally { setSaving(false) }
  }
  const columns: ColumnsType<ChargeMaster> = [
    { title: t('quotations.detail.charge'), dataIndex: 'name', render: (_, item) => <div className="primary-cell"><strong>{item.name}</strong><small>#{item.serialNo} · {item.code}</small></div> },
    { title: t('quotations.charges.unit'), dataIndex: 'unit', width: 120 },
    { title: t('quotations.charges.defaultRate'), dataIndex: 'defaultRate', render: value => money2(value) },
    ...scopes.column<ChargeMaster>(x => x.id),
    { title: t('common.status'), dataIndex: 'isActive', width: 100, render: value => <StatusTag active={value} /> },
    { title: t('common.actions'), width: 210, align: 'right', render: (_, item) => <ChargeActions item={item} onEdit={() => show(item)} onChanged={load} /> },
  ]

  return <>
    {canBill&&<><Button onClick={()=>setMappingOpen(true)} style={{marginBottom:12}}>{t('quotations.charges.accountMappings')}</Button><Modal width={900} open={mappingOpen} title={t('quotations.charges.accountMappingsTitle')} footer={null} destroyOnHidden onCancel={()=>{setMappingOpen(false);void load()}}><ChargeAccountMappings/></Modal></>}
    <PageHeader onRefresh={load} eyebrow={t('quotations.charges.eyebrow')} title={t('quotations.charges.title')} description={t('quotations.charges.description')} action={t('quotations.detail.addCharge')} onAction={() => show()} filters={<AdvancedSearch value={query} onChange={setQuery} onReset={() => { setQuery(''); setActive(undefined); setSortField('serialNo'); setSortDirection('desc') }} placeholder={t('quotations.charges.search')} active={active !== undefined || sortField !== 'serialNo' || sortDirection !== 'desc'} sortField={String(sortField)} onSortField={value => setSortField(value as keyof ChargeMaster)} sortDirection={sortDirection} onSortDirection={setSortDirection} sortOptions={[{ value: 'serialNo', label: t('quotations.list.sortCreated') }, { value: 'name', label: t('common.name') }, { value: 'defaultRate', label: t('quotations.charges.defaultRate') }]}><Select allowClear showSearch optionFilterProp="label" placeholder={t('common.status')} value={active} onChange={setActive} options={[{ value: true, label: t('common.active') }, { value: false, label: t('common.inactive') }]} /></AdvancedSearch>} />
    <Card className="grid-card" title={t('quotations.detail.charges')} extra={t('quotations.records', { count: list.total })}><ResponsiveDataView rowKey="id" columns={columns} data={list.rows} onScroll={list.onScroll} hasMore={list.hasMore} total={list.total} loading={list.loading} label={t('quotations.charges.gridLabel')} scrollX={680} renderTile={item => <><div className="tile-heading"><div className="primary-cell"><strong>{item.name}</strong><small>#{item.serialNo} · {item.code}</small></div><StatusTag active={item.isActive} /></div><div className="tile-details"><span>{t('quotations.charges.unitValue', { unit: item.unit })}</span><span>{t('quotations.charges.defaultRateValue', { rate: money2(item.defaultRate) })}</span></div><div className="tile-actions"><ChargeActions item={item} onEdit={() => show(item)} onChanged={load} /></div></>} /></Card>
    <Modal centered title={editing ? t('quotations.detail.editCharge') : t('quotations.detail.addCharge')} open={open} onCancel={() => setOpen(false)} onOk={save} confirmLoading={saving} destroyOnHidden><Form form={form} layout="vertical"><Form.Item name="taxPercent" hidden><InputNumber /></Form.Item><div className="master-form-grid"><Form.Item label={t('common.code')} name="code" rules={[{ required: true, message: t('common.required') }]}><Input /></Form.Item><Form.Item label={t('common.name')} name="name" rules={[{ required: true, message: t('common.required') }]}><Input /></Form.Item><Form.Item label={t('quotations.charges.unit')} name="unit" rules={[{ required: true, message: t('common.required') }]}><Input placeholder={t('quotations.charges.unitPlaceholder')} /></Form.Item><Form.Item className="amount-field" label={t('quotations.charges.defaultRate')} name="defaultRate" rules={[{ required: true, message: t('common.required') }]}><InputNumber controls={false} min={0} precision={2} style={{ width: '100%' }} /></Form.Item></div><Form.Item label={t('common.description')} name="description"><Input.TextArea rows={3} /></Form.Item></Form></Modal>
  </>
}

function ChargeActions({ item, onEdit, onChanged }: { item: ChargeMaster; onEdit: () => void; onChanged: () => void }) {
  const { t } = useT()
  return <RowActions><Space wrap><Button size="small" icon={<EditOutlined />} onClick={onEdit}>{t('common.edit')}</Button><Popconfirm title={item.isActive ? t('quotations.charges.confirmDeactivate') : t('quotations.charges.confirmActivate')} onConfirm={async () => { await quotationsApi.setChargeStatus(item.id, !item.isActive); onChanged() }}><Button size="small">{item.isActive ? t('common.deactivate') : t('common.activate')}</Button></Popconfirm></Space></RowActions>
}



