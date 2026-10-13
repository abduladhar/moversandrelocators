import { useEffect, useMemo, useState } from 'react'
import { useMessageTemplate } from '../messageTemplates'
import { Alert, AutoComplete, Button, Checkbox, Empty, Input, InputNumber, Modal, Select, Space, Spin, Tag, Tooltip, message } from 'antd'
import { CloseOutlined, DeleteOutlined, LinkOutlined, PictureOutlined, PlusOutlined, RobotOutlined } from '@ant-design/icons'
import { request, salesApi } from '../api'
import { ItemPicture, type PictureMark } from './ItemPicture'
import { ShareChannels } from './ShareChannels'
import { formatDateTime, formatNumber, useT } from '../i18n'

export type CustomerStatus = 'PENDING' | 'NEEDED' | 'NOT_NEEDED'
export type LeadInventoryLine = { id?: string; kind: 'ITEM' | 'BOX'; room: string | null; name: string; quantity: number; unitCbm: number; totalCbm?: number; fragile: boolean; handling: string | null; notes: string | null; sourceAttachmentId: string | null; /** Short-lived link to the item's picture, when one was attached. */ imageUrl?: string | null; imageMark?: PictureMark | null; /** What the customer answered on the shared inventory link. */ customerStatus?: CustomerStatus; customerNote?: string | null; customerDecidedAtUtc?: string | null }
export type LeadInventory = { salesLeadId: string; lines: LeadInventoryLine[]; expectedCbm: number; itemCount: number; boxCount: number; fragileItems: number; aiRuns: number; aiCost: number | null; confirmedCbm: number; notNeededLines: number; pendingLines: number; lastCustomerReplyAtUtc: string | null }

export const leadInventoryApi = {
  get: (leadId: string) => request<LeadInventory>(`/api/sales/leads/${leadId}/inventory`),
  // A line keeps its picture by naming its own id (the server never takes a storage key from the browser).
  save: (leadId: string, lines: LeadInventoryLine[]) => request<LeadInventory>(`/api/sales/leads/${leadId}/inventory`, { method: 'PUT', body: JSON.stringify({ lines: lines.map(l => ({ ...l, imageFromLineId: l.imageUrl && l.id ? l.id : null })) }) }),
}
export const cbm = (v: number) => formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * The sales lead's expected inventory: AI-extracted and staff-entered items and boxes, with volume (CBM) and
 * fragile flags. Totals update while editing; Save replaces the stored list.
 */
