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
import { useT } from '../i18n'

/** Register form; the administrator fields create the tenant's first user (optional, new tenants only). */
type TenantForm = Omit<TenantInput, 'slug'> & { adminName?: string; adminEmail?: string; adminPassword?: string }

export function TenantsPage({ onSelect }: { onSelect: (tenant: Tenant) => void }) {
  const { t } = useT()
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
          if (!role) throw new Error(t('admin.tenants.adminRoleMissing'))
          await tenantsApi.createUser(saved.id, { fullName: adminName ?? '', email: adminEmail, password: adminPassword ?? '', roleId: role.id })
          message.success(t('admin.tenants.registeredWithAdmin', { email: adminEmail }))
        } catch (reason) { message.warning(t('admin.tenants.adminNotCreated', { reason: reason instanceof Error ? reason.message : t('common.unknown') })); setUsersFor(saved) }
      } else message.success(editing ? t('admin.tenants.updated') : t('admin.tenants.registered'))
    } catch (reason) { if (reason instanceof Error) message.error(reason.message) } finally { setSaving(false) }
  }
  const statusButton = (item: Tenant) => <Popconfirm title={item.isActive ? t('admin.tenants.deactivateConfirm') : t('admin.tenants.activateConfirm')} onConfirm={async () => { const saved = await tenantsApi.setStatus(item.id, !item.isActive); setItems(all => all.map(x => x.id === saved.id ? saved : x)) }}><Button size="small">{item.isActive ? t('common.deactivate') : t('common.activate')}</Button></Popconfirm>
  const columns: ColumnsType<Tenant> = [
    { title: t('common.company'), dataIndex: 'name', sorter: true, sortOrder: sortField === 'name' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: (_, item) => <div className="primary-cell"><strong>{item.name}</strong><small>#{item.serialNo} · {item.address || t('admin.common.noAddress')}</small></div> },
    { title: t('admin.tenants.contact'), dataIndex: 'contactEmail', sorter: true, sortOrder: sortField === 'contactEmail' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: (_, item) => <div className="primary-cell"><span>{item.contactEmail || '—'}</span><small>{item.phone || t('admin.common.noPhone')}</small></div> },
    { title: t('common.status'), dataIndex: 'isActive', width: 110, filters: [{ text: t('common.active'), value: true }, { text: t('common.inactive'), value: false }], filteredValue: status === undefined ? null : [status], sorter: true, sortOrder: sortField === 'isActive' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: value => <StatusTag active={value} /> },
    { title: t('common.actions'), key: 'actions', width: 330, align: 'right', render: (_, item) => <RowActions><Space><Button size="small" icon={<EditOutlined />} onClick={() => showForm(item)}>{t('common.edit')}</Button><Button size="small" icon={<TeamOutlined />} onClick={() => setUsersFor(item)}>{t('admin.tenants.users')}</Button>{statusButton(item)}{item.isActive && <Button size="small" type="primary" icon={<LoginOutlined />} onClick={() => onSelect(item)}>{t('common.open')}</Button>}</Space></RowActions> },
  ]
  const tableChange: TableProps<Tenant>['onChange'] = (_, filters, sorter) => {
    const selected = Array.isArray(sorter) ? sorter[0] : sorter
    if (selected?.field && selected.order) { setSortField(selected.field as keyof Tenant); setSortDirection(selected.order === 'ascend' ? 'asc' : 'desc') }
    const statusFilter = filters.isActive?.[0]; setStatus(typeof statusFilter === 'boolean' ? statusFilter : undefined)
  }
  return <>
    <PageHeader onRefresh={load} eyebrow={t('admin.tenants.eyebrow')} title={t('admin.tenants.title')} description={t('admin.tenants.description')} action={t('admin.tenants.register')} onAction={() => showForm()} filters={<AdvancedSearch value={query} onChange={setQuery} placeholder={t('admin.tenants.searchPlaceholder')} active={status !== undefined || sortField !== 'serialNo' || sortDirection !== 'desc'} sortField={String(sortField)} onSortField={value => setSortField(value as keyof Tenant)} sortDirection={sortDirection} onSortDirection={setSortDirection} sortOptions={[{ value: 'serialNo', label: t('shell.search.createdSequence') }, { value: 'name', label: t('admin.tenants.companyName') }, { value: 'contactEmail', label: t('common.email') }, { value: 'isActive', label: t('common.status') }]} onReset={() => { setQuery(''); setStatus(undefined); setSortField('serialNo'); setSortDirection('desc') }}><Select showSearch optionFilterProp="label" allowClear placeholder={t('common.status')} value={status} onChange={setStatus} options={[{ value: true, label: t('common.active') }, { value: false, label: t('common.inactive') }]} /></AdvancedSearch>} />
    <Row gutter={[16, 16]} className="stats-row"><Col xs={24} sm={8}><Card><Statistic title={t('admin.tenants.total')} value={items.length} /></Card></Col><Col xs={12} sm={8}><Card><Statistic title={t('common.active')} value={items.filter(x => x.isActive).length} /></Card></Col><Col xs={12} sm={8}><Card><Statistic title={t('common.inactive')} value={items.filter(x => !x.isActive).length} /></Card></Col></Row>
    <Card className="grid-card" title={t('admin.tenants.companies')} extra={t('admin.common.recordCount', { count: filtered.length })}><ResponsiveDataView rowKey="id" columns={columns} data={visibleRows} onScroll={onScroll} onChange={tableChange} hasMore={hasMore} total={filtered.length} label={t('admin.common.records')} scrollX={850} renderTile={item => <><div className="tile-heading"><div className="primary-cell"><strong>{item.name}</strong><small>#{item.serialNo}</small></div><StatusTag active={item.isActive} /></div><div className="tile-details"><span>{item.contactEmail || t('admin.common.noEmail')}</span><span>{item.phone || t('admin.common.noPhone')}</span><span>{item.address || t('admin.common.noAddress')}</span></div><RowActions><Space wrap className="tile-actions"><Button size="small" icon={<EditOutlined />} onClick={() => showForm(item)}>{t('common.edit')}</Button><Button size="small" icon={<TeamOutlined />} onClick={() => setUsersFor(item)}>{t('admin.tenants.users')}</Button>{statusButton(item)}{item.isActive && <Button size="small" type="primary" onClick={() => onSelect(item)}>{t('common.open')}</Button>}</Space></RowActions></>} /></Card>
    <Modal centered title={editing ? t('admin.tenants.editTitle') : t('admin.tenants.register')} open={open} onCancel={() => setOpen(false)} onOk={save} confirmLoading={saving} okText={editing ? t('admin.common.saveChanges') : t('admin.tenants.register')} cancelText={t('common.cancel')} destroyOnHidden><Form form={form} layout="vertical" requiredMark="optional"><Form.Item label={t('admin.tenants.companyName')} name="name" rules={[{ required: true, min: 2, max: 160 }]}><Input /></Form.Item><Form.Item label={t('common.email')} name="contactEmail" rules={[{ type: 'email' }]}><Input /></Form.Item><Form.Item label={t('common.phone')} name="phone"><Input /></Form.Item><Form.Item label={t('admin.tenants.officeAddress')} name="address"><Input.TextArea rows={3} /></Form.Item>
      {!editing && <><Divider titlePlacement="start" plain>{t('admin.tenants.firstAdmin')}</Divider>
        <p className="tenant-admin-hint">{t('admin.tenants.firstAdminHint')}</p>
        <Form.Item label={t('admin.common.fullName')} name="adminName" dependencies={['adminEmail']} rules={[({ getFieldValue }) => ({ validator: (_, v) => !getFieldValue('adminEmail') || (v && v.trim().length >= 2) ? Promise.resolve() : Promise.reject(new Error(t('admin.tenants.adminNameRequired'))) })]}><Input autoComplete="off" /></Form.Item>
        <Form.Item label={t('admin.common.signInEmail')} name="adminEmail" rules={[{ type: 'email' }]}><Input autoComplete="off" /></Form.Item>
        <Form.Item label={t('admin.common.temporaryPassword')} name="adminPassword" dependencies={['adminEmail']} extra={t('admin.common.passwordHint')} rules={[({ getFieldValue }) => ({ validator: (_, v) => !getFieldValue('adminEmail') || (v && v.length >= 10) ? Promise.resolve() : Promise.reject(new Error(t('admin.common.passwordMin'))) })]}><Input.Password autoComplete="new-password" /></Form.Item></>}
    </Form></Modal>
    <TenantUsersDrawer tenant={usersFor} onClose={() => setUsersFor(null)} />
  </>
}
