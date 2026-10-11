import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AutoComplete, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Timeline, Typography, message } from 'antd'
import { CarOutlined, EditOutlined, FlagOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons'
import type { SurveyTimeEvent } from '../types'

type Step = 'start' | 'pause' | 'resume' | 'complete' | 'edit'
type StepForm = { atLocal: string; reason: string; distanceKm: number; conductedByEmployeeId: string }
export type TripCompletion = { at?: string; distanceKm: number; conductedByEmployeeId?: string }

const pauseReasons = ['Vehicle breakdown', 'Traffic delay', 'Customer not available', 'Waiting for building access', 'Lift not available', 'Lunch break', 'Called to another job']
const eventCopy: Record<SurveyTimeEvent['type'], { label: string; color: string }> = {
  STARTED: { label: 'Left the office', color: 'green' }, PAUSED: { label: 'Paused', color: 'orange' }, RESUMED: { label: 'Resumed', color: 'blue' }, COMPLETED: { label: 'Back at the office', color: 'green' },
}
export const localNow = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
export const toLocal = (utc: string) => { const d = new Date(utc); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
export const when = (utc: string | null | undefined) => utc ? new Date(utc).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const clock = (seconds: number) => `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
const human = (seconds: number) => seconds < 60 ? '0m' : `${seconds >= 3600 ? `${Math.floor(seconds / 3600)}h ` : ''}${Math.floor(seconds / 60) % 60}m`

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
  const [step, setStep] = useState<Step | null>(null), [busy, setBusy] = useState(false), [now, setNow] = useState(Date.now())
  const [form] = Form.useForm<StepForm>()
  const started = Boolean(startedAtUtc), completed = Boolean(endedAtUtc), running = started && !completed
  useEffect(() => { if (!running || isPaused) return; const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id) }, [running, isPaused])
  const { active, paused } = useMemo(() => durations(events, startedAtUtc, endedAtUtc, now), [events, startedAtUtc, endedAtUtc, now])
  const state = completed ? { label: 'Completed', className: 'is-done' } : isPaused ? { label: 'Paused', className: 'is-paused' } : running ? { label: 'In progress', className: 'is-running' } : { label: 'Not started', className: 'is-idle' }
  const copy: Record<Step, { title: string; time: string; ok: string; done: string }> = {
    start: { title: `Start ${noun}`, time: 'Left the office at', ok: 'Start trip', done: `${noun[0].toUpperCase()}${noun.slice(1)} trip started` },
    pause: { title: `Pause ${noun}`, time: 'Paused at', ok: 'Pause', done: `${noun[0].toUpperCase()}${noun.slice(1)} paused` },
    resume: { title: `Resume ${noun}`, time: 'Resumed at', ok: 'Resume', done: `${noun[0].toUpperCase()}${noun.slice(1)} resumed` },
    complete: { title: `End ${noun}`, time: 'Back at the office at', ok: `End ${noun}`, done: `${noun[0].toUpperCase()}${noun.slice(1)} completed` },
    edit: { title: 'Edit trip details', time: '', ok: 'Save', done: 'Trip details saved' },
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
    } catch (error) { message.error(error instanceof Error ? error.message : 'Unable to update the trip') } finally { setBusy(false) }
  }

  const actions = completed ? <Button icon={<EditOutlined />} onClick={() => open('edit')}>Edit trip details</Button>
    : !started ? <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => open('start')}>Start {noun}</Button>
    : <>{isPaused ? <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => open('resume')}>Resume</Button> : <Button icon={<PauseCircleOutlined />} onClick={() => open('pause')}>Pause</Button>}
        <Button type="primary" icon={<FlagOutlined />} onClick={() => open('complete')}>End {noun}</Button></>
  const startedAt = events.find(e => e.type === 'STARTED')?.occurredAtUtc ?? startedAtUtc
  const endedAt = [...events].reverse().find(e => e.type === 'COMPLETED')?.occurredAtUtc ?? endedAtUtc
  const pauseReason = isPaused ? [...events].reverse().find(e => e.type === 'PAUSED')?.reason : null

  return <Card className="survey-trip-card" title={<Space><CarOutlined /><span>{`${noun[0].toUpperCase()}${noun.slice(1)} trip`}</span></Space>} extra={<Space wrap className="survey-trip-actions">{actions}</Space>}>
    <div className="survey-trip-summary">
      <div className={`survey-trip-clock ${state.className}`}>
        <small>Active time</small><strong>{clock(active)}</strong>
        <span className="survey-trip-state">{state.label}{pauseReason ? ` · ${pauseReason}` : ''}</span>
      </div>
      <dl className="survey-trip-metrics">
        <div><dt>Distance travelled</dt><dd>{distanceKm != null ? <>{distanceKm.toLocaleString()}<em>km</em></> : <span className="is-empty">Recorded at the end</span>}</dd></div>
        {conductedBy && <div><dt>{conductedBy.label}</dt><dd>{conductedBy.display}</dd></div>}
        <div><dt>Left the office</dt><dd>{when(startedAt)}</dd></div>
        <div><dt>Back at the office</dt><dd>{when(endedAt)}</dd></div>
        <div><dt>Time paused</dt><dd>{human(paused)}</dd></div>
      </dl>
    </div>
    {events.length > 0 && <Timeline className="survey-trip-timeline" items={events.map(e => ({ color: eventCopy[e.type].color, children: <div><strong>{eventCopy[e.type].label}</strong><small>{when(e.occurredAtUtc)} · {e.recordedBy}</small>{e.reason && <p>{e.reason}</p>}</div> }))} />}

    <Modal centered open={step !== null} title={step ? copy[step].title : ''} okText={step ? copy[step].ok : 'Save'} confirmLoading={busy} onOk={() => void submit()} onCancel={() => setStep(null)} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false}>
        {step === 'start' && <Typography.Paragraph type="secondary">The trip clock runs from when the team leaves the office until they are back. Pause it if anything interrupts the {noun}.</Typography.Paragraph>}
        {step === 'pause' && <Form.Item label="Reason" name="reason" rules={[{ required: true, whitespace: true, message: `Enter why the ${noun} is paused` }, { max: 500 }]}><AutoComplete options={pauseReasons.map(value => ({ value }))} placeholder="e.g. Vehicle breakdown" filterOption={(input, option) => String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())} /></Form.Item>}
        {(step === 'complete' || step === 'edit') && <div className={conductedBy ? 'master-form-grid' : undefined}>
          <Form.Item className="amount-field" label="Distance travelled (km)" name="distanceKm" rules={step === 'complete' ? [{ required: true, message: 'Enter the distance travelled' }] : []}><InputNumber min={0} max={5000} precision={1} style={{ width: '100%' }} placeholder="Round trip" /></Form.Item>
          {conductedBy && <Form.Item label={conductedBy.label} name="conductedByEmployeeId" rules={[{ required: step === 'complete', message: 'Select the employee' }]}><Select showSearch optionFilterProp="label" options={conductedBy.options} /></Form.Item>}
        </div>}
        {step && step !== 'edit' && <Form.Item label={copy[step].time} name="atLocal" extra="Defaults to now. Change it only to correct a step recorded late." rules={[{ required: true, message: 'Choose a time' }]}><Input type="datetime-local" /></Form.Item>}
      </Form>
    </Modal>
  </Card>
}
