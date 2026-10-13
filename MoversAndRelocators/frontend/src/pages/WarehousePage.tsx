import {ReportPrintButton} from '../reportingV2/ReportPrintButton'
import { BillingPanel } from '../components/BillingPanel'
import { useBilling } from '../billingApi'
import { WarehouseShippingFields, WarehouseShippingSummary } from '../components/WarehouseShippingFields'
import { WarehouseReceiptExtras } from '../components/WarehouseReceiptExtras'
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Checkbox, Form, Input, Modal, Select, Space, Tabs, Tag, message } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { pickupsApi, request } from '../api'
import type { Pickup, Warehouse } from '../types'
import type { BusinessMaster } from '../businessMasters'
import { shipmentApi, type Shipment } from '../shipmentApi'
import { warehouseApi, type WarehouseReceipt, type WarehouseStock, type WarehouseShipping } from '../warehouseApi'
import { PageHeader } from '../components/PageHeader'
import { DataGrid } from '../components/DataGrid'
import { RowActions } from '../components/RowActions'
import { CreateCustomerButton } from '../components/CreateCustomerButton'
import { formatDateTime, useT } from '../i18n'

const when = (value: string) => formatDateTime(value)
type BoxInput = { description: string; customerReference?: string; condition: string; sealNumber?: string; contents?: string; contentsChecked: boolean }
type ReceiveForm = { shipping?: WarehouseShipping; customerCode?: string; pickupId?: string; warehouseId: string; bay?: string; deliveredBy?: string; receivedBy: string; notes?: string; packageIds?: string[]; boxes?: BoxInput[] }

