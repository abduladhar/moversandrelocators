import { DataGrid as Table } from '../components/DataGrid'
import { readable } from '../operationsApi'
import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Tag, Typography, message } from 'antd'
import { PageHeader } from '../components/PageHeader'
import { pickupsApi } from '../api'
import { shipmentApi, type Claim, type PackageLocation, type Shipment } from '../shipmentApi'
import type { Pickup } from '../types'
import { formatDateTime, has, useT } from '../i18n'
const CLAIM_CATEGORIES = ['MISSING', 'DAMAGED', 'LEFT_BEHIND', 'LATE', 'OTHER']
export function ShipmentsPage() {
  const { t } = useT()
  /** Displayed label for a code; codes without a text show in readable English. */
  const label = (prefix: string, value: string) => has(prefix + value) ? t(prefix + value) : readable(value)
  const movement = (value: string) => label('operations.movement.', value)
  const [pickups, setPickups] = useState<Pickup[]>([]), [id, setId] = useState<string>(), [shipment, setShipment] = useState<Shipment | null>(null)
  const [error, setError] = useState(''), [link, setLink] = useState(''), [mode, setMode] = useState<'share' | 'handover' | 'claim' | 'resolve' | null>(null)
  const [selected, setSelected] = useState<PackageLocation | null>(null), [claim, setClaim] = useState<Claim | null>(null), [busy, setBusy] = useState(false)
  const [requestId, setRequestId] = useState(''), [form] = Form.useForm()
  const fail = (e: unknown) => { const text = e instanceof Error ? e.message : t('warehouse.shipments.actionFailed'); setError(text); message.error(text) }
  const load = async () => { try { const rows = await pickupsApi.list(); setPickups(rows); if (id) setShipment(await shipmentApi.get(id)) } catch (e) { fail(e) } }
  useEffect(() => { pickupsApi.list().then(setPickups).catch(fail) }, [])
  useEffect(() => { let active = true; setShipment(null); setLink(''); if (id) shipmentApi.get(id).then(s => { if (active) setShipment(s) }).catch(fail); return () => { active = false } }, [id])
  const reload = async () => { if (id) setShipment(await shipmentApi.get(id)) }
  const open = (next: typeof mode, p?: PackageLocation, c?: Claim) => {
    setMode(next); setSelected(p ?? null); setClaim(c ?? null); setRequestId(crypto.randomUUID()); form.resetFields()
    if (next === 'handover') form.setFieldsValue({ status: p?.status === 'PACKED' || p?.status === 'WAREHOUSE' ? 'IN_TRANSIT' : 'DELIVERED' })
  }
  const submit = async (v: Record<string, unknown>) => {
    if (!id) return
    setBusy(true)
    try {
      if (mode === 'share') { const result = await shipmentApi.share(id, { ...v, validDays: 7 }); setLink(result.url) }
      if (mode === 'handover' && selected) await shipmentApi.handover(id, { ...v, requestId, packageId: selected.id, expectedStatus: selected.status })
      if (mode === 'claim') await shipmentApi.claim({ ...v, pickupId: id, packageId: v.packageId || null })
      if (mode === 'resolve' && claim) await shipmentApi.resolve(claim.id, { ...v, version: claim.version })
      setMode(null); setError(''); message.success(t('common.saved')); await reload()
    } catch (e) { fail(e) } finally { setBusy(false) }
  }
  const allowed = selected?.status === 'PACKED' ? ['WAREHOUSE', 'IN_TRANSIT'] : selected?.status === 'WAREHOUSE' ? ['IN_TRANSIT'] : selected?.status === 'IN_TRANSIT' ? ['WAREHOUSE', 'ARRIVED', 'DELIVERED'] : ['WAREHOUSE', 'DELIVERED']
  const required = [{ required: true, message: t('common.required') }]
  return <div className="operations-workspace">
    <PageHeader onRefresh={load} eyebrow={t('warehouse.shipments.eyebrow')} title={t('warehouse.shipments.title')} description={t('warehouse.shipments.description')} />
    <Select aria-label={t('warehouse.shipments.chooseMove')} showSearch optionFilterProp="label" value={id} onChange={setId} placeholder={t('warehouse.shipments.chooseMovePlaceholder')} style={{ width: '100%', maxWidth: 600 }} options={pickups.map(p => ({ value: p.id, label: p.pickupNumber + ' · ' + p.customerName }))} />
    {error && <Alert type="error" message={error} closable onClose={() => setError('')} />}
    {shipment && <><div className="operations-heading"><Typography.Title level={4}>{shipment.customerName}</Typography.Title><Space wrap><Tag color={shipment.packingConfirmed ? 'green' : 'orange'}>{shipment.packingConfirmed ? t('warehouse.shipments.packingConfirmed') : t('warehouse.shipments.packingNeedsConfirmation')}</Tag><Tag color={shipment.allPackagesDelivered ? 'green' : 'blue'}>{shipment.allPackagesDelivered ? t('warehouse.shipments.allDelivered') : t('warehouse.shipments.deliveryPending')}</Tag></Space></div>
      <Space wrap><Button type="primary" disabled={shipment.packingConfirmed || shipment.packages.length === 0} onClick={() => open('share')}>{t('warehouse.shipments.sharePackingList')}</Button><Popconfirm title={t('warehouse.shipments.revokeTitle')} okText={t('common.yes')} cancelText={t('common.no')} onConfirm={() => id && shipmentApi.revoke(id).then(() => { setLink(''); return reload() }).catch(fail)}><Button>{t('warehouse.shipments.revokeLink')}</Button></Popconfirm><Button onClick={() => open('claim')}>{t('warehouse.shipments.reportProblem')}</Button><Button onClick={() => reload().catch(fail)}>{t('common.refresh')}</Button></Space>
      {link && <Alert type="success" message={t('warehouse.shipments.linkReady')} description={<><Typography.Paragraph copyable={{ text: link }}>{link}</Typography.Paragraph><a href={link} target="_blank" rel="noopener noreferrer">{t('warehouse.shipments.openCustomerView')}</a><p>{t('warehouse.shipments.linkExpires')}</p></>} />}
      <div className="trip-cards">{shipment.packages.map(p => <Card key={p.id} title={p.trackingNumber} extra={<Tag>{movement(p.status)}</Tag>}><p>{t('warehouse.shipments.location', { location: p.location })}</p><p>{t('warehouse.shipments.receivedBy', { name: p.receivedBy || t('warehouse.shipments.awaitingHandover') })}</p>{p.updatedAtUtc && <p>{formatDateTime(p.updatedAtUtc)}</p>}<Button disabled={p.status === 'DELIVERED'} onClick={() => open('handover', p)}>{t('warehouse.shipments.recordHandover')}</Button></Card>)}</div>
      {shipment.packages.length === 0 && <Alert type="info" message={t('warehouse.shipments.noPackages')} />}
      <Typography.Title level={4}>{t('warehouse.shipments.history')}</Typography.Title><Table rowKey="id" dataSource={shipment.history} columns={[{ title: t('warehouse.shipments.col.package'), render: (_, h) => shipment.packages.find(p => p.id === h.packageId)?.trackingNumber }, { title: t('common.status'), dataIndex: 'status', render: (v: string) => movement(v) }, { title: t('warehouse.shipments.col.location'), dataIndex: 'location' }, { title: t('warehouse.shipments.col.receivedBy'), dataIndex: 'receivedBy' }, { title: t('common.time'), dataIndex: 'recordedAtUtc', render: (v: string) => formatDateTime(v) }, { title: t('common.notes'), dataIndex: 'notes' }]} scroll={{ x: 800 }} />
      <Typography.Title level={4}>{t('warehouse.shipments.claims')}</Typography.Title><div className="report-cards">{shipment.claims.map(c => <Card key={c.id} title={label('warehouse.shipments.claimCategory.', c.category) + ' · ' + label('warehouse.shipments.claimStatus.', c.status)}><p>{c.description}</p><p>{t('warehouse.shipments.owner', { name: c.owner })}</p>{c.resolution ? <p>{t('warehouse.shipments.resolution', { text: c.resolution })}</p> : <Button onClick={() => open('resolve', undefined, c)}>{t('warehouse.shipments.recordResolution')}</Button>}</Card>)}</div>
    </>}
    <Modal centered title={mode ? t('warehouse.shipments.modal.' + mode) : ''} open={!!mode} onCancel={() => !busy && setMode(null)} onOk={() => form.submit()} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={busy}>
      <Form form={form} layout="vertical" onFinish={submit}>
        {mode === 'share' && <><section className="packing-share-summary"><h3>{t('warehouse.shipments.shareSummary')}</h3><dl className="packing-share-facts"><div><dt>{t('warehouse.shipments.pickupReference')}</dt><dd>{shipment?.pickupNumber}</dd></div><div><dt>{t('common.customer')}</dt><dd>{shipment?.customerName}</dd></div><div><dt>{t('warehouse.shipments.packagesIncluded')}</dt><dd>{shipment?.packages.length ?? 0}</dd></div><div><dt>{t('warehouse.shipments.linkValidity')}</dt><dd>{t('warehouse.shipments.sevenDays')}</dd></div></dl></section><Alert type="info" message={t('warehouse.shipments.shareHint')} /><Form.Item name="leftBehindNotes" label={t('warehouse.shipments.leftBehind')} rules={required}><Input.TextArea rows={4} maxLength={2000} /></Form.Item></>}
        {mode === 'handover' && <><Form.Item name="status" label={t('warehouse.shipments.whereGoing')} rules={required}><Select options={allowed.map(value => ({ value, label: movement(value) }))} /></Form.Item><Form.Item name="location" label={t('warehouse.shipments.handoverLocation')} rules={required}><Input maxLength={500} /></Form.Item><Form.Item name="receivedBy" label={t('warehouse.shipments.receiverName')} rules={required}><Input maxLength={160} /></Form.Item><Form.Item name="notes" label={t('warehouse.shipments.handoverNotes')}><Input.TextArea maxLength={2000} /></Form.Item></>}
        {mode === 'claim' && <><Form.Item name="packageId" label={t('warehouse.shipments.packageOptional')}><Select allowClear options={shipment?.packages.map(p => ({ value: p.id, label: p.trackingNumber }))} /></Form.Item><Form.Item name="category" label={t('warehouse.shipments.problemType')} rules={required}><Select options={CLAIM_CATEGORIES.map(value => ({ value, label: t('warehouse.shipments.claimCategory.' + value) }))} /></Form.Item><Form.Item name="description" label={t('warehouse.shipments.whatHappened')} rules={required}><Input.TextArea rows={4} maxLength={2000} /></Form.Item><Form.Item name="owner" label={t('warehouse.shipments.whoResolves')} rules={required}><Input maxLength={160} /></Form.Item></>}
        {mode === 'resolve' && <Form.Item name="resolution" label={t('warehouse.shipments.resolutionLabel')} rules={required}><Input.TextArea rows={4} maxLength={2000} /></Form.Item>}
      </Form>
    </Modal>
  </div>
}
