import { RowActions } from '../components/RowActions'
import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Col, Divider, Form, Input, Modal, Popconfirm, Row, Select, Space, Statistic, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { TableProps } from 'antd'
import { EditOutlined, LoginOutlined, TeamOutlined } from '@ant-design/icons'
import { TenantUsersDrawer } from '../components/TenantUsersDrawer'
import { tenantsApi } from '../api'
import type { Tenant, TenantInput } from '../types'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { ResponsiveDataView } from '../components/ResponsiveDataView'
import { useInfiniteRows } from '../hooks/useInfiniteRows'
import { sortRecords, type SortDirection } from '../utils/sortRecords'

/** Register form; the administrator fields create the tenant's first user (optional, new tenants only). */
type TenantForm = Omit<TenantInput, 'slug'> & { adminName?: string; adminEmail?: string; adminPassword?: string }

export function TenantsPage({ onSelect }: { onSelect: (tenant: Tenant) => void }) {
  const [items, setItems] = useState<Tenant[]>([])
  const [query, setQuery] = useState(''), [status, setStatus] = useState<boolean | undefined>()
  const [sortField, setSortField] = useState<keyof Tenant>('serialNo'), [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<Tenant | null>(null), [saving, setSaving] = useState(false), [usersFor, setUsersFor] = useState<Tenant | null>(null)
  const [form] = Form.useForm<TenantForm>()
  const load = () => tenantsApi.list().then(setItems).catch(error => message.error(error.message))
  useEffect(() => { void load() }, [])
  const filtered = useMemo(() => sortRecords(items.filter(item => {
    const text = `${item.name} ${item.contactEmail ?? ''} ${item.phone ?? ''} ${item.address ?? ''}`.toLowerCase()
    return text.includes(query.toLowerCase()) && (status === undefined || item.isActive === status)
  }), sortField, sortDirection), [items, query, status, sortField, sortDirection])
  const resetKey = `${query}|${String(status)}|${String(sortField)}|${sortDirection}`
  const { visibleRows, onScroll, hasMore } = useInfiniteRows(filtered, resetKey)
  const showForm = (item?: Tenant) => {
    setEditing(item ?? null)
    form.setFieldsValue(item ? { name: item.name, contactEmail: item.contactEmail ?? '', phone: item.phone ?? '', address: item.address ?? '' } : { name: '', contactEmail: '', phone: '', address: '', adminName: '', adminEmail: '', adminPassword: '' })
    setOpen(true)
  }
  const save = async () => {
    const { adminName, adminEmail, adminPassword, ...values } = await form.validateFields(); setSaving(true)
    try {
      const slug = editing?.slug ?? `${values.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${crypto.randomUUID().slice(0, 6)}`
      const saved = editing ? await tenantsApi.update(editing.id, { ...values, slug }) : await tenantsApi.create({ ...values, slug })
      setItems(current => [saved, ...current.filter(x => x.id !== saved.id)].sort((a, b) => b.serialNo - a.serialNo)); setOpen(false)
      if (!editing && adminEmail) {
        try {
          const role = (await tenantsApi.roles(saved.id)).find(r => r.code === 'TENANT_ADMIN')
          if (!role) throw new Error('The tenant administrator role was not found.')
          await tenantsApi.createUser(saved.id, { fullName: adminName ?? '', email: adminEmail, password: adminPassword ?? '', roleId: role.id })
          message.success(`Tenant registered. ${adminEmail} can sign in as its administrator.`)
        } catch (reason) { message.warning(`Tenant registered, but the administrator was not created: ${reason instanceof Error ? reason.message : 'unknown error'}. Add it from Users.`); setUsersFor(saved) }
      } else message.success(`Tenant ${editing ? 'updated' : 'registered'}`)
    } catch (reason) { if (reason instanceof Error) message.error(reason.message) } finally { setSaving(false) }
  }
  const columns: ColumnsType<Tenant> = [
    { title: 'Company', dataIndex: 'name', sorter: true, sortOrder: sortField === 'name' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: (_, item) => <div className="primary-cell"><strong>{item.name}</strong><small>#{item.serialNo} · {item.address || 'No address'}</small></div> },
    { title: 'Contact', dataIndex: 'contactEmail', sorter: true, sortOrder: sortField === 'contactEmail' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: (_, item) => <div className="primary-cell"><span>{item.contactEmail || '—'}</span><small>{item.phone || 'No phone'}</small></div> },
    { title: 'Status', dataIndex: 'isActive', width: 110, filters: [{ text: 'Active', value: true }, { text: 'Inactive', value: false }], filteredValue: status === undefined ? null : [status], sorter: true, sortOrder: sortField === 'isActive' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: value => <StatusTag active={value} /> },
    { title: 'Actions', key: 'actions', width: 330, align: 'right', render: (_, item) => <RowActions><Space><Button size="small" icon={<EditOutlined />} onClick={() => showForm(item)}>Edit</Button><Button size="small" icon={<TeamOutlined />} onClick={() => setUsersFor(item)}>Users</Button><Popconfirm title={`${item.isActive ? 'Deactivate' : 'Activate'} this tenant?`} onConfirm={async () => { const saved = await tenantsApi.setStatus(item.id, !item.isActive); setItems(all => all.map(x => x.id === saved.id ? saved : x)) }}><Button size="small">{item.isActive ? 'Deactivate' : 'Activate'}</Button></Popconfirm>{item.isActive && <Button size="small" type="primary" icon={<LoginOutlined />} onClick={() => onSelect(item)}>Open</Button>}</Space></RowActions> },
  ]
  const tableChange: TableProps<Tenant>['onChange'] = (_, filters, sorter) => {
    const selected = Array.isArray(sorter) ? sorter[0] : sorter
    if (selected?.field && selected.order) { setSortField(selected.field as keyof Tenant); setSortDirection(selected.order === 'ascend' ? 'asc' : 'desc') }
    const statusFilter = filters.isActive?.[0]; setStatus(typeof statusFilter === 'boolean' ? statusFilter : undefined)
  }
  return <>
    <PageHeader onRefresh={load} eyebrow="PLATFORM" title="Tenant workspace" description="Manage companies and enter a tenant workspace for investigation." action="Register tenant" onAction={() => showForm()} filters={<AdvancedSearch value={query} onChange={setQuery} placeholder="Search company, contact or address" active={status !== undefined || sortField !== 'serialNo' || sortDirection !== 'desc'} sortField={String(sortField)} onSortField={value => setSortField(value as keyof Tenant)} sortDirection={sortDirection} onSortDirection={setSortDirection} sortOptions={[{ value: 'serialNo', label: 'Created sequence' }, { value: 'name', label: 'Company name' }, { value: 'contactEmail', label: 'Email' }, { value: 'isActive', label: 'Status' }]} onReset={() => { setQuery(''); setStatus(undefined); setSortField('serialNo'); setSortDirection('desc') }}><Select showSearch optionFilterProp="label" allowClear placeholder="Status" value={status} onChange={setStatus} options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} /></AdvancedSearch>} />
    <Row gutter={[16, 16]} className="stats-row"><Col xs={24} sm={8}><Card><Statistic title="Total tenants" value={items.length} /></Card></Col><Col xs={12} sm={8}><Card><Statistic title="Active" value={items.filter(x => x.isActive).length} /></Card></Col><Col xs={12} sm={8}><Card><Statistic title="Inactive" value={items.filter(x => !x.isActive).length} /></Card></Col></Row>
    <Card className="grid-card" title="Companies" extra={`${filtered.length} records`}><ResponsiveDataView rowKey="id" columns={columns} data={visibleRows} onScroll={onScroll} onChange={tableChange} hasMore={hasMore} total={filtered.length} label="records" scrollX={850} renderTile={item => <><div className="tile-heading"><div className="primary-cell"><strong>{item.name}</strong><small>#{item.serialNo}</small></div><StatusTag active={item.isActive} /></div><div className="tile-details"><span>{item.contactEmail || 'No email'}</span><span>{item.phone || 'No phone'}</span><span>{item.address || 'No address'}</span></div><RowActions><Space wrap className="tile-actions"><Button size="small" icon={<EditOutlined />} onClick={() => showForm(item)}>Edit</Button><Button size="small" icon={<TeamOutlined />} onClick={() => setUsersFor(item)}>Users</Button><Popconfirm title={`${item.isActive ? 'Deactivate' : 'Activate'} this tenant?`} onConfirm={async () => { const saved = await tenantsApi.setStatus(item.id, !item.isActive); setItems(all => all.map(x => x.id === saved.id ? saved : x)) }}><Button size="small">{item.isActive ? 'Deactivate' : 'Activate'}</Button></Popconfirm>{item.isActive && <Button size="small" type="primary" onClick={() => onSelect(item)}>Open</Button>}</Space></RowActions></>} /></Card>
    <Modal centered title={editing ? 'Edit tenant' : 'Register tenant'} open={open} onCancel={() => setOpen(false)} onOk={save} confirmLoading={saving} okText={editing ? 'Save changes' : 'Register tenant'} destroyOnHidden><Form form={form} layout="vertical" requiredMark="optional"><Form.Item label="Company name" name="name" rules={[{ required: true, min: 2, max: 160 }]}><Input /></Form.Item><Form.Item label="Email" name="contactEmail" rules={[{ type: 'email' }]}><Input /></Form.Item><Form.Item label="Phone" name="phone"><Input /></Form.Item><Form.Item label="Office address" name="address"><Input.TextArea rows={3} /></Form.Item>
      {!editing && <><Divider titlePlacement="start" plain>First administrator (optional)</Divider>
        <p className="tenant-admin-hint">Creates the company's first user, who signs in with this email and manages the tenant. You can also add users later from <strong>Users</strong>.</p>
        <Form.Item label="Full name" name="adminName" dependencies={['adminEmail']} rules={[({ getFieldValue }) => ({ validator: (_, v) => !getFieldValue('adminEmail') || (v && v.trim().length >= 2) ? Promise.resolve() : Promise.reject(new Error('Enter the administrator name')) })]}><Input autoComplete="off" /></Form.Item>
        <Form.Item label="Email (sign-in)" name="adminEmail" rules={[{ type: 'email' }]}><Input autoComplete="off" /></Form.Item>
        <Form.Item label="Temporary password" name="adminPassword" dependencies={['adminEmail']} extra="At least 10 characters." rules={[({ getFieldValue }) => ({ validator: (_, v) => !getFieldValue('adminEmail') || (v && v.length >= 10) ? Promise.resolve() : Promise.reject(new Error('Use at least 10 characters')) })]}><Input.Password autoComplete="new-password" /></Form.Item></>}
    </Form></Modal>
    <TenantUsersDrawer tenant={usersFor} onClose={() => setUsersFor(null)} />
  </>
}

