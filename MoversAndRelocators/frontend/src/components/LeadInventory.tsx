import { useEffect, useMemo, useState } from 'react'
import { Alert, AutoComplete, Button, Checkbox, Empty, Input, InputNumber, Modal, Select, Space, Spin, Tag, Tooltip, message } from 'antd'
import { CloseOutlined, DeleteOutlined, LinkOutlined, PictureOutlined, PlusOutlined, RobotOutlined } from '@ant-design/icons'
import { request, salesApi } from '../api'
import { ItemPicture, type PictureMark } from './ItemPicture'

export type CustomerStatus = 'PENDING' | 'NEEDED' | 'NOT_NEEDED'
export type LeadInventoryLine = { id?: string; kind: 'ITEM' | 'BOX'; room: string | null; name: string; quantity: number; unitCbm: number; totalCbm?: number; fragile: boolean; handling: string | null; notes: string | null; sourceAttachmentId: string | null; /** Short-lived link to the item's picture, when one was attached. */ imageUrl?: string | null; imageMark?: PictureMark | null; /** What the customer answered on the shared inventory link. */ customerStatus?: CustomerStatus; customerNote?: string | null; customerDecidedAtUtc?: string | null }
export type LeadInventory = { salesLeadId: string; lines: LeadInventoryLine[]; expectedCbm: number; itemCount: number; boxCount: number; fragileItems: number; aiRuns: number; aiCost: number | null; confirmedCbm: number; notNeededLines: number; pendingLines: number; lastCustomerReplyAtUtc: string | null }

export const leadInventoryApi = {
  get: (leadId: string) => request<LeadInventory>(`/api/sales/leads/${leadId}/inventory`),
  // A line keeps its picture by naming its own id (the server never takes a storage key from the browser).
  save: (leadId: string, lines: LeadInventoryLine[]) => request<LeadInventory>(`/api/sales/leads/${leadId}/inventory`, { method: 'PUT', body: JSON.stringify({ lines: lines.map(l => ({ ...l, imageFromLineId: l.imageUrl && l.id ? l.id : null })) }) }),
}
export const cbm = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * The sales lead's expected inventory: AI-extracted and staff-entered items and boxes, with volume (CBM) and
 * fragile flags. Totals update while editing; Save replaces the stored list.
 */
