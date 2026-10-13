import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Space, Tag, Typography, message } from 'antd'
import { BankOutlined, EditOutlined, StarOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { companiesApi } from '../api'
import type { Company, CompanyInput } from '../types'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { ResponsiveDataView } from '../components/ResponsiveDataView'
import { useInfiniteRows } from '../hooks/useInfiniteRows'
import { useT } from '../i18n'

/**
 * Companies inside the tenant. Each company has its own jobs, documents, number series, books, reports and letterhead;
 * customers, employees and other masters are shared. Changes refresh the company switcher through onChanged.
 */
export function CompaniesPage({ currentCompanyId, onChanged }: { currentCompanyId?: string | null; onChanged: (companies: Company[]) => void }) {
  const { t } = useT()
  const [companies, setCompanies] = useState<Company[]>([]), [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Company | 'new' | null>(null), [saving, setSaving] = useState(false)
  const [form] = Form.useForm<CompanyInput>()
  const apply = (rows: Company[]) => { setCompanies(rows); onChanged(rows) }
  const load = () => { setLoading(true); return companiesApi.list().then(apply).catch(error => message.error(error.message)).finally(() => setLoading(false)) }
  useEffect(() => { void load() }, [])
  const { visibleRows, onScroll, hasMore } = useInfiniteRows(companies, String(companies.length))
  const plainNumbers = companies.find(x => !x.numberCode && (editing === 'new' || x.id !== editing?.id))

  const open = (company: Company | 'new') => {
    setEditing(company)
    form.setFieldsValue(company === 'new'
      ? { code: '', name: '', legalName: null, taxNumber: null, address: null, phone: null, email: null, website: null, numberCode: null }
      : { code: company.code, name: company.name, legalName: company.legalName, taxNumber: company.taxNumber, address: company.address, phone: company.phone, email: company.email, website: company.website, numberCode: company.numberCode })
  }
  const save = async () => {
    const values = await form.validateFields(); setSaving(true)
    const input = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'string' && !value.trim() ? null : value])) as CompanyInput
    try {
      if (editing === 'new') await companiesApi.create(input); else if (editing) await companiesApi.update(editing.id, input)
      message.success(editing === 'new' ? t('admin.companies.added') : t('admin.companies.saved')); setEditing(null); await load()
    } catch (reason) { message.error(reason instanceof Error ? reason.message : t('admin.companies.saveFailed')) }
    finally { setSaving(false) }
  }
  const run = async (action: () => Promise<unknown>, done: string) => {
    try { await action(); message.success(done); await load() } catch (reason) { message.error(reason instanceof Error ? reason.message : t('admin.companies.updateFailed')) }
  }
  const actions = (x: Company) => <Space wrap>
    <Button size="small" icon={<EditOutlined />} onClick={() => open(x)}>{t('common.edit')}</Button>
    {!x.isDefault && x.isActive && <Popconfirm title={t('admin.companies.makeDefaultConfirm', { name: x.name })} description={t('admin.companies.makeDefaultHint')} onConfirm={() => run(() => companiesApi.setDefault(x.id), t('admin.companies.defaultChanged'))}><Button size="small" icon={<StarOutlined />}>{t('admin.companies.makeDefault')}</Button></Popconfirm>}
    {!x.isDefault && <Popconfirm title={x.isActive ? t('admin.companies.deactivateConfirm', { name: x.name }) : t('admin.companies.activateConfirm', { name: x.name })} description={x.isActive ? t('admin.companies.deactivateHint') : undefined} onConfirm={() => run(() => companiesApi.setStatus(x.id, !x.isActive), x.isActive ? t('admin.companies.deactivated') : t('admin.companies.activated'))}><Button size="small" disabled={x.id === currentCompanyId && x.isActive}>{x.isActive ? t('common.deactivate') : t('common.activate')}</Button></Popconfirm>}
  </Space>
  const columns: ColumnsType<Company> = [
    { title: t('common.company'), dataIndex: 'name', render: (_, x) => <Space><BankOutlined /><div className="primary-cell"><strong>{x.name} {x.isDefault && <Tag color="green">{t('admin.companies.default')}</Tag>}{x.id === currentCompanyId && <Tag color="blue">{t('admin.companies.current')}</Tag>}</strong><small>{x.code}{x.legalName ? ` · ${x.legalName}` : ''}</small></div></Space> },
    { title: t('admin.companies.documentNumbers'), dataIndex: 'numberCode', render: value => <Typography.Text code>{value ? `QT-${value}-YYYYMMDD-000001` : 'QT-YYYYMMDD-000001'}</Typography.Text> },
    { title: t('admin.companies.taxNumber'), dataIndex: 'taxNumber', render: value => value || '—' },
    { title: t('admin.companies.companyUsers'), dataIndex: 'userCount', width: 130 },
    { title: t('common.status'), dataIndex: 'isActive', width: 110, render: value => <StatusTag active={value} /> },
    { title: t('common.actions'), key: 'actions', width: 300, align: 'right', render: (_, x) => actions(x) },
  ]

  return <>
    <PageHeader onRefresh={load} refreshDisabled={loading || saving} eyebrow={t('admin.common.tenantSettings')} title={t('admin.companies.title')} description={t('admin.companies.description')} action={t('admin.companies.add')} onAction={() => open('new')} />
    <Alert className="companies-note" type="info" showIcon title={t('admin.companies.whoWorksWhere')} description={t('admin.companies.whoWorksWhereText')} />
    <Card className="grid-card" title={t('admin.companies.inThisTenant')} extra={t('admin.companies.companyCount', { count: companies.length })} loading={loading && companies.length === 0}><ResponsiveDataView rowKey="id" columns={columns} data={visibleRows} onScroll={onScroll} hasMore={hasMore} total={companies.length} label={t('admin.companies.companiesLabel')} scrollX={980}
      renderTile={x => <><div className="tile-heading"><Space><BankOutlined /><div className="primary-cell"><strong>{x.name}</strong><small>{x.code}</small></div></Space><Space>{x.isDefault && <Tag color="green">{t('admin.companies.default')}</Tag>}{x.id === currentCompanyId && <Tag color="blue">{t('admin.companies.current')}</Tag>}<StatusTag active={x.isActive} /></Space></div><div className="tile-details"><span>{t('admin.companies.numbersLine', { pattern: x.numberCode ? `QT-${x.numberCode}-…` : 'QT-…' })}</span><span>{t('admin.companies.taxNumberLine', { value: x.taxNumber ?? '—' })}</span><span>{t('admin.companies.companyUsersLine', { users: x.userCount })}</span></div><div className="tile-actions">{actions(x)}</div></>} /></Card>
    <Modal centered width={720} title={editing === 'new' ? t('admin.companies.add') : t('admin.companies.editTitle', { name: editing?.name ?? '' })} open={Boolean(editing)} onCancel={() => setEditing(null)} onOk={() => void save()} confirmLoading={saving} okText={editing === 'new' ? t('admin.companies.add') : t('admin.companies.save')} cancelText={t('common.cancel')} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark="optional">
        <Row gutter={14}>
          <Col xs={24} sm={8}><Form.Item label={t('common.code')} name="code" rules={[{ required: true }, { pattern: /^[A-Za-z0-9_-]{1,20}$/, message: t('admin.companies.codeRule') }]}><Input placeholder="DXB" /></Form.Item></Col>
          <Col xs={24} sm={16}><Form.Item label={t('common.name')} name="name" rules={[{ required: true, min: 2, max: 160 }]}><Input placeholder={t('admin.companies.namePlaceholder')} /></Form.Item></Col>
          <Col xs={24} sm={16}><Form.Item label={t('admin.companies.legalName')} name="legalName" extra={t('admin.companies.legalNameHint')}><Input /></Form.Item></Col>
          <Col xs={24} sm={8}><Form.Item label={t('admin.companies.taxNumberTrn')} name="taxNumber"><Input /></Form.Item></Col>
          <Col xs={24}><Form.Item label={t('common.address')} name="address"><Input.TextArea rows={2} /></Form.Item></Col>
          <Col xs={24} sm={8}><Form.Item label={t('common.phone')} name="phone"><Input /></Form.Item></Col>
          <Col xs={24} sm={8}><Form.Item label={t('common.email')} name="email" rules={[{ type: 'email' }]}><Input /></Form.Item></Col>
          <Col xs={24} sm={8}><Form.Item label={t('admin.companies.website')} name="website"><Input /></Form.Item></Col>
          <Col xs={24} sm={8}><Form.Item label={t('admin.companies.numberCode')} name="numberCode" normalize={(v: string) => v?.toUpperCase()}
            rules={[{ pattern: /^[A-Za-z0-9]{1,6}$/, message: t('admin.companies.numberCodeRule') }, { required: Boolean(plainNumbers), message: t('admin.companies.numberCodeRequired', { name: plainNumbers?.name ?? t('admin.companies.anotherCompany') }) }]}><Input placeholder="DXB" maxLength={6} /></Form.Item></Col>
          <Col xs={24} sm={16}><Form.Item label=" " colon={false}><Typography.Text type="secondary">{t('admin.companies.numberCodeHint')}</Typography.Text></Form.Item></Col>
        </Row>
      </Form>
    </Modal>
  </>
}
