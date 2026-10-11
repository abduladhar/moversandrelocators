import {ReportPrintButton} from '../reportingV2/ReportPrintButton'
import { BillingPanel } from '../components/BillingPanel'
import { useBilling } from '../billingApi'
import { WarehouseShippingFields, WarehouseShippingSummary } from '../components/WarehouseShippingFields'
import { WarehouseReceiptExtras } from '../components/WarehouseReceiptExtras'
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Checkbox, Form, Input, Modal, Select, Space, Tabs, Tag, message } from 'antd'
import { DeleteOutlined, PlusOutlined, PrinterOutlined } from '@ant-design/icons'
import { pickupsApi, request } from '../api'
import type { Pickup, Warehouse } from '../types'
import type { BusinessMaster } from '../businessMasters'
import { shipmentApi, type Shipment } from '../shipmentApi'
import { warehouseApi, type WarehouseReceipt, type WarehouseStock, type WarehouseShipping } from '../warehouseApi'
import { PageHeader } from '../components/PageHeader'
import { DataGrid } from '../components/DataGrid'
import { RowActions } from '../components/RowActions'
import { CreateCustomerButton } from '../components/CreateCustomerButton'

const sourceLabel = (value: string) => value === 'OFFICE' ? 'Customer office drop-off' : 'Pickup'
const when = (value: string) => new Date(value).toLocaleString()
type BoxInput = { description: string; customerReference?: string; condition: string; sealNumber?: string; contents?: string; contentsChecked: boolean }
type ReceiveForm = { shipping?: WarehouseShipping; customerCode?: string; pickupId?: string; warehouseId: string; bay?: string; deliveredBy?: string; receivedBy: string; notes?: string; packageIds?: string[]; boxes?: BoxInput[] }