export function WarehousePage({ companyName, userName }: { companyName: string; userName: string }) {
  const { t } = useT()
  const sourceLabel = (value: string) => t(value === 'OFFICE' ? 'warehouse.source.OFFICE' : 'warehouse.source.PICKUP')
  const canBill=useBilling()
  const [billingReceipt,setBillingReceipt]=useState<WarehouseReceipt>()
  const [stock, setStock] = useState<WarehouseStock[]>([]), [receipts, setReceipts] = useState<WarehouseReceipt[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]), [pickups, setPickups] = useState<Pickup[]>([]), [customers, setCustomers] = useState<BusinessMaster[]>([])
  const [query, setQuery] = useState(''), [warehouseFilter, setWarehouseFilter] = useState<string>(), [sourceFilter, setSourceFilter] = useState<string>()
  const [mode, setMode] = useState<'office' | 'pickup' | null>(null), [receipt, setReceipt] = useState<WarehouseReceipt>(), [shipment, setShipment] = useState<Shipment>()
  const [loading, setLoading] = useState(false), [saving, setSaving] = useState(false), [loadingPickup, setLoadingPickup] = useState(false)
  const busy = useRef(false), requestId = useRef(''), lookupVersion = useRef(0)
  const [form] = Form.useForm<ReceiveForm>()
  const load = async () => {
    setLoading(true)
    try {
      const [s, r, w, p, c] = await Promise.all([warehouseApi.stock(), warehouseApi.receipts(), pickupsApi.warehouses(), pickupsApi.list(), request<BusinessMaster[]>('/api/business-masters/customer/choices')])
      setStock(s); setReceipts(r); setWarehouses(w); setPickups(p); setCustomers(c)
    } catch (e) { message.error(e instanceof Error ? e.message : t('warehouse.page.loadFailed')) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  // The default condition is free text saved with the box, so it is written in the user's language.
  const newBox = () => ({ description: '', condition: t('warehouse.receive.defaultCondition'), contentsChecked: false })
  const show = (next: 'office' | 'pickup') => {
    lookupVersion.current++; setShipment(undefined); setLoadingPickup(false); form.resetFields(); requestId.current = crypto.randomUUID()
    form.setFieldsValue({ receivedBy: userName, packageIds: [], boxes: [newBox()] }); setMode(next)
    void load()
  }
  const choosePickup = async (id: string) => {
    const version = ++lookupVersion.current; setShipment(undefined); form.setFieldValue('packageIds', []); setLoadingPickup(true)
    try { const value = await shipmentApi.get(id); if (lookupVersion.current === version) { setShipment(value); const p = pickups.find(x => x.id === id); if (p) form.setFieldValue(['shipping', 'shipper'], { name: p.customerName, phone: p.phone, address: p.address }) } }
    catch (e) { if (lookupVersion.current === version) message.error(e instanceof Error ? e.message : t('warehouse.page.pickupBoxesFailed')) }
    finally { if (lookupVersion.current === version) setLoadingPickup(false) }
  }
  const receive = async () => {
    if (!mode || busy.current) return
    busy.current = true
    try {
      const v = await form.validateFields(); setSaving(true)
      const saved = await warehouseApi.receive(mode, { ...v, requestId: requestId.current })
      setMode(null); setReceipt(saved); message.success(t('warehouse.page.received', { count: saved.details.boxes.length, receipt: saved.receiptNumber })); await load()
    } catch (e) { if (e instanceof Error) message.error(e.message) }
    finally { busy.current = false; setSaving(false) }
  }
  const matches = (warehouseId: string, source: string, text: string) => (!warehouseFilter || warehouseId === warehouseFilter) && (!sourceFilter || source === sourceFilter) && text.toLowerCase().includes(query.toLowerCase())
  const filteredStock = stock.filter(x => matches(x.warehouseId, x.source, `${x.trackingNumber} ${x.customerName} ${x.location} ${x.reference} ${x.contents}`))
  const filteredReceipts = receipts.filter(x => matches(x.warehouseId, x.source, `${x.receiptNumber} ${x.details.customerName} ${x.details.warehouseName} ${x.details.pickupNumber ?? ''} ${x.details.shipping?.shipper?.name ?? ''} ${x.details.shipping?.consignee?.name ?? ''} ${x.details.shipping?.toLocation ?? ''} ${x.details.shipping?.dropAddress ?? ''}`))
  const storable = shipment?.packages.filter(x => x.status === 'PACKED' || x.status === 'IN_TRANSIT') ?? []
  if(billingReceipt)return <><Button onClick={()=>setBillingReceipt(undefined)}>{t('warehouse.page.backToWarehouse')}</Button><h2>{t('warehouse.page.billingTitle', { receipt: billingReceipt.receiptNumber, customer: billingReceipt.details.customerName })}</h2><BillingPanel sourceKind="WAREHOUSE" sourceId={billingReceipt.id} companyName={companyName}/></>
  return <>
    <PageHeader eyebrow={t('warehouse.page.eyebrow')} title={t('warehouse.page.title')} description={t('warehouse.page.description')} onRefresh={load} filters={<Space wrap>
      <Input.Search allowClear aria-label={t('warehouse.page.search')} placeholder={t('warehouse.page.searchPlaceholder')} value={query} onChange={e => setQuery(e.target.value)} style={{ width: 260 }} />
      <Select allowClear placeholder={t('warehouse.page.allWarehouses')} aria-label={t('warehouse.page.filterWarehouse')} value={warehouseFilter} onChange={setWarehouseFilter} options={warehouses.map(w => ({ value: w.id, label: w.name }))} style={{ minWidth: 170 }} />
      <Select allowClear placeholder={t('warehouse.page.allSources')} aria-label={t('warehouse.page.filterSource')} value={sourceFilter} onChange={setSourceFilter} options={['PICKUP', 'OFFICE'].map(value => ({ value, label: sourceLabel(value) }))} style={{ minWidth: 180 }} />
    </Space>} />
    <Space wrap style={{ marginBottom: 16 }}><Button type="primary" icon={<PlusOutlined />} onClick={() => show('pickup')}>{t('warehouse.page.receiveFromPickup')}</Button><Button icon={<PlusOutlined />} onClick={() => show('office')}>{t('warehouse.page.receiveCustomerBoxes')}</Button></Space>
    <Tabs items={[
      { key: 'stock', label: t('warehouse.page.stockTab', { count: filteredStock.length }), children: <Card className="grid-card"><DataGrid rowKey="id" loading={loading} dataSource={filteredStock} pagination={{ pageSize: 20 }} scroll={{ x: 1200 }} columns={[
        { title: t('warehouse.col.boxNumber'), dataIndex: 'trackingNumber' }, { title: t('common.customer'), dataIndex: 'customerName' }, { title: t('warehouse.col.source'), dataIndex: 'source', render: sourceLabel },
        { title: t('warehouse.col.locationRack'), dataIndex: 'location' }, { title: t('warehouse.col.reference'), dataIndex: 'reference' }, { title: t('warehouse.col.contents'), dataIndex: 'contents', ellipsis: true },
        { title: t('warehouse.col.received'), dataIndex: 'receivedAtUtc', render: when }, { title: t('warehouse.col.receivedBy'), dataIndex: 'receivedBy' },
      ]} /></Card> },
      { key: 'receipts', label: t('warehouse.page.receiptsTab', { count: filteredReceipts.length }), children: <Card className="grid-card"><DataGrid rowKey="id" loading={loading} dataSource={filteredReceipts} pagination={{ pageSize: 20 }} scroll={{ x: 1000 }} columns={[
        { title: t('warehouse.col.receipt'), dataIndex: 'receiptNumber' }, { title: t('common.customer'), dataIndex: ['details', 'customerName'] }, { title: t('warehouse.col.source'), dataIndex: 'source', render: sourceLabel },
        { title: t('warehouse.col.consignee'), dataIndex: ['details', 'shipping', 'consignee', 'name'] }, { title: t('warehouse.col.toLocation'), dataIndex: ['details', 'shipping', 'toLocation'] }, { title: t('warehouse.col.warehouse'), dataIndex: ['details', 'warehouseName'] }, { title: t('warehouse.col.bayRack'), dataIndex: ['details', 'bay'] }, { title: t('warehouse.col.boxes'), render: (_, x) => x.details.boxes.length },
        { title: t('warehouse.col.received'), dataIndex: 'receivedAtUtc', render: when }, { title: t('common.actions'), render: (_, x) => <RowActions><Button onClick={() => setReceipt(x)}>{t('warehouse.page.receiptAttachments')}</Button>{canBill&&<Button onClick={()=>setBillingReceipt(x)}>{t('warehouse.page.billing')}</Button>}</RowActions> },
      ]} /></Card> },
    ]} />
    <Modal centered open={!!mode} width={900} title={mode === 'office' ? t('warehouse.receive.officeTitle') : t('warehouse.receive.pickupTitle')} okText={t('warehouse.receive.ok')} cancelText={t('common.cancel')} confirmLoading={saving} okButtonProps={{ disabled: loadingPickup || (mode === 'pickup' && !storable.length) }} onOk={() => void receive()} onCancel={() => { if (!saving) { lookupVersion.current++; setMode(null) } }} closable={!saving} maskClosable={!saving} destroyOnHidden>
      <Form form={form} layout="vertical" disabled={saving}>
        <section className="warehouse-form-section"><h3>{mode === 'office' ? t('warehouse.receive.officeSection') : t('warehouse.receive.pickupSection')}</h3>
          {mode === 'office' ? <>
            <Form.Item name="customerCode" label={t('common.customer')} rules={[{ required: true, message: t('warehouse.receive.customerRequired') }]}><Select showSearch optionFilterProp="label" placeholder={t('warehouse.receive.customerPlaceholder')} onChange={code => { const c = customers.find(x => x.code === code); if (c) form.setFieldValue(['shipping', 'shipper'], { name: c.name, phone: c.phone, address: c.address }) }} options={customers.map(x => ({ value: x.code, label: `${x.name} · ${x.code} · ${x.phone ?? ''}` }))} /></Form.Item>
            <CreateCustomerButton getDefaults={() => ({})} onCreated={c => { setCustomers(all => [...all, c]); form.setFieldValue('customerCode', c.code); form.setFieldValue(['shipping', 'shipper'], { name: c.name, phone: c.phone, address: c.address }) }} />
            <Form.Item name="deliveredBy" label={t('warehouse.receive.deliveredBy')} rules={[{ required: true, whitespace: true, message: t('common.required') }]}><Input maxLength={160} placeholder={t('warehouse.receive.deliveredByPlaceholder')} /></Form.Item>
          </> : <>
            <Form.Item name="pickupId" label={t('warehouse.receive.pickup')} rules={[{ required: true, message: t('common.required') }]}><Select showSearch optionFilterProp="label" placeholder={t('warehouse.receive.selectPickup')} options={pickups.map(p => ({ value: p.id, label: `${p.pickupNumber} · ${p.customerName}` }))} onChange={id => void choosePickup(id)} /></Form.Item>
            <Form.Item name="packageIds" label={t('warehouse.receive.boxesToReceive')} rules={[{ required: true, type: 'array', min: 1, message: t('warehouse.receive.boxesRequired') }]} extra={shipment && !storable.length ? t('warehouse.receive.noBoxesWaiting') : undefined}>
              <Select mode="multiple" loading={loadingPickup} optionFilterProp="label" placeholder={t('warehouse.receive.selectBoxes')} options={storable.map(p => ({ value: p.id, label: `${p.trackingNumber} · ${p.status === 'PACKED' ? t('warehouse.receive.packed') : t('warehouse.receive.inTransit')}` }))} />
            </Form.Item>
            {!!storable.length && <Button onClick={() => form.setFieldValue('packageIds', storable.map(p => p.id))}>{t('warehouse.receive.selectAll', { count: storable.length })}</Button>}
          </>}
        </section>
        <section className="warehouse-form-section"><h3>{t('warehouse.receive.storageSection')}</h3><div className="master-form-grid">
          <Form.Item name="warehouseId" label={t('warehouse.col.warehouse')} rules={[{ required: true, message: t('common.required') }]}><Select showSearch optionFilterProp="label" placeholder={t('warehouse.receive.selectWarehouse')} options={warehouses.filter(w => w.isActive).map(w => ({ value: w.id, label: `${w.name} · ${w.code}` }))} notFoundContent={t('warehouse.receive.noWarehouse')} /></Form.Item>
          <Form.Item name="bay" label={t('warehouse.col.bayRack')}><Input maxLength={80} placeholder={t('warehouse.receive.bayPlaceholder')} /></Form.Item>
          <Form.Item name="receivedBy" label={t('warehouse.col.receivedBy')} rules={[{ required: true, whitespace: true, message: t('common.required') }]}><Input maxLength={160} /></Form.Item>
        </div><Form.Item name="notes" label={t('warehouse.receive.notes')}><Input.TextArea rows={2} maxLength={2000} placeholder={t('warehouse.receive.notesPlaceholder')} /></Form.Item></section>
        <WarehouseShippingFields />
        <Alert type="info" showIcon message={t('warehouse.receive.attachmentsTitle')} description={t('warehouse.receive.attachmentsHint')} />
        {mode === 'office' && <section className="warehouse-form-section"><h3>{t('warehouse.receive.customerBoxes')}</h3><Alert type="info" showIcon message={t('warehouse.receive.customerBoxesTitle')} description={t('warehouse.receive.customerBoxesHint')} />
          <Form.List name="boxes" rules={[{ validator: async (_, boxes) => { if (!boxes?.length) throw new Error(t('warehouse.receive.boxesListRequired')) } }]}>{(fields, { add, remove }, { errors }) => <>
            {fields.map((field, index) => <Card size="small" key={field.key} title={t('warehouse.receive.boxTitle', { number: index + 1 })} style={{ marginTop: 12 }} extra={<Button aria-label={t('warehouse.receive.removeBox', { number: index + 1 })} danger type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)} />}>
              <div className="master-form-grid">
                <Form.Item name={[field.name, 'description']} label={t('warehouse.receive.boxDescription')} rules={[{ required: true, whitespace: true, message: t('common.required') }]}><Input maxLength={160} placeholder={t('warehouse.receive.boxDescriptionPlaceholder')} /></Form.Item>
                <Form.Item name={[field.name, 'customerReference']} label={t('warehouse.receive.customerReference')}><Input maxLength={80} /></Form.Item>
                <Form.Item name={[field.name, 'condition']} label={t('warehouse.receive.condition')} rules={[{ required: true, whitespace: true, message: t('common.required') }]}><Input maxLength={500} placeholder={t('warehouse.receive.conditionPlaceholder')} /></Form.Item>
                <Form.Item name={[field.name, 'sealNumber']} label={t('warehouse.receive.sealNumber')}><Input maxLength={80} /></Form.Item>
              </div>
              <Form.Item name={[field.name, 'contents']} label={t('warehouse.receive.contents')}><Input.TextArea maxLength={2000} rows={2} placeholder={t('warehouse.receive.contentsPlaceholder')} /></Form.Item>
              <Form.Item name={[field.name, 'contentsChecked']} valuePropName="checked"><Checkbox>{t('warehouse.receive.contentsChecked')}</Checkbox></Form.Item>
            </Card>)}
            <Form.ErrorList errors={errors} /><Button style={{ marginTop: 12 }} icon={<PlusOutlined />} disabled={fields.length >= 200} onClick={() => add(newBox())}>{t('warehouse.receive.addBox')}</Button>
          </>}</Form.List>
        </section>}
      </Form>
    </Modal>
    <Modal centered title={t('warehouse.receipt.title')} open={!!receipt} width={950} onCancel={() => setReceipt(undefined)} footer={<ReportPrintButton type="WAREHOUSE_RECEIPT" title={receipt?.receiptNumber??t('warehouse.receipt.printTitle')} id={receipt?.id} disabled={!receipt}/>}>
      {receipt && <article className="warehouse-receipt printable-doc">
        <header><div><strong>{companyName}</strong><h2>{t('warehouse.receipt.title')}</h2></div><div><strong>{receipt.receiptNumber}</strong><p>{when(receipt.receivedAtUtc)}</p><Tag color="green">{sourceLabel(receipt.source)}</Tag></div></header>
        <dl className="packing-document-facts"><div><dt>{t('common.customer')}</dt><dd>{receipt.details.customerName}{receipt.details.customerCode ? ` · ${receipt.details.customerCode}` : ''}</dd></div><div><dt>{t('warehouse.receipt.phone')}</dt><dd>{receipt.details.phone || '—'}</dd></div><div><dt>{t('warehouse.receipt.warehouseRack')}</dt><dd>{receipt.details.warehouseName}{receipt.details.bay ? ` · ${receipt.details.bay}` : ''}</dd></div><div><dt>{t('warehouse.receipt.pickupReference')}</dt><dd>{receipt.details.pickupNumber || t('warehouse.receipt.officeDropOff')}</dd></div><div><dt>{t('warehouse.receipt.deliveredBy')}</dt><dd>{receipt.details.deliveredBy}</dd></div><div><dt>{t('warehouse.col.receivedBy')}</dt><dd>{receipt.details.receivedBy}</dd></div></dl>
        <WarehouseShippingSummary shipping={receipt.details.shipping} /><h3>{t('warehouse.receipt.boxesReceived', { count: receipt.details.boxes.length })}</h3>
        <div className="warehouse-receipt-table"><table className="packing-items-table"><thead><tr><th>{t('warehouse.receipt.thBox')}</th><th>{t('warehouse.receipt.thDescription')}</th><th>{t('warehouse.receipt.thContents')}</th><th>{t('warehouse.receipt.thSeal')}</th></tr></thead><tbody>{receipt.details.boxes.map(b => <tr key={b.id}><td>{b.trackingNumber}<br />{b.customerReference}</td><td>{b.description}<br />{b.condition}</td><td>{b.contents || t('warehouse.receipt.notDeclared')}</td><td>{b.sealNumber || t('warehouse.receipt.noSeal')}<br />{receipt.source === 'PICKUP' ? t('warehouse.receipt.packingList') : b.contentsChecked ? t('warehouse.receipt.checkedByStaff') : t('warehouse.receipt.notInspected')}</td></tr>)}</tbody></table></div>
        <h3>{t('warehouse.receive.notes')}</h3><p className="packing-preserve-lines">{receipt.details.notes || t('warehouse.receipt.noNotes')}</p>
        <p className="warehouse-receipt-note">{t('warehouse.receipt.footer')}</p>
      </article>}
      {receipt && <WarehouseReceiptExtras key={receipt.id} receipt={receipt} onChanged={updated => { setReceipt(updated); setReceipts(all => all.map(x => x.id === updated.id ? updated : x)) }} />}
    </Modal>
  </>
}
