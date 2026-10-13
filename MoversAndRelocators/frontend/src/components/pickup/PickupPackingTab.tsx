import { useMemo, useState } from 'react'
import { AutoComplete, Button, Card, Checkbox, Empty, Form, Input, InputNumber, Modal, Popconfirm, Progress, Select, Space, Tag, Tooltip, Typography, message } from 'antd'
import { AppstoreAddOutlined, DeleteOutlined, EditOutlined, InboxOutlined, MinusCircleOutlined, PlusOutlined, PrinterOutlined, UnorderedListOutlined } from '@ant-design/icons'
import type { BoxType, PackingMaterial, PickupDetail, PickupPackage, PickupWork } from '../../types'
import { money } from '../ExpensesCard'
import { useT } from '../../i18n'

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
  const { t } = useT()

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
  const run = async (action: () => Promise<void>, success: string) => { setBusy(true); try { await action(); message.success(success); return true } catch (e) { message.error(e instanceof Error ? e.message : t('pickups.packing.saveFailed')); return false } finally { setBusy(false) } }
  const saveBox = async () => {
    const v = await form.validateFields(); const room = v.roomName?.trim() || null
    const box: PackageDraft = { boxTypeId: v.boxTypeId, trackingNumber: editing?.index != null ? packages[editing.index].trackingNumber : null, notes: v.notes?.trim() || null, roomName: room, isFragile: v.isFragile ?? false,
      items: v.items.filter(i => i.itemName?.trim()).map(i => ({ itemName: i.itemName.trim(), quantity: i.quantity, notes: null, roomName: room, householdItemId: work.expectedInventory.find(x => key(x.roomName, x.itemName) === key(room, i.itemName))?.householdItemId ?? null })) }
    if (!box.items.length) return message.warning(t('pickups.packing.addOneItem'))
    const next = drafts(); if (editing?.index != null) next[editing.index] = box; else next.push(box)
    if (await run(() => savePacking(next, extraDrafts()), editing?.index != null ? t('pickups.packing.boxUpdated') : t('pickups.boxAdded'))) setEditing(null)
  }
  const removeBox = (index: number) => void run(() => savePacking(drafts().filter((_, i) => i !== index), extraDrafts()), t('pickups.packing.boxRemoved'))
  const addExtra = async () => { const v = await extraForm.validateFields(); if (await run(() => savePacking(drafts(), [...extraDrafts().filter(x => x.materialId !== v.materialId), { materialId: v.materialId, quantity: v.quantity, unitCost: null }]), t('pickups.packing.materialAdded'))) setExtraOpen(false) }
  const removeExtra = (materialId: string) => void run(() => savePacking(drafts(), extraDrafts().filter(x => x.materialId !== materialId)), t('pickups.packing.materialRemoved'))
  const recipeText = (id?: string) => { const b = id ? boxType(id) : undefined; return b ? `${b.capacityCbm} m³${b.materials.length ? ` · ${t('pickups.packing.builtWith', { materials: b.materials.map(m => `${m.quantity} ${m.unit} ${m.materialName}`).join(', ') })}` : ''}` : '' }

  return <div className="pickup-packing">
    <Card className="pickup-expected" title={<Space><UnorderedListOutlined />{t('pickups.packing.itemsToPack')}</Space>} extra={expectedTotal > 0 && <Tag className="survey-volume-badge">{t('pickups.packing.packedOf', { packed: packedTotal, total: expectedTotal })}</Tag>}>
      {expectedTotal > 0 && <Progress percent={Math.round(packedTotal / expectedTotal * 100)} size="small" showInfo={false} className="pickup-expected-progress" />}
      {work.inventorySource && <Typography.Text type="secondary" className="pickup-hint">{work.inventorySource === 'QUOTATION' ? t('pickups.packing.fromQuotation') : t('pickups.packing.fromSurvey')}</Typography.Text>}
      {rooms.length ? rooms.map(([room, items]) => <div key={room} className="pickup-room">
        <h4>{room}</h4>
        {items.map(x => { const done = Math.min(x.quantity, packed.get(key(x.roomName, x.itemName)) ?? 0); const left = x.quantity - done
          return <button type="button" key={`${room}-${x.itemName}`} className={`pickup-expected-row ${left === 0 ? 'is-done' : done > 0 ? 'is-partial' : ''}`} disabled={left === 0} onClick={() => open(null, { roomName: room, itemName: x.itemName, quantity: left })}>
            <span>{x.itemName}</span><b>{done}/{x.quantity}</b>
          </button> })}
      </div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('pickups.packing.noInventory')} />}
    </Card>

    <div className="pickup-stack">
      <Card title={<Space><InboxOutlined />{t('pickups.packing.boxes')}</Space>} extra={<Space wrap>{onLoadFromPacking && <Tooltip title={t('pickups.packing.loadFromPackingTip')}><Button icon={<InboxOutlined />} onClick={onLoadFromPacking}>{t('pickups.packing.loadFromPacking')}</Button></Tooltip>}<Button icon={<PrinterOutlined />} disabled={!packages.length} onClick={() => onPrintLabels(packages)}>{t('pickups.packing.printAllLabels')}</Button><Button type="primary" icon={<AppstoreAddOutlined />} onClick={() => open(null)}>{t('pickups.addBox')}</Button></Space>}>
        {packages.length ? <div className="survey-item-grid">{packages.map((p, index) => <div key={p.id} className="survey-tile">
          <div className="survey-tile-head"><span className="survey-tile-icon"><InboxOutlined /></span><strong title={p.trackingNumber}>{t('pickups.packing.boxNumber', { index: index + 1, number: p.trackingNumber })}</strong>
            <Space size={0} className="survey-tile-actions"><Tooltip title={t('pickups.packing.printLabel')}><Button size="small" type="text" aria-label={t('pickups.packing.printLabel')} icon={<PrinterOutlined />} onClick={() => onPrintLabels([p])} /></Tooltip>
              <Button size="small" type="text" aria-label={t('pickups.packing.editBoxAria')} icon={<EditOutlined />} onClick={() => open(index)} />
              <Popconfirm title={t('pickups.packing.removeBoxTitle')} okText={t('common.remove')} cancelText={t('common.cancel')} onConfirm={() => removeBox(index)}><Button size="small" type="text" danger aria-label={t('pickups.packing.removeBoxAria')} icon={<DeleteOutlined />} /></Popconfirm></Space></div>
          <div className="pickup-box-tags"><Tag className="survey-tile-tag">{p.boxTypeName}</Tag>{p.roomName && <Tag>{p.roomName}</Tag>}{p.isFragile && <Tag color="red">{t('pickups.fragile')}</Tag>}</div>
          <div className="survey-tile-contents">{p.items.map((i, n) => <span key={n}>{i.itemName} × {i.quantity}</span>)}</div>
          {p.notes && <p className="survey-tile-note">{p.notes}</p>}
        </div>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('pickups.noBoxesYet')}><Button type="primary" icon={<PlusOutlined />} onClick={() => open(null)}>{t('pickups.packing.addFirstBox')}</Button></Empty>}
      </Card>

      <Card title={t('pickups.packing.materials')} extra={<Button icon={<PlusOutlined />} onClick={() => { extraForm.resetFields(); setExtraOpen(true) }}>{t('pickups.packing.addExtraMaterial')}</Button>}>
        <h4 className="pickup-subhead">{t('pickups.packing.usedForBoxes')} <small>{t('pickups.packing.fromRecipe')}</small></h4>
        {recipe.length ? <ul className="pickup-material-list">{recipe.map(m => <li key={`r-${m.materialId}`}><span>{m.materialName}</span><b>{m.quantity} {m.unit}</b><em>{money(m.totalCost)}</em></li>)}</ul> : <Typography.Text type="secondary" className="pickup-hint">{t('pickups.packing.calculatedAutomatically')}</Typography.Text>}
        <h4 className="pickup-subhead">{t('pickups.packing.extraMaterials')}</h4>
        {extras.length ? <ul className="pickup-material-list">{extras.map(m => <li key={`e-${m.materialId}`}><span>{m.materialName}</span><b>{m.quantity} {m.unit}</b><em>{money(m.totalCost)}</em>
          <Popconfirm title={t('pickups.packing.removeMaterialTitle')} okText={t('common.remove')} cancelText={t('common.cancel')} onConfirm={() => removeExtra(m.materialId)}><Button type="text" size="small" danger aria-label={t('pickups.removeNamed', { name: m.materialName })} icon={<DeleteOutlined />} /></Popconfirm></li>)}</ul>
          : <Typography.Text type="secondary" className="pickup-hint">{t('pickups.packing.extraMaterialsHint')}</Typography.Text>}
        <div className="pickup-material-total"><span>{t('pickups.packing.totalMaterialCost')}</span><b>{money(detail.materials.reduce((s, m) => s + m.totalCost, 0))}</b></div>
      </Card>
    </div>

    <Modal centered width={640} open={editing !== null} title={editing?.index != null ? t('pickups.packing.editBox', { index: editing.index + 1 }) : t('pickups.addBox')} okText={editing?.index != null ? t('pickups.packing.saveBox') : t('pickups.addBox')} cancelText={t('common.cancel')} confirmLoading={busy} onOk={() => void saveBox()} onCancel={() => setEditing(null)} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false}>
        <div className="master-form-grid">
          <Form.Item label={t('pickups.boxType')} name="boxTypeId" rules={[{ required: true, message: t('pickups.chooseBoxType') }]} extra={recipeText(watchedType)}><Select showSearch optionFilterProp="label" options={boxTypes.filter(b => b.isActive).map(b => ({ value: b.id, label: b.name }))} /></Form.Item>
          <Form.Item label={t('common.room')} name="roomName" rules={[{ max: 120 }]}><AutoComplete options={roomOptions} placeholder={t('pickups.packing.roomPlaceholder')} filterOption={(input, option) => String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())} /></Form.Item>
        </div>
        <Typography.Text strong>{t('pickups.packing.itemsInBox')}</Typography.Text>
        <Form.List name="items">{(fields, { add, remove }) => <div className="pickup-box-items">
          {fields.map(field => <div key={field.key} className="pickup-box-item">
            <Form.Item name={[field.name, 'itemName']} rules={[{ required: true, whitespace: true, message: t('common.item') }]}><AutoComplete options={itemOptions(watchedRoom)} placeholder={t('pickups.packing.itemName')} filterOption={(input, option) => String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())} /></Form.Item>
            <Form.Item name={[field.name, 'quantity']} rules={[{ required: true, message: t('pickups.qty') }]}><InputNumber min={1} max={10000} precision={0} placeholder={t('pickups.qty')} style={{ width: '100%' }} /></Form.Item>
            <Button type="text" danger aria-label={t('pickups.packing.removeItem')} icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} disabled={fields.length === 1} />
          </div>)}
          <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ itemName: '', quantity: 1 })}>{t('pickups.packing.addItem')}</Button>
        </div>}</Form.List>
        <Form.Item name="isFragile" valuePropName="checked" style={{ marginTop: 14 }}><Checkbox>{t('pickups.packing.fragileCheckbox')}</Checkbox></Form.Item>
        <Form.Item label={t('common.notes')} name="notes"><Input maxLength={500} placeholder={t('pickups.packing.notesPlaceholder')} /></Form.Item>
      </Form>
    </Modal>
    <Modal centered open={extraOpen} title={t('pickups.packing.addExtraTitle')} okText={t('pickups.packing.addMaterial')} cancelText={t('common.cancel')} confirmLoading={busy} onOk={() => void addExtra()} onCancel={() => setExtraOpen(false)} destroyOnHidden>
      <Form form={extraForm} layout="vertical" requiredMark={false}>
        <Form.Item label={t('pickups.packing.material')} name="materialId" rules={[{ required: true, message: t('pickups.packing.selectMaterial') }]}><Select showSearch optionFilterProp="label" options={materials.filter(m => m.isActive).map(m => ({ value: m.id, label: `${m.name} · ${m.currentUnitCost}/${m.unit}` }))} /></Form.Item>
        <Form.Item label={t('common.quantity')} name="quantity" rules={[{ required: true, message: t('pickups.packing.enterQuantity') }]}><InputNumber min={0.001} max={100000} precision={3} style={{ width: '100%' }} /></Form.Item>
      </Form>
    </Modal>
  </div>
}
