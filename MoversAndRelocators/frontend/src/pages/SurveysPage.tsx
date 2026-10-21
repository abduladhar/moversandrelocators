import { nowLocal } from '../dates'
import { ContactMasterPicker } from '../components/ContactMasterPicker'
import { useMessageTemplate } from '../messageTemplates'
import { ShareChannels } from '../components/ShareChannels'
import { SurveyMapLink } from '../components/SurveyMapLink'
import { RowActions } from '../components/RowActions'
import { CustomerReplyTag, CustomerStateFilter, useCustomerReplies } from '../components/CustomerReplyTag'
import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Form, Input, Modal, Row, Select, Space, Statistic, Tag, Typography, message } from 'antd'
import { EditOutlined, LinkOutlined, MailOutlined, ClockCircleOutlined, EnvironmentOutlined, FileSearchOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { employeesApi, salesApi, surveysApi } from '../api'
import type { Employee, SalesLead, Survey, SurveyInput } from '../types'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { PageHeader } from '../components/PageHeader'
import { ResponsiveDataView } from '../components/ResponsiveDataView'
import { useServerList } from '../hooks/useServerList'
import { SurveyDetailPage } from './SurveyDetailPage'
import { formatDateTime, useT } from '../i18n'

type SurveyForm = Omit<SurveyInput, 'scheduledAtUtc'> & { scheduledAtLocal: string }
type SurveyShare = { survey: Survey; url: string; expiresAtUtc: string }

const statusColor: Record<string, string> = { SCHEDULED: 'blue', CONFIRMED: 'cyan', IN_PROGRESS: 'orange', COMPLETED: 'green' }
const localDateTime = (utc: string) => { const d = new Date(utc); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

export function SurveysPage() {
  const { t } = useT()
  const statusLabel = (status: string) => t('surveys.status.' + status)
  const [employees, setEmployees] = useState<Employee[]>([]), [leads, setLeads] = useState<SalesLead[]>([])
  const [sortField, setSortField] = useState('serialNo'), [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const [query, setQuery] = useState(''), [status, setStatus] = useState<string>(), [open, setOpen] = useState(false), [editing, setEditing] = useState<Survey | null>(null), [saving, setSaving] = useState(false)
  const [shareInfo, setShareInfo] = useState<SurveyShare | null>(null), [generatingLink, setGeneratingLink] = useState(false), [detailPageId, setDetailPageId] = useState<string | null>(null)
  const [form] = Form.useForm<SurveyForm>()
  const customer = useCustomerReplies('SURVEY'), [customerState, setCustomerState] = useState<string>()
  const list = useServerList(surveysApi.search, { search: query, status, customerState, sort: sortField, desc: direction === 'desc' })
  // A handled reply can move the row out of the customer-state filter, so the list is fetched again then.
  const customerChanged = () => { void customer.reload(); if (customerState) void list.reload() }
  const stats = list.summary
  const load = () => { void customer.reload(); void list.reload(); return Promise.all([employeesApi.employees(), salesApi.leads()]).then(([b, c]) => { setEmployees(b); setLeads(c) }).catch(error => message.error(error.message)) }
  useEffect(() => { void Promise.all([employeesApi.employees(), salesApi.leads()]).then(([b, c]) => { setEmployees(b); setLeads(c) }).catch(error => message.error(error.message)) }, [])
  const { message: surveyMessage } = useMessageTemplate('SURVEY_CONFIRM')
  const showForm = (record?: Survey) => { setEditing(record ?? null); form.setFieldsValue(record ? { ...record, email: record.email ?? '', notes: record.notes ?? '', scheduledAtLocal: localDateTime(record.scheduledAtUtc) } : { surveyNumber: `SVY-${Date.now().toString().slice(-6)}`, salesLeadId: null, customerName: '', phone: '', email: '', assignedEmployeeId: '', scheduledAtLocal: nowLocal(), address: '', notes: '' }); setOpen(true) }
  const leadChanged = (id?: string) => { const lead = leads.find(x => x.id === id); if (lead) form.setFieldsValue({ salesLeadId: lead.id, customerName: lead.customerName, phone: lead.phone, email: lead.email ?? '', address: lead.origin }) }
  const save = async () => { const value = await form.validateFields(); const input: SurveyInput = { ...value, email: value.email?.trim() ?? '', scheduledAtUtc: new Date(value.scheduledAtLocal).toISOString() }; setSaving(true); try { editing ? await surveysApi.update(editing.id, input) : await surveysApi.create(input); setOpen(false); await load(); message.success(t('surveys.list.saved')) } catch (error) { message.error(error instanceof Error ? error.message : t('surveys.list.saveFailed')) } finally { setSaving(false) } }
  const share = async (record: Survey) => { setGeneratingLink(true); try { const link = await surveysApi.link(record.id); setShareInfo({ survey: record, ...link }); void customer.reload() } catch (error) { message.error(error instanceof Error ? error.message : t('surveys.list.linkFailed')) } finally { setGeneratingLink(false) } }
  const shareText = shareInfo ? surveyMessage({ customer: shareInfo.survey.customerName, reference: shareInfo.survey.surveyNumber, date: formatDateTime(shareInfo.survey.scheduledAtUtc), link: shareInfo.url }) : ''
  const columns: ColumnsType<Survey> = [
    { title: t('surveys.list.survey'), key: 'survey', render: (_, x) => <div className="primary-cell"><strong>{x.surveyNumber}</strong><small>#{x.serialNo} · {x.customerName}</small></div> },
    { title: t('surveys.list.schedule'), dataIndex: 'scheduledAtUtc', render: x => formatDateTime(x) },
    { title: t('surveys.list.assignedTo'), dataIndex: 'assignedEmployeeName' },
    { title: t('common.status'), dataIndex: 'status', render: (x, r) => <span className="status-stack"><Tag color={statusColor[x]}>{statusLabel(x)}</Tag><CustomerReplyTag reply={customer.get(r.id)} onChanged={customerChanged} /></span> },
    { title: t('common.actions'), key: 'actions', align: 'right', render: (_, x) => <RowActions><Space wrap><Button size="small" onClick={() => setDetailPageId(x.id)}>{t('surveys.list.openSurvey')}</Button><SurveyMapLink address={x.address} latitude={x.latitude} longitude={x.longitude} /><Button size="small" loading={generatingLink} icon={<LinkOutlined />} onClick={() => void share(x)}>{t('common.share')}</Button><Button size="small" icon={<EditOutlined />} onClick={() => showForm(x)}>{t('common.edit')}</Button></Space></RowActions> },
  ]

  if (detailPageId) return <SurveyDetailPage surveyId={detailPageId} onBack={() => setDetailPageId(null)} onChanged={() => void load()} />
  return <>
    <PageHeader onRefresh={load} eyebrow={t('surveys.list.eyebrow')} title={t('surveys.list.title')} description={t('surveys.list.description')} action={t('surveys.list.create')} onAction={() => showForm()} filters={<AdvancedSearch value={query} onChange={setQuery} onReset={() => { setQuery(''); setStatus(undefined); setCustomerState(undefined); setSortField('serialNo'); setDirection('desc') }} active={Boolean(status) || Boolean(customerState) || sortField !== 'serialNo' || direction !== 'desc'} sortField={sortField} onSortField={setSortField} sortDirection={direction} onSortDirection={setDirection} sortOptions={[{ value: 'serialNo', label: t('shell.search.createdSequence') }, { value: 'scheduledAtUtc', label: t('surveys.list.schedule') }, { value: 'assignedEmployeeName', label: t('surveys.list.assignedTo') }]}><CustomerStateFilter value={customerState} onChange={setCustomerState} /><Select showSearch allowClear optionFilterProp="label" placeholder={t('surveys.list.statusFilter')} value={status} onChange={setStatus} options={['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].map(x => ({ value: x, label: statusLabel(x) }))} /></AdvancedSearch>} />
    <Row gutter={[12, 12]} className="stats-row"><Col xs={12} md={6}><Card><Statistic title={t('surveys.list.allSurveys')} value={stats?.all ?? 0} /></Card></Col><Col xs={12} md={6}><Card><Statistic title={t('surveys.list.awaitingConfirmation')} value={stats?.awaitingConfirmation ?? 0} /></Card></Col><Col xs={12} md={6}><Card><Statistic title={t('surveys.list.inProgress')} value={stats?.inProgress ?? 0} /></Card></Col><Col xs={12} md={6}><Card><Statistic title={t('surveys.list.quotationReady')} value={stats?.quotationReady ?? 0} /></Card></Col></Row>
    <Card className="grid-card" title={t('surveys.list.scheduleTitle')} extra={t('surveys.records', { count: list.total })}><ResponsiveDataView rowKey="id" columns={columns} data={list.rows} onScroll={list.onScroll} hasMore={list.hasMore} total={list.total} loading={list.loading} label={t('surveys.list.gridLabel')} renderTile={x => <><div className="tile-heading"><div className="primary-cell"><strong>{x.surveyNumber}</strong><small>{x.customerName}</small></div><span className="status-stack"><Tag color={statusColor[x.status]}>{statusLabel(x.status)}</Tag><CustomerReplyTag reply={customer.get(x.id)} onChanged={customerChanged} /></span></div><div className="tile-details"><span><ClockCircleOutlined /> {formatDateTime(x.scheduledAtUtc)}</span><span>{x.assignedEmployeeName}</span><span><EnvironmentOutlined /> {x.address}</span></div><RowActions><Space wrap className="tile-actions"><Button size="small" onClick={() => setDetailPageId(x.id)}>{t('surveys.list.openSurvey')}</Button><SurveyMapLink address={x.address} latitude={x.latitude} longitude={x.longitude} /><Button size="small" loading={generatingLink} icon={<LinkOutlined />} onClick={() => void share(x)}>{t('common.share')}</Button><Button size="small" icon={<EditOutlined />} onClick={() => showForm(x)}>{t('common.edit')}</Button></Space></RowActions></>} /></Card>
    <Modal centered className="survey-edit-modal" width={760} open={open} onCancel={() => setOpen(false)} onOk={save} confirmLoading={saving} okText={editing ? t('surveys.saveChanges') : t('surveys.list.create')} cancelText={t('common.cancel')} destroyOnHidden
      title={<div className="survey-edit-title"><span className="survey-edit-icon"><FileSearchOutlined /></span><div><strong>{editing ? t('surveys.list.editTitle') : t('surveys.list.create')}</strong><small>{editing ? <>{editing.surveyNumber}<Tag color="blue">{statusLabel(editing.status)}</Tag></> : t('surveys.list.autoNumber')}</small></div></div>}>
      <Form form={form} layout="vertical" requiredMark="optional" className="survey-edit-form">
        <section><h4>{t('surveys.list.source')}</h4><Form.Item label={t('surveys.list.salesLead')} name="salesLeadId" extra={t('surveys.list.salesLeadHelp')}><Select allowClear showSearch placeholder={t('surveys.list.salesLeadPlaceholder')} optionFilterProp="label" onChange={leadChanged} options={leads.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.leadNumber} · ${x.customerName}` }))} /></Form.Item></section>
        <section><h4>{t('common.customer')}</h4><div className="master-form-grid">
          <div className="full-width"><ContactMasterPicker kind="customer" onSelect={c => form.setFieldsValue({ salesLeadId: null, customerName: c.name, phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '' })} /></div><Form.Item className="full-width" label={t('surveys.list.customerName')} name="customerName" rules={[{ required: true, message: t('surveys.list.customerNameRequired') }]}><Input prefix={<UserOutlined />} placeholder={t('surveys.list.fullName')} /></Form.Item>
          <Form.Item label={t('common.phone')} name="phone" rules={[{ required: true, message: t('surveys.list.phoneRequired') }]}><Input prefix={<PhoneOutlined />} placeholder={t('surveys.list.phonePlaceholder')} /></Form.Item>
          <Form.Item label={t('common.email')} name="email" rules={[{ type: 'email', transform: value => value?.trim() || undefined, message: t('surveys.list.emailInvalid') }]}><Input prefix={<MailOutlined />} placeholder="name@example.com" /></Form.Item>
        </div></section>
        <section><h4>{t('surveys.list.schedule')}</h4><div className="master-form-grid">
          <Form.Item label={t('surveys.list.assignedSurveyor')} name="assignedEmployeeId" rules={[{ required: true, message: t('surveys.list.employeeRequired') }]}><Select showSearch placeholder={t('surveys.list.selectEmployee')} optionFilterProp="label" options={employees.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.fullName} · ${x.employeeNumber}` }))} /></Form.Item>
          <Form.Item label={t('surveys.list.dateTime')} name="scheduledAtLocal" rules={[{ required: true, message: t('surveys.list.dateTimeRequired') }]}><Input type="datetime-local" prefix={<ClockCircleOutlined />} /></Form.Item>
          <Form.Item className="full-width" label={t('surveys.list.location')} name="address" rules={[{ required: true, message: t('surveys.list.locationRequired') }]}><Input prefix={<EnvironmentOutlined />} placeholder={t('surveys.list.locationPlaceholder')} /></Form.Item>
        </div></section>
        <section><h4>{t('common.notes')}</h4><Form.Item name="notes"><Input.TextArea rows={3} showCount maxLength={2000} placeholder={t('surveys.list.notesPlaceholder')} /></Form.Item></section>
      </Form></Modal>
    <Modal centered className="survey-share-modal" title={t('surveys.list.shareTitle')} open={Boolean(shareInfo)} onCancel={() => setShareInfo(null)} footer={null} destroyOnHidden>{shareInfo && <Space direction="vertical" size="large" style={{ width: '100%' }}><Alert type="info" showIcon message={`${shareInfo.survey.customerName} · ${shareInfo.survey.surveyNumber}`} description={t('surveys.list.linkExpires', { date: formatDateTime(shareInfo.expiresAtUtc) })} /><Input.TextArea value={shareInfo.url} autoSize={{ minRows: 2, maxRows: 3 }} readOnly /><ShareChannels size="large" url={shareInfo.url} text={shareText} phone={shareInfo.survey.phone} email={shareInfo.survey.email} subject={t('surveys.list.shareSubject', { survey: shareInfo.survey.surveyNumber })} /><Typography.Text type="secondary">{t('surveys.list.shareHelp')}</Typography.Text></Space>}</Modal>
  </>
}


