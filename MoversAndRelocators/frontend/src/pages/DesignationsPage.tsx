import { RowActions } from '../components/RowActions'
import { useCompanyScopes } from '../companyScope'
import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Checkbox, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Statistic, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { TableProps } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { employeesApi } from '../api'
import type { Designation, DesignationInput } from '../types'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { useInfiniteRows } from '../hooks/useInfiniteRows'
import { ResponsiveDataView } from '../components/ResponsiveDataView'
import { sortRecords, type SortDirection } from '../utils/sortRecords'

export function DesignationsPage() {
  const scopes = useCompanyScopes('designation')
  const [items, setItems] = useState<Designation[]>([])
  const [query, setQuery] = useState(''), [status, setStatus] = useState<boolean | undefined>(), [level, setLevel] = useState<number>()
  const [sortField, setSortField] = useState<keyof Designation>('serialNo'), [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<Designation | null>(null), [saving, setSaving] = useState(false)
  const [form] = Form.useForm<DesignationInput>()
  const load = () => employeesApi.designations().then(setItems).catch(error => message.error(error.message))
  useEffect(() => { void load() }, [])
  const levels = useMemo(() => [...new Set(items.map(item => item.level))].sort((a, b) => a - b), [items])
  const filtered = useMemo(() => sortRecords(items.filter(item => `${item.code} ${item.name} ${item.description ?? ''}`.toLowerCase().includes(query.toLowerCase()) && (status === undefined || item.isActive === status) && (!level || item.level === level)), sortField, sortDirection), [items, query, status, level, sortField, sortDirection])
  const { visibleRows, onScroll, hasMore } = useInfiniteRows(filtered, `${query}|${status}|${level}|${String(sortField)}|${sortDirection}`)
  const showForm = (item?: Designation) => { setEditing(item ?? null); form.setFieldsValue(item ? { code: item.code, name: item.name, level: item.level, description: item.description ?? '', isSalesman: item.isSalesman } : { code: '', name: '', level: 1, description: '', isSalesman: false }); setOpen(true) }
  const save = async () => {
    const values = await form.validateFields(); setSaving(true)
    try { const saved = editing ? await employeesApi.updateDesignation(editing.id, values) : await employeesApi.createDesignation(values); setItems(current => [saved, ...current.filter(x => x.id !== saved.id)].sort((a, b) => b.serialNo - a.serialNo)); setOpen(false); message.success(`Designation ${editing ? 'updated' : 'created'}`) }
    catch (reason) { if (reason instanceof Error) message.error(reason.message) } finally { setSaving(false) }
  }
  const columns: ColumnsType<Designation> = [
    { title: 'Designation', dataIndex: 'name', sorter: true, sortOrder: sortField === 'name' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: (_, item) => <div className="primary-cell"><strong>{item.name}</strong><small>#{item.serialNo} · {item.code}</small></div> },
    { title: 'Level', dataIndex: 'level', width: 100, sorter: true, sortOrder: sortField === 'level' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, filters: levels.map(value => ({ text: `Level ${value}`, value })), filteredValue: level ? [level] : null, filterSearch: true, render: value => <Tag color="cyan">Level {value}</Tag> },
    { title: 'Type', dataIndex: 'isSalesman', width: 120, render: value => value ? <Tag color="green">Salesman</Tag> : <Tag>General</Tag> },
    { title: 'Description', dataIndex: 'description', ellipsis: true, render: value => value || '—' },
    ...scopes.column<Designation>(x => x.id),
    { title: 'Status', dataIndex: 'isActive', width: 110, sorter: true, sortOrder: sortField === 'isActive' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, filters: [{ text: 'Active', value: true }, { text: 'Inactive', value: false }], filteredValue: status === undefined ? null : [status], render: value => <StatusTag active={value} /> },
    { title: 'Actions', key: 'actions', width: 210, align: 'right', render: (_, item) => <RowActions><Space><Button size="small" icon={<EditOutlined />} onClick={() => showForm(item)}>Edit</Button><Popconfirm title={`${item.isActive ? 'Deactivate' : 'Activate'} this designation?`} onConfirm={async () => { try { const saved = await employeesApi.setDesignationStatus(item.id, !item.isActive); setItems(all => all.map(x => x.id === saved.id ? saved : x)) } catch (reason) { message.error(reason instanceof Error ? reason.message : 'Unable to update status') } }}><Button size="small">{item.isActive ? 'Deactivate' : 'Activate'}</Button></Popconfirm></Space></RowActions> },
  ]
  const tableChange: TableProps<Designation>['onChange'] = (_, filters, sorter) => { const selected = Array.isArray(sorter) ? sorter[0] : sorter; if (selected?.field && selected.order) { setSortField(selected.field as keyof Designation); setSortDirection(selected.order === 'ascend' ? 'asc' : 'desc') }; const state = filters.isActive?.[0]; setStatus(typeof state === 'boolean' ? state : undefined); const selectedLevel = filters.level?.[0]; setLevel(typeof selectedLevel === 'number' ? selectedLevel : undefined) }
  return <>
    <PageHeader onRefresh={load} eyebrow="WORKFORCE MASTER" title="Designation master" description="Define the reporting levels and positions used by your workforce." action="Add designation" onAction={() => showForm()} filters={<AdvancedSearch value={query} onChange={setQuery} placeholder="Search code, name or description" active={status !== undefined || Boolean(level) || sortField !== 'serialNo' || sortDirection !== 'desc'} sortField={String(sortField)} onSortField={value => setSortField(value as keyof Designation)} sortDirection={sortDirection} onSortDirection={setSortDirection} sortOptions={[{ value: 'serialNo', label: 'Created sequence' }, { value: 'name', label: 'Designation name' }, { value: 'code', label: 'Code' }, { value: 'level', label: 'Reporting level' }, { value: 'isActive', label: 'Status' }]} onReset={() => { setQuery(''); setStatus(undefined); setLevel(undefined); setSortField('serialNo'); setSortDirection('desc') }}><Select showSearch optionFilterProp="label" allowClear placeholder="Reporting level" value={level} onChange={setLevel} options={levels.map(value => ({ value, label: `Level ${value}` }))} /><Select showSearch optionFilterProp="label" allowClear placeholder="Status" value={status} onChange={setStatus} options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} /></AdvancedSearch>} />
    <Row gutter={[16, 16]} className="stats-row"><Col xs={24} sm={8}><Card><Statistic title="Total designations" value={items.length} /></Card></Col><Col xs={12} sm={8}><Card><Statistic title="Active" value={items.filter(x => x.isActive).length} /></Card></Col><Col xs={12} sm={8}><Card><Statistic title="Reporting levels" value={levels.length} /></Card></Col></Row>
    <Card className="grid-card" title="Designations" extra={`${filtered.length} records`}><ResponsiveDataView rowKey="id" columns={columns} data={visibleRows} onScroll={onScroll} onChange={tableChange} hasMore={hasMore} total={filtered.length} label="designations" scrollX={850} renderTile={item => <><div className="tile-heading"><div className="primary-cell"><strong>{item.name}</strong><small>#{item.serialNo} · {item.code}</small></div><StatusTag active={item.isActive} /></div><div className="tile-details"><span><Tag color="cyan">Level {item.level}</Tag></span><span>{item.description || 'No description'}</span></div><RowActions><Space wrap className="tile-actions"><Button size="small" icon={<EditOutlined />} onClick={() => showForm(item)}>Edit</Button><Popconfirm title={`${item.isActive ? 'Deactivate' : 'Activate'} this designation?`} onConfirm={async () => { const saved = await employeesApi.setDesignationStatus(item.id, !item.isActive); setItems(all => all.map(x => x.id === saved.id ? saved : x)) }}><Button size="small">{item.isActive ? 'Deactivate' : 'Activate'}</Button></Popconfirm></Space></RowActions></>} /></Card>
    <Modal centered title={editing ? 'Edit designation' : 'Create designation'} open={open} onCancel={() => setOpen(false)} onOk={save} confirmLoading={saving} okText={editing ? 'Save changes' : 'Create designation'} destroyOnHidden><Form form={form} layout="vertical" requiredMark="optional"><Form.Item label="Code" name="code" normalize={value => value?.toUpperCase()} rules={[{ required: true, min: 2, max: 40 }, { pattern: /^[a-zA-Z0-9_-]+$/, message: 'Use letters, numbers, underscore or hyphen' }]}><Input placeholder="SALES_EXECUTIVE" /></Form.Item><Form.Item label="Designation name" name="name" rules={[{ required: true, min: 2, max: 120 }]}><Input /></Form.Item><Form.Item label="Reporting level" name="level" extra="Level 1 is the highest organizational level." rules={[{ required: true }]}><InputNumber min={1} max={100} style={{ width: '100%' }} /></Form.Item><Form.Item name="isSalesman" valuePropName="checked"><Checkbox>Salesman designation — restrict linked users to their own quotations</Checkbox></Form.Item><Form.Item label="Description" name="description"><Input.TextArea rows={3} maxLength={500} showCount /></Form.Item></Form></Modal>
  </>
}


