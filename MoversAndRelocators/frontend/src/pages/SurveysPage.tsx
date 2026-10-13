import { nowLocal } from '../dates'
import { ContactMasterPicker } from '../components/ContactMasterPicker'
import { useMessageTemplate } from '../messageTemplates'
import { ShareChannels } from '../components/ShareChannels'
import { SurveyMapLink } from '../components/SurveyMapLink'
import { RowActions } from '../components/RowActions'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Col, Form, Input, Modal, Row, Select, Space, Statistic, Tag, Typography, message } from 'antd'
import { EditOutlined, LinkOutlined, MailOutlined, ClockCircleOutlined, EnvironmentOutlined, FileSearchOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { employeesApi, salesApi, surveysApi } from '../api'
import type { Employee, SalesLead, Survey, SurveyInput } from '../types'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { PageHeader } from '../components/PageHeader'
import { ResponsiveDataView } from '../components/ResponsiveDataView'
import { useInfiniteRows } from '../hooks/useInfiniteRows'
import { SurveyDetailPage } from './SurveyDetailPage'
import { formatDateTime, useT } from '../i18n'

type SurveyForm = Omit<SurveyInput, 'scheduledAtUtc'> & { scheduledAtLocal: string }
type SurveyShare = { survey: Survey; url: string; expiresAtUtc: string }

const statusColor: Record<string, string> = { SCHEDULED: 'blue', CONFIRMED: 'cyan', IN_PROGRESS: 'orange', COMPLETED: 'green' }
const localDateTime = (utc: string) => { const d = new Date(utc); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

export function SurveysPage() {
  const { t } = useT()
  const statusLabel = (status: string) => t('surveys.status.' + status)
  const [surveys, setSurveys] = useState<Survey[]>([]), [employees, setEmployees] = useState<Employee[]>([]), [leads, setLeads] = useState<SalesLead[]>([])
  const [query, setQuery] = useState(''), [status, setStatus] = useState<string>(), [open, setOpen] = useState(false), [editing, setEditing] = useState<Survey | null>(null), [saving, setSaving] = useState(false)
  const [shareInfo, setShareInfo] = useState<SurveyShare | null>(null), [generatingLink, setGeneratingLink] = useState(false), [detailPageId, setDetailPageId] = useState<string | null>(null)
  const [form] = Form.useForm<SurveyForm>()
  const load = () => Promise.all([surveysApi.surveys(), employeesApi.employees(), salesApi.leads()]).then(([a, b, c]) => { setSurveys(a); setEmployees(b); setLeads(c) }).catch(error => message.error(error.message))
  useEffect(() => { void load() }, [])
  const filtered = useMemo(() => surveys.filter(x => `${x.surveyNumber} ${x.customerName} ${x.assignedEmployeeName} ${x.address}`.toLowerCase().includes(query.toLowerCase()) && (!status || x.status === status)), [surveys, query, status])
  const { message: surveyMessage } = useMessageTemplate('SURVEY_CONFIRM')
  const { visibleRows, onScroll, hasMore } = useInfiniteRows(filtered, `${query}|${status}`)
  const showForm = (record?: Survey) => { setEditing(record ?? null); form.setFieldsValue(record ? { ...record, email: record.email ?? '', notes: record.notes ?? '', scheduledAtLocal: localDateTime(record.scheduledAtUtc) } : { surveyNumber: `SVY-${Date.now().toString().slice(-6)}`, salesLeadId: null, customerName: '', phone: '', email: '', assignedEmployeeId: '', scheduledAtLocal: nowLocal(), address: '', notes: '' }); setOpen(true) }
  const leadChanged = (id?: string) => { const lead = leads.find(x => x.id === id); if (lead) form.setFieldsValue({ salesLeadId: lead.id, customerName: lead.customerName, phone: lead.phone, email: lead.email ?? '', address: lead.origin }) }
  const save = async () => { const value = await form.validateFields(); const input: SurveyInput = { ...value, email: value.email?.trim() ?? '', scheduledAtUtc: new Date(value.scheduledAtLocal).toISOString() }; setSaving(true); try { editing ? await surveysApi.update(editing.id, input) : await surveysApi.create(input); setOpen(false); await load(); message.success(t('surveys.list.saved')) } catch (error) { message.error(error instanceof Error ? error.message : t('surveys.list.saveFailed')) } finally { setSaving(false) } }
  const share = async (record: Survey) => { setGeneratingLink(true); try { const link = await surveysApi.link(record.id); setShareInfo({ survey: record, ...link }) } catch (error) { message.error(error instanceof Error ? error.message : t('surveys.list.linkFailed')) } finally { setGeneratingLink(false) } }
  const shareText = shareInfo ? surveyMessage({ customer: shareInfo.survey.customerName, reference: shareInfo.survey.surveyNumber, date: formatDateTime(shareInfo.survey.scheduledAtUtc), link: shareInfo.url }) : ''
  const columns: ColumnsType<Survey> = [
    { title: t('surveys.list.survey'), key: 'survey', sorter: (a, b) => a.serialNo - b.serialNo, defaultSortOrder: 'descend', render: (_, x) => <div className="primary-cell"><strong>{x.surveyNumber}</strong><small>#{x.serialNo} · {x.customerName}</small></div> },
    { title: t('surveys.list.schedule'), dataIndex: 'scheduledAtUtc', sorter: (a, b) => new Date(a.scheduledAtUtc).getTime() - new Date(b.scheduledAtUtc).getTime(), render: x => formatDateTime(x) },
    { title: t('surveys.list.assignedTo'), dataIndex: 'assignedEmployeeName', sorter: (a, b) => a.assignedEmployeeName.localeCompare(b.assignedEmployeeName) },
    { title: t('common.status'), dataIndex: 'status', filters: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].map(x => ({ text: statusLabel(x), value: x })), onFilter: (value, record) => record.status === value, render: x => <Tag color={statusColor[x]}>{statusLabel(x)}</Tag> },
    { title: t('common.actions'), key: 'actions', align: 'right', render: (_, x) => <RowActions><Space wrap><Button size="small" onClick={() => setDetailPageId(x.id)}>{t('surveys.list.openSurvey')}</Button><SurveyMapLink address={x.address} latitude={x.latitude} longitude={x.longitude} /><Button size="small" loading={generatingLink} icon={<LinkOutlined />} onClick={() => void share(x)}>{t('common.share')}</Button><Button size="small" icon={<EditOutlined />} onClick={() => showForm(x)}>{t('common.edit')}</Button></Space></RowActions> },
  ]

  if (detailPageId) return <SurveyDetailPage surveyId={detailPageId} onBack={() => setDetailPageId(null)} onChanged={() => void load()} />
  return <>
    <PageHeader onRefresh={load} eyebrow={t('surveys.list.eyebrow')} title={t('surveys.list.title')} description={t('surveys.list.description')} action={t('surveys.list.create')} onAction={() => showForm()} filters={<AdvancedSearch value={query} onChange={setQuery} onReset={() => { setQuery(''); setStatus(undefined) }} active={Boolean(status)}><Select showSearch allowClear optionFilterProp="label" placeholder={t('surveys.list.statusFilter')} value={status} onChange={setStatus} options={['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].map(x => ({ value: x, label: statusLabel(x) }))} /></AdvancedSearch>} />
    <Row gutter={[12, 12]} className="stats-row"><Col xs={12} md={6}><Card><Statistic title={t('surveys.list.allSurveys')} value={surveys.length} /></Card></Col><Col xs={12} md={6}><Card><Statistic title={t('surveys.list.awaitingConfirmation')} value={surveys.filter(x => !x.scheduleConfirmedAtUtc).length} /></Card></Col><Col xs={12} md={6}><Card><Statistic title={t('surveys.list.inProgress')} value={surveys.filter(x => x.status === 'IN_PROGRESS').length} /></Card></Col><Col xs={12} md={6}><Card><Statistic title={t('surveys.list.quotationReady')} value={surveys.filter(x => x.status === 'COMPLETED').length} /></Card></Col></Row>
    <Card className="grid-card" title={t('surveys.list.scheduleTitle')} extra={t('surveys.records', { count: filtered.length })}><ResponsiveDataView rowKey="id" columns={columns} data={visibleRows} onScroll={onScroll} hasMore={hasMore} total={filtered.length} label={t('surveys.list.gridLabel')} renderTile={x => <><div className="tile-heading"><div className="primary-cell"><strong>{x.surveyNumber}</strong><small>{x.customerName}</small></div><Tag color={statusColor[x.status]}>{statusLabel(x.status)}</Tag></div><div className="tile-details"><span><ClockCircleOutlined /> {formatDateTime(x.scheduledAtUtc)}</span><span>{x.assignedEmployeeName}</span><span><EnvironmentOutlined /> {x.address}</span></div><RowActions><Space wrap className="tile-actions"><Button size="small" onClick={() => setDetailPageId(x.id)}>{t('surveys.list.openSurvey')}</Button><SurveyMapLink address={x.address} latitude={x.latitude} longitude={x.longitude} /><Button size="small" loading={generatingLink} icon={<LinkOutlined />} onClick={() => void share(x)}>{t('common.share')}</Button><Button size="small" icon={<EditOutlined />} onClick={() => showForm(x)}>{t('common.edit')}</Button></Space></RowActions></>} /></Card>
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


