import { RowActions } from '../components/RowActions'
import { useCompanyScopes } from '../companyScope'
import { useState } from 'react'
import { Button, Card, Checkbox, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Statistic, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { TableProps } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { employeesApi } from '../api'
import type { Designation, DesignationInput } from '../types'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { useServerList } from '../hooks/useServerList'
import { ResponsiveDataView } from '../components/ResponsiveDataView'
import type { SortDirection } from '../utils/sortRecords'
import { useT } from '../i18n'

export function DesignationsPage() {
  const { t } = useT()
  const scopes = useCompanyScopes('designation')
  const [query, setQuery] = useState(''), [status, setStatus] = useState<boolean | undefined>(), [level, setLevel] = useState<number>()
  const [sortField, setSortField] = useState<keyof Designation>('serialNo'), [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<Designation | null>(null), [saving, setSaving] = useState(false)
  const [form] = Form.useForm<DesignationInput>()
  const list = useServerList(employeesApi.searchDesignations, { search: query, isActive: status, level, sort: String(sortField), desc: sortDirection === 'desc' })
  const load = () => list.reload()
  const levelLabel = (value: number) => t('admin.common.level', { level: value })
  /** Level filter options and stats come from the server's whole-list summary. */
  const levels = list.summary?.levels ?? []
  const showForm = (item?: Designation) => { setEditing(item ?? null); form.setFieldsValue(item ? { code: item.code, name: item.name, level: item.level, description: item.description ?? '', isSalesman: item.isSalesman } : { code: '', name: '', level: 1, description: '', isSalesman: false }); setOpen(true) }
  const save = async () => {
    const values = await form.validateFields(); setSaving(true)
    try { await (editing ? employeesApi.updateDesignation(editing.id, values) : employeesApi.createDesignation(values)); void list.reload(); setOpen(false); message.success(editing ? t('admin.designations.updated') : t('admin.designations.created')) }
    catch (reason) { if (reason instanceof Error) message.error(reason.message) } finally { setSaving(false) }
  }
  const columns: ColumnsType<Designation> = [
    { title: t('admin.designations.designation'), dataIndex: 'name', sorter: true, sortOrder: sortField === 'name' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: (_, item) => <div className="primary-cell"><strong>{item.name}</strong><small>#{item.serialNo} · {item.code}</small></div> },
    { title: t('admin.designations.levelColumn'), dataIndex: 'level', width: 100, sorter: true, sortOrder: sortField === 'level' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, filters: levels.map(value => ({ text: levelLabel(value), value })), filteredValue: level ? [level] : null, filterSearch: true, render: value => <Tag color="cyan">{levelLabel(value)}</Tag> },
    { title: t('common.type'), dataIndex: 'isSalesman', width: 120, render: value => value ? <Tag color="green">{t('admin.designations.salesman')}</Tag> : <Tag>{t('admin.designations.general')}</Tag> },
    { title: t('common.description'), dataIndex: 'description', ellipsis: true, render: value => value || '—' },
    ...scopes.column<Designation>(x => x.id),
    { title: t('common.status'), dataIndex: 'isActive', width: 110, sorter: true, sortOrder: sortField === 'isActive' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, filters: [{ text: t('common.active'), value: true }, { text: t('common.inactive'), value: false }], filteredValue: status === undefined ? null : [status], render: value => <StatusTag active={value} /> },
    { title: t('common.actions'), key: 'actions', width: 210, align: 'right', render: (_, item) => <RowActions><Space><Button size="small" icon={<EditOutlined />} onClick={() => showForm(item)}>{t('common.edit')}</Button><Popconfirm title={item.isActive ? t('admin.designations.deactivateConfirm') : t('admin.designations.activateConfirm')} onConfirm={async () => { try { await employeesApi.setDesignationStatus(item.id, !item.isActive); void list.reload() } catch (reason) { message.error(reason instanceof Error ? reason.message : t('admin.common.statusFailed')) } }}><Button size="small">{item.isActive ? t('common.deactivate') : t('common.activate')}</Button></Popconfirm></Space></RowActions> },
  ]
  const tableChange: TableProps<Designation>['onChange'] = (_, filters, sorter) => { const selected = Array.isArray(sorter) ? sorter[0] : sorter; if (selected?.field && selected.order) { setSortField(selected.field as keyof Designation); setSortDirection(selected.order === 'ascend' ? 'asc' : 'desc') }; const state = filters.isActive?.[0]; setStatus(typeof state === 'boolean' ? state : undefined); const selectedLevel = filters.level?.[0]; setLevel(typeof selectedLevel === 'number' ? selectedLevel : undefined) }
  return <>
    <PageHeader onRefresh={load} eyebrow={t('admin.designations.eyebrow')} title={t('admin.designations.title')} description={t('admin.designations.description')} action={t('admin.designations.add')} onAction={() => showForm()} filters={<AdvancedSearch value={query} onChange={setQuery} placeholder={t('admin.designations.searchPlaceholder')} active={status !== undefined || Boolean(level) || sortField !== 'serialNo' || sortDirection !== 'desc'} sortField={String(sortField)} onSortField={value => setSortField(value as keyof Designation)} sortDirection={sortDirection} onSortDirection={setSortDirection} sortOptions={[{ value: 'serialNo', label: t('shell.search.createdSequence') }, { value: 'name', label: t('admin.designations.name') }, { value: 'code', label: t('common.code') }, { value: 'level', label: t('admin.designations.reportingLevel') }, { value: 'isActive', label: t('common.status') }]} onReset={() => { setQuery(''); setStatus(undefined); setLevel(undefined); setSortField('serialNo'); setSortDirection('desc') }}><Select showSearch optionFilterProp="label" allowClear placeholder={t('admin.designations.reportingLevel')} value={level} onChange={setLevel} options={levels.map(value => ({ value, label: levelLabel(value) }))} /><Select showSearch optionFilterProp="label" allowClear placeholder={t('common.status')} value={status} onChange={setStatus} options={[{ value: true, label: t('common.active') }, { value: false, label: t('common.inactive') }]} /></AdvancedSearch>} />
    <Row gutter={[16, 16]} className="stats-row"><Col xs={24} sm={8}><Card><Statistic title={t('admin.designations.total')} value={list.summary?.total ?? 0} /></Card></Col><Col xs={12} sm={8}><Card><Statistic title={t('common.active')} value={list.summary?.active ?? 0} /></Card></Col><Col xs={12} sm={8}><Card><Statistic title={t('admin.designations.reportingLevels')} value={levels.length} /></Card></Col></Row>
    <Card className="grid-card" title={t('admin.designations.designations')} extra={t('admin.common.recordCount', { count: list.total })}><ResponsiveDataView rowKey="id" columns={columns} data={list.rows} onScroll={list.onScroll} onChange={tableChange} hasMore={list.hasMore} total={list.total} loading={list.loading} label={t('admin.designations.designationsLabel')} scrollX={850} renderTile={item => <><div className="tile-heading"><div className="primary-cell"><strong>{item.name}</strong><small>#{item.serialNo} · {item.code}</small></div><StatusTag active={item.isActive} /></div><div className="tile-details"><span><Tag color="cyan">{levelLabel(item.level)}</Tag></span><span>{item.description || t('admin.designations.noDescription')}</span></div><RowActions><Space wrap className="tile-actions"><Button size="small" icon={<EditOutlined />} onClick={() => showForm(item)}>{t('common.edit')}</Button><Popconfirm title={item.isActive ? t('admin.designations.deactivateConfirm') : t('admin.designations.activateConfirm')} onConfirm={async () => { await employeesApi.setDesignationStatus(item.id, !item.isActive); void list.reload() }}><Button size="small">{item.isActive ? t('common.deactivate') : t('common.activate')}</Button></Popconfirm></Space></RowActions></>} /></Card>
    <Modal centered title={editing ? t('admin.designations.editTitle') : t('admin.designations.createTitle')} open={open} onCancel={() => setOpen(false)} onOk={save} confirmLoading={saving} okText={editing ? t('admin.common.saveChanges') : t('admin.designations.createTitle')} cancelText={t('common.cancel')} destroyOnHidden><Form form={form} layout="vertical" requiredMark="optional"><Form.Item label={t('common.code')} name="code" normalize={value => value?.toUpperCase()} rules={[{ required: true, min: 2, max: 40 }, { pattern: /^[a-zA-Z0-9_-]+$/, message: t('admin.designations.codeRule') }]}><Input placeholder="SALES_EXECUTIVE" /></Form.Item><Form.Item label={t('admin.designations.name')} name="name" rules={[{ required: true, min: 2, max: 120 }]}><Input /></Form.Item><Form.Item label={t('admin.designations.reportingLevel')} name="level" extra={t('admin.designations.levelHint')} rules={[{ required: true }]}><InputNumber min={1} max={100} style={{ width: '100%' }} /></Form.Item><Form.Item name="isSalesman" valuePropName="checked"><Checkbox>{t('admin.designations.salesmanCheckbox')}</Checkbox></Form.Item><Form.Item label={t('common.description')} name="description"><Input.TextArea rows={3} maxLength={500} showCount /></Form.Item></Form></Modal>
  </>
}
