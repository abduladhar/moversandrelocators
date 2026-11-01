import type { ReactNode } from 'react'
import { Button, Card, Tabs } from 'antd'
import { ArrowLeftOutlined, CheckOutlined } from '@ant-design/icons'

export type RecordFact = { label: string; value: ReactNode; tone?: 'attention' | 'problem' }
/** One stage of the move. `done` stages show what was created; the first stage that is not done is the next one.
 * `here` marks the stage of the record being viewed. */
export type RecordStage = { key: string; label: string; done: boolean; here?: boolean; detail?: ReactNode; onOpen?: () => void }

/** The move's stage bar: lead → survey → quotation → packing → pickup → delivery. */
export function StageBar({ stages }: { stages: RecordStage[] }) {
  const next = stages.findIndex(s => !s.done)
  return <ol className="record-stages">{stages.map((s, i) => {
    const state = [s.done ? 'is-done' : i === next ? 'is-current' : 'is-next', s.here ? 'is-here' : ''].filter(Boolean).join(' ')
    const body = <><span className="record-stage-mark" aria-hidden="true">{s.done ? <CheckOutlined /> : i + 1}</span><span className="record-stage-text"><strong>{s.label}</strong>{s.detail && <small>{s.detail}</small>}</span></>
    return <li key={s.key} className={state} aria-current={s.here ? 'page' : i === next ? 'step' : undefined}>{s.onOpen && !s.here ? <button type="button" onClick={s.onOpen}>{body}</button> : <div>{body}</div>}</li>
  })}</ol>
}

/**
 * The record page template (design step 4): back link, title with number and status, actions, key facts,
 * the move's stage bar, tabs for the work, and an activity column. Leads, surveys, quotations, packing,
 * pickups and deliveries share it so every record reads the same way.
 */
export function RecordPage({ backLabel, onBack, title, number, status, actions, facts, stages, tabs, activity, activityTitle }: {
  backLabel: string; onBack: () => void; title: ReactNode; number?: ReactNode; status?: ReactNode; actions?: ReactNode
  facts: RecordFact[]; stages?: RecordStage[]; tabs: { key: string; label: ReactNode; children: ReactNode }[]; activity?: ReactNode; activityTitle?: string
}) {
  return <div className="record-page">
    <header className="record-head">
      <div className="record-title">
        <Button type="link" className="record-back" icon={<ArrowLeftOutlined />} onClick={onBack}>{backLabel}</Button>
        <h1>{title}</h1>{number && <span className="record-number">{number}</span>}{status}
        {actions && <div className="record-actions">{actions}</div>}
      </div>
      <dl className="record-facts">{facts.map(f => <div key={f.label}><dt>{f.label}</dt><dd className={f.tone ? 'is-' + f.tone : undefined}>{f.value ?? '—'}</dd></div>)}</dl>
    </header>
    {stages && <StageBar stages={stages} />}
    <div className={activity ? 'record-body has-activity' : 'record-body'}>
      <Card className="record-main"><Tabs items={tabs} /></Card>
      {activity && <Card className="record-activity" title={activityTitle}>{activity}</Card>}
    </div>
  </div>
}
