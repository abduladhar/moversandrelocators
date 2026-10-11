import { useEffect, useState } from 'react'
import { Alert, Button, Drawer, Empty, Form, Input, Popconfirm, Select, Space, Spin, Tag, message } from 'antd'
import { PlusOutlined, UserOutlined } from '@ant-design/icons'
import { tenantsApi } from '../api'
import type { CompanyOption, Role, Tenant, User } from '../types'

const ALL_COMPANIES = '__all__'

const when = (v: string | null) => v ? new Date(v).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'

/**
 * The users of one tenant, managed by the system administrator from the platform. A new user here has no employee
 * link; the tenant can link one later on its own Users page.
 */
export function TenantUsersDrawer({ tenant, onClose }: { tenant: Tenant | null; onClose: () => void }) {
  const [users, setUsers] = useState<User[]>(), [roles, setRoles] = useState<Role[]>([]), [adding, setAdding] = useState(false), [saving, setSaving] = useState(false)
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [form] = Form.useForm<{ fullName: string; email: string; password: string; roleId: string; companyId: string }>()
  const load = (id: string) => Promise.all([tenantsApi.users(id), tenantsApi.roles(id), tenantsApi.companies(id)]).then(([u, r, c]) => { setUsers(u); setRoles(r); setCompanies(c) }).catch(e => message.error(e instanceof Error ? e.message : 'Unable to load users'))
  useEffect(() => { setUsers(undefined); setAdding(false); if (tenant) void load(tenant.id) }, [tenant?.id])
  const openAdd = () => { form.resetFields(); form.setFieldsValue({ roleId: roles.find(r => r.code === 'TENANT_ADMIN')?.id, companyId: ALL_COMPANIES }); setAdding(true) }
  const add = async () => {
    if (!tenant) return
    const v = await form.validateFields(); setSaving(true)
    try { await tenantsApi.createUser(tenant.id, { ...v, companyId: v.companyId === ALL_COMPANIES ? null : v.companyId }); message.success(v.fullName + ' can now sign in'); setAdding(false); await load(tenant.id) }
    catch (e) { message.error(e instanceof Error ? e.message : 'Unable to create the user') } finally { setSaving(false) }
  }
  const toggle = async (u: User) => {
    if (!tenant) return
    try { const saved = await tenantsApi.setUserStatus(tenant.id, u.id, !u.isActive); setUsers(all => all?.map(x => x.id === saved.id ? saved : x)) }
    catch (e) { message.error(e instanceof Error ? e.message : 'Unable to update the user') }
  }

  return <Drawer open={Boolean(tenant)} onClose={onClose} size={520} title={tenant ? 'Users · ' + tenant.name : ''} extra={!adding && <Button type="primary" icon={<PlusOutlined />} disabled={!users} onClick={openAdd}>Add user</Button>} destroyOnHidden>
    {adding && <div className="tenant-user-form">
      <h4>New user</h4>
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item label="Full name" name="fullName" rules={[{ required: true, whitespace: true, min: 2, max: 160 }]}><Input autoComplete="off" /></Form.Item>
        <Form.Item label="Email (sign-in)" name="email" rules={[{ required: true }, { type: 'email' }]}><Input autoComplete="off" /></Form.Item>
        <Form.Item label="Temporary password" name="password" extra="At least 10 characters. Share it securely; the user should change it." rules={[{ required: true }, { min: 10, message: 'Use at least 10 characters' }]}><Input.Password autoComplete="new-password" /></Form.Item>
        <Form.Item label="Role" name="roleId" rules={[{ required: true, message: 'Choose a role' }]}><Select options={roles.map(r => ({ value: r.id, label: r.name }))} /></Form.Item>
        {companies.length > 1 && <Form.Item label="Company" name="companyId" extra="All companies: a tenant user who switches between companies (usual for the first administrator)."><Select options={[{ value: ALL_COMPANIES, label: 'All companies (tenant user)' }, ...companies.map(c => ({ value: c.id, label: c.name }))]} /></Form.Item>}
      </Form>
      <Space><Button onClick={() => setAdding(false)}>Cancel</Button><Button type="primary" loading={saving} onClick={() => void add()}>Create user</Button></Space>
    </div>}
    {!users ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      : !users.length ? <Empty description="This tenant has no users yet"><Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add the first administrator</Button></Empty>
      : <>
        {!users.some(u => u.isActive && u.roles.some(r => r.code === 'TENANT_ADMIN')) && <Alert style={{ marginBottom: 12 }} type="warning" showIcon title="No active tenant administrator" description="Add one so the company can manage its own users and settings." />}
        <ul className="tenant-user-list">{users.map(u => <li key={u.id} className={u.isActive ? '' : 'is-inactive'}>
          <span className="tenant-user-avatar"><UserOutlined /></span>
          <div><strong>{u.fullName}</strong><small>{u.email}</small><small>Last sign-in: {when(u.lastLoginAtUtc)}{u.employeeName ? ' · ' + u.employeeName : ''} · {u.companyName ?? 'All companies'}</small>
            <div>{u.roles.map(r => <Tag key={r.id} color={r.code === 'TENANT_ADMIN' ? 'green' : undefined}>{r.name}</Tag>)}{!u.isActive && <Tag>Inactive</Tag>}</div></div>
          <Popconfirm title={(u.isActive ? 'Deactivate ' : 'Activate ') + u.fullName + '?'} description={u.isActive ? 'They will no longer be able to sign in.' : undefined} onConfirm={() => void toggle(u)}><Button size="small" danger={u.isActive}>{u.isActive ? 'Deactivate' : 'Activate'}</Button></Popconfirm>
        </li>)}</ul>
      </>}
  </Drawer>
}
