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
import { formatNumber, useT } from '../i18n'

type TaxInput = Omit<TaxMaster, 'id' | 'serialNo' | 'isActive' | 'createdAtUtc' | 'updatedAtUtc'>

export function TaxMastersPage() {
  const { t } = useT()
  const kindLabel = (kind: string) => kind === 'CESS' ? t('quotations.taxes.cess') : t('quotations.detail.tax')
  const calculation = (x: TaxMaster) => x.calculationBasis === 'QUANTITY' ? t('quotations.perUnit', { rate: formatNumber(x.rate) })
    : x.calculationBasis === 'TAX_AMOUNT' ? t('quotations.taxes.percentOfTax', { rate: formatNumber(x.rate) }) : t('quotations.taxes.percentOfTaxable', { rate: formatNumber(x.rate) })
  const scopes = useCompanyScopes('tax')
  const [items, setItems] = useState<TaxMaster[]>([]), [query, setQuery] = useState(''), [kind, setKind] = useState<string>(), [open, setOpen] = useState(false), [editing, setEditing] = useState<TaxMaster | null>(null), [saving, setSaving] = useState(false)
  const [form] = Form.useForm<TaxInput>()
  const selectedKind = Form.useWatch('kind', form)
  const load = () => quotationsApi.taxes().then(setItems).catch(error => message.error(error.message))
  useEffect(() => { void load() }, [])
  const filtered = useMemo(() => items.filter(x => `${x.code} ${x.name}`.toLowerCase().includes(query.toLowerCase()) && (!kind || x.kind === kind)), [items, query, kind])
  const { visibleRows, onScroll, hasMore } = useInfiniteRows(filtered, `${query}|${kind}`)
  const show = (item?: TaxMaster) => { setEditing(item ?? null); form.setFieldsValue(item ? { code: item.code, name: item.name, kind: item.kind, calculationBasis: item.calculationBasis, rate: item.rate, isDefault: item.isDefault, description: item.description } : { code: '', name: '', kind: 'TAX', calculationBasis: 'TAXABLE_AMOUNT', rate: 0, isDefault: false, description: '' }); setOpen(true) }
  const save = async () => { const values = await form.validateFields(); setSaving(true); try { editing ? await quotationsApi.updateTax(editing.id, values) : await quotationsApi.createTax(values); await load(); setOpen(false); message.success(t('quotations.taxes.saved')) } catch (error) { message.error(error instanceof Error ? error.message : t('quotations.taxes.saveFailed')) } finally { setSaving(false) } }
  const columns: ColumnsType<TaxMaster> = [
    { title: t('quotations.detail.tax'), sorter: (a, b) => a.name.localeCompare(b.name), render: (_, x) => <div className="primary-cell"><strong>{x.name}</strong><small>#{x.serialNo} · {x.code}</small></div> },
    { title: t('common.type'), dataIndex: 'kind', render: value => <Tag color={value === 'CESS' ? 'orange' : 'blue'}>{kindLabel(value)}</Tag> },
    { title: t('quotations.taxes.calculation'), render: (_, x) => calculation(x) },
    { title: t('quotations.taxes.default'), dataIndex: 'isDefault', render: value => value ? <Tag color="green">{t('quotations.taxes.autoSelected')}</Tag> : t('common.optional') },
    ...scopes.column<TaxMaster>(x => x.id),
    { title: t('common.status'), dataIndex: 'isActive', render: value => <StatusTag active={value} /> },
    { title: t('common.actions'), align: 'right', render: (_, x) => <RowActions><Space wrap><Button size="small" icon={<EditOutlined />} onClick={() => show(x)}>{t('common.edit')}</Button><Popconfirm title={x.isActive ? t('quotations.taxes.confirmDeactivate') : t('quotations.taxes.confirmActivate')} onConfirm={async () => { await quotationsApi.setTaxStatus(x.id, !x.isActive); await load() }}><Button size="small">{x.isActive ? t('common.deactivate') : t('common.activate')}</Button></Popconfirm></Space></RowActions> },
  ]
  return <><PageHeader onRefresh={load} eyebrow={t('quotations.taxes.eyebrow')} title={t('quotations.taxes.title')} description={t('quotations.taxes.description')} action={t('quotations.taxes.add')} onAction={() => show()} filters={<AdvancedSearch value={query} onChange={setQuery} onReset={() => { setQuery(''); setKind(undefined) }} active={Boolean(kind)}><Select allowClear showSearch optionFilterProp="label" placeholder={t('common.type')} value={kind} onChange={setKind} options={[{ value: 'TAX', label: t('quotations.detail.tax') }, { value: 'CESS', label: t('quotations.taxes.cess') }]} /></AdvancedSearch>} /><Card className="grid-card" title={t('quotations.detail.taxesAndCess')} extra={t('quotations.taxes.count', { count: filtered.length })}><ResponsiveDataView rowKey="id" columns={columns} data={visibleRows} onScroll={onScroll} hasMore={hasMore} total={filtered.length} label={t('quotations.taxes.gridLabel')} scrollX={800} renderTile={x => <><div className="tile-heading"><div className="primary-cell"><strong>{x.name}</strong><small>{x.code}</small></div><Tag color={x.kind === 'CESS' ? 'orange' : 'blue'}>{kindLabel(x.kind)}</Tag></div><div className="tile-details"><span>{calculation(x)}</span><span>{x.isDefault ? t('quotations.taxes.selectedByDefault') : t('common.optional')}</span><StatusTag active={x.isActive} /></div><div className="tile-actions"><RowActions><Space wrap><Button size="small" onClick={() => show(x)}>{t('common.edit')}</Button><Button size="small" onClick={async () => { await quotationsApi.setTaxStatus(x.id, !x.isActive); await load() }}>{x.isActive ? t('common.deactivate') : t('common.activate')}</Button></Space></RowActions></div></>} /></Card><Modal centered title={editing ? t('quotations.taxes.editTitle') : t('quotations.taxes.addTitle')} open={open} onCancel={() => setOpen(false)} onOk={() => void save()} confirmLoading={saving} destroyOnHidden><Form form={form} layout="vertical"><div className="master-form-grid"><Form.Item label={t('common.code')} name="code" rules={[{ required: true, message: t('common.required') }]}><Input /></Form.Item><Form.Item label={t('common.name')} name="name" rules={[{ required: true, message: t('common.required') }]}><Input /></Form.Item><Form.Item label={t('common.type')} name="kind" rules={[{ required: true, message: t('common.required') }]}><Select showSearch optionFilterProp="label" options={[{ value: 'TAX', label: t('quotations.detail.tax') }, { value: 'CESS', label: t('quotations.taxes.cess') }]} onChange={value => { if (value === 'TAX' && form.getFieldValue('calculationBasis') === 'TAX_AMOUNT') form.setFieldValue('calculationBasis', 'TAXABLE_AMOUNT') }} /></Form.Item><Form.Item label={t('quotations.taxes.basis')} name="calculationBasis" rules={[{ required: true, message: t('common.required') }]}><Select showSearch optionFilterProp="label" options={[{ value: 'TAXABLE_AMOUNT', label: t('quotations.taxes.basisTaxable') }, ...(selectedKind === 'CESS' ? [{ value: 'TAX_AMOUNT', label: t('quotations.taxes.basisTax') }] : []), { value: 'QUANTITY', label: t('quotations.taxes.basisQuantity') }]} /></Form.Item><Form.Item className="amount-field" label={form.getFieldValue('calculationBasis') === 'QUANTITY' ? t('quotations.taxes.amountPerUnit') : t('quotations.taxes.ratePercentage')} name="rate" rules={[{ required: true, message: t('common.required') }]}><InputNumber min={0} precision={4} style={{ width: '100%' }} /></Form.Item></div><Form.Item name="isDefault" valuePropName="checked"><Checkbox>{t('quotations.taxes.autoSelect')}</Checkbox></Form.Item><Form.Item label={t('common.description')} name="description"><Input.TextArea rows={3} /></Form.Item></Form></Modal></>
}

