import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Empty, Input, Modal, Popover, Select, Space, Spin, Tag, Timeline, Typography, message } from 'antd'
import { CheckCircleOutlined, CheckOutlined, ClockCircleOutlined, HistoryOutlined, LinkOutlined, MessageOutlined, StopOutlined } from '@ant-design/icons'
import { customerRepliesApi } from '../api'
import type { CustomerReply, CustomerReplyEvent, CustomerReplyRecordType } from '../types'
import { formatDateTime, useT } from '../i18n'

/**
 * The customer side of records shared through a link: "customer action pending" while a link waits for an answer,
 * "customer replied" until someone records the action taken, then "action taken" until a new link is shared. Loads every
 * record of one type at once, so a list page makes a single request; call reload() whenever the page reloads.
 */
export function useCustomerReplies(type: CustomerReplyRecordType) {
  const [replies, setReplies] = useState<Record<string, CustomerReply>>({})
  const reload = useCallback(() => customerRepliesApi.list(type)
    .then(rows => setReplies(Object.fromEntries(rows.map(x => [x.recordId, x]))))
    .catch(() => undefined), [type])
  useEffect(() => { void reload() }, [reload])
  return { replies, get: (id: string) => replies[id] as CustomerReply | undefined, reload }
}

const look = {
  PENDING: { color: 'gold', icon: <ClockCircleOutlined /> },
  REPLIED: { color: 'magenta', icon: <MessageOutlined /> },
  EXPIRED: { color: 'default', icon: <StopOutlined /> },
  ACTION_TAKEN: { color: 'green', icon: <CheckCircleOutlined /> },
} as const

const needsAction = (reply: CustomerReply) => reply.state === 'REPLIED' || reply.state === 'EXPIRED'
/** The customer actor stored by the server for the customer's own steps. */
const CUSTOMER = 'CUSTOMER'

/** "Mark action taken" with an optional note on what was done. */
function ActionForm({ reply, onDone }: { reply: CustomerReply; onDone?: () => void }) {
  const { t } = useT()
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try { await customerRepliesApi.handled(reply.recordType, reply.recordId, note.trim() || undefined); message.success(t('shared.customerReplies.handled')); setNote(''); onDone?.() }
    catch (error) { message.error(error instanceof Error ? error.message : t('shared.customerReplies.handleFailed')) }
    finally { setBusy(false) }
  }
  return <Space direction="vertical" size={6} style={{ width: '100%' }}>
    <Input.TextArea rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder={t('shared.customerReplies.actionNotePlaceholder')} aria-label={t('shared.customerReplies.actionNote')} />
    <Button size="small" type="primary" icon={<CheckOutlined />} loading={busy} onClick={() => void save()}>{t('shared.customerReplies.markHandled')}</Button>
  </Space>
}

function ReplyDetails({ reply }: { reply: CustomerReply }) {
  const { t } = useT()
  const replied = reply.repliedAtUtc && (reply.state === 'REPLIED' || reply.state === 'ACTION_TAKEN')
  return <Space direction="vertical" size={2}>
    {replied && reply.replyKind && <strong>{t('shared.customerReplies.kind.' + reply.replyKind)}</strong>}
    {replied && reply.replyNote && <Typography.Text type="secondary">“{reply.replyNote}”</Typography.Text>}
    {replied && <small>{t('shared.customerReplies.repliedAt', { date: formatDateTime(reply.repliedAtUtc!) })}</small>}
    {(reply.state === 'PENDING' || reply.state === 'EXPIRED') && reply.sharedAtUtc && <small>{t('shared.customerReplies.sharedAt', { date: formatDateTime(reply.sharedAtUtc) })}</small>}
    {reply.state === 'PENDING' && reply.expiresAtUtc && <small>{t('shared.customerReplies.expiresAt', { date: formatDateTime(reply.expiresAtUtc) })}</small>}
    {reply.state === 'EXPIRED' && reply.expiresAtUtc && <small>{t('shared.customerReplies.expiredAt', { date: formatDateTime(reply.expiresAtUtc) })}</small>}
    {reply.state === 'ACTION_TAKEN' && reply.handledAtUtc && <>
      <strong style={{ marginTop: 4 }}><CheckCircleOutlined /> {t('shared.customerReplies.action.' + (reply.handledAction ?? 'MARKED'))}</strong>
      {reply.handledNote && <Typography.Text type="secondary">“{reply.handledNote}”</Typography.Text>}
      <small>{t('shared.customerReplies.actionBy', { name: reply.handledBy ?? '—', date: formatDateTime(reply.handledAtUtc) })}</small>
    </>}
  </Space>
}

