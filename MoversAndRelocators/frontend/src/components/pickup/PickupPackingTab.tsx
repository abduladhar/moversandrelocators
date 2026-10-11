import { useMemo, useState } from 'react'
import { AutoComplete, Button, Card, Checkbox, Empty, Form, Input, InputNumber, Modal, Popconfirm, Progress, Select, Space, Tag, Tooltip, Typography, message } from 'antd'
import { AppstoreAddOutlined, DeleteOutlined, EditOutlined, InboxOutlined, MinusCircleOutlined, PlusOutlined, PrinterOutlined, UnorderedListOutlined } from '@ant-design/icons'
import type { BoxType, PackingMaterial, PickupDetail, PickupPackage, PickupWork } from '../../types'
import { money } from '../ExpensesCard'

export type PackageDraft = { boxTypeId: string; trackingNumber: string | null; notes: string | null; roomName: string | null; isFragile: boolean; items: { itemName: string; quantity: number; notes: string | null; roomName: string | null; householdItemId: string | null }[] }
export type MaterialDraft = { materialId: string; quantity: number; unitCost: number | null }
type BoxForm = { boxTypeId: string; roomName: string; isFragile: boolean; notes: string; items: { itemName: string; quantity: number }[] }

export const toDraft = (x: PickupPackage): PackageDraft => ({ boxTypeId: x.boxTypeId, trackingNumber: x.trackingNumber, notes: x.notes, roomName: x.roomName, isFragile: x.isFragile, items: x.items.map(i => ({ itemName: i.itemName, quantity: i.quantity, notes: i.notes, roomName: i.roomName, householdItemId: i.householdItemId })) })
const key = (room: string | null, name: string) => `${(room ?? '').trim().toLowerCase()}|${name.trim().toLowerCase()}`

type Props = { detail: PickupDetail; work: PickupWork; boxTypes: BoxType[]; materials: PackingMaterial[]; savePacking: (packages: PackageDraft[], extras: MaterialDraft[]) => Promise<void>; onPrintLabels: (packages: PickupPackage[]) => void; onLoadFromPacking?: () => void }

