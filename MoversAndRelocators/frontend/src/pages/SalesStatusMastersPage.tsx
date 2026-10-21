import { RowActions } from '../components/RowActions'
import { useCompanyScopes } from '../companyScope'
import { useState } from 'react'
import { Button, Card, Checkbox, ColorPicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined } from '@ant-design/icons'
import { salesApi } from '../api'
import type { FollowUpStatus, LeadStatus, MoveType } from '../types'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { PageHeader } from '../components/PageHeader'
import { ResponsiveDataView } from '../components/ResponsiveDataView'
import { StatusTag } from '../components/StatusTag'
import { useServerList, type ListParams, type Paged } from '../hooks/useServerList'
import type { SortDirection } from '../utils/sortRecords'
import { useT } from '../i18n'

type StatusForm = { code: string; name: string; displayOrder: number; color: string; terminal: boolean; description: string }
type StatusRow = { serialNo: number; id: string; code: string; name: string; displayOrder: number; color: string | null; terminal: boolean; description: string | null; isActive: boolean }
type MasterSummary = { count: number; maxDisplayOrder: number }

export function SalesStatusMastersPage({ initialMode = 'Lead statuses' }: { initialMode?: 'Lead statuses' | 'Follow-up statuses' | 'Move types' } = {}) {
  const { t } = useT()
  const mode = initialMode
  const isMove = mode === 'Move types'
  const modeTitle = mode === 'Lead statuses' ? t('sales.statusMasters.leadStatuses') : mode === 'Follow-up statuses' ? t('sales.statusMasters.followUpStatuses') : t('sales.statusMasters.moveTypes')
  const scopes = useCompanyScopes(mode === 'Lead statuses' ? 'lead-status' : mode === 'Follow-up statuses' ? 'follow-up-status' : 'move-type')
  const [query, setQuery] = useState(''), [active, setActive] = useState<boolean | undefined>(), [sortField, setSortField] = useState<keyof StatusRow>('displayOrder'), [direction, setDirection] = useState<SortDirection>('asc')
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<StatusRow | null>(null), [saving, setSaving] = useState(false)
  const [form] = Form.useForm<StatusForm>()
  // One page of the current master, mapped to the shared row shape; summary.count is the whole master's size (next display order default).
  const fetchPage = (params: ListParams): Promise<Paged<StatusRow, MasterSummary>> => mode === 'Lead statuses'
    ? salesApi.searchMasters<LeadStatus>('leads', params).then(p => ({ ...p, items: p.items.map(x => ({ ...x, terminal: x.isClosed, description: null })) }))
    : mode === 'Follow-up statuses'
      ? salesApi.searchMasters<FollowUpStatus>('follow-ups', params).then(p => ({ ...p, items: p.items.map(x => ({ ...x, terminal: x.isCompleted, description: null })) }))
      : salesApi.searchMasters<MoveType>('move-types', params).then(p => ({ ...p, items: p.items.map(x => ({ ...x, color: null, terminal: false })) }))
  const list = useServerList(fetchPage, { kind: mode, search: query, active, sort: String(sortField), desc: direction === 'desc' })
  const load = () => list.reload()
  const showForm = (item?: StatusRow) => { setEditing(item ?? null); form.setFieldsValue(item ? { code: item.code, name: item.name, displayOrder: item.displayOrder, color: item.color ?? '#1677ff', terminal: item.terminal, description: item.description ?? '' } : { code: '', name: '', displayOrder: ((list.summary?.count ?? list.total) + 1) * 10, color: '#1677ff', terminal: false, description: '' }); setOpen(true) }
  const save = async () => { const values = await form.validateFields(); setSaving(true); try { const common = { code: values.code, name: values.name, displayOrder: values.displayOrder, color: values.color }; if (mode === 'Lead statuses') { const input = { ...common, isClosed: values.terminal }; if (editing) await salesApi.updateLeadStatus(editing.id, input); else await salesApi.createLeadStatus(input) } else if (mode === 'Follow-up statuses') { const input = { ...common, isCompleted: values.terminal }; if (editing) await salesApi.updateFollowUpStatus(editing.id, input); else await salesApi.createFollowUpStatus(input) } else { const input = { code: values.code, name: values.name, displayOrder: values.displayOrder, description: values.description }; if (editing) await salesApi.updateMoveType(editing.id, input); else await salesApi.createMoveType(input) } void list.reload(); setOpen(false); message.success(isMove ? t('sales.statusMasters.moveTypeSaved') : t('sales.statusMasters.statusSaved')) } catch (reason) { if (reason instanceof Error) message.error(reason.message) } finally { setSaving(false) } }
  const setStatus = async (item: StatusRow) => { if (mode === 'Lead statuses') await salesApi.setLeadStatusActive(item.id, !item.isActive); else if (mode === 'Follow-up statuses') await salesApi.setFollowUpStatusActive(item.id, !item.isActive); else await salesApi.setMoveTypeActive(item.id, !item.isActive); void list.reload() }
  const columns: ColumnsType<StatusRow> = [
    { title: isMove ? t('sales.leads.moveType') : t('common.status'), dataIndex: 'name', render: (_, x) => <div className="primary-cell"><strong>{x.name}</strong><small>#{x.serialNo} · {x.code}{x.description ? ` · ${x.description}` : ''}</small></div> },
    { title: t('sales.statusMasters.order'), dataIndex: 'displayOrder', width: 90 },
    ...(mode === 'Move types' ? [] : [{ title: t('sales.statusMasters.colour'), dataIndex: 'color', width: 110, render: (value: string | null) => <Tag color={value || 'default'}>{value || t('sales.statusMasters.default')}</Tag> }, { title: mode === 'Lead statuses' ? t('sales.statusMasters.closed') : t('sales.statusMasters.completed'), dataIndex: 'terminal', width: 110, render: (value: boolean) => value ? <Tag color="green">{t('common.yes')}</Tag> : <Tag>{t('common.no')}</Tag> }]),
    { title: t('common.active'), dataIndex: 'isActive', width: 100, render: value => <StatusTag active={value} /> },
    ...scopes.column<StatusRow>(x => x.id),
    { title: t('common.actions'), key: 'actions', width: 200, align: 'right', render: (_, x) => <RowActions><Space><Button size="small" icon={<EditOutlined />} onClick={() => showForm(x)}>{t('common.edit')}</Button><Popconfirm title={x.isActive ? (isMove ? t('sales.statusMasters.confirmDeactivateMoveType') : t('sales.statusMasters.confirmDeactivate')) : (isMove ? t('sales.statusMasters.confirmActivateMoveType') : t('sales.statusMasters.confirmActivate'))} onConfirm={() => setStatus(x)}><Button size="small">{x.isActive ? t('common.deactivate') : t('common.activate')}</Button></Popconfirm></Space></RowActions> }
  ]
  const description = mode === 'Lead statuses'
    ? t('sales.statusMasters.leadDescription')
    : mode === 'Follow-up statuses'
      ? t('sales.statusMasters.followUpDescription')
      : t('sales.statusMasters.moveTypeDescription')
  return <><PageHeader onRefresh={load} eyebrow={t('sales.statusMasters.eyebrow')} title={modeTitle} description={description} action={isMove ? t('sales.statusMasters.addMoveType') : t('sales.statusMasters.addStatus')} onAction={() => showForm()} filters={<AdvancedSearch value={query} onChange={setQuery} active={active !== undefined || sortField !== 'displayOrder' || direction !== 'asc'} sortField={String(sortField)} onSortField={value => setSortField(value as keyof StatusRow)} sortDirection={direction} onSortDirection={setDirection} sortOptions={[{ value: 'displayOrder', label: t('sales.statusMasters.displayOrder') }, { value: 'serialNo', label: t('sales.leads.sortCreated') }, { value: 'name', label: t('common.name') }, { value: 'code', label: t('common.code') }]} onReset={() => { setQuery(''); setActive(undefined); setSortField('displayOrder'); setDirection('asc') }}><Select showSearch optionFilterProp="label" allowClear placeholder={t('sales.leads.activeState')} value={active} onChange={setActive} options={[{ value: true, label: t('common.active') }, { value: false, label: t('common.inactive') }]} /></AdvancedSearch>} /><Card className="grid-card sales-status-grid" extra={t('sales.statusMasters.records', { count: list.total })}><ResponsiveDataView rowKey="id" columns={columns} data={list.rows} onScroll={list.onScroll} hasMore={list.hasMore} total={list.total} loading={list.loading} label={t('sales.statusMasters.gridLabel')} renderTile={x => <><div className="tile-heading"><div className="primary-cell"><strong>{x.name}</strong><small>{x.code} · {t('sales.statusMasters.orderValue', { value: x.displayOrder })}</small></div><StatusTag active={x.isActive} /></div>{x.description && <div className="tile-details"><span>{x.description}</span></div>}<div className="tile-tags">{mode !== 'Move types' && <Tag color={x.color || 'default'}>{x.color || t('sales.statusMasters.default')}</Tag>}{x.terminal && <Tag color="green">{mode === 'Lead statuses' ? t('sales.statusMasters.closed') : t('sales.statusMasters.completed')}</Tag>}</div><RowActions><Space className="tile-actions"><Button size="small" onClick={() => showForm(x)}>{t('common.edit')}</Button><Button size="small" onClick={() => setStatus(x)}>{x.isActive ? t('common.deactivate') : t('common.activate')}</Button></Space></RowActions></>} /></Card><Modal centered title={editing ? (isMove ? t('sales.statusMasters.editMoveType') : t('sales.statusMasters.editStatus')) : (isMove ? t('sales.statusMasters.createMoveType') : t('sales.statusMasters.createStatus'))} open={open} onCancel={() => setOpen(false)} onOk={save} confirmLoading={saving} destroyOnHidden><Form form={form} layout="vertical"><Form.Item label={t('common.code')} name="code" normalize={v => v?.toUpperCase()} rules={[{ required: true, min: 2, message: t('sales.minTwo') }]}><Input /></Form.Item><Form.Item label={t('common.name')} name="name" rules={[{ required: true, min: 2, message: t('sales.minTwo') }]}><Input /></Form.Item><Form.Item label={t('sales.statusMasters.displayOrder')} name="displayOrder" rules={[{ required: true, message: t('common.required') }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>{mode === 'Move types' ? <Form.Item label={t('common.description')} name="description"><Input.TextArea rows={3} /></Form.Item> : <><Form.Item label={t('sales.statusMasters.colour')} name="color" getValueFromEvent={color => typeof color === 'string' ? color : color?.toHexString()}><ColorPicker showText /></Form.Item><Form.Item name="terminal" valuePropName="checked"><Checkbox>{mode === 'Lead statuses' ? t('sales.statusMasters.closesLead') : t('sales.statusMasters.completesFollowUp')}</Checkbox></Form.Item></>}</Form></Modal></>
}

