import { useEffect, useMemo, useState } from 'react'
import { Card, Checkbox, Form, Input, Modal, Select, Space, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { TableProps } from 'antd'
import { securityApi } from '../api'
import type { Permission, Role } from '../types'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { PageHeader } from '../components/PageHeader'
import { useServerList } from '../hooks/useServerList'
import { ResponsiveDataView } from '../components/ResponsiveDataView'
import type { SortDirection } from '../utils/sortRecords'
import { useT } from '../i18n'

export function RolesPage() {
  const { t } = useT()
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [query, setQuery] = useState(''), [type, setType] = useState<boolean | undefined>()
  const [sortField, setSortField] = useState<keyof Role>('serialNo'), [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [open, setOpen] = useState(false), [saving, setSaving] = useState(false)
  const [form] = Form.useForm<{ name: string; permissionIds: string[] }>()
  const list = useServerList(securityApi.searchRoles, { search: query, isSystemRole: type, sort: String(sortField), desc: sortDirection === 'desc' })
  const loadPermissions = () => securityApi.permissions().then(setPermissions).catch(error => message.error(error.message))
  const load = () => { void list.reload(); return loadPermissions() }
  useEffect(() => { void loadPermissions() }, [])
  const groups = useMemo(() => permissions.reduce<Record<string, Permission[]>>((all, permission) => { (all[permission.module] ??= []).push(permission); return all }, {}), [permissions])
  const create = async () => {
    const values = await form.validateFields(); setSaving(true)
    try { await securityApi.createRole(values.name, values.permissionIds); void list.reload(); setOpen(false); form.resetFields(); message.success(t('admin.roles.created')) }
    catch (reason) { if (reason instanceof Error) message.error(reason.message) } finally { setSaving(false) }
  }
  const typeLabel = (system: boolean) => system ? t('admin.roles.default') : t('admin.roles.custom')
  const columns: ColumnsType<Role> = [
    { title: t('admin.common.role'), dataIndex: 'name', sorter: true, sortOrder: sortField === 'name' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: (_, role) => <div className="primary-cell"><strong>{role.name}</strong><small>#{role.serialNo} · {role.code}</small></div> },
    { title: t('common.type'), dataIndex: 'isSystemRole', width: 120, sorter: true, sortOrder: sortField === 'isSystemRole' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, filters: [{ text: t('admin.roles.default'), value: true }, { text: t('admin.roles.custom'), value: false }], filteredValue: type === undefined ? null : [type], render: value => <Tag color={value ? 'blue' : 'purple'}>{typeLabel(value)}</Tag> },
    { title: t('admin.roles.permissions'), key: 'permissions', render: (_, role) => <Space size={[4, 4]} wrap>{role.permissions.slice(0, 6).map(permission => <Tag key={permission}>{permission}</Tag>)}{role.permissions.length > 6 && <Tag>+{role.permissions.length - 6}</Tag>}</Space> },
  ]
  const tableChange: TableProps<Role>['onChange'] = (_, filters, sorter) => { const selected = Array.isArray(sorter) ? sorter[0] : sorter; if (selected?.field && selected.order) { setSortField(selected.field as keyof Role); setSortDirection(selected.order === 'ascend' ? 'asc' : 'desc') }; const roleType = filters.isSystemRole?.[0]; setType(typeof roleType === 'boolean' ? roleType : undefined) }
  return <>
    <PageHeader onRefresh={load} eyebrow={t('admin.common.accessControl')} title={t('admin.roles.title')} description={t('admin.roles.description')} action={t('admin.roles.create')} onAction={() => setOpen(true)} filters={<AdvancedSearch value={query} onChange={setQuery} placeholder={t('admin.roles.searchPlaceholder')} active={type !== undefined || sortField !== 'serialNo' || sortDirection !== 'desc'} sortField={String(sortField)} onSortField={value => setSortField(value as keyof Role)} sortDirection={sortDirection} onSortDirection={setSortDirection} sortOptions={[{ value: 'serialNo', label: t('shell.search.createdSequence') }, { value: 'name', label: t('admin.roles.roleName') }, { value: 'code', label: t('admin.roles.roleCode') }, { value: 'isSystemRole', label: t('admin.roles.roleType') }]} onReset={() => { setQuery(''); setType(undefined); setSortField('serialNo'); setSortDirection('desc') }}><Select showSearch optionFilterProp="label" allowClear placeholder={t('admin.roles.roleType')} value={type} onChange={setType} options={[{ value: true, label: t('admin.roles.defaultRole') }, { value: false, label: t('admin.roles.customRole') }]} /></AdvancedSearch>} />
    <Card className="grid-card" title={t('admin.roles.roles')} extra={t('admin.roles.roleCount', { count: list.total })}><ResponsiveDataView rowKey="id" columns={columns} data={list.rows} onScroll={list.onScroll} onChange={tableChange} hasMore={list.hasMore} total={list.total} loading={list.loading} label={t('admin.roles.rolesLabel')} scrollX={760} renderTile={role => <><div className="tile-heading"><div className="primary-cell"><strong>{role.name}</strong><small>#{role.serialNo} · {role.code}</small></div><Tag color={role.isSystemRole ? 'blue' : 'purple'}>{typeLabel(role.isSystemRole)}</Tag></div><div className="tile-tags">{role.permissions.slice(0, 5).map(permission => <Tag key={permission}>{permission}</Tag>)}{role.permissions.length > 5 && <Tag>+{role.permissions.length - 5}</Tag>}</div></>} /></Card>
    <Modal centered width={760} title={t('admin.roles.createTitle')} open={open} onCancel={() => setOpen(false)} onOk={create} confirmLoading={saving} okText={t('admin.roles.create')} cancelText={t('common.cancel')} destroyOnHidden><Form form={form} layout="vertical" initialValues={{ permissionIds: [] }}><Form.Item label={t('admin.roles.roleName')} name="name" rules={[{ required: true, min: 2 }]}><Input placeholder={t('admin.roles.roleNamePlaceholder')} /></Form.Item><Typography.Title level={5}>{t('admin.roles.permissions')}</Typography.Title><Form.Item name="permissionIds" rules={[{ required: true, message: t('admin.roles.selectPermission') }]}><Checkbox.Group className="permission-checkboxes">{Object.entries(groups).map(([module, rows]) => <Card size="small" title={module} key={module}>{rows.map(permission => <Checkbox value={permission.id} key={permission.id}><span>{permission.name}<small>{permission.code}</small></span></Checkbox>)}</Card>)}</Checkbox.Group></Form.Item></Form></Modal>
  </>
}
