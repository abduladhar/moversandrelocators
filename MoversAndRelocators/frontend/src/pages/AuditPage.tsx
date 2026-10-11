import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Modal, Select, Space, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { TableProps } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { securityApi } from '../api'
import type { AuditLog } from '../types'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { PageHeader } from '../components/PageHeader'
import { useInfiniteRows } from '../hooks/useInfiniteRows'
import { ResponsiveDataView } from '../components/ResponsiveDataView'
import { sortRecords, type SortDirection } from '../utils/sortRecords'

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]), [selected, setSelected] = useState<AuditLog | null>(null)
  const [query, setQuery] = useState(''), [action, setAction] = useState<string>(), [entity, setEntity] = useState<string>()
  const [sortField, setSortField] = useState<keyof AuditLog>('serialNo'), [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const load = () => securityApi.audit().then(setLogs).catch(error => message.error(error.message))
  useEffect(() => { void load() }, [])
  const actions = useMemo(() => [...new Set(logs.map(log => log.action))].sort(), [logs])
  const entities = useMemo(() => [...new Set(logs.map(log => log.entityType))].sort(), [logs])
  const filtered = useMemo(() => sortRecords(logs.filter(log => `${log.actorEmail} ${log.entityType} ${log.entityId ?? ''} ${log.action}`.toLowerCase().includes(query.toLowerCase()) && (!action || log.action === action) && (!entity || log.entityType === entity)), sortField, sortDirection), [logs, query, action, entity, sortField, sortDirection])
  const { visibleRows, onScroll, hasMore } = useInfiniteRows(filtered, `${query}|${action}|${entity}|${String(sortField)}|${sortDirection}`)
  const columns: ColumnsType<AuditLog> = [
    { title: 'Serial', dataIndex: 'serialNo', width: 85, sorter: true, sortOrder: sortField === 'serialNo' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: value => `#${value}` },
    { title: 'Actor', dataIndex: 'actorEmail', ellipsis: true, sorter: true, sortOrder: sortField === 'actorEmail' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null },
    { title: 'Action', dataIndex: 'action', width: 110, sorter: true, sortOrder: sortField === 'action' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, filters: actions.map(value => ({ text: value, value })), filteredValue: action ? [action] : null, render: value => <Tag color={value === 'Deleted' ? 'red' : value === 'Updated' ? 'gold' : 'green'}>{value}</Tag> },
    { title: 'Entity', dataIndex: 'entityType', sorter: true, sortOrder: sortField === 'entityType' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, filters: entities.map(value => ({ text: value, value })), filteredValue: entity ? [entity] : null, filterSearch: true, render: (_, log) => <div className="primary-cell"><strong>{log.entityType}</strong><small>{log.entityId || 'No public identifier'}</small></div> },
    { title: 'IP address', dataIndex: 'ipAddress', render: value => value || 'Server' },
    { title: 'Date and time', dataIndex: 'createdAtUtc', width: 190, sorter: true, sortOrder: sortField === 'createdAtUtc' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: value => new Date(value).toLocaleString() },
    { title: 'Details', key: 'details', width: 90, align: 'right', render: (_, log) => <Button size="small" icon={<EyeOutlined />} onClick={() => setSelected(log)}>View</Button> },
  ]
  const tableChange: TableProps<AuditLog>['onChange'] = (_, filters, sorter) => { const selected = Array.isArray(sorter) ? sorter[0] : sorter; if (selected?.field && selected.order) { setSortField(selected.field as keyof AuditLog); setSortDirection(selected.order === 'ascend' ? 'asc' : 'desc') }; setAction(typeof filters.action?.[0] === 'string' ? filters.action[0] : undefined); setEntity(typeof filters.entityType?.[0] === 'string' ? filters.entityType[0] : undefined) }
  return <>
    <PageHeader onRefresh={load} eyebrow="GOVERNANCE" title="Audit trail" description="A chronological, immutable record of data changes in this tenant." filters={<AdvancedSearch value={query} onChange={setQuery} placeholder="Search actor, entity, ID or action" active={Boolean(action) || Boolean(entity) || sortField !== 'serialNo' || sortDirection !== 'desc'} sortField={String(sortField)} onSortField={value => setSortField(value as keyof AuditLog)} sortDirection={sortDirection} onSortDirection={setSortDirection} sortOptions={[{ value: 'serialNo', label: 'Created sequence' }, { value: 'createdAtUtc', label: 'Date and time' }, { value: 'actorEmail', label: 'Actor' }, { value: 'action', label: 'Action' }, { value: 'entityType', label: 'Entity type' }]} onReset={() => { setQuery(''); setAction(undefined); setEntity(undefined); setSortField('serialNo'); setSortDirection('desc') }}><Select showSearch optionFilterProp="label" allowClear placeholder="Action" value={action} onChange={setAction} options={actions.map(value => ({ value, label: value }))} /><Select showSearch optionFilterProp="label" allowClear placeholder="Entity type" value={entity} onChange={setEntity} options={entities.map(value => ({ value, label: value }))} /></AdvancedSearch>} />
    <Card className="grid-card" title="Recent activity" extra={`${filtered.length} events`}><ResponsiveDataView rowKey="id" columns={columns} data={visibleRows} onScroll={onScroll} onChange={tableChange} hasMore={hasMore} total={filtered.length} label="events" scrollX={960} renderTile={log => <><div className="tile-heading"><div className="primary-cell"><strong>{log.entityType}</strong><small>#{log.serialNo} · {log.entityId || 'No ID'}</small></div><Tag color={log.action === 'Deleted' ? 'red' : log.action === 'Updated' ? 'gold' : 'green'}>{log.action}</Tag></div><div className="tile-details"><span>{log.actorEmail}</span><span>{new Date(log.createdAtUtc).toLocaleString()}</span><span>{log.ipAddress || 'Server'}</span></div><div className="tile-actions"><Button size="small" icon={<EyeOutlined />} onClick={() => setSelected(log)}>View details</Button></div></>} /></Card>
    <Modal centered title="Audit event details" open={Boolean(selected)} onCancel={() => setSelected(null)} footer={<Button onClick={() => setSelected(null)}>Close</Button>}><Space direction="vertical" size="middle" style={{ width: '100%' }}><Typography.Text type="secondary">Recorded changes</Typography.Text><pre className="audit-json">{selected ? JSON.stringify(JSON.parse(selected.changes), null, 2) : ''}</pre></Space></Modal>
  </>
}


