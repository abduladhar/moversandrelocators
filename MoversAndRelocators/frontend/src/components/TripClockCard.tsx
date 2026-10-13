import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AutoComplete, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Timeline, Typography, message } from 'antd'
import { CarOutlined, EditOutlined, FlagOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons'
import type { SurveyTimeEvent } from '../types'
import { formatDateTime, formatNumber, t as translate, useT } from '../i18n'

type Step = 'start' | 'pause' | 'resume' | 'complete' | 'edit'
type StepForm = { atLocal: string; reason: string; distanceKm: number; conductedByEmployeeId: string }
export type TripCompletion = { at?: string; distanceKm: number; conductedByEmployeeId?: string }

/** Suggested pause reasons (keys under surveys.trip.reasons); the chosen text is saved as typed. */
const pauseReasons = ['breakdown', 'traffic', 'customerUnavailable', 'buildingAccess', 'liftUnavailable', 'lunch', 'anotherJob']
/** Labels are keys under surveys.trip.events. */
const eventCopy: Record<SurveyTimeEvent['type'], { label: string; color: string }> = {
  STARTED: { label: 'leftOffice', color: 'green' }, PAUSED: { label: 'paused', color: 'orange' }, RESUMED: { label: 'resumed', color: 'blue' }, COMPLETED: { label: 'backAtOffice', color: 'green' },
}
/** Wording per kind of trip (keys under surveys.trip.<noun>); other nouns use the generic "job" texts. */
const nouns = ['survey', 'pickup', 'delivery']
export const localNow = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
export const toLocal = (utc: string) => { const d = new Date(utc); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
export const when = (utc: string | null | undefined) => utc ? formatDateTime(utc) : '—'
const clock = (seconds: number) => `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
const human = (seconds: number) => seconds >= 3600
  ? translate('surveys.trip.hoursMinutes', { hours: Math.floor(seconds / 3600), minutes: Math.floor(seconds / 60) % 60 })
  : translate('surveys.trip.minutes', { minutes: seconds < 60 ? 0 : Math.floor(seconds / 60) % 60 })

/** Mirrors the server: active time runs from leaving the office to returning, minus paused intervals. */
function durations(events: SurveyTimeEvent[], startedAtUtc: string | null, endedAtUtc: string | null, now: number) {
  const start = events.find(e => e.type === 'STARTED')?.occurredAtUtc ?? startedAtUtc
  if (!start) return { active: 0, paused: 0 }
  const end = [...events].reverse().find(e => e.type === 'COMPLETED')?.occurredAtUtc ?? endedAtUtc
  const stop = end ? Date.parse(end) : now
  let pausedAt: number | null = null, paused = 0
  for (const e of events) {
    if (e.type === 'PAUSED' && pausedAt === null) pausedAt = Date.parse(e.occurredAtUtc)
    else if ((e.type === 'RESUMED' || e.type === 'COMPLETED') && pausedAt !== null) { paused += Date.parse(e.occurredAtUtc) - pausedAt; pausedAt = null }
  }
  if (pausedAt !== null) paused += stop - pausedAt
  return { active: Math.max(0, (stop - Date.parse(start) - paused) / 1000), paused: Math.max(0, paused / 1000) }
}

type Props = {
  noun: string
  startedAtUtc: string | null; endedAtUtc: string | null; isPaused: boolean; events: SurveyTimeEvent[]; distanceKm: number | null
  /** When set, ending the trip asks who did the work (e.g. the surveyor). */
  conductedBy?: { label: string; value: string | null; display: ReactNode; options: { value: string; label: string }[] }
  onStart: (at?: string) => Promise<void>
  onPause: (reason: string, at?: string) => Promise<void>
  onResume: (at?: string) => Promise<void>
  onComplete: (input: TripCompletion) => Promise<void>
  onEdit: (input: { distanceKm: number | null; conductedByEmployeeId: string | null }) => Promise<void>
}

/** Trip clock: leave office → pause/resume → back at office, with a live active-time clock and a step timeline. */
export function TripClockCard({ noun, startedAtUtc, endedAtUtc, isPaused, events, distanceKm, conductedBy, onStart, onPause, onResume, onComplete, onEdit }: Props) {
  const { t } = useT()
  const n = (key: string) => t(`surveys.trip.${nouns.includes(noun) ? noun : 'job'}.${key}`)
  const [step, setStep] = useState<Step | null>(null), [busy, setBusy] = useState(false), [now, setNow] = useState(Date.now())
  const [form] = Form.useForm<StepForm>()
  const started = Boolean(startedAtUtc), completed = Boolean(endedAtUtc), running = started && !completed
  useEffect(() => { if (!running || isPaused) return; const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id) }, [running, isPaused])
  const { active, paused } = useMemo(() => durations(events, startedAtUtc, endedAtUtc, now), [events, startedAtUtc, endedAtUtc, now])
  const state = completed ? { label: t('surveys.trip.state.completed'), className: 'is-done' } : isPaused ? { label: t('surveys.trip.state.paused'), className: 'is-paused' } : running ? { label: t('surveys.trip.state.inProgress'), className: 'is-running' } : { label: t('surveys.trip.state.notStarted'), className: 'is-idle' }
  const copy: Record<Step, { title: string; time: string; ok: string; done: string }> = {
    start: { title: n('start'), time: t('surveys.trip.leftOfficeAt'), ok: t('surveys.trip.startTrip'), done: n('started') },
    pause: { title: n('pause'), time: t('surveys.trip.pausedAt'), ok: t('surveys.trip.pause'), done: n('paused') },
    resume: { title: n('resume'), time: t('surveys.trip.resumedAt'), ok: t('surveys.trip.resume'), done: n('resumed') },
    complete: { title: n('end'), time: t('surveys.trip.backAtOfficeAt'), ok: n('end'), done: n('completed') },
    edit: { title: t('surveys.trip.editDetails'), time: '', ok: t('common.save'), done: t('surveys.trip.detailsSaved') },
  }

  const open = (next: Step) => { form.resetFields(); form.setFieldsValue({ atLocal: localNow(), reason: '', distanceKm: distanceKm ?? undefined, conductedByEmployeeId: conductedBy?.value ?? undefined }); setStep(next) }
  const submit = async () => {
    if (!step) return
    const value = await form.validateFields(); const at = value.atLocal ? new Date(value.atLocal).toISOString() : undefined
    setBusy(true)
    try {
      if (step === 'start') await onStart(at)
      else if (step === 'pause') await onPause(value.reason, at)
      else if (step === 'resume') await onResume(at)
      else if (step === 'complete') await onComplete({ at, distanceKm: value.distanceKm, conductedByEmployeeId: value.conductedByEmployeeId })
      else await onEdit({ distanceKm: value.distanceKm ?? null, conductedByEmployeeId: value.conductedByEmployeeId ?? null })
      message.success(copy[step].done); setStep(null)
    } catch (error) { message.error(error instanceof Error ? error.message : t('surveys.trip.updateFailed')) } finally { setBusy(false) }
  }

  const actions = completed ? <Button icon={<EditOutlined />} onClick={() => open('edit')}>{t('surveys.trip.editDetails')}</Button>
    : !started ? <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => open('start')}>{n('start')}</Button>
    : <>{isPaused ? <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => open('resume')}>{t('surveys.trip.resume')}</Button> : <Button icon={<PauseCircleOutlined />} onClick={() => open('pause')}>{t('surveys.trip.pause')}</Button>}
        <Button type="primary" icon={<FlagOutlined />} onClick={() => open('complete')}>{n('end')}</Button></>
  const startedAt = events.find(e => e.type === 'STARTED')?.occurredAtUtc ?? startedAtUtc
  const endedAt = [...events].reverse().find(e => e.type === 'COMPLETED')?.occurredAtUtc ?? endedAtUtc
  const pauseReason = isPaused ? [...events].reverse().find(e => e.type === 'PAUSED')?.reason : null

  return <Card className="survey-trip-card" title={<Space><CarOutlined /><span>{n('trip')}</span></Space>} extra={<Space wrap className="survey-trip-actions">{actions}</Space>}>
    <div className="survey-trip-summary">
      <div className={`survey-trip-clock ${state.className}`}>
        <small>{t('surveys.trip.activeTime')}</small><strong>{clock(active)}</strong>
        <span className="survey-trip-state">{state.label}{pauseReason ? ` · ${pauseReason}` : ''}</span>
      </div>
      <dl className="survey-trip-metrics">
        <div><dt>{t('surveys.trip.distance')}</dt><dd>{distanceKm != null ? <>{formatNumber(distanceKm)}<em>{t('surveys.trip.km')}</em></> : <span className="is-empty">{t('surveys.trip.recordedAtEnd')}</span>}</dd></div>
        {conductedBy && <div><dt>{conductedBy.label}</dt><dd>{conductedBy.display}</dd></div>}
        <div><dt>{t('surveys.trip.events.leftOffice')}</dt><dd>{when(startedAt)}</dd></div>
        <div><dt>{t('surveys.trip.events.backAtOffice')}</dt><dd>{when(endedAt)}</dd></div>
        <div><dt>{t('surveys.trip.timePaused')}</dt><dd>{human(paused)}</dd></div>
      </dl>
    </div>
    {events.length > 0 && <Timeline className="survey-trip-timeline" items={events.map(e => ({ color: eventCopy[e.type].color, children: <div><strong>{t('surveys.trip.events.' + eventCopy[e.type].label)}</strong><small>{when(e.occurredAtUtc)} · {e.recordedBy}</small>{e.reason && <p>{e.reason}</p>}</div> }))} />}

    <Modal centered open={step !== null} title={step ? copy[step].title : ''} okText={step ? copy[step].ok : t('common.save')} cancelText={t('common.cancel')} confirmLoading={busy} onOk={() => void submit()} onCancel={() => setStep(null)} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false}>
        {step === 'start' && <Typography.Paragraph type="secondary">{n('startHelp')}</Typography.Paragraph>}
        {step === 'pause' && <Form.Item label={t('surveys.trip.reason')} name="reason" rules={[{ required: true, whitespace: true, message: n('pauseReasonRequired') }, { max: 500, message: t('surveys.trip.reasonTooLong') }]}><AutoComplete options={pauseReasons.map(key => ({ value: t('surveys.trip.reasons.' + key) }))} placeholder={t('surveys.trip.reasonPlaceholder')} filterOption={(input, option) => String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())} /></Form.Item>}
        {(step === 'complete' || step === 'edit') && <div className={conductedBy ? 'master-form-grid' : undefined}>
          <Form.Item className="amount-field" label={t('surveys.trip.distanceKm')} name="distanceKm" rules={step === 'complete' ? [{ required: true, message: t('surveys.trip.distanceRequired') }] : []}><InputNumber min={0} max={5000} precision={1} style={{ width: '100%' }} placeholder={t('surveys.trip.roundTrip')} /></Form.Item>
          {conductedBy && <Form.Item label={conductedBy.label} name="conductedByEmployeeId" rules={[{ required: step === 'complete', message: t('surveys.trip.employeeRequired') }]}><Select showSearch optionFilterProp="label" options={conductedBy.options} /></Form.Item>}
        </div>}
        {step && step !== 'edit' && <Form.Item label={copy[step].time} name="atLocal" extra={t('surveys.trip.timeHelp')} rules={[{ required: true, message: t('surveys.trip.timeRequired') }]}><Input type="datetime-local" /></Form.Item>}
      </Form>
    </Modal>
  </Card>
}