export function LeadInventoryModal({ lead, open, onClose, onSaved }: { lead: { id: string; customerName: string; leadNumber: string; phone?: string; email?: string | null } | null; open: boolean; onClose: () => void; onSaved?: (inventory: LeadInventory) => void }) {
  const { t } = useT()
  const [lines, setLines] = useState<LeadInventoryLine[]>(), [saving, setSaving] = useState(false), [dirty, setDirty] = useState(false), [ai, setAi] = useState<{ runs: number; cost: number | null }>()
  const [review, setReview] = useState<{ pending: number; notNeeded: number; repliedAt: string | null }>(), [shareUrl, setShareUrl] = useState(''), [sharing, setSharing] = useState(false)
  const { message: reviewMessage } = useMessageTemplate('LEAD_INVENTORY')
  const shareText = reviewMessage({ customer: lead?.customerName, reference: lead?.leadNumber, link: shareUrl })
  useEffect(() => {
    if (!open || !lead) return
    setLines(undefined); setDirty(false)
    setShareUrl('')
    leadInventoryApi.get(lead.id).then(x => { setLines(x.lines); setAi({ runs: x.aiRuns, cost: x.aiCost }); setReview({ pending: x.pendingLines, notNeeded: x.notNeededLines, repliedAt: x.lastCustomerReplyAtUtc }) }).catch(e => { message.error(e instanceof Error ? e.message : t('sales.inventory.loadFailed')); setLines([]) })
  }, [open, lead?.id])
  const totals = useMemo(() => {
    const all = lines ?? []
    return { cbm: all.reduce((n, l) => n + (l.quantity || 0) * (l.unitCbm || 0), 0), confirmed: all.filter(l => l.customerStatus !== 'NOT_NEEDED').reduce((n, l) => n + (l.quantity || 0) * (l.unitCbm || 0), 0), items: all.filter(l => l.kind === 'ITEM').reduce((n, l) => n + (l.quantity || 0), 0), boxes: all.filter(l => l.kind === 'BOX').reduce((n, l) => n + (l.quantity || 0), 0), fragile: all.filter(l => l.fragile).reduce((n, l) => n + (l.quantity || 0), 0), dropped: all.filter(l => l.customerStatus === 'NOT_NEEDED').length }
  }, [lines])
  const rooms = useMemo(() => [...new Set((lines ?? []).map(l => l.room).filter((x): x is string => !!x))].map(value => ({ value })), [lines])
  const change = (i: number, patch: Partial<LeadInventoryLine>) => { setLines(all => all!.map((l, n) => n === i ? { ...l, ...patch } : l)); setDirty(true) }
  const add = () => { setLines(all => [...(all ?? []), { kind: 'ITEM', room: null, name: '', quantity: 1, unitCbm: 0, fragile: false, handling: null, notes: null, sourceAttachmentId: null }]); setDirty(true) }
  const save = async () => {
    if (!lead || !lines) return
    if (lines.some(l => !l.name.trim() || !l.quantity)) { message.error(t('sales.inventory.lineIncomplete')); return }
    setSaving(true)
    try { const saved = await leadInventoryApi.save(lead.id, lines); setLines(saved.lines); setReview({ pending: saved.pendingLines, notNeeded: saved.notNeededLines, repliedAt: saved.lastCustomerReplyAtUtc }); setDirty(false); onSaved?.(saved); message.success(t('sales.inventory.saved')) }
    catch (e) { message.error(e instanceof Error ? e.message : t('sales.inventory.saveFailed')) } finally { setSaving(false) }
  }
  const close = () => { if (dirty && !window.confirm(t('sales.inventory.discardConfirm'))) return; onClose() }
  /* Sharing mints a fresh 14-day link: the token is only ever handed over once, at generation, so an earlier link
     cannot be shown again. The same token also opens the upload page, which is what the customer already knows. */
  const share = async () => {
    if (!lead) return
    if (dirty) { message.warning(t('sales.inventory.saveBeforeShare')); return }
    setSharing(true)
    try {
      const generated = await salesApi.generateUploadLink(lead.id, 14, undefined, t('sales.inventory.linkDescription'))
      setShareUrl(generated.inventoryUrl)
      if (navigator.share) await navigator.share({ title: t('sales.inventory.shareTitle', { customer: lead.customerName }), text: t('sales.inventory.shareText'), url: generated.inventoryUrl })
      else { await navigator.clipboard.writeText(generated.inventoryUrl); message.success(t('sales.inventory.linkCopied')) }
    } catch (e) { if (e instanceof Error && e.name !== 'AbortError') message.error(e.message) }
    finally { setSharing(false) }
  }
  const statusTag = (l: LeadInventoryLine) => l.customerStatus === 'NOT_NEEDED'
    ? <Tooltip title={l.customerNote ?? t('sales.inventory.notNeededTip')}><Tag color="red">{t('sales.inventory.notNeeded')}</Tag></Tooltip>
    : l.customerStatus === 'NEEDED' ? <Tooltip title={l.customerNote ?? t('sales.inventory.confirmedTip')}><Tag color="green">{t('sales.inventory.confirmed')}</Tag></Tooltip>
    : <Tag>{t('sales.inventory.notAsked')}</Tag>

  return <Modal centered width={1180} open={open} title={lead ? t('sales.inventory.title', { customer: lead.customerName, lead: lead.leadNumber }) : ''} onCancel={close}
    footer={[<Button key="add" icon={<PlusOutlined />} onClick={add} disabled={!lines}>{t('sales.inventory.addLine')}</Button>, <Button key="share" icon={<LinkOutlined />} loading={sharing} disabled={!lines?.length} onClick={() => void share()}>{t('sales.inventory.shareWithCustomer')}</Button>, <Button key="close" onClick={close}>{t('common.close')}</Button>, <Button key="save" type="primary" loading={saving} disabled={!dirty} onClick={() => void save()}>{t('sales.inventory.save')}</Button>]}>
    <div className="lead-inventory-totals">
      <div><small>{t('sales.inventory.expectedVolume')}</small><strong>{t('sales.cbmValue', { value: cbm(totals.cbm) })}</strong></div>
      <div><small>{t('common.items')}</small><strong>{totals.items}</strong></div>
      <div><small>{t('sales.boxes')}</small><strong>{totals.boxes}</strong></div>
      <div className={totals.fragile ? 'is-fragile' : ''}><small>{t('sales.inventory.fragilePieces')}</small><strong>{totals.fragile}</strong></div>
      <div className={totals.dropped ? 'is-dropped' : ''}><small>{t('sales.inventory.customerKeeps')}</small><strong>{t('sales.cbmValue', { value: cbm(totals.confirmed) })}</strong></div>
    </div>
    {shareUrl && <div className="lead-inventory-share">
      <Input readOnly aria-label={t('sales.inventory.reviewLink')} value={shareUrl} />
      <ShareChannels size="small" url={shareUrl} subject={t('sales.inventory.shareSubject')} phone={lead?.phone} email={lead?.email} text={shareText}>
        <Button size="small" href={shareUrl} target="_blank" rel="noopener noreferrer">{t('sales.inventory.openPage')}</Button>
      </ShareChannels>
    </div>}
    {review && review.repliedAt && <Alert style={{ marginBottom: 10 }} type={review.notNeeded ? 'warning' : 'success'} showIcon
      title={t('sales.inventory.customerAnswered', { date: formatDateTime(review.repliedAt) })}
      description={review.pending ? t('sales.inventory.answerPending', { count: review.notNeeded, pending: review.pending }) : t('sales.inventory.answer', { count: review.notNeeded })} />}
    {ai && ai.runs > 0 && <p className="lead-inventory-ai"><RobotOutlined /> {t('sales.inventory.aiRuns', { count: ai.runs })}{ai.cost != null ? <> · {t('sales.approx')} <strong>${formatNumber(ai.cost, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</strong></> : ' · ' + t('sales.inventory.costNotCalculated')}</p>}
    {!lines ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      : !lines.length ? <Empty description={t('sales.inventory.empty')} />
      : <>
        {lines.some(l => l.sourceAttachmentId && !l.unitCbm) && <Alert style={{ marginBottom: 10 }} type="warning" showIcon title={t('sales.inventory.missingVolume')} />}
        <div className="lead-inventory-table">
          <div className="lead-inventory-row is-head"><span>{t('sales.picture')}</span><span>{t('common.room')}</span><span>{t('common.type')}</span><span>{t('sales.inventory.itemOrBox')}</span><span>{t('sales.qty')}</span><span>{t('sales.inventory.cbmPerUnit')}</span><span>{t('sales.cbm')}</span><span>{t('sales.fragile')}</span><span>{t('common.customer')}</span><span>{t('sales.inventory.handlingNotes')}</span><span /></div>
          {lines.map((l, i) => <div key={l.id ?? 'new' + i} className={'lead-inventory-row' + (l.fragile ? ' is-fragile' : '') + (l.customerStatus === 'NOT_NEEDED' ? ' is-dropped' : '')}>
            {l.imageUrl
              ? <span className="lead-inventory-picture"><ItemPicture src={l.imageUrl} mark={l.imageMark} alt={l.name} /><Tooltip title={t('sales.inventory.removePictureTip')}><Button size="small" icon={<CloseOutlined />} aria-label={t('sales.inventory.removePicture')} onClick={() => change(i, { imageUrl: null, imageMark: null })} /></Tooltip></span>
              : <span className="lead-inventory-picture-empty" title={t('sales.inventory.noPicture')}><PictureOutlined /></span>}
            <AutoComplete size="small" value={l.room ?? ''} options={rooms} placeholder={t('common.room')} onChange={v => change(i, { room: v || null })} />
            <Select size="small" value={l.kind} onChange={v => change(i, { kind: v })} options={[{ value: 'ITEM', label: t('common.item') }, { value: 'BOX', label: t('sales.boxes') }]} />
            <span className="lead-inventory-name"><Input size="small" value={l.name} maxLength={160} onChange={e => change(i, { name: e.target.value })} />{l.sourceAttachmentId ? <Tooltip title={t('sales.inventory.aiTip')}><Tag icon={<RobotOutlined />} color="purple">{t('sales.ai')}</Tag></Tooltip> : <Tag>{t('sales.inventory.manual')}</Tag>}</span>
            <InputNumber size="small" min={1} max={10000} value={l.quantity} onChange={v => change(i, { quantity: v ?? 1 })} style={{ width: '100%' }} />
            <InputNumber size="small" min={0} max={100} step={0.05} precision={3} value={l.unitCbm} onChange={v => change(i, { unitCbm: v ?? 0 })} style={{ width: '100%' }} />
            <span className="lead-inventory-cbm">{cbm((l.quantity || 0) * (l.unitCbm || 0))}</span>
            <Checkbox checked={l.fragile} onChange={e => change(i, { fragile: e.target.checked })} />
            <span className="lead-inventory-customer">{statusTag(l)}</span>
            <Input size="small" value={l.handling ?? ''} placeholder={l.notes ?? t('sales.inventory.specialHandling')} maxLength={300} onChange={e => change(i, { handling: e.target.value || null })} title={l.notes ?? undefined} />
            <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t('sales.inventory.removeLine')} onClick={() => { setLines(all => all!.filter((_, n) => n !== i)); setDirty(true) }} />
          </div>)}
        </div>
      </>}
  </Modal>
}
