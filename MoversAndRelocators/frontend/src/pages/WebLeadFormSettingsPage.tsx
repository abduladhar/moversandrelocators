import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, ColorPicker, Form, Input, Popconfirm, Row, Select, Space, Switch, Tag, Typography, message } from 'antd'
import { CopyOutlined, ExportOutlined, GlobalOutlined, ReloadOutlined } from '@ant-design/icons'
import { employeesApi, salesApi, webLeadFormApi, type WebLeadFormSettings, type WebLeadFormView } from '../api'
import type { Employee, LeadStatus, MoveType } from '../types'
import { PageHeader } from '../components/PageHeader'
import { languages, useT } from '../i18n'

type Values = Omit<WebLeadFormSettings, 'key'>
const blank: Values = { enabled: false, statusId: null, defaultMoveTypeId: null, assignedEmployeeId: null, source: 'Website', heading: null, intro: null, thankYou: null, accentColor: null, allowUploads: true, showCompanyName: true }

/** Sales › Website form: the company's public "request a quote" form, its texts and colour, where its leads go, and the code for the website. */
export function WebLeadFormSettingsPage() {
  const { t } = useT()
  const [form] = Form.useForm<Values>()
  const [view, setView] = useState<WebLeadFormView>(), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false)
  const [statuses, setStatuses] = useState<LeadStatus[]>([]), [moveTypes, setMoveTypes] = useState<MoveType[]>([]), [employees, setEmployees] = useState<Employee[]>([])
  const [lang, setLang] = useState(''), [previewHeight, setPreviewHeight] = useState(640), [previewVersion, setPreviewVersion] = useState(0)

  const show = (next: WebLeadFormView) => { setView(next); form.setFieldsValue({ ...blank, ...next.settings }); setPreviewVersion(v => v + 1) }
  const load = () => { setLoading(true); return Promise.all([webLeadFormApi.get(), salesApi.leadStatuses(), salesApi.moveTypes(), employeesApi.employees()])
    .then(([settings, s, m, e]) => { show(settings); setStatuses(s); setMoveTypes(m); setEmployees(e) }).catch(error => message.error(error.message)).finally(() => setLoading(false)) }
  useEffect(() => { void load() }, [])
  useEffect(() => {
    const listen = (event: MessageEvent) => { if (event.origin === window.location.origin && event.data?.type === 'crateway:lead-form-height') setPreviewHeight(Math.max(320, Number(event.data.height) || 0)) }
    window.addEventListener('message', listen); return () => window.removeEventListener('message', listen)
  }, [])

  const save = async () => {
    const values = await form.validateFields(); setSaving(true)
    try { show(await webLeadFormApi.save(view?.version ?? null, { ...blank, ...values, key: view?.settings.key ?? null })); message.success(t('sales.webForm.saved')) }
    catch (reason) { message.error(reason instanceof Error ? reason.message : t('sales.webForm.saveFailed')) }
    finally { setSaving(false) }
  }
  const newAddress = async () => {
    try { show(await webLeadFormApi.newAddress(view?.version ?? null)); message.success(t('sales.webForm.newAddressDone')) }
    catch (reason) { message.error(reason instanceof Error ? reason.message : t('sales.webForm.saveFailed')) }
  }
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => message.success(t('sales.webForm.copied')), () => message.error(t('sales.webForm.copyFailed')))

  const key = view?.settings.key, live = Boolean(key && view?.settings.enabled)
  const address = key ? `${window.location.origin}/lead-form/${encodeURIComponent(key)}${lang ? `?lang=${lang}` : ''}` : ''
  const frameAddress = key ? `${window.location.origin}/lead-form/${encodeURIComponent(key)}?embed=1${lang ? `&lang=${lang}` : ''}` : ''
  const snippet = key ? `<iframe id="crateway-lead-form" src="${frameAddress}" title="${t('sales.webForm.frameTitle')}" allow="camera; microphone" loading="lazy" style="width:100%;min-height:720px;border:0"></iframe>
<script>
addEventListener('message', function (e) {
  if (e.origin === '${window.location.origin}' && e.data && e.data.type === 'crateway:lead-form-height')
    document.getElementById('crateway-lead-form').style.height = e.data.height + 'px'
})
</script>` : ''
  const active = <T extends { id: string; isActive: boolean }>(rows: T[], current?: string | null) => rows.filter(x => x.isActive || x.id === current)

  return <>
    <PageHeader onRefresh={load} refreshDisabled={saving || loading} eyebrow={t('shell.nav.sales')} title={t('sales.webForm.title')} description={t('sales.webForm.description')} />
    <Row gutter={[14, 14]}>
      <Col xs={24} xl={14}>
        <Card title={<Space><GlobalOutlined /> {t('sales.webForm.formCard')}</Space>}
          extra={live ? <Tag color="success">{t('sales.webForm.live')}</Tag> : <Tag>{t('sales.webForm.off')}</Tag>}>
          <Form form={form} layout="vertical" requiredMark={false} className="settings-form">
            <Form.Item label={t('sales.webForm.enabled')} name="enabled" valuePropName="checked" extra={t('sales.webForm.enabledHint')}><Switch /></Form.Item>
            <Form.Item label={t('sales.webForm.accent')} name="accentColor" extra={t('sales.webForm.accentHint')} getValueFromEvent={color => typeof color === 'string' ? color : color?.toHexString()}>
              <ColorPicker showText allowClear onClear={() => form.setFieldValue('accentColor', null)} /></Form.Item>
            <Form.Item label={t('sales.webForm.heading')} name="heading" className="settings-form-wide" rules={[{ max: 160 }]}><Input placeholder={t('customer.leadForm.defaultHeading')} /></Form.Item>
            <Form.Item label={t('sales.webForm.intro')} name="intro" className="settings-form-wide" rules={[{ max: 1000 }]}><Input.TextArea rows={2} placeholder={t('customer.leadForm.defaultIntro')} /></Form.Item>
            <Form.Item label={t('sales.webForm.thankYou')} name="thankYou" className="settings-form-wide" rules={[{ max: 1000 }]}><Input.TextArea rows={2} placeholder={t('customer.leadForm.defaultThankYou')} /></Form.Item>
            <Form.Item label={t('sales.webForm.allowUploads')} name="allowUploads" valuePropName="checked" extra={t('sales.webForm.allowUploadsHint')}><Switch /></Form.Item>
            <Form.Item label={t('sales.webForm.showCompanyName')} name="showCompanyName" valuePropName="checked" extra={t('sales.webForm.showCompanyNameHint')}><Switch /></Form.Item>
            <Typography.Title level={5} className="settings-form-wide">{t('sales.webForm.newLeads')}</Typography.Title>
            <Form.Item label={t('sales.webForm.defaultMoveType')} name="defaultMoveTypeId" extra={t('sales.webForm.defaultMoveTypeHint')}>
              <Select allowClear options={active(moveTypes, form.getFieldValue('defaultMoveTypeId')).map(x => ({ value: x.id, label: x.name }))} placeholder={t('sales.webForm.customerChooses')} /></Form.Item>
            <Form.Item label={t('sales.webForm.status')} name="statusId" extra={t('sales.webForm.statusHint')}>
              <Select allowClear options={active(statuses, form.getFieldValue('statusId')).filter(x => !x.isClosed).map(x => ({ value: x.id, label: x.name }))} placeholder={t('sales.webForm.firstOpenStatus')} /></Form.Item>
            <Form.Item label={t('sales.webForm.assignTo')} name="assignedEmployeeId">
              <Select allowClear showSearch optionFilterProp="label" options={active(employees, form.getFieldValue('assignedEmployeeId')).map(x => ({ value: x.id, label: x.fullName }))} placeholder={t('sales.webForm.nobody')} /></Form.Item>
            <Form.Item label={t('sales.webForm.source')} name="source" extra={t('sales.webForm.sourceHint')} rules={[{ max: 100 }]}><Input placeholder="Website" /></Form.Item>
            <div className="settings-form-wide"><Button type="primary" loading={saving} onClick={() => void save()}>{t('sales.webForm.save')}</Button></div>
          </Form>
        </Card>
      </Col>
      <Col xs={24} xl={10}>
        <Card loading={loading} title={t('sales.webForm.websiteCard')}>
          {!key ? <Alert type="info" showIcon title={t('sales.webForm.saveFirst')} /> : <Space orientation="vertical" size={14} style={{ width: '100%' }}>
            {!view?.settings.enabled && <Alert type="warning" showIcon title={t('sales.webForm.offWarning')} />}
            {view?.captchaOn ? <Alert type="success" showIcon title={t('sales.webForm.captchaOn')} description={t('sales.webForm.captchaOnText')} />
              : <Alert type="warning" showIcon title={t('sales.webForm.captchaOff')} description={t('sales.webForm.captchaOffText')} />}
            <div><Typography.Text strong>{t('sales.webForm.language')}</Typography.Text>
              <Select style={{ width: '100%', marginTop: 6 }} value={lang} onChange={setLang} options={[{ value: '', label: t('sales.webForm.visitorLanguage') }, ...languages.map(l => ({ value: l.code, label: l.name }))]} /></div>
            <div><Typography.Text strong>{t('sales.webForm.link')}</Typography.Text>
              <Space.Compact style={{ width: '100%', marginTop: 6 }}><Input readOnly value={address} aria-label={t('sales.webForm.link')} />
                <Button icon={<CopyOutlined />} onClick={() => void copy(address)} aria-label={t('sales.webForm.copyLink')} />
                <Button icon={<ExportOutlined />} href={address} target="_blank" rel="noopener" aria-label={t('sales.webForm.open')} /></Space.Compact>
              <Typography.Text type="secondary" className="field-note">{t('sales.webForm.linkHint')}</Typography.Text></div>
            <div><Typography.Text strong>{t('sales.webForm.embed')}</Typography.Text>
              <Input.TextArea readOnly value={snippet} autoSize={{ minRows: 4, maxRows: 9 }} className="code-snippet" style={{ marginTop: 6 }} aria-label={t('sales.webForm.embed')} />
              <Space wrap style={{ marginTop: 8 }}><Button icon={<CopyOutlined />} onClick={() => void copy(snippet)}>{t('sales.webForm.copyCode')}</Button>
                <Popconfirm title={t('sales.webForm.newAddressConfirm')} description={t('sales.webForm.newAddressHint')} onConfirm={() => void newAddress()}><Button icon={<ReloadOutlined />}>{t('sales.webForm.newAddress')}</Button></Popconfirm></Space>
              <Typography.Paragraph type="secondary" className="field-note">{t('sales.webForm.embedHint')}</Typography.Paragraph></div>
          </Space>}
        </Card>
      </Col>
      {live && <Col xs={24}>
        <Card title={t('sales.webForm.preview')} extra={<Typography.Text type="secondary">{t('sales.webForm.previewHint')}</Typography.Text>}>
          <iframe key={`${previewVersion}-${lang}`} className="web-lead-preview" src={frameAddress} title={t('sales.webForm.preview')} style={{ height: previewHeight }} />
        </Card>
      </Col>}
    </Row>
  </>
}