export function LeadInventoryModal({ lead, open, onClose, onSaved }: { lead: { id: string; customerName: string; leadNumber: string } | null; open: boolean; onClose: () => void; onSaved?: (inventory: LeadInventory) => void }) {
  const [lines, setLines] = useState<LeadInventoryLine[]>(), [saving, setSaving] = useState(false), [dirty, setDirty] = useState(false), [ai, setAi] = useState<{ runs: number; cost: number | null }>()
  const [review, setReview] = useState<{ pending: number; notNeeded: number; repliedAt: string | null }>(), [shareUrl, setShareUrl] = useState(''), [sharing, setSharing] = useState(false)
  useEffect(() => {
    if (!open || !lead) return
    setLines(undefined); setDirty(false)
    setShareUrl('')
    leadInventoryApi.get(lead.id).then(x => { setLines(x.lines); setAi({ runs: x.aiRuns, cost: x.aiCost }); setReview({ pending: x.pendingLines, notNeeded: x.notNeededLines, repliedAt: x.lastCustomerReplyAtUtc }) }).catch(e => { message.error(e instanceof Error ? e.message : 'Unable to load the inventory'); setLines([]) })
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
    if (lines.some(l => !l.name.trim() || !l.quantity)) { message.error('Every line needs a name and a quantity.'); return }
    setSaving(true)
    try { const saved = await leadInventoryApi.save(lead.id, lines); setLines(saved.lines); setReview({ pending: saved.pendingLines, notNeeded: saved.notNeededLines, repliedAt: saved.lastCustomerReplyAtUtc }); setDirty(false); onSaved?.(saved); message.success('Inventory saved') }
    catch (e) { message.error(e instanceof Error ? e.message : 'Unable to save the inventory') } finally { setSaving(false) }
  }
  const close = () => { if (dirty && !window.confirm('Discard the changes to this inventory?')) return; onClose() }
  /* Sharing mints a fresh 14-day link: the token is only ever handed over once, at generation, so an earlier link
     cannot be shown again. The same token also opens the upload page, which is what the customer already knows. */
  const share = async () => {
    if (!lead) return
    if (dirty) { message.warning('Save the inventory before sharing it, so the customer sees the current list.'); return }
    setSharing(true)
    try {
      const generated = await salesApi.generateUploadLink(lead.id, 14, undefined, 'Please check the moving list and mark anything you do not need moved.')
      setShareUrl(generated.inventoryUrl)
      if (navigator.share) await navigator.share({ title: `Moving list for ${lead.customerName}`, text: 'Please check your moving list and mark anything you are not taking.', url: generated.inventoryUrl })
      else { await navigator.clipboard.writeText(generated.inventoryUrl); message.success('Review link copied') }
    } catch (e) { if (e instanceof Error && e.name !== 'AbortError') message.error(e.message) }
    finally { setSharing(false) }
  }
  const statusTag = (l: LeadInventoryLine) => l.customerStatus === 'NOT_NEEDED'
    ? <Tooltip title={l.customerNote ?? 'The customer does not want this moved'}><Tag color="red">Not needed</Tag></Tooltip>
    : l.customerStatus === 'NEEDED' ? <Tooltip title={l.customerNote ?? 'Confirmed by the customer'}><Tag color="green">Confirmed</Tag></Tooltip>
    : <Tag>Not asked</Tag>

  return <Modal centered width={1180} open={open} title={lead ? `Expected inventory · ${lead.customerName} (${lead.leadNumber})` : ''} onCancel={close}
    footer={[<Button key="add" icon={<PlusOutlined />} onClick={add} disabled={!lines}>Add line</Button>, <Button key="share" icon={<LinkOutlined />} loading={sharing} disabled={!lines?.length} onClick={() => void share()}>Share with customer</Button>, <Button key="close" onClick={close}>Close</Button>, <Button key="save" type="primary" loading={saving} disabled={!dirty} onClick={() => void save()}>Save inventory</Button>]}>
    <div className="lead-inventory-totals">
      <div><small>Expected volume</small><strong>{cbm(totals.cbm)} CBM</strong></div>
      <div><small>Items</small><strong>{totals.items}</strong></div>
      <div><small>Boxes</small><strong>{totals.boxes}</strong></div>
      <div className={totals.fragile ? 'is-fragile' : ''}><small>Fragile pieces</small><strong>{totals.fragile}</strong></div>
      <div className={totals.dropped ? 'is-dropped' : ''}><small>Customer keeps</small><strong>{cbm(totals.confirmed)} CBM</strong></div>
    </div>
    {shareUrl && <div className="lead-inventory-share">
      <Input readOnly aria-label="Customer review link" value={shareUrl} />
      <Space wrap>
        <Button size="small" onClick={() => navigator.clipboard.writeText(shareUrl).then(() => message.success('Link copied')).catch(() => message.info('Select and copy the link above.'))}>Copy link</Button>
        <Button size="small" href={'https://wa.me/?text=' + encodeURIComponent('Please check your moving list and mark anything you do not need moved: ' + shareUrl)} target="_blank" rel="noopener noreferrer">WhatsApp</Button>
        <Button size="small" href={'mailto:?subject=' + encodeURIComponent('Please check your moving list') + '&body=' + encodeURIComponent(shareUrl)}>Email</Button>
        <Button size="small" href={shareUrl} target="_blank" rel="noopener noreferrer">Open the page</Button>
      </Space>
    </div>}
    {review && review.repliedAt && <Alert style={{ marginBottom: 10 }} type={review.notNeeded ? 'warning' : 'success'} showIcon
      title={`The customer answered on ${new Date(review.repliedAt).toLocaleString()}`}
      description={`${review.notNeeded} line${review.notNeeded === 1 ? '' : 's'} marked as not needed${review.pending ? `, ${review.pending} still unanswered` : ''}. Lines marked not needed are left out of a quotation built from this inventory.`} />}
    {ai && ai.runs > 0 && <p className="lead-inventory-ai"><RobotOutlined /> AI: {ai.runs} run{ai.runs === 1 ? '' : 's'} for this lead{ai.cost != null ? <> · approx. <strong>${ai.cost.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</strong></> : ' · cost not calculated (no prices set)'}</p>}
    {!lines ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      : !lines.length ? <Empty description="No inventory yet. Use Extract items on a lead video or photo, or add lines here." />
      : <>
        {lines.some(l => l.sourceAttachmentId && !l.unitCbm) && <Alert style={{ marginBottom: 10 }} type="warning" showIcon title="Some lines have no volume. Enter the CBM per unit so the expected volume is complete." />}
        <div className="lead-inventory-table">
          <div className="lead-inventory-row is-head"><span>Picture</span><span>Room</span><span>Type</span><span>Item / box</span><span>Qty</span><span>CBM / unit</span><span>CBM</span><span>Fragile</span><span>Customer</span><span>Handling / notes</span><span /></div>
          {lines.map((l, i) => <div key={l.id ?? 'new' + i} className={'lead-inventory-row' + (l.fragile ? ' is-fragile' : '') + (l.customerStatus === 'NOT_NEEDED' ? ' is-dropped' : '')}>
            {l.imageUrl
              ? <span className="lead-inventory-picture"><ItemPicture src={l.imageUrl} mark={l.imageMark} alt={l.name} /><Tooltip title="Remove the picture"><Button size="small" icon={<CloseOutlined />} aria-label="Remove picture" onClick={() => change(i, { imageUrl: null, imageMark: null })} /></Tooltip></span>
              : <span className="lead-inventory-picture-empty" title="No picture"><PictureOutlined /></span>}
            <AutoComplete size="small" value={l.room ?? ''} options={rooms} placeholder="Room" onChange={v => change(i, { room: v || null })} />
            <Select size="small" value={l.kind} onChange={v => change(i, { kind: v })} options={[{ value: 'ITEM', label: 'Item' }, { value: 'BOX', label: 'Boxes' }]} />
            <span className="lead-inventory-name"><Input size="small" value={l.name} maxLength={160} onChange={e => change(i, { name: e.target.value })} />{l.sourceAttachmentId ? <Tooltip title="From AI extraction of a lead video or photo"><Tag icon={<RobotOutlined />} color="purple">AI</Tag></Tooltip> : <Tag>Manual</Tag>}</span>
            <InputNumber size="small" min={1} max={10000} value={l.quantity} onChange={v => change(i, { quantity: v ?? 1 })} style={{ width: '100%' }} />
            <InputNumber size="small" min={0} max={100} step={0.05} precision={3} value={l.unitCbm} onChange={v => change(i, { unitCbm: v ?? 0 })} style={{ width: '100%' }} />
            <span className="lead-inventory-cbm">{cbm((l.quantity || 0) * (l.unitCbm || 0))}</span>
            <Checkbox checked={l.fragile} onChange={e => change(i, { fragile: e.target.checked })} />
            <span className="lead-inventory-customer">{statusTag(l)}</span>
            <Input size="small" value={l.handling ?? ''} placeholder={l.notes ?? 'Special handling'} maxLength={300} onChange={e => change(i, { handling: e.target.value || null })} title={l.notes ?? undefined} />
            <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Remove line" onClick={() => { setLines(all => all!.filter((_, n) => n !== i)); setDirty(true) }} />
          </div>)}
        </div>
      </>}
  </Modal>
}
