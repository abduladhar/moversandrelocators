import {ReportPrintButton} from '../reportingV2/ReportPrintButton'
import {useCurrencies} from '../currency'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Card, Descriptions, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Tabs, Tag, Typography, message } from 'antd'
import { ArrowLeftOutlined, DollarOutlined, DeleteOutlined, EditOutlined, FileDoneOutlined, ImportOutlined, PlusOutlined, SyncOutlined } from '@ant-design/icons'
import { AiSpendCard } from '../components/AiSpendCard'
import { quotationsApi, surveysApi } from '../api'
import type { ChargeMaster, HouseholdItem, QuotationDetail, QuotationItemInput, QuotationLineInput, TaxMaster } from '../types'

const statusColor: Record<string, string> = { DRAFT: 'default', SENT: 'blue', REQUOTE_REQUESTED: 'orange', ACCEPTED: 'green', REJECTED: 'red' }

export function QuotationDetailPage({ quotationId, onBack, onChanged, onOpenRevision }: { quotationId: string; onBack: () => void; onChanged: () => void; onOpenRevision: (id: string) => void }) {
  const [detail, setDetail] = useState<QuotationDetail>(), [charges, setCharges] = useState<ChargeMaster[]>([]), [taxes, setTaxes] = useState<TaxMaster[]>([]), [masters, setMasters] = useState<HouseholdItem[]>([]), [lines, setLines] = useState<QuotationLineInput[]>([]), [items, setItems] = useState<QuotationItemInput[]>([]), [open, setOpen] = useState(false), [itemOpen, setItemOpen] = useState(false), [editing, setEditing] = useState<number | null>(null), [editingItem, setEditingItem] = useState<number | null>(null), [saving, setSaving] = useState(false)
  const {data:currencyData}=useCurrencies()
  const digits=currencyData?.currencies.find(c=>c.code===detail?.quotation.currency)?.decimalPlaces??2
  const mutationInFlight = useRef(false)
  const [refreshingReview, setRefreshingReview] = useState(false)
  const [form] = Form.useForm<QuotationLineInput>()
  const [itemForm] = Form.useForm<QuotationItemInput>()
  const load = () => Promise.all([quotationsApi.get(quotationId), quotationsApi.charges(), quotationsApi.taxes(), surveysApi.items()]).then(([quote, chargeMasters, taxMasters, itemMasters]) => { setDetail(quote); setCharges(chargeMasters); setTaxes(taxMasters); setMasters(itemMasters); setLines(quote.lines.map(x => ({ chargeMasterId: x.chargeMasterId, description: x.description, quantity: x.quantity, rate: x.rate, discountPercent: x.discountPercent, taxIds: x.taxes.map(tax => tax.taxMasterId), displayOrder: x.displayOrder }))); setItems(quote.quotationItems.map(x => ({ householdItemId: x.householdItemId, roomName: x.roomName, quantity: x.quantity, volumePerUnitCbm: x.volumePerUnitCbm, notes: x.notes ?? '', displayOrder: x.displayOrder }))) }).catch(error => message.error(error.message))
  useEffect(() => { void load() }, [quotationId])
  const preview = useMemo(() => lines.map((line, index) => { const charge = charges.find(x => x.id === line.chargeMasterId); const rate = line.rate ?? charge?.defaultRate ?? 0; const gross = line.quantity * rate; const discountAmount = gross * line.discountPercent / 100; const taxable = gross - discountAmount; const selected = taxes.filter(tax => line.taxIds.includes(tax.id)); const components = selected.filter(tax => tax.kind === 'TAX').map(tax => ({ tax, amount: tax.calculationBasis === 'QUANTITY' ? line.quantity * tax.rate : taxable * tax.rate / 100 })); const regularTax = components.reduce((sum, x) => sum + x.amount, 0); components.push(...selected.filter(tax => tax.kind === 'CESS').map(tax => ({ tax, amount: tax.calculationBasis === 'QUANTITY' ? line.quantity * tax.rate : (tax.calculationBasis === 'TAX_AMOUNT' ? regularTax : taxable) * tax.rate / 100 }))); const taxAmount = components.reduce((sum, x) => sum + x.amount, 0); return { ...line, index, chargeName: charge?.name ?? 'Charge', unit: charge?.unit ?? '', rate, gross, discountAmount, taxAmount, components, total: taxable + taxAmount } }), [lines, charges, taxes])
  const totals = useMemo(() => ({ subtotal: preview.reduce((x, y) => x + y.gross, 0), discount: preview.reduce((x, y) => x + y.discountAmount, 0), tax: preview.reduce((x, y) => x + y.taxAmount, 0), total: preview.reduce((x, y) => x + y.total, 0) }), [preview])
  const showLine = (index?: number) => { setEditing(index ?? null); form.setFieldsValue(index === undefined ? { chargeMasterId: '', description: '', quantity: 1, rate: null, discountPercent: 0, taxIds: taxes.filter(x => x.isActive && x.isDefault).map(x => x.id), displayOrder: lines.length + 1 } : lines[index]); setOpen(true) }
  const chargeChanged = (id: string) => { const charge = charges.find(x => x.id === id); if (charge) form.setFieldsValue({ description: charge.name, rate: charge.defaultRate, taxIds: taxes.filter(x => x.isActive && x.isDefault).map(x => x.id) }) }
  const saveLine = async () => {
    let value: QuotationLineInput
    try { value = await form.validateFields() } catch { return }
    const next = editing === null ? [...lines, value] : lines.map((line, index) => index === editing ? value : line)
    if (await persistLines(next)) setOpen(false)
  }
  const showItem = (index?: number) => { setEditingItem(index ?? null); itemForm.setFieldsValue(index === undefined ? { householdItemId: '', roomName: 'Living room', quantity: 1, volumePerUnitCbm: null, notes: '', displayOrder: items.length + 1 } : items[index]); setItemOpen(true) }
  const itemChanged = (id: string) => { const item = masters.find(x => x.id === id); if (item) itemForm.setFieldValue('volumePerUnitCbm', item.volumeCbm) }
  const persistItems = async (next: QuotationItemInput[]) => {
    if (mutationInFlight.current) return false
    mutationInFlight.current = true; setSaving(true)
    try {
      const updated = await quotationsApi.saveItems(quotationId, next.map((item, index) => ({ ...item, displayOrder: index + 1 })))
      setDetail(updated)
      setItems(updated.quotationItems.map(item => ({ householdItemId: item.householdItemId, roomName: item.roomName, quantity: item.quantity, volumePerUnitCbm: item.volumePerUnitCbm, notes: item.notes ?? '', displayOrder: item.displayOrder })))
      onChanged(); message.success('Quotation items saved'); return true
    } catch (error) { message.error(error instanceof Error ? error.message : 'Unable to save quotation items'); return false }
    finally { mutationInFlight.current = false; setSaving(false) }
  }
  /* The sales lead's inventory is the list the customer themselves checked, so it is the honest starting point for
     the quotation. Only names that match an active household item can be priced, so the rest are reported back. */
  const importLeadInventory = async () => {
    if (mutationInFlight.current) return
    mutationInFlight.current = true; setSaving(true)
    try {
      const result = await quotationsApi.importLeadInventory(quotationId)
      setDetail(result.detail)
      setItems(result.detail.quotationItems.map(item => ({ householdItemId: item.householdItemId, roomName: item.roomName, quantity: item.quantity, volumePerUnitCbm: item.volumePerUnitCbm, notes: item.notes ?? '', displayOrder: item.displayOrder })))
      onChanged()
      const notes = [result.dropped ? `${result.dropped} the customer does not need` : '', result.unmatched.length ? `${result.unmatched.length} with no household item: ${result.unmatched.slice(0, 5).join(', ')}${result.unmatched.length > 5 ? '…' : ''}` : ''].filter(Boolean)
      message.success(`${result.imported} item${result.imported === 1 ? '' : 's'} imported from the lead inventory${notes.length ? ` · left out: ${notes.join('; ')}` : ''}`)
      if (result.unmatched.length) message.warning(`Add these to the household items master to quote them: ${result.unmatched.join(', ')}`, 8)
    } catch (error) { message.error(error instanceof Error ? error.message : 'Unable to import the lead inventory') }
    finally { mutationInFlight.current = false; setSaving(false) }
  }
  const saveItem = async () => {
    let value: QuotationItemInput
    try { value = await itemForm.validateFields() } catch { return }
    const next = editingItem === null ? [...items, value] : items.map((item, index) => index === editingItem ? value : item)
    if (await persistItems(next)) setItemOpen(false)
  }
  const persistLines = async (next: QuotationLineInput[]) => {
    if (mutationInFlight.current) return false
    mutationInFlight.current = true; setSaving(true)
    try {
      const updated = await quotationsApi.saveLines(quotationId, next.map((line, index) => ({ ...line, displayOrder: index + 1 })))
      setDetail(updated)
      setLines(updated.lines.map(line => ({ chargeMasterId: line.chargeMasterId, description: line.description, quantity: line.quantity, rate: line.rate, discountPercent: line.discountPercent, taxIds: line.taxes.map(tax => tax.taxMasterId), displayOrder: line.displayOrder })))
      onChanged(); message.success('Quotation charges and totals saved'); return true
    } catch (error) { message.error(error instanceof Error ? error.message : 'Unable to save quotation charges'); return false }
    finally { mutationInFlight.current = false; setSaving(false) }
  }
  const createRevision = async () => {
    if (mutationInFlight.current) return
    mutationInFlight.current = true; setSaving(true)
    try { const revised = await quotationsApi.revise(quotationId); onChanged(); onOpenRevision(revised.id); message.success('Revision created. Review items and charges before sharing.') }
    catch (error) { message.error(error instanceof Error ? error.message : 'Unable to create revision') }
    finally { mutationInFlight.current = false; setSaving(false) }
  }
  const [refreshing, setRefreshing] = useState(false)
  const refreshQuotation = async () => {
    if (mutationInFlight.current || open || itemOpen) return
    mutationInFlight.current = true; setRefreshing(true); setSaving(true)
    try { await load(); onChanged() }
    finally { mutationInFlight.current = false; setRefreshing(false); setSaving(false) }
  }
  const refreshReview = async () => {
    setRefreshingReview(true)
    try { setDetail(await quotationsApi.get(quotationId)); onChanged() }
    catch (error) { message.error(error instanceof Error ? error.message : 'Unable to refresh customer response') }
    finally { setRefreshingReview(false) }
  }
  const applyRequote = async (requestId: string) => { setSaving(true); try { await quotationsApi.applyRequote(quotationId, requestId); await load(); onChanged(); message.success('Survey items, CBM, and CBM-based quotation charges recalculated') } catch (error) { message.error(error instanceof Error ? error.message : 'Unable to apply customer changes') } finally { setSaving(false) } }
  if (!detail) return <Card loading />
  const q = detail.quotation; const locked = q.status === 'ACCEPTED' || q.status === 'REJECTED'
  return <div className="survey-workspace quotation-workspace"><div className="survey-workspace-header"><div className="survey-heading"><Button disabled={saving} icon={<ArrowLeftOutlined />} aria-label="Back to quotations" onClick={onBack} /><div><Typography.Text className="eyebrow">QUOTATION WORKSPACE</Typography.Text><Typography.Title level={2}>{q.quotationNumber}<span className="survey-heading-customer">{q.customerName}</span></Typography.Title></div></div><Space wrap className="survey-heading-actions"><ReportPrintButton type="QUOTATION" title={q.quotationNumber} id={q.id}/><Button icon={<SyncOutlined />} loading={refreshing} disabled={saving || refreshingReview || open || itemOpen} onClick={() => void refreshQuotation()}>Refresh</Button><Tag className="survey-status-tag" color={statusColor[q.status]}>{q.status.replaceAll('_', ' ')}</Tag></Space></div>
    {q.revisedFromNumber && <Alert type="info" showIcon message={`Revision of ${q.revisedFromNumber}`} description={<div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>Previous rejection reason: {q.revisionReason || 'Not recorded'}</div>} />}
    <div className="survey-kpi-row quotation-kpi-row">{[
      { key: 'subtotal', label: 'Subtotal', value: totals.subtotal },
      { key: 'discount', label: 'Discount', value: totals.discount },
      { key: 'tax', label: 'Tax', value: totals.tax },
      { key: 'total', label: 'Grand total', value: totals.total },
    ].map(kpi => <div key={kpi.key} className="survey-kpi survey-kpi-cost"><span className="survey-kpi-icon"><DollarOutlined /></span><div><small>{kpi.label}</small><strong><em>{q.currency}</em> {kpi.value.toFixed(digits)}</strong></div></div>)}</div>
    <Tabs className="survey-workspace-tabs" defaultActiveKey="overview" destroyOnHidden={false} onChange={key => { if (key === 'review') void refreshReview() }} items={[
      { key: 'overview', label: 'Overview', children: <>
<Card><Descriptions size="small" bordered column={{ xs: 1, md: 3 }} items={[{ key: 'origin', label: 'Origin', children: q.origin }, { key: 'destination', label: 'Destination', children: q.destination }, { key: 'employee', label: 'Sales employee', children: q.assignedEmployeeName }, { key: 'lead', label: 'Sales lead', children: q.leadNumber ?? 'Independent' }, { key: 'survey', label: 'Survey', children: q.surveyNumber ?? 'No survey' }, { key: 'valid', label: 'Valid until', children: new Date(`${q.validUntil}T00:00:00`).toLocaleDateString() }, { key: 'volume', label: 'Survey volume', children: detail.surveyVolumeCbm === null ? '—' : `${detail.surveyVolumeCbm.toFixed(3)} CBM` }, { key: 'response', label: 'Customer response', children: q.rejectionReason ?? (q.respondedAtUtc ? new Date(q.respondedAtUtc).toLocaleString() : 'Pending') }]} /></Card>
        <Card title="Terms & notes"><Typography.Paragraph>{q.terms || 'No terms and conditions entered.'}</Typography.Paragraph>{q.notes && <><Typography.Text strong>Internal notes</Typography.Text><Typography.Paragraph>{q.notes}</Typography.Paragraph></>}</Card>
        <AiSpendCard spend={detail.leadAiSpend} context="quotation" />
      </> },
      { key: 'items', label: `Quotation items (${items.length})`, children: <>
<Card title="Quotation items" extra={!locked && <Space>{q.salesLeadId && <Popconfirm title="Build the item list from the lead inventory?" description="This replaces the items below with what the customer confirmed on their moving list." onConfirm={() => void importLeadInventory()}><Button disabled={saving} icon={<ImportOutlined />}>From lead inventory</Button></Popconfirm>}<Button disabled={saving} type="primary" icon={<PlusOutlined />} onClick={() => showItem()}>Add item</Button></Space>}>
      {items.length ? <div className="quote-line-list">{items.map((item, index) => { const master = masters.find(x => x.id === item.householdItemId); const volume = item.volumePerUnitCbm ?? master?.volumeCbm ?? 0; return <Card size="small" key={`${item.householdItemId}-${index}`} className="quote-line-card quotation-item-card"><div className="quote-line-main"><div><strong>{master?.name ?? 'Item'}</strong><small>{item.roomName}{item.notes ? ` · ${item.notes}` : ''}</small></div><div className="quote-line-total"><small>VOLUME</small><strong>{(item.quantity * volume).toFixed(3)} CBM</strong></div>{!locked && <Space><Button disabled={saving} type="text" aria-label="Edit item" icon={<EditOutlined />} onClick={() => showItem(index)} /><Popconfirm disabled={saving} title="Remove this item?" onConfirm={async () => { await persistItems(items.filter((_, i) => i !== index)) }}><Button disabled={saving} type="text" danger aria-label="Remove" icon={<DeleteOutlined />} /></Popconfirm></Space>}</div><div className="quote-line-breakdown"><span>Room {item.roomName}</span><span>Count {item.quantity}</span><span>{volume.toFixed(3)} CBM each</span></div></Card> })}</div> : <Empty description="Add household items to this quotation" />}
    </Card>
      </> },
      { key: 'survey', label: 'Survey inventory', children: <>
{q.includeSurveyItems && detail.surveyRooms.length > 0 && <Card title="Survey inventory included with quotation" extra={`${detail.surveyRooms.reduce((sum, room) => sum + room.totalVolumeCbm, 0).toFixed(3)} CBM`}><div className="survey-inventory-preview">{detail.surveyRooms.map(room => <section key={room.roomId} className="public-survey-room"><div className="public-survey-room-title"><strong>{room.roomName}</strong><span>{room.totalVolumeCbm.toFixed(3)} CBM</span></div>{room.items.map(item => <div key={item.surveyItemId} className="staff-survey-item"><span><strong>{item.itemName}</strong><small>{item.notes ?? 'No handling note'}</small></span><span>{item.quantity} × {item.volumePerUnitCbm.toFixed(3)} CBM</span></div>)}</section>)}</div></Card>}
        {(!q.includeSurveyItems || !detail.surveyRooms.length) && <Card><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={q.includeSurveyItems ? 'No survey items have been entered yet.' : 'Survey inventory is not included in this quotation.'} /></Card>}
      </> },
      { key: 'charges', label: `Charges & taxes (${lines.length})`, children: <>
        <Typography.Paragraph type="secondary">Items and charges are saved when you save their popup. Totals reflect the saved charges.</Typography.Paragraph>
<Card title={<Space><FileDoneOutlined />Charges</Space>} extra={!locked && <Button disabled={saving} type="primary" icon={<PlusOutlined />} onClick={() => showLine()}>Add charge</Button>}>
      {preview.length ? <div className="quote-line-list">{preview.map(line => <Card size="small" key={line.index} className="quote-line-card"><div className="quote-line-main"><div><strong>{line.chargeName}</strong><small>{line.description} · {line.quantity} {line.unit} × {line.rate.toFixed(digits)}</small><div className="line-tax-tags">{line.components.length ? line.components.map(component => <Tag key={component.tax.id} color={component.tax.kind === 'CESS' ? 'orange' : 'blue'}>{component.tax.name}: {component.amount.toFixed(digits)}</Tag>) : <Tag>No tax</Tag>}</div></div><div className="quote-line-total"><small>LINE TOTAL</small><strong>{q.currency} {line.total.toFixed(digits)}</strong></div>{!locked && <Space><Button disabled={saving} type="text" aria-label="Edit charge" icon={<EditOutlined />} onClick={() => showLine(line.index)} /><Popconfirm disabled={saving} title="Remove this charge?" onConfirm={async () => { await persistLines(lines.filter((_, index) => index !== line.index)) }}><Button disabled={saving} type="text" danger aria-label="Remove" icon={<DeleteOutlined />} /></Popconfirm></Space>}</div><div className="quote-line-breakdown"><span>Gross {line.gross.toFixed(digits)}</span><span>Discount {line.discountAmount.toFixed(digits)}</span><span>Tax + cess {line.taxAmount.toFixed(digits)}</span></div></Card>)}</div> : <Empty description="Add quotation charges" />}
    </Card>
      </> },
      { key: 'review', label: <Space size={6}>Customer review{q.status === 'REJECTED' ? <Tag color="red">Rejected</Tag> : q.status === 'ACCEPTED' ? <Tag color="green">Accepted</Tag> : detail.requoteRequests.some(request => !request.appliedAtUtc) && <Tag color="orange">Pending</Tag>}</Space>, children: <>
        <Card title="Customer response" extra={<Button icon={<SyncOutlined />} loading={refreshingReview} onClick={() => void refreshReview()}>Refresh response</Button>}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {q.status === 'REJECTED' && <Button type="primary" icon={<PlusOutlined />} loading={saving} onClick={() => void createRevision()}>Create new revision</Button>}
            <Space wrap><Tag color={statusColor[q.status]}>{q.status.replaceAll('_', ' ')}</Tag>{q.respondedAtUtc && <Typography.Text type="secondary">Responded {new Date(q.respondedAtUtc).toLocaleString()}</Typography.Text>}</Space>
            {q.status === 'REJECTED' ? <Alert type="error" showIcon message="Reason for rejection" description={<div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{q.rejectionReason || 'No rejection reason was recorded.'}</div>} />
              : q.status === 'ACCEPTED' ? <Alert type="success" showIcon message="Customer accepted the quotation" />
              : q.status === 'REQUOTE_REQUESTED' ? <Alert type="warning" showIcon message="Customer requested a revised quotation" description="Review the requested changes below." />
              : <Typography.Text type="secondary">{q.status === 'DRAFT' ? 'Share the quotation link to collect the customer’s response.' : 'Waiting for the customer to respond through the quotation link.'}</Typography.Text>}
          </Space>
        </Card>
{detail.requoteRequests.length > 0 && <Card title="Customer requote request" extra={detail.requoteRequests[0].appliedAtUtc ? <Tag color="green">Applied {new Date(detail.requoteRequests[0].appliedAtUtc).toLocaleString()}</Tag> : <Button type="primary" icon={<SyncOutlined />} loading={saving} onClick={() => void applyRequote(detail.requoteRequests[0].id)}>Apply changes & recalculate</Button>}><Alert type={detail.requoteRequests[0].appliedAtUtc ? 'success' : 'warning'} showIcon message={detail.requoteRequests[0].appliedAtUtc ? 'Customer changes applied' : 'The customer changed the surveyed inventory'} description={detail.requoteRequests[0].appliedAtUtc ? 'Survey quantities and CBM-based quotation charges were recalculated. Review the totals before sharing again.' : 'Apply the requested quantities to the survey before resending. This recalculates survey CBM and every quotation line whose unit is CBM.'} /><div className="requote-change-list">{detail.requoteRequests[0].items.map(item => <div key={item.surveyItemId} className={item.originalQuantity !== item.requestedQuantity ? 'is-changed' : ''}><span><strong>{item.itemName}</strong><small>{item.roomName}{item.notes ? ` · ${item.notes}` : ''}</small></span><span>{item.originalQuantity} → <strong>{item.requestedQuantity}</strong></span></div>)}</div>{detail.requoteRequests[0].customerNotes && <Typography.Paragraph><strong>Customer note:</strong> {detail.requoteRequests[0].customerNotes}</Typography.Paragraph>}</Card>}
        {!detail.requoteRequests.length && q.status === 'REQUOTE_REQUESTED' && <Card><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No customer requote requests to review." /></Card>}
      </> },
    ]} />
    <Modal centered width={760} title={editing === null ? 'Add charge' : 'Edit charge'} open={open} onCancel={() => { if (!saving) setOpen(false) }} onOk={() => void saveLine()} okText="Save charge" confirmLoading={saving} cancelButtonProps={{ disabled: saving }} closable={!saving} maskClosable={!saving} keyboard={!saving} destroyOnHidden><Form form={form} layout="vertical" disabled={saving}><Form.Item label="Charge" name="chargeMasterId" rules={[{ required: true }]}><SelectCharge charges={charges} onChange={chargeChanged} /></Form.Item><Form.Item label="Description" name="description"><Input /></Form.Item><div className="master-form-grid"><Form.Item label="Quantity" name="quantity" rules={[{ required: true }]}><InputNumber min={0.001} precision={3} style={{ width: '100%' }} /></Form.Item><Form.Item className="amount-field" label="Rate" name="rate" rules={[{ required: true }]}><InputNumber controls={false} min={0} precision={digits} style={{ width: '100%' }} /></Form.Item><Form.Item label="Discount %" name="discountPercent"><InputNumber min={0} max={100} precision={3} style={{ width: '100%' }} /></Form.Item></div><Form.Item label="Taxes and cess" name="taxIds" extra="Select one or more configured components. Cess can be calculated on taxable amount, selected tax amount, or quantity."><Select mode="multiple" allowClear showSearch optionFilterProp="label" placeholder="Select taxes and cess" options={taxes.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.name} · ${x.calculationBasis === 'QUANTITY' ? `${x.rate}/unit` : `${x.rate}%`}` }))} /></Form.Item></Form></Modal>
    <Modal centered width={760} title={editingItem === null ? 'Add quotation item' : 'Edit quotation item'} open={itemOpen} onCancel={() => { if (!saving) setItemOpen(false) }} onOk={() => void saveItem()} okText="Save item" confirmLoading={saving} cancelButtonProps={{ disabled: saving }} closable={!saving} maskClosable={!saving} keyboard={!saving} destroyOnHidden><Form form={itemForm} layout="vertical" disabled={saving}><Form.Item label="Household item" name="householdItemId" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" onChange={itemChanged} options={masters.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.name} · ${x.volumeCbm.toFixed(3)} CBM` }))} /></Form.Item><div className="master-form-grid"><Form.Item label="Room" name="roomName" rules={[{ required: true }]}><Input /></Form.Item><Form.Item label="Count" name="quantity" rules={[{ required: true }]}><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item><Form.Item label="CBM each" name="volumePerUnitCbm" rules={[{ required: true }]}><InputNumber min={0.001} precision={3} style={{ width: '100%' }} /></Form.Item></div><Form.Item label="Notes" name="notes"><Input /></Form.Item></Form></Modal>
  </div>
}

function SelectCharge({ charges, onChange }: { charges: ChargeMaster[]; onChange: (id: string) => void }) {
  return <Select showSearch optionFilterProp="label" onChange={onChange} options={charges.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.name} · ${x.defaultRate.toLocaleString(undefined,{maximumFractionDigits:4})}/${x.unit}` }))} />
}




