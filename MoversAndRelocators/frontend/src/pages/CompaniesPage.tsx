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

/**
 * Companies inside the tenant. Each company has its own jobs, documents, number series, books, reports and letterhead;
 * customers, employees and other masters are shared. Changes refresh the company switcher through onChanged.
 */
export function CompaniesPage({ currentCompanyId, onChanged }: { currentCompanyId?: string | null; onChanged: (companies: Company[]) => void }) {
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
      message.success(editing === 'new' ? 'Company added' : 'Company saved'); setEditing(null); await load()
    } catch (reason) { message.error(reason instanceof Error ? reason.message : 'Unable to save the company') }
    finally { setSaving(false) }
  }
  const run = async (action: () => Promise<unknown>, done: string) => {
    try { await action(); message.success(done); await load() } catch (reason) { message.error(reason instanceof Error ? reason.message : 'Unable to update the company') }
  }
  const actions = (x: Company) => <Space wrap>
    <Button size="small" icon={<EditOutlined />} onClick={() => open(x)}>Edit</Button>
    {!x.isDefault && x.isActive && <Popconfirm title={`Make ${x.name} the default company?`} description="Tenant users open it first, and background work is recorded in it." onConfirm={() => run(() => companiesApi.setDefault(x.id), 'Default company changed')}><Button size="small" icon={<StarOutlined />}>Make default</Button></Popconfirm>}
    {!x.isDefault && <Popconfirm title={`${x.isActive ? 'Deactivate' : 'Activate'} ${x.name}?`} description={x.isActive ? 'Its users cannot sign in until it is active again. Its records are kept.' : undefined} onConfirm={() => run(() => companiesApi.setStatus(x.id, !x.isActive), x.isActive ? 'Company deactivated' : 'Company activated')}><Button size="small" disabled={x.id === currentCompanyId && x.isActive}>{x.isActive ? 'Deactivate' : 'Activate'}</Button></Popconfirm>}
  </Space>
  const columns: ColumnsType<Company> = [
    { title: 'Company', dataIndex: 'name', render: (_, x) => <Space><BankOutlined /><div className="primary-cell"><strong>{x.name} {x.isDefault && <Tag color="green">Default</Tag>}{x.id === currentCompanyId && <Tag color="blue">Current</Tag>}</strong><small>{x.code}{x.legalName ? ` · ${x.legalName}` : ''}</small></div></Space> },
    { title: 'Document numbers', dataIndex: 'numberCode', render: value => <Typography.Text code>{value ? `QT-${value}-YYYYMMDD-000001` : 'QT-YYYYMMDD-000001'}</Typography.Text> },
    { title: 'Tax number', dataIndex: 'taxNumber', render: value => value || '—' },
    { title: 'Company users', dataIndex: 'userCount', width: 130 },
    { title: 'Status', dataIndex: 'isActive', width: 110, render: value => <StatusTag active={value} /> },
    { title: 'Actions', key: 'actions', width: 300, align: 'right', render: (_, x) => actions(x) },
  ]

  return <>
    <PageHeader onRefresh={load} refreshDisabled={loading || saving} eyebrow="TENANT SETTINGS" title="Companies" description="Each company keeps its own jobs, documents, numbering, books, reports and letterhead. Customers, employees and other masters are shared by all companies." action="Add company" onAction={() => open('new')} />
    <Alert className="companies-note" type="info" showIcon title="Who works where" description="Users assigned to a company see only that company. Tenant users (no company) switch between companies from the side menu. Set a user's company on the Users page." />
    <Card className="grid-card" title="Companies in this tenant" extra={`${companies.length} companies`} loading={loading && companies.length === 0}><ResponsiveDataView rowKey="id" columns={columns} data={visibleRows} onScroll={onScroll} hasMore={hasMore} total={companies.length} label="companies" scrollX={980}
      renderTile={x => <><div className="tile-heading"><Space><BankOutlined /><div className="primary-cell"><strong>{x.name}</strong><small>{x.code}</small></div></Space><Space>{x.isDefault && <Tag color="green">Default</Tag>}{x.id === currentCompanyId && <Tag color="blue">Current</Tag>}<StatusTag active={x.isActive} /></Space></div><div className="tile-details"><span>Numbers: {x.numberCode ? `QT-${x.numberCode}-…` : 'QT-…'}</span><span>Tax number: {x.taxNumber ?? '—'}</span><span>Company users: {x.userCount}</span></div><div className="tile-actions">{actions(x)}</div></>} /></Card>
    <Modal centered width={720} title={editing === 'new' ? 'Add company' : `Edit company · ${editing?.name ?? ''}`} open={Boolean(editing)} onCancel={() => setEditing(null)} onOk={() => void save()} confirmLoading={saving} okText={editing === 'new' ? 'Add company' : 'Save company'} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark="optional">
        <Row gutter={14}>
          <Col xs={24} sm={8}><Form.Item label="Code" name="code" rules={[{ required: true }, { pattern: /^[A-Za-z0-9_-]{1,20}$/, message: 'Letters, digits, - or _ (up to 20)' }]}><Input placeholder="DXB" /></Form.Item></Col>
          <Col xs={24} sm={16}><Form.Item label="Name" name="name" rules={[{ required: true, min: 2, max: 160 }]}><Input placeholder="Dubai branch" /></Form.Item></Col>
          <Col xs={24} sm={16}><Form.Item label="Legal name" name="legalName" extra="Printed on documents when the letterhead has no company name."><Input /></Form.Item></Col>
          <Col xs={24} sm={8}><Form.Item label="Tax number (TRN)" name="taxNumber"><Input /></Form.Item></Col>
          <Col xs={24}><Form.Item label="Address" name="address"><Input.TextArea rows={2} /></Form.Item></Col>
          <Col xs={24} sm={8}><Form.Item label="Phone" name="phone"><Input /></Form.Item></Col>
          <Col xs={24} sm={8}><Form.Item label="Email" name="email" rules={[{ type: 'email' }]}><Input /></Form.Item></Col>
          <Col xs={24} sm={8}><Form.Item label="Website" name="website"><Input /></Form.Item></Col>
          <Col xs={24} sm={8}><Form.Item label="Number code" name="numberCode" normalize={(v: string) => v?.toUpperCase()}
            rules={[{ pattern: /^[A-Za-z0-9]{1,6}$/, message: '1 to 6 letters or digits' }, { required: Boolean(plainNumbers), message: `Required: ${plainNumbers?.name ?? 'another company'} already uses plain numbers` }]}><Input placeholder="DXB" maxLength={6} /></Form.Item></Col>
          <Col xs={24} sm={16}><Form.Item label=" " colon={false}><Typography.Text type="secondary">Added to this company's document numbers (QT-DXB-20261011-000001), so every company has its own series. Only one company can use plain numbers.</Typography.Text></Form.Item></Col>
        </Row>
      </Form>
    </Modal>
  </>
}