/** A small tag for list rows and tiles; click it for the details, "Mark action taken" and the history. */
export function CustomerReplyTag({ reply, onChanged }: { reply?: CustomerReply; onChanged?: () => void }) {
  const { t } = useT()
  const [open, setOpen] = useState(false), [history, setHistory] = useState(false)
  if (!reply) return null
  const content = <Space direction="vertical" size="small" style={{ width: 280 }}>
    <ReplyDetails reply={reply} />
    {needsAction(reply) && <ActionForm reply={reply} onDone={() => { setOpen(false); onChanged?.() }} />}
    <Button size="small" type="link" icon={<HistoryOutlined />} style={{ paddingInline: 0 }} onClick={() => { setOpen(false); setHistory(true) }}>{t('shared.customerReplies.viewHistory')}</Button>
  </Space>
  return <>
    <Popover trigger="click" open={open} onOpenChange={setOpen} title={t('shared.customerReplies.title')} content={content}>
      <Tag color={look[reply.state].color} icon={look[reply.state].icon} style={{ cursor: 'pointer', marginInlineEnd: 0 }} onClick={e => e.stopPropagation()}>{t('shared.customerReplies.state.' + reply.state)}</Tag>
    </Popover>
    <CustomerReplyHistory type={reply.recordType} id={reply.recordId} open={history} onClose={() => setHistory(false)} />
  </>
}

/** The same state as a banner at the top of a detail page, with the action to take and the history. */
export function CustomerReplyBanner({ type, id, onChanged, refreshKey }: { type: CustomerReplyRecordType; id: string; onChanged?: () => void; refreshKey?: unknown }) {
  const { t } = useT()
  const { get, reload } = useCustomerReplies(type)
  const [history, setHistory] = useState(false)
  useEffect(() => { void reload() }, [refreshKey, reload])
  const reply = get(id)
  if (!reply) return null
  const kind = reply.state === 'REPLIED' ? 'warning' : reply.state === 'ACTION_TAKEN' ? 'success' : 'info'
  return <>
    <Alert showIcon type={kind} icon={look[reply.state].icon} style={{ marginBottom: 16 }}
      title={t('shared.customerReplies.banner.' + reply.state)}
      description={<Space direction="vertical" size="small" style={{ width: '100%', maxWidth: 520 }}>
        <ReplyDetails reply={reply} />
        {needsAction(reply) && <ActionForm reply={reply} onDone={() => { void reload(); onChanged?.() }} />}
      </Space>}
      action={<Button size="small" icon={<HistoryOutlined />} onClick={() => setHistory(true)}>{t('shared.customerReplies.history')}</Button>} />
    <CustomerReplyHistory type={type} id={id} open={history} onClose={() => setHistory(false)} />
  </>
}

/** Every step of the record's customer history, newest first: links shared or revoked, the customer's replies, the office's actions. */
export function CustomerReplyHistory({ type, id, open, onClose }: { type: CustomerReplyRecordType; id: string; open: boolean; onClose: () => void }) {
  const { t } = useT()
  const [events, setEvents] = useState<CustomerReplyEvent[]>()
  useEffect(() => {
    if (!open) return
    setEvents(undefined)
    customerRepliesApi.history(type, id).then(setEvents).catch(error => { message.error(error instanceof Error ? error.message : t('shared.customerReplies.historyFailed')); setEvents([]) })
  }, [open, type, id, t])
  const who = (actor: string) => actor === CUSTOMER ? t('shared.customerReplies.customer') : actor
  const item = (x: CustomerReplyEvent) => {
    const note = x.note && <Typography.Text type="secondary">“{x.note}”</Typography.Text>
    const when = <small>{formatDateTime(x.atUtc)}</small>
    switch (x.event) {
      case 'SHARED': return { color: 'blue', icon: <LinkOutlined />, title: t('shared.customerReplies.event.SHARED', { name: who(x.actor) }), content: <Space direction="vertical" size={0}>{when}{x.expiresAtUtc && <small>{t('shared.customerReplies.expiresAt', { date: formatDateTime(x.expiresAtUtc) })}</small>}</Space> }
      case 'REPLIED': return { color: 'magenta', icon: <MessageOutlined />, title: t('shared.customerReplies.event.REPLIED', { what: x.detail ? t('shared.customerReplies.kind.' + x.detail) : '' }), content: <Space direction="vertical" size={0}>{note}{when}</Space> }
      case 'ACTION_TAKEN': return { color: 'green', icon: <CheckCircleOutlined />, title: t('shared.customerReplies.event.ACTION_TAKEN', { what: t('shared.customerReplies.action.' + (x.detail ?? 'MARKED')), name: who(x.actor) }), content: <Space direction="vertical" size={0}>{note}{when}</Space> }
      default: return { color: 'gray', icon: <StopOutlined />, title: t('shared.customerReplies.event.WITHDRAWN', { name: who(x.actor) }), content: when }
    }
  }
  return <Modal centered open={open} onCancel={onClose} footer={null} title={<Space><HistoryOutlined />{t('shared.customerReplies.historyTitle')}</Space>} destroyOnHidden>
    {!events ? <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
      : events.length ? <Timeline style={{ marginTop: 16 }} items={events.map(item)} />
      : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('shared.customerReplies.noHistory')} />}
  </Modal>
}

/** "Customer" filter for a list's advanced search. */
export function CustomerStateFilter({ value, onChange }: { value?: string; onChange: (value?: string) => void }) {
  const { t } = useT()
  return <Select allowClear placeholder={t('shared.customerReplies.filter')} value={value} onChange={onChange}
    options={(['REPLIED', 'PENDING', 'EXPIRED', 'ACTION_TAKEN'] as const).map(x => ({ value: x, label: t('shared.customerReplies.state.' + x) }))} />
}
