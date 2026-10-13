import { useEffect, useState } from 'react'
import { useMessageTemplate } from '../../messageTemplates'
import { ShareChannels } from '../ShareChannels'
import { movementLabel } from '../../operationsApi'
import { Alert, Button, Card, Checkbox, Empty, Form, Input, Modal, Select, Space, Tag, message } from 'antd'
import { CopyOutlined, HomeOutlined, SendOutlined, WhatsAppOutlined } from '@ant-design/icons'
import { pickupsApi } from '../../api'
import { shipmentApi, type Shipment } from '../../shipmentApi'
import type { PickupDetail, PickupWork, Warehouse } from '../../types'
import { when } from '../TripClockCard'
import { useT } from '../../i18n'

const statusColor: Record<string, string> = { PACKED: 'blue', WAREHOUSE: 'purple', IN_TRANSIT: 'orange', ARRIVED: 'cyan', DELIVERED: 'green' }
type StoreForm = { warehouseId: string; bay: string; packageIds: string[]; receivedBy: string; notes: string }

type Props = { detail: PickupDetail; work: PickupWork; warehouses: Warehouse[]; onWork: (work: PickupWork) => void }

/** Store packed boxes in a warehouse. Custody moves only after the customer has confirmed the packing list. */
export function PickupStorageTab({ detail, work, warehouses, onWork }: Props) {
  const [shipment, setShipment] = useState<Shipment>(), [busy, setBusy] = useState(false), [shareOpen, setShareOpen] = useState(false), [link, setLink] = useState<string>()
  const [form] = Form.useForm<StoreForm>(), [shareForm] = Form.useForm<{ leftBehindNotes: string }>()
  const pickupId = detail.pickup.id, p = detail.pickup
  const { t } = useT()
  const { message: listMessage } = useMessageTemplate('PICKUP_PACKING_LIST')
  useEffect(() => { shipmentApi.get(pickupId).then(setShipment).catch(() => setShipment(undefined)) }, [pickupId, work])
  const storable = detail.packages.filter(b => { const s = work.storage.find(x => x.packageId === b.id)?.status ?? 'PACKED'; return s === 'PACKED' || s === 'IN_TRANSIT' })

  const store = async () => {
    const v = await form.validateFields(); setBusy(true)
    try { onWork(await pickupsApi.store(pickupId, { warehouseId: v.warehouseId, bay: v.bay, packageIds: v.packageIds, receivedBy: v.receivedBy, notes: v.notes })); form.setFieldValue('packageIds', []); message.success(t('pickups.storage.stored', { count: v.packageIds.length })) }
    catch (e) { message.error(e instanceof Error ? e.message : t('pickups.storage.storeFailed')) } finally { setBusy(false) }
  }
  const share = async () => {
    const v = await shareForm.validateFields(); setBusy(true)
    try { setLink((await shipmentApi.share(pickupId, { validDays: 7, leftBehindNotes: v.leftBehindNotes })).url); setShareOpen(false); setShipment(await shipmentApi.get(pickupId)) }
    catch (e) { message.error(e instanceof Error ? e.message : t('pickups.storage.shareFailed')) } finally { setBusy(false) }
  }

  return <div className="pickup-tab-grid">
    <Card title={<Space><HomeOutlined />{t('pickups.storage.storeInWarehouse')}</Space>}>
      {/* Storing no longer waits on the customer. A confirmation recorded earlier still shows. */}
      {shipment?.packingConfirmed && <Alert className="pickup-alert" type="success" showIcon message={t('pickups.storage.customerConfirmed')} />}
      {warehouses.filter(w => w.isActive).length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('pickups.storage.addWarehouseFirst')} /> :
        <Form form={form} layout="vertical" requiredMark={false} initialValues={{ packageIds: [] }}>
          <div className="master-form-grid">
            <Form.Item label={t('pickups.warehouse')} name="warehouseId" rules={[{ required: true, message: t('pickups.storage.selectWarehouse') }]}><Select options={warehouses.filter(w => w.isActive).map(w => ({ value: w.id, label: `${w.name} · ${w.code}` }))} /></Form.Item>
            <Form.Item label={t('pickups.storage.bay')} name="bay" rules={[{ max: 80 }]}><Input placeholder={t('pickups.storage.bayPlaceholder')} /></Form.Item>
          </div>
          <Form.Item label={t('pickups.storage.boxesToStore')} name="packageIds" rules={[{ required: true, type: 'array', min: 1, message: t('pickups.storage.selectOneBox') }]}
            extra={storable.length ? <Button type="link" size="small" style={{ padding: 0 }} onClick={() => form.setFieldValue('packageIds', storable.map(b => b.id))}>{t('pickups.storage.selectAll', { count: storable.length })}</Button> : t('pickups.storage.noneWaiting')}>
            <Checkbox.Group className="pickup-box-checks" options={storable.map(b => ({ value: b.id, label: `${b.trackingNumber}${b.roomName ? ` · ${b.roomName}` : ''}` }))} />
          </Form.Item>
          <div className="master-form-grid">
            <Form.Item label={t('pickups.storage.receivedBy')} name="receivedBy" rules={[{ required: true, whitespace: true, message: t('pickups.storage.whoReceived') }]}><Input placeholder={t('pickups.storage.storeKeeper')} /></Form.Item>
            <Form.Item label={t('common.notes')} name="notes"><Input placeholder={t('pickups.storage.notesPlaceholder')} /></Form.Item>
          </div>
          <Button type="primary" loading={busy} disabled={!storable.length} onClick={() => void store()}>{t('pickups.storage.storeSelected')}</Button>
        </Form>}
    </Card>
    <Card title={t('pickups.storage.locations')} extra={<Tag>{t('pickups.boxCount', { count: detail.packages.length })}</Tag>}>
      {detail.packages.length ? <ul className="pickup-list">{detail.packages.map(b => { const s = work.storage.find(x => x.packageId === b.id)
        return <li key={b.id}><div><strong>{b.trackingNumber}</strong><small>{s?.location ?? p.address}{s?.updatedAtUtc ? ` · ${when(s.updatedAtUtc)}` : ''}</small></div><Tag color={statusColor[s?.status ?? 'PACKED']}>{movementLabel(s?.status ?? 'PACKED')}</Tag></li> })}</ul>
        : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('pickups.noBoxesYet')} />}
    </Card>

    <Modal centered width={640} open={shareOpen} title={t('pickups.storage.sendTitle')} okText={t('pickups.storage.createLink')} cancelText={t('common.cancel')} confirmLoading={busy} onOk={() => void share()} onCancel={() => setShareOpen(false)} destroyOnHidden>
      <section className="packing-share-summary"><h3>{t('pickups.storage.sendHeading')}</h3><dl className="packing-share-facts">
        <div><dt>{t('pickups.storage.reference')}</dt><dd>{p.pickupNumber}</dd></div><div><dt>{t('common.customer')}</dt><dd>{p.customerName}</dd></div>
        <div className="packing-fact-wide"><dt>{t('pickups.pickupAddress')}</dt><dd>{p.address}</dd></div>
        <div><dt>{t('pickups.storage.packagesIncluded')}</dt><dd>{detail.packages.length}</dd></div><div><dt>{t('pickups.storage.linkValidity')}</dt><dd>{t('pickups.storage.days', { count: 7 })}</dd></div>
      </dl></section>
      <Form form={shareForm} layout="vertical" requiredMark={false}>
        <Form.Item label={t('pickups.storage.leftBehind')} name="leftBehindNotes" rules={[{ required: true, whitespace: true, message: t('pickups.storage.leftBehindRequired') }]} extra={t('pickups.storage.leftBehindHelp')}><Input.TextArea rows={3} maxLength={2000} /></Form.Item>
      </Form>
    </Modal>
    <Modal centered open={Boolean(link)} title={t('pickups.storage.readyTitle')} footer={null} onCancel={() => setLink(undefined)}>
      <section className="packing-share-summary"><h3>{t('pickups.storage.readyHeading')}</h3><dl className="packing-share-facts"><div><dt>{t('pickups.storage.reference')}</dt><dd>{p.pickupNumber}</dd></div><div><dt>{t('common.customer')}</dt><dd>{p.customerName}</dd></div></dl></section>
      <p>{t('pickups.storage.readyHelp')}</p>
      <Form layout="vertical"><Form.Item label={t('pickups.storage.reviewLink')}><Input.TextArea aria-label={t('pickups.storage.reviewLink')} value={link} readOnly autoSize={{ minRows: 2, maxRows: 3 }} /></Form.Item></Form>
      <Button href={link} target="_blank" rel="noopener noreferrer">{t('pickups.storage.openList')}</Button>
      <ShareChannels url={link ?? ''} phone={p.phone} email={p.email} subject={t('pickups.storage.shareSubject', { number: p.pickupNumber })}
        text={listMessage({ customer: p.customerName, reference: p.pickupNumber, link })} />
    </Modal>
  </div>
}

