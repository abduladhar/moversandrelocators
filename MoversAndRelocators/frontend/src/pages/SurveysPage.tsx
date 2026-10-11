import { ContactMasterPicker } from '../components/ContactMasterPicker'
import { SurveyMapLink } from '../components/SurveyMapLink'
import { RowActions } from '../components/RowActions'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Col, Form, Input, Modal, Row, Select, Space, Statistic, Tag, Typography, message } from 'antd'
import { ClockCircleOutlined, CopyOutlined, EditOutlined, EnvironmentOutlined, FileSearchOutlined, LinkOutlined, MailOutlined, PhoneOutlined, ShareAltOutlined, UserOutlined, WhatsAppOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { employeesApi, salesApi, surveysApi } from '../api'
import type { Employee, SalesLead, Survey, SurveyInput } from '../types'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { PageHeader } from '../components/PageHeader'
import { ResponsiveDataView } from '../components/ResponsiveDataView'
import { useInfiniteRows } from '../hooks/useInfiniteRows'
import { SurveyDetailPage } from './SurveyDetailPage'

type SurveyForm = Omit<SurveyInput, 'scheduledAtUtc'> & { scheduledAtLocal: string }
type SurveyShare = { survey: Survey; url: string; expiresAtUtc: string }

const statusColor: Record<string, string> = { SCHEDULED: 'blue', CONFIRMED: 'cyan', IN_PROGRESS: 'orange', COMPLETED: 'green' }
const localDateTime = (utc: string) => { const d = new Date(utc); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

export function SurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]), [employees, setEmployees] = useState<Employee[]>([]), [leads, setLeads] = useState<SalesLead[]>([])
  const [query, setQuery] = useState(''), [status, setStatus] = useState<string>(), [open, setOpen] = useState(false), [editing, setEditing] = useState<Survey | null>(null), [saving, setSaving] = useState(false)
  const [shareInfo, setShareInfo] = useState<SurveyShare | null>(null), [generatingLink, setGeneratingLink] = useState(false), [detailPageId, setDetailPageId] = useState<string | null>(null)
  const [form] = Form.useForm<SurveyForm>()
  const load = () => Promise.all([surveysApi.surveys(), employeesApi.employees(), salesApi.leads()]).then(([a, b, c]) => { setSurveys(a); setEmployees(b); setLeads(c) }).catch(error => message.error(error.message))
  useEffect(() => { void load() }, [])
  const filtered = useMemo(() => surveys.filter(x => `${x.surveyNumber} ${x.customerName} ${x.assignedEmployeeName} ${x.address}`.toLowerCase().includes(query.toLowerCase()) && (!status || x.status === status)), [surveys, query, status])
  const { visibleRows, onScroll, hasMore } = useInfiniteRows(filtered, `${query}|${status}`)
  const showForm = (record?: Survey) => { setEditing(record ?? null); form.setFieldsValue(record ? { ...record, email: record.email ?? '', notes: record.notes ?? '', scheduledAtLocal: localDateTime(record.scheduledAtUtc) } : { surveyNumber: `SVY-${Date.now().toString().slice(-6)}`, salesLeadId: null, customerName: '', phone: '', email: '', assignedEmployeeId: '', scheduledAtLocal: localDateTime(new Date(Date.now() + 86400000).toISOString()), address: '', notes: '' }); setOpen(true) }
  const leadChanged = (id?: string) => { const lead = leads.find(x => x.id === id); if (lead) form.setFieldsValue({ salesLeadId: lead.id, customerName: lead.customerName, phone: lead.phone, email: lead.email ?? '', address: lead.origin }) }
  const save = async () => { const value = await form.validateFields(); const input: SurveyInput = { ...value, email: value.email?.trim() ?? '', scheduledAtUtc: new Date(value.scheduledAtLocal).toISOString() }; setSaving(true); try { editing ? await surveysApi.update(editing.id, input) : await surveysApi.create(input); setOpen(false); await load(); message.success('Survey saved') } catch (error) { message.error(error instanceof Error ? error.message : 'Unable to save') } finally { setSaving(false) } }
  const share = async (record: Survey) => { setGeneratingLink(true); try { const link = await surveysApi.link(record.id); setShareInfo({ survey: record, ...link }) } catch (error) { message.error(error instanceof Error ? error.message : 'Unable to generate link') } finally { setGeneratingLink(false) } }
  const shareText = shareInfo ? `Hello ${shareInfo.survey.customerName}, please confirm your moving survey ${shareInfo.survey.surveyNumber}, scheduled for ${new Date(shareInfo.survey.scheduledAtUtc).toLocaleString()}: ${shareInfo.url}` : ''
  const copyLink = async () => { if (!shareInfo) return; try { await navigator.clipboard.writeText(shareInfo.url); message.success('Confirmation link copied') } catch { message.error('Unable to copy automatically. Select and copy the link below.') } }
  const shareEmail = () => { if (!shareInfo) return; window.open(`mailto:${encodeURIComponent(shareInfo.survey.email ?? '')}?subject=${encodeURIComponent(`Confirm your moving survey ${shareInfo.survey.surveyNumber}`)}&body=${encodeURIComponent(shareText)}`, '_self') }
  const shareWhatsApp = () => { if (!shareInfo) return; const phone = shareInfo.survey.phone.replace(/\D/g, ''); window.open(`https://wa.me/${phone.length >= 8 ? phone : ''}?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer') }
  const nativeShare = async () => { if (!shareInfo || !navigator.share) return; try { await navigator.share({ title: `Survey ${shareInfo.survey.surveyNumber}`, text: shareText, url: shareInfo.url }) } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) message.error('Unable to open the share menu') } }
  const columns: ColumnsType<Survey> = [
    { title: 'Survey', key: 'survey', sorter: (a, b) => a.serialNo - b.serialNo, defaultSortOrder: 'descend', render: (_, x) => <div className="primary-cell"><strong>{x.surveyNumber}</strong><small>#{x.serialNo} · {x.customerName}</small></div> },
    { title: 'Schedule', dataIndex: 'scheduledAtUtc', sorter: (a, b) => new Date(a.scheduledAtUtc).getTime() - new Date(b.scheduledAtUtc).getTime(), render: x => new Date(x).toLocaleString() },
    { title: 'Assigned to', dataIndex: 'assignedEmployeeName', sorter: (a, b) => a.assignedEmployeeName.localeCompare(b.assignedEmployeeName) },
    { title: 'Status', dataIndex: 'status', filters: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].map(x => ({ text: x.replaceAll('_', ' '), value: x })), onFilter: (value, record) => record.status === value, render: x => <Tag color={statusColor[x]}>{x.replaceAll('_', ' ')}</Tag> },
    { title: 'Actions', key: 'actions', align: 'right', render: (_, x) => <RowActions><Space wrap><Button size="small" onClick={() => setDetailPageId(x.id)}>Open survey</Button><SurveyMapLink address={x.address} latitude={x.latitude} longitude={x.longitude} /><Button size="small" loading={generatingLink} icon={<LinkOutlined />} onClick={() => void share(x)}>Share</Button><Button size="small" icon={<EditOutlined />} onClick={() => showForm(x)}>Edit</Button></Space></RowActions> },
  ]

  if (detailPageId) return <SurveyDetailPage surveyId={detailPageId} onBack={() => setDetailPageId(null)} onChanged={() => void load()} />
  return <>
    <PageHeader onRefresh={load} eyebrow="SURVEY OPERATIONS" title="Surveys" description="Schedule visits, collect room inventories, calculate packing and prepare quotation-ready costs." action="Create survey" onAction={() => showForm()} filters={<AdvancedSearch value={query} onChange={setQuery} onReset={() => { setQuery(''); setStatus(undefined) }} active={Boolean(status)}><Select showSearch allowClear optionFilterProp="label" placeholder="Survey status" value={status} onChange={setStatus} options={['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].map(x => ({ value: x, label: x.replaceAll('_', ' ') }))} /></AdvancedSearch>} />
    <Row gutter={[12, 12]} className="stats-row"><Col xs={12} md={6}><Card><Statistic title="All surveys" value={surveys.length} /></Card></Col><Col xs={12} md={6}><Card><Statistic title="Awaiting confirmation" value={surveys.filter(x => !x.scheduleConfirmedAtUtc).length} /></Card></Col><Col xs={12} md={6}><Card><Statistic title="In progress" value={surveys.filter(x => x.status === 'IN_PROGRESS').length} /></Card></Col><Col xs={12} md={6}><Card><Statistic title="Quotation ready" value={surveys.filter(x => x.status === 'COMPLETED').length} /></Card></Col></Row>
    <Card className="grid-card" title="Survey schedule" extra={`${filtered.length} records`}><ResponsiveDataView rowKey="id" columns={columns} data={visibleRows} onScroll={onScroll} hasMore={hasMore} total={filtered.length} label="surveys" renderTile={x => <><div className="tile-heading"><div className="primary-cell"><strong>{x.surveyNumber}</strong><small>{x.customerName}</small></div><Tag color={statusColor[x.status]}>{x.status.replaceAll('_', ' ')}</Tag></div><div className="tile-details"><span><ClockCircleOutlined /> {new Date(x.scheduledAtUtc).toLocaleString()}</span><span>{x.assignedEmployeeName}</span><span><EnvironmentOutlined /> {x.address}</span></div><RowActions><Space wrap className="tile-actions"><Button size="small" onClick={() => setDetailPageId(x.id)}>Open survey</Button><SurveyMapLink address={x.address} latitude={x.latitude} longitude={x.longitude} /><Button size="small" loading={generatingLink} icon={<LinkOutlined />} onClick={() => void share(x)}>Share</Button><Button size="small" icon={<EditOutlined />} onClick={() => showForm(x)}>Edit</Button></Space></RowActions></>} /></Card>
    <Modal centered className="survey-edit-modal" width={760} open={open} onCancel={() => setOpen(false)} onOk={save} confirmLoading={saving} okText={editing ? 'Save changes' : 'Create survey'} destroyOnHidden
      title={<div className="survey-edit-title"><span className="survey-edit-icon"><FileSearchOutlined /></span><div><strong>{editing ? 'Edit survey' : 'Create survey'}</strong><small>{editing ? <>{editing.surveyNumber}<Tag color="blue">{editing.status}</Tag></> : 'Survey number is assigned automatically on save'}</small></div></div>}>
      <Form form={form} layout="vertical" requiredMark="optional" className="survey-edit-form">
        <section><h4>Source</h4><Form.Item label="Sales lead" name="salesLeadId" extra="Selecting a lead fills in the customer details."><Select allowClear showSearch placeholder="Link to a sales lead" optionFilterProp="label" onChange={leadChanged} options={leads.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.leadNumber} · ${x.customerName}` }))} /></Form.Item></section>
        <section><h4>Customer</h4><div className="master-form-grid">
          <div className="full-width"><ContactMasterPicker kind="customer" onSelect={c => form.setFieldsValue({ salesLeadId: null, customerName: c.name, phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '' })} /></div><Form.Item className="full-width" label="Customer name" name="customerName" rules={[{ required: true, message: 'Enter the customer name' }]}><Input prefix={<UserOutlined />} placeholder="Full name" /></Form.Item>
          <Form.Item label="Phone" name="phone" rules={[{ required: true, message: 'Enter a phone number' }]}><Input prefix={<PhoneOutlined />} placeholder="Include country code" /></Form.Item>
          <Form.Item label="Email" name="email" rules={[{ type: 'email', transform: value => value?.trim() || undefined, message: 'Enter a valid email address or leave it blank' }]}><Input prefix={<MailOutlined />} placeholder="name@example.com" /></Form.Item>
        </div></section>
        <section><h4>Schedule</h4><div className="master-form-grid">
          <Form.Item label="Assigned surveyor" name="assignedEmployeeId" rules={[{ required: true, message: 'Select an employee' }]}><Select showSearch placeholder="Select employee" optionFilterProp="label" options={employees.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.fullName} · ${x.employeeNumber}` }))} /></Form.Item>
          <Form.Item label="Date and time" name="scheduledAtLocal" rules={[{ required: true, message: 'Choose a date and time' }]}><Input type="datetime-local" prefix={<ClockCircleOutlined />} /></Form.Item>
          <Form.Item className="full-width" label="Survey location" name="address" rules={[{ required: true, message: 'Enter the survey address' }]}><Input prefix={<EnvironmentOutlined />} placeholder="Street, building, city" /></Form.Item>
        </div></section>
        <section><h4>Notes</h4><Form.Item name="notes"><Input.TextArea rows={3} showCount maxLength={2000} placeholder="Access instructions, parking, fragile or special items…" /></Form.Item></section>
      </Form></Modal>
    <Modal centered className="survey-share-modal" title="Share customer confirmation" open={Boolean(shareInfo)} onCancel={() => setShareInfo(null)} footer={null} destroyOnHidden>{shareInfo && <Space direction="vertical" size="large" style={{ width: '100%' }}><Alert type="info" showIcon message={`${shareInfo.survey.customerName} · ${shareInfo.survey.surveyNumber}`} description={`Link expires ${new Date(shareInfo.expiresAtUtc).toLocaleString()}. Generating another link will replace this link.`} /><Input.TextArea value={shareInfo.url} autoSize={{ minRows: 2, maxRows: 3 }} readOnly /><div className="survey-share-actions"><Button className="share-whatsapp" size="large" icon={<WhatsAppOutlined />} onClick={shareWhatsApp}>WhatsApp</Button><Button size="large" icon={<MailOutlined />} onClick={shareEmail}>Email</Button><Button size="large" icon={<CopyOutlined />} onClick={() => void copyLink()}>Copy link</Button>{typeof navigator.share === 'function' && <Button size="large" icon={<ShareAltOutlined />} onClick={() => void nativeShare()}>More</Button>}</div><Typography.Text type="secondary">WhatsApp uses the customer phone number when it includes the country code. Email opens the device’s configured email application.</Typography.Text></Space>}</Modal>
  </>
}


