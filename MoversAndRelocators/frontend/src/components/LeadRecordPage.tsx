import { useContext, useEffect, useState } from 'react'
import { Button, Empty, Space, message } from 'antd'
import { CalendarOutlined, ContainerOutlined, EditOutlined, PaperClipOutlined } from '@ant-design/icons'
import { salesApi } from '../api'
import type { LeadFollowUp, LeadJourneyStep, SalesLead } from '../types'
import { formatDateTime, useT } from '../i18n'
import { OpenListContext } from '../searchHandoff'
import { RecordPage } from './RecordPage'
import { buildMoveStages } from './MoveJourneyBar'
import { StatusTag } from './StatusTag'

/**
 * One lead on its own page: who and where, the next follow-up, how far the move has got (survey → delivery),
 * and its follow-up history. Editing, follow-ups, files and inventory open the leads page's existing dialogs;
 * `version` changes after any of them saves so the page reloads.
 */
export function LeadRecordPage({ lead, version, onBack, onEdit, onFollowUps, onFiles, onInventory }: {
  lead: SalesLead; version: number; onBack: () => void; onEdit: () => void; onFollowUps: () => void; onFiles: () => void; onInventory: () => void
}) {
  const { t } = useT()
  const openList = useContext(OpenListContext)
  const [followUps, setFollowUps] = useState<LeadFollowUp[]>([]), [journey, setJourney] = useState<LeadJourneyStep[]>([])
  useEffect(() => {
    Promise.all([salesApi.followUps(lead.id), salesApi.journey(lead.id)])
      .then(([f, j]) => { setFollowUps(f); setJourney(j) })
      .catch(e => message.error(e instanceof Error ? e.message : String(e)))
  }, [lead.id, version])

  const now = Date.now()
  const next = followUps.map(f => f.nextFollowUpAtUtc).filter((x): x is string => !!x && new Date(x).getTime() >= now - 86400000).sort()[0]
  const nextOverdue = next && new Date(next).getTime() < now
  const stages = buildMoveStages(t, lead.leadNumber, journey, openList, 'LEAD')
  const field = (label: string, value: string | null | undefined) => <div><dt>{label}</dt><dd>{value || '—'}</dd></div>
  const history = [...followUps].sort((a, b) => b.scheduledAtUtc.localeCompare(a.scheduledAtUtc))

  return <RecordPage backLabel={t('shell.nav.salesLeads')} onBack={onBack}
    title={lead.customerName} number={lead.leadNumber} status={<StatusTag color={lead.statusColor || 'blue'}>{lead.statusName}</StatusTag>}
    actions={<Space wrap>
      <Button icon={<CalendarOutlined />} onClick={onFollowUps}>{t('sales.leads.followUps')}</Button>
      <Button icon={<PaperClipOutlined />} onClick={onFiles}>{t('sales.leads.shareAttachments')}</Button>
      <Button icon={<ContainerOutlined />} onClick={onInventory}>{t('sales.leads.inventory')}</Button>
      <Button type="primary" icon={<EditOutlined />} onClick={onEdit}>{t('common.edit')}</Button>
    </Space>}
    facts={[
      { label: t('sales.leads.moveType'), value: lead.moveTypeName },
      { label: t('sales.record.route'), value: `${lead.origin} → ${lead.destination}` },
      { label: t('sales.leads.expectedMoveDate'), value: lead.expectedMoveDate || t('sales.leads.noMoveDate') },
      { label: t('sales.record.owner'), value: lead.assignedEmployeeName || t('sales.leads.unassigned') },
      { label: t('sales.leads.nextFollowUp'), value: next ? formatDateTime(next) : t('sales.record.noneScheduled'), tone: nextOverdue ? 'problem' : next ? 'attention' : undefined },
    ]}
    stages={stages}
    tabs={[
      { key: 'details', label: t('sales.record.details'), children: <dl className="record-fields">
        {field(t('common.phone'), lead.phone)}{field(t('common.email'), lead.email)}{field(t('sales.leads.source'), lead.source)}
        {field(t('sales.leads.origin'), lead.origin)}{field(t('sales.leads.destination'), lead.destination)}{field(t('sales.leads.expectedMoveDate'), lead.expectedMoveDate)}
        <div className="record-fields-wide">{field(t('common.notes'), lead.notes)}</div>
      </dl> },
      { key: 'follow-ups', label: `${t('sales.leads.followUps')} ${followUps.length || ''}`.trim(), children: history.length
        ? <ul className="record-list">{history.map(f => <li key={f.id}><div><strong>{formatDateTime(f.scheduledAtUtc)}</strong><StatusTag color={f.statusColor || 'blue'}>{f.statusName}</StatusTag></div><p>{f.notes}</p>{f.nextFollowUpAtUtc && <small>{t('sales.leads.next')}: {formatDateTime(f.nextFollowUpAtUtc)}</small>}</li>)}</ul>
        : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('sales.record.noFollowUps')}><Button onClick={onFollowUps}>{t('sales.leads.followUps')}</Button></Empty> },
    ]}
    activityTitle={t('sales.record.activity')}
    activity={<ol className="record-timeline">
      {history.slice(0, 8).map(f => <li key={f.id}><span>{f.notes || f.statusName}</span><small>{f.statusName} · {formatDateTime(f.createdAtUtc)}</small></li>)}
      <li><span>{t('sales.record.leadCreated')}</span><small>{lead.source ? lead.source + ' · ' : ''}{formatDateTime(lead.createdAtUtc)}</small></li>
    </ol>}
  />
}
