import {ReportPrintButton} from '../reportingV2/ReportPrintButton'
import {useCurrencies} from '../currency'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Card, Descriptions, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Tabs, Tag, Typography, message } from 'antd'
import { ArrowLeftOutlined, DollarOutlined, DeleteOutlined, EditOutlined, FileDoneOutlined, ImportOutlined, PlusOutlined, SyncOutlined } from '@ant-design/icons'
import { AiSpendCard } from '../components/AiSpendCard'
import { quotationsApi, surveysApi } from '../api'
import type { ChargeMaster, HouseholdItem, QuotationDetail, QuotationItemInput, QuotationLineInput, TaxMaster } from '../types'
import { formatDate, formatDateTime, formatNumber, useT } from '../i18n'

const cbm3 = (value: number) => formatNumber(value, { minimumFractionDigits: 3, maximumFractionDigits: 3 })

const statusColor: Record<string, string> = { DRAFT: 'default', SENT: 'blue', REQUOTE_REQUESTED: 'orange', ACCEPTED: 'green', REJECTED: 'red' }

export function QuotationDetailPage({ quotationId, onBack, onChanged, onOpenRevision }: { quotationId: string; onBack: () => void; onChanged: () => void; onOpenRevision: (id: string) => void }) {
  const [detail, setDetail] = useState<QuotationDetail>(), [charges, setCharges] = useState<ChargeMaster[]>([]), [taxes, setTaxes] = useState<TaxMaster[]>([]), [masters, setMasters] = useState<HouseholdItem[]>([]), [lines, setLines] = useState<QuotationLineInput[]>([]), [items, setItems] = useState<QuotationItemInput[]>([]), [open, setOpen] = useState(false), [itemOpen, setItemOpen] = useState(false), [editing, setEditing] = useState<number | null>(null), [editingItem, setEditingItem] = useState<number | null>(null), [saving, setSaving] = useState(false)
  const { t } = useT()
  const {data:currencyData}=useCurrencies()
  const digits=currencyData?.currencies.find(c=>c.code===detail?.quotation.currency)?.decimalPlaces??2
  const money = (value: number) => formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits })
  const statusLabel = (status: string) => t('quotations.status.' + status)
  const mutationInFlight = useRef(false)
  const [refreshingReview, setRefreshingReview] = useState(false)
  const [form] = Form.useForm<QuotationLineInput>()
  const [itemForm] = Form.useForm<QuotationItemInput>()
  const load = () => Promise.all([quotationsApi.get(quotationId), quotationsApi.charges(), quotationsApi.taxes(), surveysApi.items()]).then(([quote, chargeMasters, taxMasters, itemMasters]) => { setDetail(quote); setCharges(chargeMasters); setTaxes(taxMasters); setMasters(itemMasters); setLines(quote.lines.map(x => ({ chargeMasterId: x.chargeMasterId, description: x.description, quantity: x.quantity, rate: x.rate, discountPercent: x.discountPercent, taxIds: x.taxes.map(tax => tax.taxMasterId), displayOrder: x.displayOrder }))); setItems(quote.quotationItems.map(x => ({ householdItemId: x.householdItemId, roomName: x.roomName, quantity: x.quantity, volumePerUnitCbm: x.volumePerUnitCbm, notes: x.notes ?? '', displayOrder: x.displayOrder }))) }).catch(error => message.error(error.message))
  useEffect(() => { void load() }, [quotationId])
  const preview = useMemo(() => lines.map((line, index) => { const charge = charges.find(x => x.id === line.chargeMasterId); const rate = line.rate ?? charge?.defaultRate ?? 0; const gross = line.quantity * rate; const discountAmount = gross * line.discountPercent / 100; const taxable = gross - discountAmount; const selected = taxes.filter(tax => line.taxIds.includes(tax.id)); const components = selected.filter(tax => tax.kind === 'TAX').map(tax => ({ tax, amount: tax.calculationBasis === 'QUANTITY' ? line.quantity * tax.rate : taxable * tax.rate / 100 })); const regularTax = components.reduce((sum, x) => sum + x.amount, 0); components.push(...selected.filter(tax => tax.kind === 'CESS').map(tax => ({ tax, amount: tax.calculationBasis === 'QUANTITY' ? line.quantity * tax.rate : (tax.calculationBasis === 'TAX_AMOUNT' ? regularTax : taxable) * tax.rate / 100 }))); const taxAmount = components.reduce((sum, x) => sum + x.amount, 0); return { ...line, index, chargeName: charge?.name ?? t('quotations.detail.charge'), unit: charge?.unit ?? '', rate, gross, discountAmount, taxAmount, components, total: taxable + taxAmount } }), [lines, charges, taxes, t])
  const totals = useMemo(() => ({ subtotal: preview.reduce((x, y) => x + y.gross, 0), discount: preview.reduce((x, y) => x + y.discountAmount, 0), tax: preview.reduce((x, y) => x + y.taxAmount, 0), total: preview.reduce((x, y) => x + y.total, 0) }), [preview])
  const showLine = (index?: number) => { setEditing(index ?? null); form.setFieldsValue(index === undefined ? { chargeMasterId: '', description: '', quantity: 1, rate: null, discountPercent: 0, taxIds: taxes.filter(x => x.isActive && x.isDefault).map(x => x.id), displayOrder: lines.length + 1 } : lines[index]); setOpen(true) }
  const chargeChanged = (id: string) => { const charge = charges.find(x => x.id === id); if (charge) form.setFieldsValue({ description: charge.name, rate: charge.defaultRate, taxIds: taxes.filter(x => x.isActive && x.isDefault).map(x => x.id) }) }
  const saveLine = async () => {
    let value: QuotationLineInput
    try { value = await form.validateFields() } catch { return }
    const next = editing === null ? [...lines, value] : lines.map((line, index) => index === editing ? value : line)
    if (await persistLines(next)) setOpen(false)
  }
  const showItem = (index?: number) => { setEditingItem(index ?? null); itemForm.setFieldsValue(index === undefined ? { householdItemId: '', roomName: t('quotations.detail.defaultRoom'), quantity: 1, volumePerUnitCbm: null, notes: '', displayOrder: items.length + 1 } : items[index]); setItemOpen(true) }
  const itemChanged = (id: string) => { const item = masters.find(x => x.id === id); if (item) itemForm.setFieldValue('volumePerUnitCbm', item.volumeCbm) }
  const persistItems = async (next: QuotationItemInput[]) => {
    if (mutationInFlight.current) return false
    mutationInFlight.current = true; setSaving(true)
    try {
      const updated = await quotationsApi.saveItems(quotationId, next.map((item, index) => ({ ...item, displayOrder: index + 1 })))
      setDetail(updated)
      setItems(updated.quotationItems.map(item => ({ householdItemId: item.householdItemId, roomName: item.roomName, quantity: item.quantity, volumePerUnitCbm: item.volumePerUnitCbm, notes: item.notes ?? '', displayOrder: item.displayOrder })))
      onChanged(); message.success(t('quotations.detail.itemsSaved')); return true
    } catch (error) { message.error(error instanceof Error ? error.message : t('quotations.detail.itemsSaveFailed')); return false }
    finally { mutationInFlight.current = false; setSaving(false) }
  }
  /* The sales lead's inventory is the list the customer themselves checked, so it is the honest starting point for
     the quotation. Only names that match an active household item can be priced, so the rest are reported back. */
  const importLeadInventory = async () => {
    if (mutationInFlight.current) return
    mutationInFlight.current = true; setSaving(true)
    try {
      const result = await quotationsApi.importLeadInventory(quotationId)
      const created = result.createdItems ?? []
      // New masters were made for names not in the master data: reload the list so their names show.
      if (created.length) setMasters(await surveysApi.items())
      setDetail(result.detail)
      setItems(result.detail.quotationItems.map(item => ({ householdItemId: item.householdItemId, roomName: item.roomName, quantity: item.quantity, volumePerUnitCbm: item.volumePerUnitCbm, notes: item.notes ?? '', displayOrder: item.displayOrder })))
      onChanged()
      const notes = [result.dropped ? t('quotations.detail.import.dropped', { count: result.dropped }) : '', result.unmatched.length ? t('quotations.detail.import.noVolume', { count: result.unmatched.length, items: result.unmatched.slice(0, 5).join(', ') + (result.unmatched.length > 5 ? '…' : '') }) : ''].filter(Boolean)
      message.success(notes.length ? t('quotations.detail.import.importedLeftOut', { count: result.imported, list: notes.join('; ') }) : t('quotations.detail.import.imported', { count: result.imported }))
      if (created.length) message.info(t('quotations.detail.import.created', { items: created.join(', ') }), 10)
      if (result.unmatched.length) message.warning(t('quotations.detail.import.unmatched', { items: result.unmatched.join(', ') }), 10)
    } catch (error) { message.error(error instanceof Error ? error.message : t('quotations.detail.import.failed')) }
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
      onChanged(); message.success(t('quotations.detail.chargesSaved')); return true
    } catch (error) { message.error(error instanceof Error ? error.message : t('quotations.detail.chargesSaveFailed')); return false }
    finally { mutationInFlight.current = false; setSaving(false) }
  }
  const createRevision = async () => {
    if (mutationInFlight.current) return
    mutationInFlight.current = true; setSaving(true)
    try { const revised = await quotationsApi.revise(quotationId); onChanged(); onOpenRevision(revised.id); message.success(t('quotations.detail.revisionCreated')) }
    catch (error) { message.error(error instanceof Error ? error.message : t('quotations.detail.revisionFailed')) }
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
    catch (error) { message.error(error instanceof Error ? error.message : t('quotations.detail.refreshFailed')) }
    finally { setRefreshingReview(false) }
  }
  const applyRequote = async (requestId: string) => { setSaving(true); try { await quotationsApi.applyRequote(quotationId, requestId); await load(); onChanged(); message.success(t('quotations.detail.requoteApplied')) } catch (error) { message.error(error instanceof Error ? error.message : t('quotations.detail.requoteFailed')) } finally { setSaving(false) } }
  if (!detail) return <Card loading />
  const q = detail.quotation; const locked = q.status === 'ACCEPTED' || q.status === 'REJECTED'
  return <div className="survey-workspace quotation-workspace"><div className="survey-workspace-header"><div className="survey-heading"><Button disabled={saving} icon={<ArrowLeftOutlined />} aria-label={t('quotations.detail.back')} onClick={onBack} /><div><Typography.Text className="eyebrow">{t('quotations.detail.eyebrow')}</Typography.Text><Typography.Title level={2}>{q.quotationNumber}<span className="survey-heading-customer">{q.customerName}</span></Typography.Title></div></div><Space wrap className="survey-heading-actions"><ReportPrintButton type="QUOTATION" title={q.quotationNumber} id={q.id}/><Button icon={<SyncOutlined />} loading={refreshing} disabled={saving || refreshingReview || open || itemOpen} onClick={() => void refreshQuotation()}>{t('common.refresh')}</Button><Tag className="survey-status-tag" color={statusColor[q.status]}>{statusLabel(q.status)}</Tag></Space></div>
    {q.revisedFromNumber && <Alert type="info" showIcon message={t('quotations.revisionOf', { number: q.revisedFromNumber })} description={<div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{t('quotations.detail.previousReason', { reason: q.revisionReason || t('quotations.detail.notRecorded') })}</div>} />}
    <div className="survey-kpi-row quotation-kpi-row">{[
      { key: 'subtotal', label: t('quotations.detail.subtotal'), value: totals.subtotal },
      { key: 'discount', label: t('quotations.detail.discount'), value: totals.discount },
      { key: 'tax', label: t('quotations.detail.tax'), value: totals.tax },
      { key: 'total', label: t('quotations.detail.grandTotal'), value: totals.total },
    ].map(kpi => <div key={kpi.key} className="survey-kpi survey-kpi-cost"><span className="survey-kpi-icon"><DollarOutlined /></span><div><small>{kpi.label}</small><strong><em>{q.currency}</em> {money(kpi.value)}</strong></div></div>)}</div>
    <Tabs className="survey-workspace-tabs" defaultActiveKey="overview" destroyOnHidden={false} onChange={key => { if (key === 'review') void refreshReview() }} items={[
      { key: 'overview', label: t('quotations.detail.tabs.overview'), children: <>
<Card><Descriptions size="small" bordered column={{ xs: 1, md: 3 }} items={[{ key: 'origin', label: t('quotations.list.origin'), children: q.origin }, { key: 'destination', label: t('quotations.list.destination'), children: q.destination }, { key: 'employee', label: t('quotations.detail.salesEmployee'), children: q.assignedEmployeeName }, { key: 'lead', label: t('quotations.detail.salesLead'), children: q.leadNumber ?? t('quotations.detail.independent') }, { key: 'survey', label: t('quotations.detail.survey'), children: q.surveyNumber ?? t('quotations.detail.noSurvey') }, { key: 'valid', label: t('quotations.list.validUntil'), children: formatDate(`${q.validUntil}T00:00:00`) }, { key: 'volume', label: t('quotations.detail.surveyVolume'), children: detail.surveyVolumeCbm === null ? '—' : t('quotations.cbmValue', { value: cbm3(detail.surveyVolumeCbm) }) }, { key: 'response', label: t('quotations.detail.customerResponse'), children: q.rejectionReason ?? (q.respondedAtUtc ? formatDateTime(q.respondedAtUtc) : t('quotations.detail.pending')) }]} /></Card>
        <Card title={t('quotations.detail.termsNotes')}><Typography.Paragraph>{q.terms || t('quotations.detail.noTerms')}</Typography.Paragraph>{q.notes && <><Typography.Text strong>{t('quotations.internalNotes')}</Typography.Text><Typography.Paragraph>{q.notes}</Typography.Paragraph></>}</Card>
        <AiSpendCard spend={detail.leadAiSpend} context="quotation" />
      </> },
      { key: 'items', label: t('quotations.detail.tabs.items', { count: items.length }), children: <>
<Card title={t('quotations.detail.items')} extra={!locked && <Space>{q.salesLeadId && <Popconfirm title={t('quotations.detail.import.confirmTitle')} description={t('quotations.detail.import.confirmDescription')} okText={t('common.yes')} cancelText={t('common.no')} onConfirm={() => void importLeadInventory()}><Button disabled={saving} icon={<ImportOutlined />}>{t('quotations.detail.import.button')}</Button></Popconfirm>}<Button disabled={saving} type="primary" icon={<PlusOutlined />} onClick={() => showItem()}>{t('quotations.detail.addItem')}</Button></Space>}>
      {items.length ? <div className="quote-line-list">{items.map((item, index) => { const master = masters.find(x => x.id === item.householdItemId); const volume = item.volumePerUnitCbm ?? master?.volumeCbm ?? 0; return <Card size="small" key={`${item.householdItemId}-${index}`} className="quote-line-card quotation-item-card"><div className="quote-line-main"><div><strong>{master?.name ?? t('common.item')}</strong><small>{item.roomName}{item.notes ? ` · ${item.notes}` : ''}</small></div><div className="quote-line-total"><small>{t('quotations.detail.volumeCaps')}</small><strong>{t('quotations.cbmValue', { value: cbm3(item.quantity * volume) })}</strong></div>{!locked && <Space><Button disabled={saving} type="text" aria-label={t('quotations.detail.editItem')} icon={<EditOutlined />} onClick={() => showItem(index)} /><Popconfirm disabled={saving} title={t('quotations.detail.removeItemConfirm')} okText={t('common.remove')} cancelText={t('common.cancel')} onConfirm={async () => { await persistItems(items.filter((_, i) => i !== index)) }}><Button disabled={saving} type="text" danger aria-label={t('common.remove')} icon={<DeleteOutlined />} /></Popconfirm></Space>}</div><div className="quote-line-breakdown"><span>{t('quotations.detail.roomValue', { room: item.roomName })}</span><span>{t('quotations.detail.countValue', { count: item.quantity })}</span><span>{t('quotations.detail.cbmEach', { value: cbm3(volume) })}</span></div></Card> })}</div> : <Empty description={t('quotations.detail.noItems')} />}
    </Card>
      </> },
      { key: 'survey', label: t('quotations.detail.tabs.survey'), children: <>
{q.includeSurveyItems && detail.surveyRooms.length > 0 && <Card title={t('quotations.detail.surveyIncluded')} extra={t('quotations.cbmValue', { value: cbm3(detail.surveyRooms.reduce((sum, room) => sum + room.totalVolumeCbm, 0)) })}><div className="survey-inventory-preview">{detail.surveyRooms.map(room => <section key={room.roomId} className="public-survey-room"><div className="public-survey-room-title"><strong>{room.roomName}</strong><span>{t('quotations.cbmValue', { value: cbm3(room.totalVolumeCbm) })}</span></div>{room.items.map(item => <div key={item.surveyItemId} className="staff-survey-item"><span><strong>{item.itemName}</strong><small>{item.notes ?? t('quotations.detail.noHandlingNote')}</small></span><span>{item.quantity} × {t('quotations.cbmValue', { value: cbm3(item.volumePerUnitCbm) })}</span></div>)}</section>)}</div></Card>}
        {(!q.includeSurveyItems || !detail.surveyRooms.length) && <Card><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={q.includeSurveyItems ? t('quotations.detail.noSurveyItems') : t('quotations.detail.surveyNotIncluded')} /></Card>}
      </> },
      { key: 'charges', label: t('quotations.detail.tabs.charges', { count: lines.length }), children: <>
        <Typography.Paragraph type="secondary">{t('quotations.detail.chargesHelp')}</Typography.Paragraph>
<Card title={<Space><FileDoneOutlined />{t('quotations.detail.charges')}</Space>} extra={!locked && <Button disabled={saving} type="primary" icon={<PlusOutlined />} onClick={() => showLine()}>{t('quotations.detail.addCharge')}</Button>}>
      {preview.length ? <div className="quote-line-list">{preview.map(line => <Card size="small" key={line.index} className="quote-line-card"><div className="quote-line-main"><div><strong>{line.chargeName}</strong><small>{line.description} · {formatNumber(line.quantity)} {line.unit} × {money(line.rate)}</small><div className="line-tax-tags">{line.components.length ? line.components.map(component => <Tag key={component.tax.id} color={component.tax.kind === 'CESS' ? 'orange' : 'blue'}>{component.tax.name}: {money(component.amount)}</Tag>) : <Tag>{t('quotations.detail.noTax')}</Tag>}</div></div><div className="quote-line-total"><small>{t('quotations.detail.lineTotal')}</small><strong>{q.currency} {money(line.total)}</strong></div>{!locked && <Space><Button disabled={saving} type="text" aria-label={t('quotations.detail.editCharge')} icon={<EditOutlined />} onClick={() => showLine(line.index)} /><Popconfirm disabled={saving} title={t('quotations.detail.removeChargeConfirm')} okText={t('common.remove')} cancelText={t('common.cancel')} onConfirm={async () => { await persistLines(lines.filter((_, index) => index !== line.index)) }}><Button disabled={saving} type="text" danger aria-label={t('common.remove')} icon={<DeleteOutlined />} /></Popconfirm></Space>}</div><div className="quote-line-breakdown"><span>{t('quotations.detail.grossValue', { value: money(line.gross) })}</span><span>{t('quotations.detail.discountValue', { value: money(line.discountAmount) })}</span><span>{t('quotations.detail.taxCessValue', { value: money(line.taxAmount) })}</span></div></Card>)}</div> : <Empty description={t('quotations.detail.noCharges')} />}
    </Card>
      </> },
      { key: 'review', label: <Space size={6}>{t('quotations.detail.tabs.review')}{q.status === 'REJECTED' ? <Tag color="red">{statusLabel('REJECTED')}</Tag> : q.status === 'ACCEPTED' ? <Tag color="green">{statusLabel('ACCEPTED')}</Tag> : detail.requoteRequests.some(request => !request.appliedAtUtc) && <Tag color="orange">{t('quotations.detail.pending')}</Tag>}</Space>, children: <>
        <Card title={t('quotations.detail.customerResponse')} extra={<Button icon={<SyncOutlined />} loading={refreshingReview} onClick={() => void refreshReview()}>{t('quotations.detail.refreshResponse')}</Button>}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {q.status === 'REJECTED' && <Button type="primary" icon={<PlusOutlined />} loading={saving} onClick={() => void createRevision()}>{t('quotations.detail.createRevision')}</Button>}
            <Space wrap><Tag color={statusColor[q.status]}>{statusLabel(q.status)}</Tag>{q.respondedAtUtc && <Typography.Text type="secondary">{t('quotations.detail.responded', { date: formatDateTime(q.respondedAtUtc) })}</Typography.Text>}</Space>
            {q.status === 'REJECTED' ? <Alert type="error" showIcon message={t('quotations.detail.rejectionReason')} description={<div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{q.rejectionReason || t('quotations.detail.noRejectionReason')}</div>} />
              : q.status === 'ACCEPTED' ? <Alert type="success" showIcon message={t('quotations.detail.accepted')} />
              : q.status === 'REQUOTE_REQUESTED' ? <Alert type="warning" showIcon message={t('quotations.detail.requoteRequested')} description={t('quotations.detail.reviewChangesBelow')} />
              : <Typography.Text type="secondary">{q.status === 'DRAFT' ? t('quotations.detail.shareToCollect') : t('quotations.detail.waitingForCustomer')}</Typography.Text>}
          </Space>
        </Card>
{detail.requoteRequests.length > 0 && <Card title={t('quotations.detail.requote.title')} extra={detail.requoteRequests[0].appliedAtUtc ? <Tag color="green">{t('quotations.detail.requote.appliedAt', { date: formatDateTime(detail.requoteRequests[0].appliedAtUtc) })}</Tag> : <Button type="primary" icon={<SyncOutlined />} loading={saving} onClick={() => void applyRequote(detail.requoteRequests[0].id)}>{t('quotations.detail.requote.apply')}</Button>}><Alert type={detail.requoteRequests[0].appliedAtUtc ? 'success' : 'warning'} showIcon message={detail.requoteRequests[0].appliedAtUtc ? t('quotations.detail.requote.applied') : t('quotations.detail.requote.changed')} description={detail.requoteRequests[0].appliedAtUtc ? t('quotations.detail.requote.appliedDescription') : t('quotations.detail.requote.changedDescription')} /><div className="requote-change-list">{detail.requoteRequests[0].items.map(item => <div key={item.surveyItemId} className={item.originalQuantity !== item.requestedQuantity ? 'is-changed' : ''}><span><strong>{item.itemName}</strong><small>{item.roomName}{item.notes ? ` · ${item.notes}` : ''}</small></span><span>{item.originalQuantity} → <strong>{item.requestedQuantity}</strong></span></div>)}</div>{detail.requoteRequests[0].customerNotes && <Typography.Paragraph><strong>{t('quotations.detail.requote.customerNote')}</strong> {detail.requoteRequests[0].customerNotes}</Typography.Paragraph>}</Card>}
        {!detail.requoteRequests.length && q.status === 'REQUOTE_REQUESTED' && <Card><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('quotations.detail.requote.none')} /></Card>}
      </> },
    ]} />
    <Modal centered width={760} title={editing === null ? t('quotations.detail.addCharge') : t('quotations.detail.editCharge')} open={open} onCancel={() => { if (!saving) setOpen(false) }} onOk={() => void saveLine()} okText={t('quotations.detail.saveCharge')} cancelText={t('common.cancel')} confirmLoading={saving} cancelButtonProps={{ disabled: saving }} closable={!saving} maskClosable={!saving} keyboard={!saving} destroyOnHidden><Form form={form} layout="vertical" disabled={saving}><Form.Item label={t('quotations.detail.charge')} name="chargeMasterId" rules={[{ required: true, message: t('common.required') }]}><SelectCharge charges={charges} onChange={chargeChanged} /></Form.Item><Form.Item label={t('common.description')} name="description"><Input /></Form.Item><div className="master-form-grid"><Form.Item label={t('common.quantity')} name="quantity" rules={[{ required: true, message: t('common.required') }]}><InputNumber min={0.001} precision={3} style={{ width: '100%' }} /></Form.Item><Form.Item className="amount-field" label={t('quotations.detail.rate')} name="rate" rules={[{ required: true, message: t('common.required') }]}><InputNumber controls={false} min={0} precision={digits} style={{ width: '100%' }} /></Form.Item><Form.Item label={t('quotations.detail.discountPercent')} name="discountPercent"><InputNumber min={0} max={100} precision={3} style={{ width: '100%' }} /></Form.Item></div><Form.Item label={t('quotations.detail.taxesAndCess')} name="taxIds" extra={t('quotations.detail.taxesHelp')}><Select mode="multiple" allowClear showSearch optionFilterProp="label" placeholder={t('quotations.detail.taxesPlaceholder')} options={taxes.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.name} · ${x.calculationBasis === 'QUANTITY' ? t('quotations.perUnit', { rate: formatNumber(x.rate) }) : `${formatNumber(x.rate)}%`}` }))} /></Form.Item></Form></Modal>
    <Modal centered width={760} title={editingItem === null ? t('quotations.detail.addItemTitle') : t('quotations.detail.editItemTitle')} open={itemOpen} onCancel={() => { if (!saving) setItemOpen(false) }} onOk={() => void saveItem()} okText={t('quotations.detail.saveItem')} cancelText={t('common.cancel')} confirmLoading={saving} cancelButtonProps={{ disabled: saving }} closable={!saving} maskClosable={!saving} keyboard={!saving} destroyOnHidden><Form form={itemForm} layout="vertical" disabled={saving}><Form.Item label={t('quotations.detail.householdItem')} name="householdItemId" rules={[{ required: true, message: t('common.required') }]}><Select showSearch optionFilterProp="label" onChange={itemChanged} options={masters.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.name} · ${t('quotations.cbmValue', { value: cbm3(x.volumeCbm) })}` }))} /></Form.Item><div className="master-form-grid"><Form.Item label={t('common.room')} name="roomName" rules={[{ required: true, message: t('common.required') }]}><Input /></Form.Item><Form.Item label={t('quotations.detail.count')} name="quantity" rules={[{ required: true, message: t('common.required') }]}><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item><Form.Item label={t('quotations.detail.cbmEachLabel')} name="volumePerUnitCbm" rules={[{ required: true, message: t('common.required') }]}><InputNumber min={0.001} precision={3} style={{ width: '100%' }} /></Form.Item></div><Form.Item label={t('common.notes')} name="notes"><Input /></Form.Item></Form></Modal>
  </div>
}

function SelectCharge({ charges, onChange }: { charges: ChargeMaster[]; onChange: (id: string) => void }) {
  return <Select showSearch optionFilterProp="label" onChange={onChange} options={charges.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.name} · ${formatNumber(x.defaultRate, { maximumFractionDigits: 4 })}/${x.unit}` }))} />
}




