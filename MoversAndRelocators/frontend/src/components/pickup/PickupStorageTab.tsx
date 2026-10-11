import { useEffect, useState } from 'react'
import { movementLabel } from '../../operationsApi'
import { Alert, Button, Card, Checkbox, Empty, Form, Input, Modal, Select, Space, Tag, message } from 'antd'
import { CopyOutlined, HomeOutlined, SendOutlined, WhatsAppOutlined } from '@ant-design/icons'
import { pickupsApi } from '../../api'
import { shipmentApi, type Shipment } from '../../shipmentApi'
import type { PickupDetail, PickupWork, Warehouse } from '../../types'
import { when } from '../TripClockCard'

const statusColor: Record<string, string> = { PACKED: 'blue', WAREHOUSE: 'purple', IN_TRANSIT: 'orange', ARRIVED: 'cyan', DELIVERED: 'green' }
type StoreForm = { warehouseId: string; bay: string; packageIds: string[]; receivedBy: string; notes: string }

type Props = { detail: PickupDetail; work: PickupWork; warehouses: Warehouse[]; onWork: (work: PickupWork) => void }

/** Store packed boxes in a warehouse. Custody moves only after the customer has confirmed the packing list. */
export function PickupStorageTab({ detail, work, warehouses, onWork }: Props) {
  const [shipment, setShipment] = useState<Shipment>(), [busy, setBusy] = useState(false), [shareOpen, setShareOpen] = useState(false), [link, setLink] = useState<string>()
  const [form] = Form.useForm<StoreForm>(), [shareForm] = Form.useForm<{ leftBehindNotes: string }>()
  const pickupId = detail.pickup.id, p = detail.pickup
  useEffect(() => { shipmentApi.get(pickupId).then(setShipment).catch(() => setShipment(undefined)) }, [pickupId, work])
  const storable = detail.packages.filter(b => { const s = work.storage.find(x => x.packageId === b.id)?.status ?? 'PACKED'; return s === 'PACKED' || s === 'IN_TRANSIT' })

  const store = async () => {
    const v = await form.validateFields(); setBusy(true)
    try { onWork(await pickupsApi.store(pickupId, { warehouseId: v.warehouseId, bay: v.bay, packageIds: v.packageIds, receivedBy: v.receivedBy, notes: v.notes })); form.setFieldValue('packageIds', []); message.success(`${v.packageIds.length} box${v.packageIds.length === 1 ? '' : 'es'} stored`) }
    catch (e) { message.error(e instanceof Error ? e.message : 'Unable to store the boxes') } finally { setBusy(false) }
  }
  const share = async () => {
    const v = await shareForm.validateFields(); setBusy(true)
    try { setLink((await shipmentApi.share(pickupId, { validDays: 7, leftBehindNotes: v.leftBehindNotes })).url); setShareOpen(false); setShipment(await shipmentApi.get(pickupId)) }
    catch (e) { message.error(e instanceof Error ? e.message : 'Unable to share the packing list') } finally { setBusy(false) }
  }

  return <div className="pickup-tab-grid">
    <Card title={<Space><HomeOutlined />Store in warehouse</Space>}>
      {/* Storing no longer waits on the customer. A confirmation recorded earlier still shows. */}
      {shipment?.packingConfirmed && <Alert className="pickup-alert" type="success" showIcon message="Customer confirmed the packing list" />}
      {warehouses.filter(w => w.isActive).length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Add a warehouse in Pickup master data first." /> :
        <Form form={form} layout="vertical" requiredMark={false} initialValues={{ packageIds: [] }}>
          <div className="master-form-grid">
            <Form.Item label="Warehouse" name="warehouseId" rules={[{ required: true, message: 'Select a warehouse' }]}><Select options={warehouses.filter(w => w.isActive).map(w => ({ value: w.id, label: `${w.name} · ${w.code}` }))} /></Form.Item>
            <Form.Item label="Bay / rack" name="bay" rules={[{ max: 80 }]}><Input placeholder="e.g. A-04" /></Form.Item>
          </div>
          <Form.Item label="Boxes to store" name="packageIds" rules={[{ required: true, type: 'array', min: 1, message: 'Select at least one box' }]}
            extra={storable.length ? <Button type="link" size="small" style={{ padding: 0 }} onClick={() => form.setFieldValue('packageIds', storable.map(b => b.id))}>Select all {storable.length}</Button> : 'No boxes are waiting to be stored.'}>
            <Checkbox.Group className="pickup-box-checks" options={storable.map(b => ({ value: b.id, label: `${b.trackingNumber}${b.roomName ? ` · ${b.roomName}` : ''}` }))} />
          </Form.Item>
          <div className="master-form-grid">
            <Form.Item label="Received by" name="receivedBy" rules={[{ required: true, whitespace: true, message: 'Who received the boxes?' }]}><Input placeholder="Store keeper name" /></Form.Item>
            <Form.Item label="Notes" name="notes"><Input placeholder="Seal numbers, condition…" /></Form.Item>
          </div>
          <Button type="primary" loading={busy} disabled={!storable.length} onClick={() => void store()}>Store selected boxes</Button>
        </Form>}
    </Card>
    <Card title="Box locations" extra={<Tag>{detail.packages.length} boxes</Tag>}>
      {detail.packages.length ? <ul className="pickup-list">{detail.packages.map(b => { const s = work.storage.find(x => x.packageId === b.id)
        return <li key={b.id}><div><strong>{b.trackingNumber}</strong><small>{s?.location ?? p.address}{s?.updatedAtUtc ? ` · ${when(s.updatedAtUtc)}` : ''}</small></div><Tag color={statusColor[s?.status ?? 'PACKED']}>{movementLabel(s?.status ?? 'PACKED')}</Tag></li> })}</ul>
        : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No boxes packed yet" />}
    </Card>

    <Modal centered width={640} open={shareOpen} title="Send packing list for confirmation" okText="Create link" confirmLoading={busy} onOk={() => void share()} onCancel={() => setShareOpen(false)} destroyOnHidden>
      <section className="packing-share-summary"><h3>Packing list · Customer confirmation</h3><dl className="packing-share-facts">
        <div><dt>Pickup reference</dt><dd>{p.pickupNumber}</dd></div><div><dt>Customer</dt><dd>{p.customerName}</dd></div>
        <div className="packing-fact-wide"><dt>Pickup address</dt><dd>{p.address}</dd></div>
        <div><dt>Packages included</dt><dd>{detail.packages.length}</dd></div><div><dt>Link validity</dt><dd>7 days</dd></div>
      </dl></section>
      <Form form={shareForm} layout="vertical" requiredMark={false}>
        <Form.Item label="Items left behind or excluded" name="leftBehindNotes" rules={[{ required: true, whitespace: true, message: 'Describe anything left behind, or say nothing was' }]} extra="Shown to the customer with the box list. Packing is locked while the link is open."><Input.TextArea rows={3} maxLength={2000} /></Form.Item>
      </Form>
    </Modal>
    <Modal centered open={Boolean(link)} title="Packing list ready" footer={null} onCancel={() => setLink(undefined)}>
      <section className="packing-share-summary"><h3>Ready for customer review</h3><dl className="packing-share-facts"><div><dt>Pickup reference</dt><dd>{p.pickupNumber}</dd></div><div><dt>Customer</dt><dd>{p.customerName}</dd></div></dl></section>
      <p>Share this secure link so the customer can review package contents and confirm the list or request corrections.</p>
      <Form layout="vertical"><Form.Item label="Customer review link"><Input.TextArea aria-label="Customer review link" value={link} readOnly autoSize={{ minRows: 2, maxRows: 3 }} /></Form.Item></Form>
      <Button href={link} target="_blank" rel="noopener noreferrer">Open packing list</Button>
      <div className="survey-share-actions" style={{ marginTop: 14 }}>
        <Button className="share-whatsapp" icon={<WhatsAppOutlined />} onClick={() => window.open(`https://wa.me/${p.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Please check and confirm your packing list for ${p.pickupNumber}: ${link}`)}`, '_blank', 'noopener')}>WhatsApp</Button>
        <Button icon={<CopyOutlined />} onClick={() => { void navigator.clipboard.writeText(link ?? ''); message.success('Link copied') }}>Copy link</Button>
      </div>
    </Modal>
  </div>
}