/** Pack boxes room by room against the expected inventory; box-building materials follow each box type's recipe. */
export function PickupPackingTab({ detail, work, boxTypes, materials, savePacking, onPrintLabels, onLoadFromPacking }: Props) {
  const [editing, setEditing] = useState<{ index: number | null } | null>(null), [busy, setBusy] = useState(false), [extraOpen, setExtraOpen] = useState(false)
  const [form] = Form.useForm<BoxForm>(), [extraForm] = Form.useForm<{ materialId: string; quantity: number }>()
  const packages = detail.packages, extras = detail.materials.filter(m => !m.isBoxRecipe), recipe = detail.materials.filter(m => m.isBoxRecipe)
  const drafts = () => packages.map(toDraft), extraDrafts = (): MaterialDraft[] => extras.map(m => ({ materialId: m.materialId, quantity: m.quantity, unitCost: m.unitCost }))
  const boxType = (id: string) => boxTypes.find(b => b.id === id)
  const watchedType = Form.useWatch('boxTypeId', form), watchedRoom = Form.useWatch('roomName', form)

  // Packed quantity per expected line, matched by room and item name.
  const packed = useMemo(() => { const m = new Map<string, number>(); for (const p of packages) for (const i of p.items) { const k = key(i.roomName ?? p.roomName, i.itemName); m.set(k, (m.get(k) ?? 0) + i.quantity) } return m }, [packages])
  const rooms = useMemo(() => { const g = new Map<string, typeof work.expectedInventory>(); for (const x of work.expectedInventory) g.set(x.roomName, [...(g.get(x.roomName) ?? []), x]); return [...g.entries()] }, [work.expectedInventory])
  const expectedTotal = work.expectedInventory.reduce((s, x) => s + x.quantity, 0)
  const packedTotal = work.expectedInventory.reduce((s, x) => s + Math.min(x.quantity, packed.get(key(x.roomName, x.itemName)) ?? 0), 0)
  const roomOptions = [...new Set([...work.expectedInventory.map(x => x.roomName), ...packages.map(p => p.roomName).filter((x): x is string => Boolean(x))])].map(value => ({ value }))
  const itemOptions = (room?: string) => [...new Set(work.expectedInventory.filter(x => !room || x.roomName.toLowerCase() === room.toLowerCase()).map(x => x.itemName))].map(value => ({ value }))

  const open = (index: number | null, prefill?: { roomName: string; itemName: string; quantity: number }) => {
    const p = index === null ? null : packages[index]
    form.resetFields()
    form.setFieldsValue(p ? { boxTypeId: p.boxTypeId, roomName: p.roomName ?? '', isFragile: p.isFragile, notes: p.notes ?? '', items: p.items.map(i => ({ itemName: i.itemName, quantity: i.quantity })) }
      : { boxTypeId: boxTypes.find(b => b.isActive)?.id, roomName: prefill?.roomName ?? '', isFragile: false, notes: '', items: prefill ? [{ itemName: prefill.itemName, quantity: prefill.quantity }] : [{ itemName: '', quantity: 1 }] })
    setEditing({ index })
  }
  const run = async (action: () => Promise<void>, success: string) => { setBusy(true); try { await action(); message.success(success); return true } catch (e) { message.error(e instanceof Error ? e.message : 'Unable to save packing'); return false } finally { setBusy(false) } }
  const saveBox = async () => {
    const v = await form.validateFields(); const room = v.roomName?.trim() || null
    const box: PackageDraft = { boxTypeId: v.boxTypeId, trackingNumber: editing?.index != null ? packages[editing.index].trackingNumber : null, notes: v.notes?.trim() || null, roomName: room, isFragile: v.isFragile ?? false,
      items: v.items.filter(i => i.itemName?.trim()).map(i => ({ itemName: i.itemName.trim(), quantity: i.quantity, notes: null, roomName: room, householdItemId: work.expectedInventory.find(x => key(x.roomName, x.itemName) === key(room, i.itemName))?.householdItemId ?? null })) }
    if (!box.items.length) return message.warning('Add at least one item to the box.')
    const next = drafts(); if (editing?.index != null) next[editing.index] = box; else next.push(box)
    if (await run(() => savePacking(next, extraDrafts()), editing?.index != null ? 'Box updated' : 'Box added')) setEditing(null)
  }
  const removeBox = (index: number) => void run(() => savePacking(drafts().filter((_, i) => i !== index), extraDrafts()), 'Box removed')
  const addExtra = async () => { const v = await extraForm.validateFields(); if (await run(() => savePacking(drafts(), [...extraDrafts().filter(x => x.materialId !== v.materialId), { materialId: v.materialId, quantity: v.quantity, unitCost: null }]), 'Material added')) setExtraOpen(false) }
  const removeExtra = (materialId: string) => void run(() => savePacking(drafts(), extraDrafts().filter(x => x.materialId !== materialId)), 'Material removed')
  const recipeText = (id?: string) => { const b = id ? boxType(id) : undefined; return b ? `${b.capacityCbm} CBM${b.materials.length ? ` · built with ${b.materials.map(m => `${m.quantity} ${m.unit} ${m.materialName}`).join(', ')}` : ''}` : '' }

  return <div className="pickup-packing">
    <Card className="pickup-expected" title={<Space><UnorderedListOutlined />Items to pack</Space>} extra={expectedTotal > 0 && <Tag className="survey-volume-badge">{packedTotal} of {expectedTotal} packed</Tag>}>
      {expectedTotal > 0 && <Progress percent={Math.round(packedTotal / expectedTotal * 100)} size="small" showInfo={false} className="pickup-expected-progress" />}
      {work.inventorySource && <Typography.Text type="secondary" className="pickup-hint">From the {work.inventorySource === 'QUOTATION' ? 'quotation' : 'survey'} inventory. Select an item to pack it into a new box.</Typography.Text>}
      {rooms.length ? rooms.map(([room, items]) => <div key={room} className="pickup-room">
        <h4>{room}</h4>
        {items.map(x => { const done = Math.min(x.quantity, packed.get(key(x.roomName, x.itemName)) ?? 0); const left = x.quantity - done
          return <button type="button" key={`${room}-${x.itemName}`} className={`pickup-expected-row ${left === 0 ? 'is-done' : done > 0 ? 'is-partial' : ''}`} disabled={left === 0} onClick={() => open(null, { roomName: room, itemName: x.itemName, quantity: left })}>
            <span>{x.itemName}</span><b>{done}/{x.quantity}</b>
          </button> })}
      </div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No survey or quotation inventory is linked. Add boxes and their contents directly." />}
    </Card>

    <div className="pickup-stack">
      <Card title={<Space><InboxOutlined />Boxes</Space>} extra={<Space wrap>{onLoadFromPacking && <Tooltip title="Collect boxes that a packing job already packed"><Button icon={<InboxOutlined />} onClick={onLoadFromPacking}>Load from packing</Button></Tooltip>}<Button icon={<PrinterOutlined />} disabled={!packages.length} onClick={() => onPrintLabels(packages)}>Print all labels</Button><Button type="primary" icon={<AppstoreAddOutlined />} onClick={() => open(null)}>Add box</Button></Space>}>
        {packages.length ? <div className="survey-item-grid">{packages.map((p, index) => <div key={p.id} className="survey-tile">
          <div className="survey-tile-head"><span className="survey-tile-icon"><InboxOutlined /></span><strong title={p.trackingNumber}>Box {index + 1} · {p.trackingNumber}</strong>
            <Space size={0} className="survey-tile-actions"><Tooltip title="Print label"><Button size="small" type="text" aria-label="Print label" icon={<PrinterOutlined />} onClick={() => onPrintLabels([p])} /></Tooltip>
              <Button size="small" type="text" aria-label="Edit box" icon={<EditOutlined />} onClick={() => open(index)} />
              <Popconfirm title="Remove this box and its contents?" onConfirm={() => removeBox(index)}><Button size="small" type="text" danger aria-label="Remove box" icon={<DeleteOutlined />} /></Popconfirm></Space></div>
          <div className="pickup-box-tags"><Tag className="survey-tile-tag">{p.boxTypeName}</Tag>{p.roomName && <Tag>{p.roomName}</Tag>}{p.isFragile && <Tag color="red">Fragile</Tag>}</div>
          <div className="survey-tile-contents">{p.items.map((i, n) => <span key={n}>{i.itemName} × {i.quantity}</span>)}</div>
          {p.notes && <p className="survey-tile-note">{p.notes}</p>}
        </div>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No boxes packed yet"><Button type="primary" icon={<PlusOutlined />} onClick={() => open(null)}>Add first box</Button></Empty>}
      </Card>

      <Card title="Packing materials" extra={<Button icon={<PlusOutlined />} onClick={() => { extraForm.resetFields(); setExtraOpen(true) }}>Add extra material</Button>}>
        <h4 className="pickup-subhead">Used to build the boxes <small>from each box type's recipe</small></h4>
        {recipe.length ? <ul className="pickup-material-list">{recipe.map(m => <li key={`r-${m.materialId}`}><span>{m.materialName}</span><b>{m.quantity} {m.unit}</b><em>{money(m.totalCost)}</em></li>)}</ul> : <Typography.Text type="secondary" className="pickup-hint">Calculated automatically when boxes are added.</Typography.Text>}
        <h4 className="pickup-subhead">Extra materials used while packing</h4>
        {extras.length ? <ul className="pickup-material-list">{extras.map(m => <li key={`e-${m.materialId}`}><span>{m.materialName}</span><b>{m.quantity} {m.unit}</b><em>{money(m.totalCost)}</em>
          <Popconfirm title="Remove this material?" onConfirm={() => removeExtra(m.materialId)}><Button type="text" size="small" danger aria-label={`Remove ${m.materialName}`} icon={<DeleteOutlined />} /></Popconfirm></li>)}</ul>
          : <Typography.Text type="secondary" className="pickup-hint">Bubble wrap, stretch film, blankets and similar.</Typography.Text>}
        <div className="pickup-material-total"><span>Total material cost</span><b>{money(detail.materials.reduce((s, m) => s + m.totalCost, 0))}</b></div>
      </Card>
    </div>

    <Modal centered width={640} open={editing !== null} title={editing?.index != null ? `Edit box ${editing.index + 1}` : 'Add box'} okText={editing?.index != null ? 'Save box' : 'Add box'} confirmLoading={busy} onOk={() => void saveBox()} onCancel={() => setEditing(null)} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false}>
        <div className="master-form-grid">
          <Form.Item label="Box type" name="boxTypeId" rules={[{ required: true, message: 'Select a box type' }]} extra={recipeText(watchedType)}><Select showSearch optionFilterProp="label" options={boxTypes.filter(b => b.isActive).map(b => ({ value: b.id, label: b.name }))} /></Form.Item>
          <Form.Item label="Room" name="roomName" rules={[{ max: 120 }]}><AutoComplete options={roomOptions} placeholder="e.g. Kitchen" filterOption={(input, option) => String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())} /></Form.Item>
        </div>
        <Typography.Text strong>Items in this box</Typography.Text>
        <Form.List name="items">{(fields, { add, remove }) => <div className="pickup-box-items">
          {fields.map(field => <div key={field.key} className="pickup-box-item">
            <Form.Item name={[field.name, 'itemName']} rules={[{ required: true, whitespace: true, message: 'Item' }]}><AutoComplete options={itemOptions(watchedRoom)} placeholder="Item name" filterOption={(input, option) => String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())} /></Form.Item>
            <Form.Item name={[field.name, 'quantity']} rules={[{ required: true, message: 'Qty' }]}><InputNumber min={1} max={10000} precision={0} placeholder="Qty" style={{ width: '100%' }} /></Form.Item>
            <Button type="text" danger aria-label="Remove item" icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} disabled={fields.length === 1} />
          </div>)}
          <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ itemName: '', quantity: 1 })}>Add item</Button>
        </div>}</Form.List>
        <Form.Item name="isFragile" valuePropName="checked" style={{ marginTop: 14 }}><Checkbox>Fragile — print a handle-with-care warning on the label</Checkbox></Form.Item>
        <Form.Item label="Notes" name="notes"><Input maxLength={500} placeholder="Wrapping, orientation, seal number…" /></Form.Item>
      </Form>
    </Modal>
    <Modal centered open={extraOpen} title="Add extra packing material" okText="Add material" confirmLoading={busy} onOk={() => void addExtra()} onCancel={() => setExtraOpen(false)} destroyOnHidden>
      <Form form={extraForm} layout="vertical" requiredMark={false}>
        <Form.Item label="Material" name="materialId" rules={[{ required: true, message: 'Select a material' }]}><Select showSearch optionFilterProp="label" options={materials.filter(m => m.isActive).map(m => ({ value: m.id, label: `${m.name} · ${m.currentUnitCost}/${m.unit}` }))} /></Form.Item>
        <Form.Item label="Quantity" name="quantity" rules={[{ required: true, message: 'Enter the quantity' }]}><InputNumber min={0.001} max={100000} precision={3} style={{ width: '100%' }} /></Form.Item>
      </Form>
    </Modal>
  </div>
}