export function WarehousePage({ companyName, userName }: { companyName: string; userName: string }) {
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
    } catch (e) { message.error(e instanceof Error ? e.message : 'Unable to load warehouse records') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const show = (next: 'office' | 'pickup') => {
    lookupVersion.current++; setShipment(undefined); setLoadingPickup(false); form.resetFields(); requestId.current = crypto.randomUUID()
    form.setFieldsValue({ receivedBy: userName, packageIds: [], boxes: [{ description: '', condition: 'Good external condition', contentsChecked: false }] }); setMode(next)
    void load()
  }
  const choosePickup = async (id: string) => {
    const version = ++lookupVersion.current; setShipment(undefined); form.setFieldValue('packageIds', []); setLoadingPickup(true)
    try { const value = await shipmentApi.get(id); if (lookupVersion.current === version) { setShipment(value); const p = pickups.find(x => x.id === id); if (p) form.setFieldValue(['shipping', 'shipper'], { name: p.customerName, phone: p.phone, address: p.address }) } }
    catch (e) { if (lookupVersion.current === version) message.error(e instanceof Error ? e.message : 'Unable to load pickup boxes') }
    finally { if (lookupVersion.current === version) setLoadingPickup(false) }
  }
  const receive = async () => {
    if (!mode || busy.current) return
    busy.current = true
    try {
      const v = await form.validateFields(); setSaving(true)
      const saved = await warehouseApi.receive(mode, { ...v, requestId: requestId.current })
      setMode(null); setReceipt(saved); message.success(`Received ${saved.details.boxes.length} boxes · ${saved.receiptNumber}`); await load()
    } catch (e) { if (e instanceof Error) message.error(e.message) }
    finally { busy.current = false; setSaving(false) }
  }
  const matches = (warehouseId: string, source: string, text: string) => (!warehouseFilter || warehouseId === warehouseFilter) && (!sourceFilter || source === sourceFilter) && text.toLowerCase().includes(query.toLowerCase())
  const filteredStock = stock.filter(x => matches(x.warehouseId, x.source, `${x.trackingNumber} ${x.customerName} ${x.location} ${x.reference} ${x.contents}`))
  const filteredReceipts = receipts.filter(x => matches(x.warehouseId, x.source, `${x.receiptNumber} ${x.details.customerName} ${x.details.warehouseName} ${x.details.pickupNumber ?? ''} ${x.details.shipping?.shipper?.name ?? ''} ${x.details.shipping?.consignee?.name ?? ''} ${x.details.shipping?.toLocation ?? ''} ${x.details.shipping?.dropAddress ?? ''}`))
  const storable = shipment?.packages.filter(x => x.status === 'PACKED' || x.status === 'IN_TRANSIT') ?? []
  if(billingReceipt)return <><Button onClick={()=>setBillingReceipt(undefined)}>Back to warehouse</Button><h2>Billing · {billingReceipt.receiptNumber} · {billingReceipt.details.customerName}</h2><BillingPanel sourceKind="WAREHOUSE" sourceId={billingReceipt.id} companyName={companyName}/></>
  return <>
    <PageHeader eyebrow="WAREHOUSE OPERATIONS" title="Warehouse" description="Receive pickup items or customer boxes brought to the office, and track where every box is stored." onRefresh={load} filters={<Space wrap>
      <Input.Search allowClear aria-label="Search warehouse records" placeholder="Customer, box, receipt or location" value={query} onChange={e => setQuery(e.target.value)} style={{ width: 260 }} />
      <Select allowClear placeholder="All warehouses" aria-label="Filter warehouse" value={warehouseFilter} onChange={setWarehouseFilter} options={warehouses.map(w => ({ value: w.id, label: w.name }))} style={{ minWidth: 170 }} />
      <Select allowClear placeholder="All sources" aria-label="Filter receipt source" value={sourceFilter} onChange={setSourceFilter} options={['PICKUP', 'OFFICE'].map(value => ({ value, label: sourceLabel(value) }))} style={{ minWidth: 180 }} />
    </Space>} />
    <Space wrap style={{ marginBottom: 16 }}><Button type="primary" icon={<PlusOutlined />} onClick={() => show('pickup')}>Receive from pickup</Button><Button icon={<PlusOutlined />} onClick={() => show('office')}>Receive customer boxes</Button></Space>
    <Tabs items={[
      { key: 'stock', label: `Boxes in warehouse (${filteredStock.length})`, children: <Card className="grid-card"><DataGrid rowKey="id" loading={loading} dataSource={filteredStock} pagination={{ pageSize: 20 }} scroll={{ x: 1200 }} columns={[
        { title: 'Box number', dataIndex: 'trackingNumber' }, { title: 'Customer', dataIndex: 'customerName' }, { title: 'Source', dataIndex: 'source', render: sourceLabel },
        { title: 'Location / rack', dataIndex: 'location' }, { title: 'Reference', dataIndex: 'reference' }, { title: 'Contents', dataIndex: 'contents', ellipsis: true },
        { title: 'Received', dataIndex: 'receivedAtUtc', render: when }, { title: 'Received by', dataIndex: 'receivedBy' },
      ]} /></Card> },
      { key: 'receipts', label: `Receiving history (${filteredReceipts.length})`, children: <Card className="grid-card"><DataGrid rowKey="id" loading={loading} dataSource={filteredReceipts} pagination={{ pageSize: 20 }} scroll={{ x: 1000 }} columns={[
        { title: 'Receipt', dataIndex: 'receiptNumber' }, { title: 'Customer', dataIndex: ['details', 'customerName'] }, { title: 'Source', dataIndex: 'source', render: sourceLabel },
        { title: 'Consignee', dataIndex: ['details', 'shipping', 'consignee', 'name'] }, { title: 'To location', dataIndex: ['details', 'shipping', 'toLocation'] }, { title: 'Warehouse', dataIndex: ['details', 'warehouseName'] }, { title: 'Bay / rack', dataIndex: ['details', 'bay'] }, { title: 'Boxes', render: (_, x) => x.details.boxes.length },
        { title: 'Received', dataIndex: 'receivedAtUtc', render: when }, { title: 'Actions', render: (_, x) => <RowActions><Button onClick={() => setReceipt(x)}>Receipt / attachments</Button>{canBill&&<Button onClick={()=>setBillingReceipt(x)}>Invoicing & billing</Button>}</RowActions> },
      ]} /></Card> },
    ]} />
    <Modal centered open={!!mode} width={900} title={mode === 'office' ? 'Receive customer boxes at office' : 'Receive items from pickup'} okText="Receive into warehouse" confirmLoading={saving} okButtonProps={{ disabled: loadingPickup || (mode === 'pickup' && !storable.length) }} onOk={() => void receive()} onCancel={() => { if (!saving) { lookupVersion.current++; setMode(null) } }} closable={!saving} maskClosable={!saving} destroyOnHidden>
      <Form form={form} layout="vertical" disabled={saving}>
        <section className="warehouse-form-section"><h3>{mode === 'office' ? 'Customer & handover' : 'Pickup & boxes'}</h3>
          {mode === 'office' ? <>
            <Form.Item name="customerCode" label="Customer" rules={[{ required: true, message: 'Select the customer who owns these boxes.' }]}><Select showSearch optionFilterProp="label" placeholder="Search customer name, code or phone" onChange={code => { const c = customers.find(x => x.code === code); if (c) form.setFieldValue(['shipping', 'shipper'], { name: c.name, phone: c.phone, address: c.address }) }} options={customers.map(x => ({ value: x.code, label: `${x.name} · ${x.code} · ${x.phone ?? ''}` }))} /></Form.Item>
            <CreateCustomerButton getDefaults={() => ({})} onCreated={c => { setCustomers(all => [...all, c]); form.setFieldValue('customerCode', c.code); form.setFieldValue(['shipping', 'shipper'], { name: c.name, phone: c.phone, address: c.address }) }} />
            <Form.Item name="deliveredBy" label="Delivered to office by" rules={[{ required: true, whitespace: true }]}><Input maxLength={160} placeholder="Customer or representative name" /></Form.Item>
          </> : <>
            <Form.Item name="pickupId" label="Pickup" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" placeholder="Select pickup" options={pickups.map(p => ({ value: p.id, label: `${p.pickupNumber} · ${p.customerName}` }))} onChange={id => void choosePickup(id)} /></Form.Item>
            <Form.Item name="packageIds" label="Boxes to receive" rules={[{ required: true, type: 'array', min: 1, message: 'Select at least one box.' }]} extra={shipment && !storable.length ? 'No boxes from this pickup are waiting to be received.' : undefined}>
              <Select mode="multiple" loading={loadingPickup} optionFilterProp="label" placeholder="Select boxes" options={storable.map(p => ({ value: p.id, label: `${p.trackingNumber} · ${p.status === 'PACKED' ? 'Packed' : 'In transit'}` }))} />
            </Form.Item>
            {!!storable.length && <Button onClick={() => form.setFieldValue('packageIds', storable.map(p => p.id))}>Select all {storable.length} boxes</Button>}
          </>}
        </section>
        <section className="warehouse-form-section"><h3>Storage location & receiving details</h3><div className="master-form-grid">
          <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" placeholder="Select warehouse" options={warehouses.filter(w => w.isActive).map(w => ({ value: w.id, label: `${w.name} · ${w.code}` }))} notFoundContent="Add an active warehouse in Pickup masters." /></Form.Item>
          <Form.Item name="bay" label="Bay / rack"><Input maxLength={80} placeholder="e.g. A-04" /></Form.Item>
          <Form.Item name="receivedBy" label="Received by" rules={[{ required: true, whitespace: true }]}><Input maxLength={160} /></Form.Item>
        </div><Form.Item name="notes" label="Receiving notes / discrepancies"><Input.TextArea rows={2} maxLength={2000} placeholder="Record visible damage, missing boxes or differences before receiving." /></Form.Item></section>
        <WarehouseShippingFields />
        <Alert type="info" showIcon message="Warehouse attachments" description="After receiving the boxes, add photos and documents from the receipt’s Warehouse attachments section. You can also open any saved receipt to attach files later." />
        {mode === 'office' && <section className="warehouse-form-section"><h3>Customer-supplied boxes</h3><Alert type="info" showIcon message="Add one row per physical box. Box numbers are assigned automatically." description="Record visible condition and seal numbers. Only mark contents checked if staff actually opened and checked the box." />
          <Form.List name="boxes" rules={[{ validator: async (_, boxes) => { if (!boxes?.length) throw new Error('Add at least one box.') } }]}>{(fields, { add, remove }, { errors }) => <>
            {fields.map((field, index) => <Card size="small" key={field.key} title={`Box ${index + 1}`} style={{ marginTop: 12 }} extra={<Button aria-label={`Remove box ${index + 1}`} danger type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)} />}>
              <div className="master-form-grid">
                <Form.Item name={[field.name, 'description']} label="Box description" rules={[{ required: true, whitespace: true }]}><Input maxLength={160} placeholder="Large carton, suitcase…" /></Form.Item>
                <Form.Item name={[field.name, 'customerReference']} label="Customer box reference"><Input maxLength={80} /></Form.Item>
                <Form.Item name={[field.name, 'condition']} label="Visible condition" rules={[{ required: true, whitespace: true }]}><Input maxLength={500} placeholder="Good, dented corner, wet…" /></Form.Item>
                <Form.Item name={[field.name, 'sealNumber']} label="Seal number"><Input maxLength={80} /></Form.Item>
              </div>
              <Form.Item name={[field.name, 'contents']} label="Contents / quantities declared or checked"><Input.TextArea maxLength={2000} rows={2} placeholder="e.g. Books × 20. Leave blank if contents were not declared." /></Form.Item>
              <Form.Item name={[field.name, 'contentsChecked']} valuePropName="checked"><Checkbox>Contents opened and checked by receiving staff</Checkbox></Form.Item>
            </Card>)}
            <Form.ErrorList errors={errors} /><Button style={{ marginTop: 12 }} icon={<PlusOutlined />} disabled={fields.length >= 200} onClick={() => add({ description: '', condition: 'Good external condition', contentsChecked: false })}>Add another box</Button>
          </>}</Form.List>
        </section>}
      </Form>
    </Modal>
    <Modal centered title="Warehouse receiving receipt" open={!!receipt} width={950} onCancel={() => setReceipt(undefined)} footer={<ReportPrintButton type="WAREHOUSE_RECEIPT" title={receipt?.receiptNumber??"Warehouse receipt"} id={receipt?.id} disabled={!receipt}/>}>
      {receipt && <article className="warehouse-receipt printable-doc">
        <header><div><strong>{companyName}</strong><h2>Warehouse receiving receipt</h2></div><div><strong>{receipt.receiptNumber}</strong><p>{when(receipt.receivedAtUtc)}</p><Tag color="green">{sourceLabel(receipt.source)}</Tag></div></header>
        <dl className="packing-document-facts"><div><dt>Customer</dt><dd>{receipt.details.customerName}{receipt.details.customerCode ? ` · ${receipt.details.customerCode}` : ''}</dd></div><div><dt>Phone</dt><dd>{receipt.details.phone || '—'}</dd></div><div><dt>Warehouse / rack</dt><dd>{receipt.details.warehouseName}{receipt.details.bay ? ` · ${receipt.details.bay}` : ''}</dd></div><div><dt>Pickup reference</dt><dd>{receipt.details.pickupNumber || 'Office drop-off'}</dd></div><div><dt>Delivered by</dt><dd>{receipt.details.deliveredBy}</dd></div><div><dt>Received by</dt><dd>{receipt.details.receivedBy}</dd></div></dl>
        <WarehouseShippingSummary shipping={receipt.details.shipping} /><h3>Boxes received ({receipt.details.boxes.length})</h3>
        <div className="warehouse-receipt-table"><table className="packing-items-table"><thead><tr><th>Box number / reference</th><th>Description / condition</th><th>Contents / quantities</th><th>Seal / verification</th></tr></thead><tbody>{receipt.details.boxes.map(b => <tr key={b.id}><td>{b.trackingNumber}<br />{b.customerReference}</td><td>{b.description}<br />{b.condition}</td><td>{b.contents || 'Not declared'}</td><td>{b.sealNumber || 'No seal recorded'}<br />{receipt.source === 'PICKUP' ? 'Customer-confirmed packing list' : b.contentsChecked ? 'Checked by staff' : 'Customer declared / not inspected'}</td></tr>)}</tbody></table></div>
        <h3>Receiving notes / discrepancies</h3><p className="packing-preserve-lines">{receipt.details.notes || 'No receiving notes recorded.'}</p>
        <p className="warehouse-receipt-note">Receipt records the boxes received at the location above. Uninspected contents are recorded as declared by the customer.</p>
      </article>}
      {receipt && <WarehouseReceiptExtras key={receipt.id} receipt={receipt} onChanged={updated => { setReceipt(updated); setReceipts(all => all.map(x => x.id === updated.id ? updated : x)) }} />}
    </Modal>
  </>
}



