import { useEffect, useMemo, useState } from 'react'
import { Avatar, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Tag, message } from 'antd'
import { ClusterOutlined, LinkOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { TableProps } from 'antd'
import { companiesApi, employeesApi, securityApi } from '../api'
import type { Company, Employee, Role, User } from '../types'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { ResponsiveDataView } from '../components/ResponsiveDataView'
import { useInfiniteRows } from '../hooks/useInfiniteRows'
import { sortRecords, type SortDirection } from '../utils/sortRecords'

type UserForm = { fullName: string; email: string; password: string; roleId: string; employeeId: string; companyId?: string }
/** Select value for "tenant user": no company, can switch between all companies. */
const ALL_COMPANIES = '__all__'

/** tenantWide: the signed-in user can switch companies, so they can assign users to any company (company users manage only their own). */
export function UsersPage({ tenantWide = false }: { tenantWide?: boolean }) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [moving, setMoving] = useState<User | null>(null), [moveSaving, setMoveSaving] = useState(false)
  const [moveForm] = Form.useForm<{ companyId: string }>()
  const companyOptions = [{ value: ALL_COMPANIES, label: 'All companies (tenant user, can switch)' }, ...companies.filter(x => x.isActive).map(x => ({ value: x.id, label: x.name }))]
  const [users, setUsers] = useState<User[]>([]), [roles, setRoles] = useState<Role[]>([]), [employees, setEmployees] = useState<Employee[]>([])
  const [query, setQuery] = useState(''), [status, setStatus] = useState<boolean | undefined>(), [roleId, setRoleId] = useState<string>()
  const [sortField, setSortField] = useState<keyof User>('serialNo'), [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [open, setOpen] = useState(false), [saving, setSaving] = useState(false)
  const [linking, setLinking] = useState<User | null>(null), [linkSaving, setLinkSaving] = useState(false)
  const [form] = Form.useForm<UserForm>()
  const [linkForm] = Form.useForm<{ employeeId: string }>()
  const load = () => Promise.all([securityApi.users(), securityApi.roles(), employeesApi.employees(), tenantWide ? companiesApi.list() : Promise.resolve([] as Company[])]).then(([userRows, roleRows, employeeRows, companyRows]) => { setUsers(userRows); setRoles(roleRows); setEmployees(employeeRows); setCompanies(companyRows) }).catch(error => message.error(error.message))
  const showCompany = (user: User) => { setMoving(user); moveForm.setFieldsValue({ companyId: user.companyId ?? ALL_COMPANIES }) }
  const saveCompany = async () => {
    if (!moving) return
    const { companyId } = await moveForm.validateFields(); setMoveSaving(true)
    try { const saved = await securityApi.setUserCompany(moving.id, companyId === ALL_COMPANIES ? null : companyId); setUsers(all => all.map(user => user.id === saved.id ? saved : user)); setMoving(null); message.success('Company access saved. It applies to the user\'s next request.') }
    catch (reason) { message.error(reason instanceof Error ? reason.message : 'Unable to change the company') }
    finally { setMoveSaving(false) }
  }
  const companyLabel = (user: User) => user.companyName ?? (user.companyId ? 'Company' : 'All companies')
  useEffect(() => { void load() }, [])
  const filtered = useMemo(() => sortRecords(users.filter(user => `${user.fullName} ${user.email}`.toLowerCase().includes(query.toLowerCase()) && (status === undefined || user.isActive === status) && (!roleId || user.roles.some(role => role.id === roleId))), sortField, sortDirection), [users, query, status, roleId, sortField, sortDirection])
  const { visibleRows, onScroll, hasMore } = useInfiniteRows(filtered, `${query}|${status}|${roleId}|${String(sortField)}|${sortDirection}`)
  const create = async () => {
    const values = await form.validateFields(); setSaving(true)
    try { const saved = await securityApi.createUser({ ...values, companyId: !values.companyId || values.companyId === ALL_COMPANIES ? null : values.companyId }); setUsers(current => [saved, ...current]); setOpen(false); form.resetFields(); message.success('User created') }
    catch (reason) { if (reason instanceof Error) message.error(reason.message) } finally { setSaving(false) }
  }
  const showEmployeeLink = (user: User) => { setLinking(user); linkForm.setFieldsValue({ employeeId: user.employeeId ?? '' }) }
  const saveEmployeeLink = async () => {
    if (!linking) return
    const { employeeId } = await linkForm.validateFields(); setLinkSaving(true)
    try { const saved = await securityApi.setUserEmployee(linking.id, employeeId); setUsers(all => all.map(user => user.id === saved.id ? saved : user)); setLinking(null); message.success('Employee linked. The user must sign in again to refresh access.') }
    catch (reason) { message.error(reason instanceof Error ? reason.message : 'Unable to link employee') }
    finally { setLinkSaving(false) }
  }
  const columns: ColumnsType<User> = [
    { title: 'User', dataIndex: 'fullName', sorter: true, sortOrder: sortField === 'fullName' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: (_, user) => <Space><Avatar>{user.fullName.charAt(0)}</Avatar><div className="primary-cell"><strong>{user.fullName}</strong><small>#{user.serialNo} · {user.email}</small></div></Space> },
    { title: 'Employee', dataIndex: 'employeeName', render: value => value || '—' },
    { title: 'Company', key: 'company', render: (_, user) => user.companyId ? companyLabel(user) : <Tag color="blue">All companies</Tag> },
    { title: 'Role', key: 'role', filters: roles.map(role => ({ text: role.name, value: role.id })), filteredValue: roleId ? [roleId] : null, filterSearch: true, render: (_, user) => user.roles.map(role => role.name).join(', ') || '—' },
    { title: 'Last login', dataIndex: 'lastLoginAtUtc', sorter: true, sortOrder: sortField === 'lastLoginAtUtc' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: value => value ? new Date(value).toLocaleString() : 'Never' },
    { title: 'Status', dataIndex: 'isActive', width: 110, filters: [{ text: 'Active', value: true }, { text: 'Inactive', value: false }], filteredValue: status === undefined ? null : [status], sorter: true, sortOrder: sortField === 'isActive' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: value => <StatusTag active={value} /> },
    { title: 'Actions', key: 'actions', width: 330, align: 'right', render: (_, user) => <Space wrap>{tenantWide && <Button size="small" icon={<ClusterOutlined />} onClick={() => showCompany(user)}>Company</Button>}<Button size="small" icon={<LinkOutlined />} onClick={() => showEmployeeLink(user)}>{user.employeeId ? 'Change employee' : 'Link employee'}</Button><Popconfirm title={`${user.isActive ? 'Deactivate' : 'Activate'} this user?`} onConfirm={async () => { try { const saved = await securityApi.setUserStatus(user.id, !user.isActive); setUsers(all => all.map(x => x.id === saved.id ? saved : x)) } catch (reason) { message.error(reason instanceof Error ? reason.message : 'Unable to update user') } }}><Button size="small">{user.isActive ? 'Deactivate' : 'Activate'}</Button></Popconfirm></Space> },
  ]
  const tableChange: TableProps<User>['onChange'] = (_, filters, sorter) => { const selected = Array.isArray(sorter) ? sorter[0] : sorter; if (selected?.field && selected.order) { setSortField(selected.field as keyof User); setSortDirection(selected.order === 'ascend' ? 'asc' : 'desc') }; const state = filters.isActive?.[0]; setStatus(typeof state === 'boolean' ? state : undefined); setRoleId(typeof filters.role?.[0] === 'string' ? filters.role[0] : undefined) }
  return <>
    <PageHeader onRefresh={load} eyebrow="ACCESS CONTROL" title="Users" description="Control who can access this tenant and their assigned role." action="Add user" onAction={() => setOpen(true)} filters={<AdvancedSearch value={query} onChange={setQuery} placeholder="Search name or email" active={status !== undefined || Boolean(roleId) || sortField !== 'serialNo' || sortDirection !== 'desc'} sortField={String(sortField)} onSortField={value => setSortField(value as keyof User)} sortDirection={sortDirection} onSortDirection={setSortDirection} sortOptions={[{ value: 'serialNo', label: 'Created sequence' }, { value: 'fullName', label: 'Full name' }, { value: 'email', label: 'Email' }, { value: 'lastLoginAtUtc', label: 'Last login' }, { value: 'isActive', label: 'Status' }]} onReset={() => { setQuery(''); setStatus(undefined); setRoleId(undefined); setSortField('serialNo'); setSortDirection('desc') }}><Select showSearch optionFilterProp="label" allowClear placeholder="Role" value={roleId} onChange={setRoleId} options={roles.map(role => ({ value: role.id, label: role.name }))} /><Select showSearch optionFilterProp="label" allowClear placeholder="Status" value={status} onChange={setStatus} options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} /></AdvancedSearch>} />
    <Card className="grid-card" title="Tenant users" extra={`${filtered.length} accounts`}><ResponsiveDataView rowKey="id" columns={columns} data={visibleRows} onScroll={onScroll} onChange={tableChange} hasMore={hasMore} total={filtered.length} label="accounts" scrollX={980} renderTile={user => <><div className="tile-heading"><Space><Avatar>{user.fullName.charAt(0)}</Avatar><div className="primary-cell"><strong>{user.fullName}</strong><small>#{user.serialNo}</small></div></Space><StatusTag active={user.isActive} /></div><div className="tile-details"><span>{user.email}</span><span>Employee: {user.employeeName ?? 'Not linked'}</span><span>Company: {companyLabel(user)}</span><span>{user.roles.map(role => role.name).join(', ') || 'No role'}</span><span>Last login: {user.lastLoginAtUtc ? new Date(user.lastLoginAtUtc).toLocaleDateString() : 'Never'}</span></div><div className="tile-actions"><Space wrap>{tenantWide && <Button size="small" icon={<ClusterOutlined />} onClick={() => showCompany(user)}>Company</Button>}<Button size="small" icon={<LinkOutlined />} onClick={() => showEmployeeLink(user)}>{user.employeeId ? 'Change employee' : 'Link employee'}</Button><Popconfirm title={`${user.isActive ? 'Deactivate' : 'Activate'} this user?`} onConfirm={async () => { const saved = await securityApi.setUserStatus(user.id, !user.isActive); setUsers(all => all.map(x => x.id === saved.id ? saved : x)) }}><Button size="small">{user.isActive ? 'Deactivate' : 'Activate'}</Button></Popconfirm></Space></div></>} /></Card>
    <Modal centered title="Create tenant user" open={open} onCancel={() => setOpen(false)} onOk={create} confirmLoading={saving} okText="Create user" destroyOnHidden><Form form={form} layout="vertical" requiredMark="optional"><Form.Item label="Employee" name="employeeId" extra="Every tenant user must be linked to one active employee." rules={[{ required: true }]}><Select showSearch optionFilterProp="label" placeholder="Select employee" options={employees.filter(employee => employee.isActive && !users.some(user => user.employeeId === employee.id)).map(employee => ({ value: employee.id, label: `${employee.fullName} · ${employee.employeeNumber}` }))} /></Form.Item><Form.Item label="Full name" name="fullName" rules={[{ required: true, min: 2 }]}><Input /></Form.Item><Form.Item label="Email" name="email" rules={[{ required: true }, { type: 'email' }]}><Input /></Form.Item><Form.Item label="Temporary password" name="password" rules={[{ required: true, min: 10 }]}><Input.Password /></Form.Item><Form.Item label="Role" name="roleId" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" placeholder="Select role" options={roles.map(role => ({ value: role.id, label: role.name }))} /></Form.Item>{tenantWide && <Form.Item label="Company" name="companyId" initialValue={ALL_COMPANIES} extra="A company user sees only that company's jobs, documents and reports. Tenant users switch between companies." rules={[{ required: true }]}><Select options={companyOptions} /></Form.Item>}</Form></Modal>
    <Modal centered title={`Company access · ${moving?.fullName ?? ''}`} open={Boolean(moving)} onCancel={() => setMoving(null)} onOk={() => void saveCompany()} confirmLoading={moveSaving} okText="Save company" destroyOnHidden><Form form={moveForm} layout="vertical"><Form.Item label="Company" name="companyId" extra="Customers, employees and other masters are shared; jobs, documents and reports are per company." rules={[{ required: true }]}><Select options={companyOptions} /></Form.Item></Form></Modal>
    <Modal centered title={`Link employee · ${linking?.fullName ?? ''}`} open={Boolean(linking)} onCancel={() => setLinking(null)} onOk={() => void saveEmployeeLink()} confirmLoading={linkSaving} okText="Save employee" destroyOnHidden><Form form={linkForm} layout="vertical"><Form.Item label="Employee" name="employeeId" extra="Each employee can be linked to only one user. The user must sign in again after this change." rules={[{ required: true, message: 'Select an employee' }]}><Select showSearch optionFilterProp="label" placeholder="Select active employee" options={employees.filter(employee => employee.isActive && (employee.id === linking?.employeeId || !users.some(user => user.employeeId === employee.id))).map(employee => ({ value: employee.id, label: `${employee.fullName} · ${employee.employeeNumber} · ${employee.designationName}` }))} /></Form.Item></Form></Modal>
  </>
}


