import { useEffect, useMemo, useState } from 'react'
import { Alert, AutoComplete, Button, Checkbox, Empty, Input, InputNumber, Modal, Select, Spin, Tag, Tooltip, message } from 'antd'
import { DeleteOutlined, PlusOutlined, RobotOutlined } from '@ant-design/icons'
import { request } from '../api'

export type LeadInventoryLine = { id?: string; kind: 'ITEM' | 'BOX'; room: string | null; name: string; quantity: number; unitCbm: number; totalCbm?: number; fragile: boolean; handling: string | null; notes: string | null; sourceAttachmentId: string | null }
export type LeadInventory = { salesLeadId: string; lines: LeadInventoryLine[]; expectedCbm: number; itemCount: number; boxCount: number; fragileItems: number; aiRuns: number; aiCost: number | null }

export const leadInventoryApi = {
  get: (leadId: string) => request<LeadInventory>(`/api/sales/leads/${leadId}/inventory`),
  save: (leadId: string, lines: LeadInventoryLine[]) => request<LeadInventory>(`/api/sales/leads/${leadId}/inventory`, { method: 'PUT', body: JSON.stringify({ lines }) }),
}
export const cbm = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * The sales lead's expected inventory: AI-extracted and staff-entered items and boxes, with volume (CBM) and
 * fragile flags. Totals update while editing; Save replaces the stored list.
 */
export function LeadInventoryModal({ lead, open, onClose, onSaved }: { lead: { id: string; customerName: string; leadNumber: string } | null; open: boolean; onClose: () => void; onSaved?: (inventory: LeadInventory) => void }) {
  const [lines, setLines] = useState<LeadInventoryLine[]>(), [saving, setSaving] = useState(false), [dirty, setDirty] = useState(false), [ai, setAi] = useState<{ runs: number; cost: number | null }>()
  useEffect(() => {
    if (!open || !lead) return
    setLines(undefined); setDirty(false)
    leadInventoryApi.get(lead.id).then(x => { setLines(x.lines); setAi({ runs: x.aiRuns, cost: x.aiCost }) }).catch(e => { message.error(e instanceof Error ? e.message : 'Unable to load the inventory'); setLines([]) })
  }, [open, lead?.id])
  const totals = useMemo(() => {
    const all = lines ?? []
    return { cbm: all.reduce((n, l) => n + (l.quantity || 0) * (l.unitCbm || 0), 0), items: all.filter(l => l.kind === 'ITEM').reduce((n, l) => n + (l.quantity || 0), 0), boxes: all.filter(l => l.kind === 'BOX').reduce((n, l) => n + (l.quantity || 0), 0), fragile: all.filter(l => l.fragile).reduce((n, l) => n + (l.quantity || 0), 0) }
  }, [lines])
  const rooms = useMemo(() => [...new Set((lines ?? []).map(l => l.room).filter((x): x is string => !!x))].map(value => ({ value })), [lines])
  const change = (i: number, patch: Partial<LeadInventoryLine>) => { setLines(all => all!.map((l, n) => n === i ? { ...l, ...patch } : l)); setDirty(true) }
  const add = () => { setLines(all => [...(all ?? []), { kind: 'ITEM', room: null, name: '', quantity: 1, unitCbm: 0, fragile: false, handling: null, notes: null, sourceAttachmentId: null }]); setDirty(true) }
  const save = async () => {
    if (!lead || !lines) return
    if (lines.some(l => !l.name.trim() || !l.quantity)) { message.error('Every line needs a name and a quantity.'); return }
    setSaving(true)
    try { const saved = await leadInventoryApi.save(lead.id, lines); setLines(saved.lines); setDirty(false); onSaved?.(saved); message.success('Inventory saved') }
    catch (e) { message.error(e instanceof Error ? e.message : 'Unable to save the inventory') } finally { setSaving(false) }
  }
  const close = () => { if (dirty && !window.confirm('Discard the changes to this inventory?')) return; onClose() }

  return <Modal centered width={1180} open={open} title={lead ? `Expected inventory · ${lead.customerName} (${lead.leadNumber})` : ''} onCancel={close}
    footer={[<Button key="add" icon={<PlusOutlined />} onClick={add} disabled={!lines}>Add line</Button>, <Button key="close" onClick={close}>Close</Button>, <Button key="save" type="primary" loading={saving} disabled={!dirty} onClick={() => void save()}>Save inventory</Button>]}>
    <div className="lead-inventory-totals">
      <div><small>Expected volume</small><strong>{cbm(totals.cbm)} CBM</strong></div>
      <div><small>Items</small><strong>{totals.items}</strong></div>
      <div><small>Boxes</small><strong>{totals.boxes}</strong></div>
      <div className={totals.fragile ? 'is-fragile' : ''}><small>Fragile pieces</small><strong>{totals.fragile}</strong></div>
    </div>
    {ai && ai.runs > 0 && <p className="lead-inventory-ai"><RobotOutlined /> OpenAI: {ai.runs} run{ai.runs === 1 ? '' : 's'} for this lead{ai.cost != null ? <> · approx. <strong>${ai.cost.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</strong></> : ' · cost not calculated (no prices set)'}</p>}
    {!lines ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      : !lines.length ? <Empty description="No inventory yet. Use Extract items on a lead video or photo, or add lines here." />
      : <>
        {lines.some(l => l.sourceAttachmentId && !l.unitCbm) && <Alert style={{ marginBottom: 10 }} type="warning" showIcon title="Some lines have no volume. Enter the CBM per unit so the expected volume is complete." />}
        <div className="lead-inventory-table">
          <div className="lead-inventory-row is-head"><span>Room</span><span>Type</span><span>Item / box</span><span>Qty</span><span>CBM / unit</span><span>CBM</span><span>Fragile</span><span>Handling / notes</span><span /></div>
          {lines.map((l, i) => <div key={l.id ?? 'new' + i} className={'lead-inventory-row' + (l.fragile ? ' is-fragile' : '')}>
            <AutoComplete size="small" value={l.room ?? ''} options={rooms} placeholder="Room" onChange={v => change(i, { room: v || null })} />
            <Select size="small" value={l.kind} onChange={v => change(i, { kind: v })} options={[{ value: 'ITEM', label: 'Item' }, { value: 'BOX', label: 'Boxes' }]} />
            <span className="lead-inventory-name"><Input size="small" value={l.name} maxLength={160} onChange={e => change(i, { name: e.target.value })} />{l.sourceAttachmentId ? <Tooltip title="From AI extraction of a lead video or photo"><Tag icon={<RobotOutlined />} color="purple">AI</Tag></Tooltip> : <Tag>Manual</Tag>}</span>
            <InputNumber size="small" min={1} max={10000} value={l.quantity} onChange={v => change(i, { quantity: v ?? 1 })} style={{ width: '100%' }} />
            <InputNumber size="small" min={0} max={100} step={0.05} precision={3} value={l.unitCbm} onChange={v => change(i, { unitCbm: v ?? 0 })} style={{ width: '100%' }} />
            <span className="lead-inventory-cbm">{cbm((l.quantity || 0) * (l.unitCbm || 0))}</span>
            <Checkbox checked={l.fragile} onChange={e => change(i, { fragile: e.target.checked })} />
            <Input size="small" value={l.handling ?? ''} placeholder={l.notes ?? 'Special handling'} maxLength={300} onChange={e => change(i, { handling: e.target.value || null })} title={l.notes ?? undefined} />
            <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Remove line" onClick={() => { setLines(all => all!.filter((_, n) => n !== i)); setDirty(true) }} />
          </div>)}
        </div>
      </>}
  </Modal>
}
