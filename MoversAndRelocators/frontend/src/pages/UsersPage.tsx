import { useEffect, useState } from 'react'
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
import { useServerList } from '../hooks/useServerList'
import type { SortDirection } from '../utils/sortRecords'
import { formatDate, formatDateTime, useT } from '../i18n'

type UserForm = { fullName: string; email: string; password: string; roleId: string; employeeId: string; companyId?: string }
/** Select value for "tenant user": no company, can switch between all companies. */
const ALL_COMPANIES = '__all__'

/** tenantWide: the signed-in user can switch companies, so they can assign users to any company (company users manage only their own). */
export function UsersPage({ tenantWide = false }: { tenantWide?: boolean }) {
  const { t } = useT()
  const [companies, setCompanies] = useState<Company[]>([])
  const [moving, setMoving] = useState<User | null>(null), [moveSaving, setMoveSaving] = useState(false)
  const [moveForm] = Form.useForm<{ companyId: string }>()
  const companyOptions = [{ value: ALL_COMPANIES, label: t('admin.users.allCompaniesOption') }, ...companies.filter(x => x.isActive).map(x => ({ value: x.id, label: x.name }))]
  const [roles, setRoles] = useState<Role[]>([]), [employees, setEmployees] = useState<Employee[]>([])
  const [query, setQuery] = useState(''), [status, setStatus] = useState<boolean | undefined>(), [roleId, setRoleId] = useState<string>()
  const [sortField, setSortField] = useState<keyof User>('serialNo'), [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [open, setOpen] = useState(false), [saving, setSaving] = useState(false)
  const [linking, setLinking] = useState<User | null>(null), [linkSaving, setLinkSaving] = useState(false)
  const [form] = Form.useForm<UserForm>()
  const [linkForm] = Form.useForm<{ employeeId: string }>()
  /** The register is searched and paged by the server; summary.linkedEmployeeIds (every user this requester can see) keeps linked employees out of the create/link forms. */
  const list = useServerList(securityApi.searchUsers, { search: query, isActive: status, roleId, sort: String(sortField), desc: sortDirection === 'desc' })
  const linkedEmployees = new Set(list.summary?.linkedEmployeeIds ?? [])
  const loadLookups = () => Promise.all([securityApi.roles(), employeesApi.employees(), tenantWide ? companiesApi.list() : Promise.resolve([] as Company[])]).then(([roleRows, employeeRows, companyRows]) => { setRoles(roleRows); setEmployees(employeeRows); setCompanies(companyRows) }).catch(error => message.error(error.message))
  const load = () => { void list.reload(); return loadLookups() }
  const showCompany = (user: User) => { setMoving(user); moveForm.setFieldsValue({ companyId: user.companyId ?? ALL_COMPANIES }) }
  const saveCompany = async () => {
    if (!moving) return
    const { companyId } = await moveForm.validateFields(); setMoveSaving(true)
    try { await securityApi.setUserCompany(moving.id, companyId === ALL_COMPANIES ? null : companyId); void list.reload(); setMoving(null); message.success(t('admin.users.companySaved')) }
    catch (reason) { message.error(reason instanceof Error ? reason.message : t('admin.users.companyFailed')) }
    finally { setMoveSaving(false) }
  }
  const companyLabel = (user: User) => user.companyName ?? (user.companyId ? t('common.company') : t('admin.common.allCompanies'))
  useEffect(() => { void loadLookups() }, [])
  const create = async () => {
    const values = await form.validateFields(); setSaving(true)
    try { await securityApi.createUser({ ...values, companyId: !values.companyId || values.companyId === ALL_COMPANIES ? null : values.companyId }); void list.reload(); setOpen(false); form.resetFields(); message.success(t('admin.users.created')) }
    catch (reason) { if (reason instanceof Error) message.error(reason.message) } finally { setSaving(false) }
  }
  const showEmployeeLink = (user: User) => { setLinking(user); linkForm.setFieldsValue({ employeeId: user.employeeId ?? '' }) }
  const saveEmployeeLink = async () => {
    if (!linking) return
    const { employeeId } = await linkForm.validateFields(); setLinkSaving(true)
    try { await securityApi.setUserEmployee(linking.id, employeeId); void list.reload(); setLinking(null); message.success(t('admin.users.employeeLinked')) }
    catch (reason) { message.error(reason instanceof Error ? reason.message : t('admin.users.linkFailed')) }
    finally { setLinkSaving(false) }
  }
  const rowButtons = (user: User, reportErrors: boolean) => <Space wrap>{tenantWide && <Button size="small" icon={<ClusterOutlined />} onClick={() => showCompany(user)}>{t('common.company')}</Button>}<Button size="small" icon={<LinkOutlined />} onClick={() => showEmployeeLink(user)}>{user.employeeId ? t('admin.users.changeEmployee') : t('admin.users.linkEmployee')}</Button><Popconfirm title={user.isActive ? t('admin.users.deactivateConfirm') : t('admin.users.activateConfirm')} onConfirm={async () => { try { await securityApi.setUserStatus(user.id, !user.isActive); void list.reload() } catch (reason) { if (!reportErrors) throw reason; message.error(reason instanceof Error ? reason.message : t('admin.users.updateFailed')) } }}><Button size="small">{user.isActive ? t('common.deactivate') : t('common.activate')}</Button></Popconfirm></Space>
  const columns: ColumnsType<User> = [
    { title: t('admin.users.user'), dataIndex: 'fullName', sorter: true, sortOrder: sortField === 'fullName' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: (_, user) => <Space><Avatar>{user.fullName.charAt(0)}</Avatar><div className="primary-cell"><strong>{user.fullName}</strong><small>#{user.serialNo} · {user.email}</small></div></Space> },
    { title: t('common.employee'), dataIndex: 'employeeName', render: value => value || '—' },
    { title: t('common.company'), key: 'company', render: (_, user) => user.companyId ? companyLabel(user) : <Tag color="blue">{t('admin.common.allCompanies')}</Tag> },
    { title: t('admin.common.role'), key: 'role', filters: roles.map(role => ({ text: role.name, value: role.id })), filteredValue: roleId ? [roleId] : null, filterSearch: true, render: (_, user) => user.roles.map(role => role.name).join(', ') || '—' },
    { title: t('admin.users.lastLogin'), dataIndex: 'lastLoginAtUtc', sorter: true, sortOrder: sortField === 'lastLoginAtUtc' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: value => value ? formatDateTime(value) : t('admin.common.never') },
    { title: t('common.status'), dataIndex: 'isActive', width: 110, filters: [{ text: t('common.active'), value: true }, { text: t('common.inactive'), value: false }], filteredValue: status === undefined ? null : [status], sorter: true, sortOrder: sortField === 'isActive' ? (sortDirection === 'asc' ? 'ascend' : 'descend') : null, render: value => <StatusTag active={value} /> },
    { title: t('common.actions'), key: 'actions', width: 330, align: 'right', render: (_, user) => rowButtons(user, true) },
  ]
  const tableChange: TableProps<User>['onChange'] = (_, filters, sorter) => { const selected = Array.isArray(sorter) ? sorter[0] : sorter; if (selected?.field && selected.order) { setSortField(selected.field as keyof User); setSortDirection(selected.order === 'ascend' ? 'asc' : 'desc') }; const state = filters.isActive?.[0]; setStatus(typeof state === 'boolean' ? state : undefined); setRoleId(typeof filters.role?.[0] === 'string' ? filters.role[0] : undefined) }
  return <>
    <PageHeader onRefresh={load} eyebrow={t('admin.common.accessControl')} title={t('admin.users.title')} description={t('admin.users.description')} action={t('admin.users.add')} onAction={() => setOpen(true)} filters={<AdvancedSearch value={query} onChange={setQuery} placeholder={t('admin.users.searchPlaceholder')} active={status !== undefined || Boolean(roleId) || sortField !== 'serialNo' || sortDirection !== 'desc'} sortField={String(sortField)} onSortField={value => setSortField(value as keyof User)} sortDirection={sortDirection} onSortDirection={setSortDirection} sortOptions={[{ value: 'serialNo', label: t('shell.search.createdSequence') }, { value: 'fullName', label: t('admin.common.fullName') }, { value: 'email', label: t('common.email') }, { value: 'lastLoginAtUtc', label: t('admin.users.lastLogin') }, { value: 'isActive', label: t('common.status') }]} onReset={() => { setQuery(''); setStatus(undefined); setRoleId(undefined); setSortField('serialNo'); setSortDirection('desc') }}><Select showSearch optionFilterProp="label" allowClear placeholder={t('admin.common.role')} value={roleId} onChange={setRoleId} options={roles.map(role => ({ value: role.id, label: role.name }))} /><Select showSearch optionFilterProp="label" allowClear placeholder={t('common.status')} value={status} onChange={setStatus} options={[{ value: true, label: t('common.active') }, { value: false, label: t('common.inactive') }]} /></AdvancedSearch>} />
    <Card className="grid-card" title={t('admin.users.tenantUsers')} extra={t('admin.users.accountCount', { count: list.total })}><ResponsiveDataView rowKey="id" columns={columns} data={list.rows} onScroll={list.onScroll} onChange={tableChange} hasMore={list.hasMore} total={list.total} loading={list.loading} label={t('admin.users.accounts')} scrollX={980} renderTile={user => <><div className="tile-heading"><Space><Avatar>{user.fullName.charAt(0)}</Avatar><div className="primary-cell"><strong>{user.fullName}</strong><small>#{user.serialNo}</small></div></Space><StatusTag active={user.isActive} /></div><div className="tile-details"><span>{user.email}</span><span>{t('admin.users.employeeLine', { employee: user.employeeName ?? t('admin.users.notLinked') })}</span><span>{t('admin.users.companyLine', { company: companyLabel(user) })}</span><span>{user.roles.map(role => role.name).join(', ') || t('admin.users.noRole')}</span><span>{t('admin.users.lastLoginLine', { when: user.lastLoginAtUtc ? formatDate(user.lastLoginAtUtc) : t('admin.common.never') })}</span></div><div className="tile-actions">{rowButtons(user, false)}</div></>} /></Card>
    <Modal centered title={t('admin.users.createTitle')} open={open} onCancel={() => setOpen(false)} onOk={create} confirmLoading={saving} okText={t('admin.users.create')} cancelText={t('common.cancel')} destroyOnHidden><Form form={form} layout="vertical" requiredMark="optional"><Form.Item label={t('common.employee')} name="employeeId" extra={t('admin.users.employeeRequiredHint')} rules={[{ required: true }]}><Select showSearch optionFilterProp="label" placeholder={t('admin.users.selectEmployee')} options={employees.filter(employee => employee.isActive && !linkedEmployees.has(employee.id)).map(employee => ({ value: employee.id, label: `${employee.fullName} · ${employee.employeeNumber}` }))} /></Form.Item><Form.Item label={t('admin.common.fullName')} name="fullName" rules={[{ required: true, min: 2 }]}><Input /></Form.Item><Form.Item label={t('common.email')} name="email" rules={[{ required: true }, { type: 'email' }]}><Input /></Form.Item><Form.Item label={t('admin.common.temporaryPassword')} name="password" rules={[{ required: true, min: 10 }]}><Input.Password /></Form.Item><Form.Item label={t('admin.common.role')} name="roleId" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" placeholder={t('admin.users.selectRole')} options={roles.map(role => ({ value: role.id, label: role.name }))} /></Form.Item>{tenantWide && <Form.Item label={t('common.company')} name="companyId" initialValue={ALL_COMPANIES} extra={t('admin.users.companyCreateHint')} rules={[{ required: true }]}><Select options={companyOptions} /></Form.Item>}</Form></Modal>
    <Modal centered title={t('admin.users.companyAccessTitle', { name: moving?.fullName ?? '' })} open={Boolean(moving)} onCancel={() => setMoving(null)} onOk={() => void saveCompany()} confirmLoading={moveSaving} okText={t('admin.users.saveCompany')} cancelText={t('common.cancel')} destroyOnHidden><Form form={moveForm} layout="vertical"><Form.Item label={t('common.company')} name="companyId" extra={t('admin.users.companyMoveHint')} rules={[{ required: true }]}><Select options={companyOptions} /></Form.Item></Form></Modal>
    <Modal centered title={t('admin.users.linkTitle', { name: linking?.fullName ?? '' })} open={Boolean(linking)} onCancel={() => setLinking(null)} onOk={() => void saveEmployeeLink()} confirmLoading={linkSaving} okText={t('admin.users.saveEmployee')} cancelText={t('common.cancel')} destroyOnHidden><Form form={linkForm} layout="vertical"><Form.Item label={t('common.employee')} name="employeeId" extra={t('admin.users.linkHint')} rules={[{ required: true, message: t('admin.users.selectAnEmployee') }]}><Select showSearch optionFilterProp="label" placeholder={t('admin.users.selectActiveEmployee')} options={employees.filter(employee => employee.isActive && (employee.id === linking?.employeeId || !linkedEmployees.has(employee.id))).map(employee => ({ value: employee.id, label: `${employee.fullName} · ${employee.employeeNumber} · ${employee.designationName}` }))} /></Form.Item></Form></Modal>
  </>
}
