import { useEffect, useState } from 'react'
import { Alert, Button, Drawer, Empty, Form, Input, Popconfirm, Select, Space, Spin, Tag, message } from 'antd'
import { PlusOutlined, UserOutlined } from '@ant-design/icons'
import { tenantsApi } from '../api'
import type { CompanyOption, Role, Tenant, User } from '../types'
import { formatDateTime, useT } from '../i18n'

const ALL_COMPANIES = '__all__'

/**
 * The users of one tenant, managed by the system administrator from the platform. A new user here has no employee
 * link; the tenant can link one later on its own Users page.
 */
export function TenantUsersDrawer({ tenant, onClose }: { tenant: Tenant | null; onClose: () => void }) {
  const { t } = useT()
  const when = (v: string | null) => v ? formatDateTime(v) : t('admin.common.never')
  const [users, setUsers] = useState<User[]>(), [roles, setRoles] = useState<Role[]>([]), [adding, setAdding] = useState(false), [saving, setSaving] = useState(false)
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [form] = Form.useForm<{ fullName: string; email: string; password: string; roleId: string; companyId: string }>()
  const load = (id: string) => Promise.all([tenantsApi.users(id), tenantsApi.roles(id), tenantsApi.companies(id)]).then(([u, r, c]) => { setUsers(u); setRoles(r); setCompanies(c) }).catch(e => message.error(e instanceof Error ? e.message : t('admin.tenantUsers.loadFailed')))
  useEffect(() => { setUsers(undefined); setAdding(false); if (tenant) void load(tenant.id) }, [tenant?.id])
  const openAdd = () => { form.resetFields(); form.setFieldsValue({ roleId: roles.find(r => r.code === 'TENANT_ADMIN')?.id, companyId: ALL_COMPANIES }); setAdding(true) }
  const add = async () => {
    if (!tenant) return
    const v = await form.validateFields(); setSaving(true)
    try { await tenantsApi.createUser(tenant.id, { ...v, companyId: v.companyId === ALL_COMPANIES ? null : v.companyId }); message.success(t('admin.tenantUsers.canSignIn', { name: v.fullName })); setAdding(false); await load(tenant.id) }
    catch (e) { message.error(e instanceof Error ? e.message : t('admin.tenantUsers.createFailed')) } finally { setSaving(false) }
  }
  const toggle = async (u: User) => {
    if (!tenant) return
    try { const saved = await tenantsApi.setUserStatus(tenant.id, u.id, !u.isActive); setUsers(all => all?.map(x => x.id === saved.id ? saved : x)) }
    catch (e) { message.error(e instanceof Error ? e.message : t('admin.tenantUsers.updateFailed')) }
  }

  return <Drawer open={Boolean(tenant)} onClose={onClose} size={520} title={tenant ? t('admin.tenantUsers.title', { tenant: tenant.name }) : ''} extra={!adding && <Button type="primary" icon={<PlusOutlined />} disabled={!users} onClick={openAdd}>{t('admin.users.add')}</Button>} destroyOnHidden>
    {adding && <div className="tenant-user-form">
      <h4>{t('admin.tenantUsers.newUser')}</h4>
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item label={t('admin.common.fullName')} name="fullName" rules={[{ required: true, whitespace: true, min: 2, max: 160 }]}><Input autoComplete="off" /></Form.Item>
        <Form.Item label={t('admin.common.signInEmail')} name="email" rules={[{ required: true }, { type: 'email' }]}><Input autoComplete="off" /></Form.Item>
        <Form.Item label={t('admin.common.temporaryPassword')} name="password" extra={t('admin.tenantUsers.passwordHint')} rules={[{ required: true }, { min: 10, message: t('admin.common.passwordMin') }]}><Input.Password autoComplete="new-password" /></Form.Item>
        <Form.Item label={t('admin.common.role')} name="roleId" rules={[{ required: true, message: t('admin.tenantUsers.chooseRole') }]}><Select options={roles.map(r => ({ value: r.id, label: r.name }))} /></Form.Item>
        {companies.length > 1 && <Form.Item label={t('common.company')} name="companyId" extra={t('admin.tenantUsers.companyHint')}><Select options={[{ value: ALL_COMPANIES, label: t('admin.tenantUsers.allCompaniesOption') }, ...companies.map(c => ({ value: c.id, label: c.name }))]} /></Form.Item>}
      </Form>
      <Space><Button onClick={() => setAdding(false)}>{t('common.cancel')}</Button><Button type="primary" loading={saving} onClick={() => void add()}>{t('admin.users.create')}</Button></Space>
    </div>}
    {!users ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      : !users.length ? <Empty description={t('admin.tenantUsers.empty')}><Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>{t('admin.tenantUsers.addFirstAdmin')}</Button></Empty>
      : <>
        {!users.some(u => u.isActive && u.roles.some(r => r.code === 'TENANT_ADMIN')) && <Alert style={{ marginBottom: 12 }} type="warning" showIcon title={t('admin.tenantUsers.noAdminTitle')} description={t('admin.tenantUsers.noAdminText')} />}
        <ul className="tenant-user-list">{users.map(u => <li key={u.id} className={u.isActive ? '' : 'is-inactive'}>
          <span className="tenant-user-avatar"><UserOutlined /></span>
          <div><strong>{u.fullName}</strong><small>{u.email}</small><small>{t('admin.tenantUsers.lastSignIn', { when: when(u.lastLoginAtUtc) })}{u.employeeName ? ' · ' + u.employeeName : ''} · {u.companyName ?? t('admin.common.allCompanies')}</small>
            <div>{u.roles.map(r => <Tag key={r.id} color={r.code === 'TENANT_ADMIN' ? 'green' : undefined}>{r.name}</Tag>)}{!u.isActive && <Tag>{t('common.inactive')}</Tag>}</div></div>
          <Popconfirm title={u.isActive ? t('admin.tenantUsers.deactivateConfirm', { name: u.fullName }) : t('admin.tenantUsers.activateConfirm', { name: u.fullName })} description={u.isActive ? t('admin.tenantUsers.deactivateHint') : undefined} onConfirm={() => void toggle(u)}><Button size="small" danger={u.isActive}>{u.isActive ? t('common.deactivate') : t('common.activate')}</Button></Popconfirm>
        </li>)}</ul>
      </>}
  </Drawer>
}
