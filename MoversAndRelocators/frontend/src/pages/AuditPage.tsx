import { useState } from 'react'
import { Button, Card, Modal, Select, Space, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { TableProps } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { securityApi } from '../api'
import type { AuditLog } from '../types'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { PageHeader } from '../components/PageHeader'
import { useServerList } from '../hooks/useServerList'
import { ResponsiveDataView } from '../components/ResponsiveDataView'
import type { SortDirection } from '../utils/sortRecords'
import { formatDateTime, has, useT } from '../i18n'

export function AuditPage() {
  const { t } = useT()
  const [selected, setSelected] = useState<AuditLog | null>(null)
  const [query, setQuery] = useState(''), [action, setAction] = useState<string>(), [entity, setEntity] = useState<string>()
  const [sortField, setSortField] = useState<keyof AuditLog>('serialNo'), [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  /** Searches the whole audit log on the server. The keyword matches the raw action (Created, Updated...), not its translated label. */
  const list = useServerList(securityApi.searchAudit, { search: query, action, entityType: entity, sort: String(sortField), desc: sortDirection === 'desc' })
  const load = () => list.reload()
  /** The server records actions as English words (Created, Updated, Deleted…); show the known ones translated. */
  const actionLabel = (value: string) => has('admin.audit.actions.' + value) ? t('admin.audit.actions.' + value) : value
  const actions = list.summary?.actions ?? []
  const entities = list.summary?.entityTypes ?? []
  const columns: ColumnsType<AuditLog> = [
    { title: t('admin.audit.serial'), dataIndex: 'serialNo', width: 85, sorter: true, sortOrder: sortField === 'serialNo' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: value => `#${value}` },
    { title: t('admin.audit.actor'), dataIndex: 'actorEmail', ellipsis: true, sorter: true, sortOrder: sortField === 'actorEmail' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null },
    { title: t('admin.audit.action'), dataIndex: 'action', width: 110, sorter: true, sortOrder: sortField === 'action' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, filters: actions.map(value => ({ text: actionLabel(value), value })), filteredValue: action ? [action] : null, render: value => <Tag color={value === 'Deleted' ? 'red' : value === 'Updated' ? 'gold' : 'green'}>{actionLabel(value)}</Tag> },
    { title: t('admin.audit.entity'), dataIndex: 'entityType', sorter: true, sortOrder: sortField === 'entityType' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, filters: entities.map(value => ({ text: value, value })), filteredValue: entity ? [entity] : null, filterSearch: true, render: (_, log) => <div className="primary-cell"><strong>{log.entityType}</strong><small>{log.entityId || t('admin.audit.noPublicId')}</small></div> },
    { title: t('admin.audit.ipAddress'), dataIndex: 'ipAddress', render: value => value || t('admin.audit.server') },
    { title: t('admin.audit.dateTime'), dataIndex: 'createdAtUtc', width: 190, sorter: true, sortOrder: sortField === 'createdAtUtc' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: value => formatDateTime(value) },
    { title: t('common.details'), key: 'details', width: 90, align: 'right', render: (_, log) => <Button size="small" icon={<EyeOutlined />} onClick={() => setSelected(log)}>{t('common.view')}</Button> },
  ]
  const tableChange: TableProps<AuditLog>['onChange'] = (_, filters, sorter) => { const selected = Array.isArray(sorter) ? sorter[0] : sorter; if (selected?.field && selected.order) { setSortField(selected.field as keyof AuditLog); setSortDirection(selected.order === 'ascend' ? 'asc' : 'desc') }; setAction(typeof filters.action?.[0] === 'string' ? filters.action[0] : undefined); setEntity(typeof filters.entityType?.[0] === 'string' ? filters.entityType[0] : undefined) }
  return <>
    <PageHeader onRefresh={load} eyebrow={t('admin.audit.eyebrow')} title={t('admin.audit.title')} description={t('admin.audit.description')} filters={<AdvancedSearch value={query} onChange={setQuery} placeholder={t('admin.audit.searchPlaceholder')} active={Boolean(action) || Boolean(entity) || sortField !== 'serialNo' || sortDirection !== 'desc'} sortField={String(sortField)} onSortField={value => setSortField(value as keyof AuditLog)} sortDirection={sortDirection} onSortDirection={setSortDirection} sortOptions={[{ value: 'serialNo', label: t('shell.search.createdSequence') }, { value: 'createdAtUtc', label: t('admin.audit.dateTime') }, { value: 'actorEmail', label: t('admin.audit.actor') }, { value: 'action', label: t('admin.audit.action') }, { value: 'entityType', label: t('admin.audit.entityType') }]} onReset={() => { setQuery(''); setAction(undefined); setEntity(undefined); setSortField('serialNo'); setSortDirection('desc') }}><Select showSearch optionFilterProp="label" allowClear placeholder={t('admin.audit.action')} value={action} onChange={setAction} options={actions.map(value => ({ value, label: actionLabel(value) }))} /><Select showSearch optionFilterProp="label" allowClear placeholder={t('admin.audit.entityType')} value={entity} onChange={setEntity} options={entities.map(value => ({ value, label: value }))} /></AdvancedSearch>} />
    <Card className="grid-card" title={t('admin.audit.recentActivity')} extra={t('admin.audit.eventCount', { count: list.total })}><ResponsiveDataView rowKey="id" columns={columns} data={list.rows} onScroll={list.onScroll} onChange={tableChange} hasMore={list.hasMore} total={list.total} loading={list.loading} label={t('admin.audit.events')} scrollX={960} renderTile={log => <><div className="tile-heading"><div className="primary-cell"><strong>{log.entityType}</strong><small>#{log.serialNo} · {log.entityId || t('admin.audit.noId')}</small></div><Tag color={log.action === 'Deleted' ? 'red' : log.action === 'Updated' ? 'gold' : 'green'}>{actionLabel(log.action)}</Tag></div><div className="tile-details"><span>{log.actorEmail}</span><span>{formatDateTime(log.createdAtUtc)}</span><span>{log.ipAddress || t('admin.audit.server')}</span></div><div className="tile-actions"><Button size="small" icon={<EyeOutlined />} onClick={() => setSelected(log)}>{t('admin.audit.viewDetails')}</Button></div></>} /></Card>
    <Modal centered title={t('admin.audit.detailsTitle')} open={Boolean(selected)} onCancel={() => setSelected(null)} footer={<Button onClick={() => setSelected(null)}>{t('common.close')}</Button>}><Space direction="vertical" size="middle" style={{ width: '100%' }}><Typography.Text type="secondary">{t('admin.audit.recordedChanges')}</Typography.Text><pre className="audit-json" dir="ltr">{selected ? JSON.stringify(JSON.parse(selected.changes), null, 2) : ''}</pre></Space></Modal>
  </>
}
