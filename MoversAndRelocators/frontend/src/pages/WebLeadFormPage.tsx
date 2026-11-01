import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Alert, Button, ConfigProvider, DatePicker, Form, Input, Result, Select, Skeleton, Typography } from 'antd'
import { ArrowRightOutlined, CheckCircleFilled, CheckOutlined, FileOutlined, LockOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { publicLeadFormApi, publicUploadApi, type PublicLeadForm, type WebLeadSubmitted } from '../api'
import { MediaCapture } from '../components/MediaCapture'
import { LanguageSwitcher } from '../i18n/LanguageSwitcher'
import { formatDateTime, useT } from '../i18n'

type Values = { customerName: string; phone: string; email?: string; moveTypeId?: string; origin: string; destination: string; expectedMoveDate?: Dayjs; notes?: string; website?: string }
type Sent = WebLeadSubmitted & { customerName: string }

/** The form works inside the company's website (?embed=1 in an iframe): it reports its height so the frame can fit it. */
export const embedded = new URLSearchParams(window.location.search).get('embed') === '1'
const storageKey = (key: string) => `crateway_lead_form_${key}`
const remembered = (key: string): Sent | null => { try { return JSON.parse(sessionStorage.getItem(storageKey(key)) ?? 'null') } catch { return null } }
const remember = (key: string, sent: Sent | null) => { try { if (sent) sessionStorage.setItem(storageKey(key), JSON.stringify(sent)); else sessionStorage.removeItem(storageKey(key)) } catch { /* storage unavailable */ } }

/**
 * Public "request a quote" page for the company's website. No sign-in: step 1 creates the sales lead, step 2 lets the
 * customer add documents, photos, videos and voice notes to it (through the lead's customer upload link).
 */
export function WebLeadFormPage({ formKey }: { formKey: string }) {
  const { t } = useT()
  const [form] = Form.useForm<Values>()
  const [page, setPage] = useState<PublicLeadForm>(), [missing, setMissing] = useState(false)
  const [sent, setSent] = useState<Sent | null>(() => remembered(formKey)), [finished, setFinished] = useState(false)
  const [sending, setSending] = useState(false), [error, setError] = useState<string>()
  const [uploaded, setUploaded] = useState<string[]>([])
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => { publicLeadFormApi.get(formKey).then(setPage).catch(() => setMissing(true)) }, [formKey])
  useEffect(() => { if (page?.defaultMoveTypeId) form.setFieldValue('moveTypeId', page.defaultMoveTypeId) }, [page, form])
  useEffect(() => {
    if (!embedded || !root.current || window.parent === window) return
    const report = () => window.parent.postMessage({ type: 'crateway:lead-form-height', key: formKey, height: Math.ceil(root.current?.getBoundingClientRect().height ?? 0) }, '*')
    const observer = new ResizeObserver(report); observer.observe(root.current); report()
    return () => observer.disconnect()
  }, [formKey, page, missing])
  const step = !sent ? 1 : sent.uploadToken && !finished ? 2 : 3
  useEffect(() => { if (step > 1) root.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }, [step])

  const submit = async (values: Values) => {
    setSending(true); setError(undefined)
    try {
      const result = await publicLeadFormApi.submit(formKey, { ...values, email: values.email || null, notes: values.notes || null, website: values.website || null,
        moveTypeId: values.moveTypeId ?? null, expectedMoveDate: values.expectedMoveDate?.format('YYYY-MM-DD') ?? null })
      const next = { ...result, customerName: values.customerName.trim() }
      setSent(next); if (next.uploadToken) remember(formKey, next)
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('customer.leadForm.sendFailed')) }
    finally { setSending(false) }
  }
  const finish = () => { remember(formKey, null); setFinished(true) }
  const startOver = () => { remember(formKey, null); setSent(null); setFinished(false); setUploaded([]); form.resetFields(); if (page?.defaultMoveTypeId) form.setFieldValue('moveTypeId', page.defaultMoveTypeId) }

  const accent = page?.accentColor || undefined
  const shell = (body: ReactNode) => <ConfigProvider theme={accent ? { token: { colorPrimary: accent, colorLink: accent } } : undefined}>
    <div ref={root} className={`web-lead-form${embedded ? ' is-embedded' : ''}`} style={accent ? { '--lead-accent': accent, '--cw-brand': accent, '--cw-brand-hover': `color-mix(in srgb, ${accent} 84%, black)` } as CSSProperties : undefined}>
      <div className="web-lead-card">{body}</div>
      {!embedded && <p className="web-lead-privacy"><LockOutlined /> {t('customer.leadForm.privacy')}</p>}
    </div>
  </ConfigProvider>

  if (missing) return shell(<Result status="warning" title={t('customer.leadForm.unavailableTitle')} subTitle={t('customer.leadForm.unavailableText')} />)
  if (!page) return shell(<Skeleton active paragraph={{ rows: 8 }} />)

  const steps = [t('customer.leadForm.stepDetails'), ...(page.allowUploads ? [t('customer.leadForm.stepFiles')] : []), t('customer.leadForm.stepDone')]
  const current = step === 1 ? 0 : step === 2 ? 1 : steps.length - 1
  return shell(<>
    <header className="web-lead-head">
      <div>
        {page.showCompanyName && page.companyName && <span className="web-lead-company">{page.companyName}</span>}
        <Typography.Title level={2}>{page.heading || t('customer.leadForm.defaultHeading')}</Typography.Title>
        {step === 1 && <Typography.Paragraph>{page.intro || t('customer.leadForm.defaultIntro')}</Typography.Paragraph>}
      </div>
      <LanguageSwitcher compact />
    </header>
    <ol className="web-lead-steps" aria-label={t('customer.leadForm.progress')}>
      {steps.map((label, index) => <li key={label} className={index < current ? 'is-done' : index === current ? 'is-here' : undefined} aria-current={index === current ? 'step' : undefined}>
        <span>{index < current ? <CheckOutlined /> : index + 1}</span>{label}</li>)}
    </ol>

    {step === 1 && <Form form={form} layout="vertical" requiredMark={false} onFinish={values => void submit(values)} className="web-lead-fields" disabled={sending}>
      <Form.Item name="customerName" label={t('customer.leadForm.name')} rules={[{ required: true, whitespace: true, min: 2, max: 160, message: t('customer.leadForm.nameRequired') }]}><Input autoComplete="name" size="large" /></Form.Item>
      <Form.Item name="phone" label={t('customer.leadForm.phone')} rules={[{ required: true, whitespace: true, min: 5, max: 40, message: t('customer.leadForm.phoneRequired') }]}><Input autoComplete="tel" inputMode="tel" size="large" /></Form.Item>
      <Form.Item name="email" label={t('customer.leadForm.email')} rules={[{ type: 'email', max: 254, message: t('customer.leadForm.emailInvalid') }]}><Input autoComplete="email" inputMode="email" size="large" /></Form.Item>
      <Form.Item name="moveTypeId" label={t('customer.leadForm.moveType')} rules={[{ required: page.moveTypes.length > 0, message: t('customer.leadForm.moveTypeRequired') }]}>
        <Select size="large" options={page.moveTypes.map(x => ({ value: x.id, label: x.name, title: x.description ?? x.name }))} placeholder={t('customer.leadForm.moveTypePlaceholder')} /></Form.Item>
      <Form.Item name="origin" label={t('customer.leadForm.origin')} rules={[{ required: true, whitespace: true, max: 300, message: t('customer.leadForm.originRequired') }]}><Input autoComplete="address-level2" size="large" placeholder={t('customer.leadForm.originPlaceholder')} /></Form.Item>
      <Form.Item name="destination" label={t('customer.leadForm.destination')} rules={[{ required: true, whitespace: true, max: 300, message: t('customer.leadForm.destinationRequired') }]}><Input size="large" placeholder={t('customer.leadForm.destinationPlaceholder')} /></Form.Item>
      <Form.Item name="expectedMoveDate" label={t('customer.leadForm.moveDate')}><DatePicker size="large" style={{ width: '100%' }} disabledDate={d => d.isBefore(dayjs(), 'day')} /></Form.Item>
      <Form.Item name="notes" label={t('customer.leadForm.notes')} className="web-lead-wide" rules={[{ max: 2000 }]}><Input.TextArea rows={3} maxLength={2000} placeholder={t('customer.leadForm.notesPlaceholder')} /></Form.Item>
      {/* Not shown to people; bots fill every field. */}
      <Form.Item name="website" className="web-lead-trap" aria-hidden><Input tabIndex={-1} autoComplete="off" /></Form.Item>
      {error && <Alert className="web-lead-wide" type="error" showIcon title={error} />}
      <div className="web-lead-wide web-lead-submit">
        <Button type="primary" size="large" htmlType="submit" loading={sending} icon={<ArrowRightOutlined />} iconPlacement="end">{page.allowUploads ? t('customer.leadForm.sendAndContinue') : t('customer.leadForm.send')}</Button>
        {page.allowUploads && <Typography.Text type="secondary">{t('customer.leadForm.nextHint')}</Typography.Text>}
      </div>
    </Form>}

    {step === 2 && sent?.uploadToken && <div className="web-lead-upload">
      <Alert type="success" showIcon title={t('customer.leadForm.receivedTitle', { name: sent.customerName })} description={t('customer.leadForm.receivedText', { number: sent.leadNumber ?? '' })} />
      <div><Typography.Title level={4}>{t('customer.leadForm.filesTitle')}</Typography.Title>
        <Typography.Paragraph type="secondary">{t('customer.leadForm.filesText')}</Typography.Paragraph></div>
      <MediaCapture uploadFile={async file => { const done = await publicUploadApi.upload(sent.uploadToken!, file); setUploaded(names => [...names, file.name]); return done }}
        note={sent.uploadExpiresAtUtc ? t('customer.leadForm.filesLater', { date: formatDateTime(sent.uploadExpiresAtUtc) }) : undefined} />
      {uploaded.length > 0 && <div className="web-lead-sent-files"><strong>{t('customer.leadForm.filesSent', { count: uploaded.length })}</strong>
        <ul>{uploaded.map((name, index) => <li key={index}><FileOutlined /> {name}</li>)}</ul></div>}
      <div className="web-lead-submit"><Button size="large" type={uploaded.length ? 'primary' : 'default'} onClick={finish}>{uploaded.length ? t('customer.leadForm.finish') : t('customer.leadForm.skipFiles')}</Button></div>
    </div>}

    {step === 3 && sent && <div className="web-lead-done">
      <CheckCircleFilled />
      <Typography.Title level={3}>{t('customer.leadForm.thanksTitle', { name: sent.customerName })}</Typography.Title>
      <Typography.Paragraph>{page.thankYou || t('customer.leadForm.defaultThankYou')}</Typography.Paragraph>
      {sent.leadNumber && <Typography.Text type="secondary">{t('customer.leadForm.reference', { number: sent.leadNumber })}</Typography.Text>}
      <Button type="link" onClick={startOver}>{t('customer.leadForm.another')}</Button>
    </div>}
  </>)
}
