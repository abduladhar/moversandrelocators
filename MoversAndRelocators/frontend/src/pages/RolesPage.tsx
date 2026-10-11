import { useEffect, useMemo, useState } from 'react'
import { Card, Checkbox, Form, Input, Modal, Select, Space, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { TableProps } from 'antd'
import { securityApi } from '../api'
import type { Permission, Role } from '../types'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { PageHeader } from '../components/PageHeader'
import { useInfiniteRows } from '../hooks/useInfiniteRows'
import { ResponsiveDataView } from '../components/ResponsiveDataView'
import { sortRecords, type SortDirection } from '../utils/sortRecords'

export function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]), [permissions, setPermissions] = useState<Permission[]>([])
  const [query, setQuery] = useState(''), [type, setType] = useState<boolean | undefined>()
  const [sortField, setSortField] = useState<keyof Role>('serialNo'), [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [open, setOpen] = useState(false), [saving, setSaving] = useState(false)
  const [form] = Form.useForm<{ name: string; permissionIds: string[] }>()
  const load = () => Promise.all([securityApi.roles(), securityApi.permissions()]).then(([roleRows, permissionRows]) => { setRoles(roleRows); setPermissions(permissionRows) }).catch(error => message.error(error.message))
  useEffect(() => { void load() }, [])
  const filtered = useMemo(() => sortRecords(roles.filter(role => `${role.name} ${role.code} ${role.permissions.join(' ')}`.toLowerCase().includes(query.toLowerCase()) && (type === undefined || role.isSystemRole === type)), sortField, sortDirection), [roles, query, type, sortField, sortDirection])
  const { visibleRows, onScroll, hasMore } = useInfiniteRows(filtered, `${query}|${type}|${String(sortField)}|${sortDirection}`)
  const groups = useMemo(() => permissions.reduce<Record<string, Permission[]>>((all, permission) => { (all[permission.module] ??= []).push(permission); return all }, {}), [permissions])
  const create = async () => {
    const values = await form.validateFields(); setSaving(true)
    try { const saved = await securityApi.createRole(values.name, values.permissionIds); setRoles(current => [saved, ...current]); setOpen(false); form.resetFields(); message.success('Role created') }
    catch (reason) { if (reason instanceof Error) message.error(reason.message) } finally { setSaving(false) }
  }
  const columns: ColumnsType<Role> = [
    { title: 'Role', dataIndex: 'name', sorter: true, sortOrder: sortField === 'name' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: (_, role) => <div className="primary-cell"><strong>{role.name}</strong><small>#{role.serialNo} · {role.code}</small></div> },
    { title: 'Type', dataIndex: 'isSystemRole', width: 120, sorter: true, sortOrder: sortField === 'isSystemRole' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, filters: [{ text: 'Default', value: true }, { text: 'Custom', value: false }], filteredValue: type === undefined ? null : [type], render: value => <Tag color={value ? 'blue' : 'purple'}>{value ? 'Default' : 'Custom'}</Tag> },
    { title: 'Permissions', key: 'permissions', render: (_, role) => <Space size={[4, 4]} wrap>{role.permissions.slice(0, 6).map(permission => <Tag key={permission}>{permission}</Tag>)}{role.permissions.length > 6 && <Tag>+{role.permissions.length - 6}</Tag>}</Space> },
  ]
  const tableChange: TableProps<Role>['onChange'] = (_, filters, sorter) => { const selected = Array.isArray(sorter) ? sorter[0] : sorter; if (selected?.field && selected.order) { setSortField(selected.field as keyof Role); setSortDirection(selected.order === 'ascend' ? 'asc' : 'desc') }; const roleType = filters.isSystemRole?.[0]; setType(typeof roleType === 'boolean' ? roleType : undefined) }
  return <>
    <PageHeader onRefresh={load} eyebrow="ACCESS CONTROL" title="Roles & permissions" description="Review default access or create a tailored permission set." action="Create role" onAction={() => setOpen(true)} filters={<AdvancedSearch value={query} onChange={setQuery} placeholder="Search role, code or permission" active={type !== undefined || sortField !== 'serialNo' || sortDirection !== 'desc'} sortField={String(sortField)} onSortField={value => setSortField(value as keyof Role)} sortDirection={sortDirection} onSortDirection={setSortDirection} sortOptions={[{ value: 'serialNo', label: 'Created sequence' }, { value: 'name', label: 'Role name' }, { value: 'code', label: 'Role code' }, { value: 'isSystemRole', label: 'Role type' }]} onReset={() => { setQuery(''); setType(undefined); setSortField('serialNo'); setSortDirection('desc') }}><Select showSearch optionFilterProp="label" allowClear placeholder="Role type" value={type} onChange={setType} options={[{ value: true, label: 'Default role' }, { value: false, label: 'Custom role' }]} /></AdvancedSearch>} />
    <Card className="grid-card" title="Roles" extra={`${filtered.length} roles`}><ResponsiveDataView rowKey="id" columns={columns} data={visibleRows} onScroll={onScroll} onChange={tableChange} hasMore={hasMore} total={filtered.length} label="roles" scrollX={760} renderTile={role => <><div className="tile-heading"><div className="primary-cell"><strong>{role.name}</strong><small>#{role.serialNo} · {role.code}</small></div><Tag color={role.isSystemRole ? 'blue' : 'purple'}>{role.isSystemRole ? 'Default' : 'Custom'}</Tag></div><div className="tile-tags">{role.permissions.slice(0, 5).map(permission => <Tag key={permission}>{permission}</Tag>)}{role.permissions.length > 5 && <Tag>+{role.permissions.length - 5}</Tag>}</div></>} /></Card>
    <Modal centered width={760} title="Create custom role" open={open} onCancel={() => setOpen(false)} onOk={create} confirmLoading={saving} okText="Create role" destroyOnHidden><Form form={form} layout="vertical" initialValues={{ permissionIds: [] }}><Form.Item label="Role name" name="name" rules={[{ required: true, min: 2 }]}><Input placeholder="Operations supervisor" /></Form.Item><Typography.Title level={5}>Permissions</Typography.Title><Form.Item name="permissionIds" rules={[{ required: true, message: 'Select at least one permission' }]}><Checkbox.Group className="permission-checkboxes">{Object.entries(groups).map(([module, rows]) => <Card size="small" title={module} key={module}>{rows.map(permission => <Checkbox value={permission.id} key={permission.id}><span>{permission.name}<small>{permission.code}</small></span></Checkbox>)}</Card>)}</Checkbox.Group></Form.Item></Form></Modal>
  </>
}


