import { DataGrid as Table } from '../components/DataGrid'
import { movementLabel } from '../operationsApi'
import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Tag, Typography, message } from 'antd'
import { PageHeader } from '../components/PageHeader'
import { pickupsApi } from '../api'
import { shipmentApi, type Claim, type PackageLocation, type Shipment } from '../shipmentApi'
import type { Pickup } from '../types'
export function ShipmentsPage() {
  const [pickups, setPickups] = useState<Pickup[]>([]), [id, setId] = useState<string>(), [shipment, setShipment] = useState<Shipment | null>(null)
  const [error, setError] = useState(''), [link, setLink] = useState(''), [mode, setMode] = useState<'share' | 'handover' | 'claim' | 'resolve' | null>(null)
  const [selected, setSelected] = useState<PackageLocation | null>(null), [claim, setClaim] = useState<Claim | null>(null), [busy, setBusy] = useState(false)
  const [requestId, setRequestId] = useState(''), [form] = Form.useForm()
  const fail = (e: unknown) => { const text = e instanceof Error ? e.message : 'Unable to complete action.'; setError(text); message.error(text) }
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
      setMode(null); setError(''); message.success('Saved'); await reload()
    } catch (e) { fail(e) } finally { setBusy(false) }
  }
  const allowed = selected?.status === 'PACKED' ? ['WAREHOUSE', 'IN_TRANSIT'] : selected?.status === 'WAREHOUSE' ? ['IN_TRANSIT'] : selected?.status === 'IN_TRANSIT' ? ['WAREHOUSE', 'ARRIVED', 'DELIVERED'] : ['WAREHOUSE', 'DELIVERED']
  return <div className="operations-workspace">
    <PageHeader onRefresh={load} eyebrow="OPERATIONS" title="Shipment tracking" description="Confirm the packing list, record every handover, and resolve delivery issues." />
    <Select aria-label="Choose a move" showSearch optionFilterProp="label" value={id} onChange={setId} placeholder="Choose a move / pickup" style={{ width: '100%', maxWidth: 600 }} options={pickups.map(p => ({ value: p.id, label: p.pickupNumber + ' · ' + p.customerName }))} />
    {error && <Alert type="error" message={error} closable onClose={() => setError('')} />}
    {shipment && <><div className="operations-heading"><Typography.Title level={4}>{shipment.customerName}</Typography.Title><Space wrap><Tag color={shipment.packingConfirmed ? 'green' : 'orange'}>{shipment.packingConfirmed ? 'Packing confirmed' : 'Packing needs confirmation'}</Tag><Tag color={shipment.allPackagesDelivered ? 'green' : 'blue'}>{shipment.allPackagesDelivered ? 'All packages delivered' : 'Delivery pending'}</Tag></Space></div>
      <Space wrap><Button type="primary" disabled={shipment.packingConfirmed || shipment.packages.length === 0} onClick={() => open('share')}>Share packing list</Button><Popconfirm title="Revoke the customer link?" onConfirm={() => id && shipmentApi.revoke(id).then(() => { setLink(''); return reload() }).catch(fail)}><Button>Revoke link</Button></Popconfirm><Button onClick={() => open('claim')}>Report a problem</Button><Button onClick={() => reload().catch(fail)}>Refresh</Button></Space>
      {link && <Alert type="success" message="Customer link ready" description={<><Typography.Paragraph copyable={{ text: link }}>{link}</Typography.Paragraph><a href={link} target="_blank" rel="noopener noreferrer">Open customer view</a><p>Share this link with the customer. It expires in seven days.</p></>} />}
      <div className="trip-cards">{shipment.packages.map(p => <Card key={p.id} title={p.trackingNumber} extra={<Tag>{movementLabel(p.status)}</Tag>}><p>Location: {p.location}</p><p>Received by: {p.receivedBy || 'Awaiting handover'}</p>{p.updatedAtUtc && <p>{new Date(p.updatedAtUtc).toLocaleString()}</p>}<Button disabled={p.status === 'DELIVERED'} onClick={() => open('handover', p)}>Record handover</Button></Card>)}</div>
      {shipment.packages.length === 0 && <Alert type="info" message="Create packages in Pickup & packing first." />}
      <Typography.Title level={4}>Handover history</Typography.Title><Table rowKey="id" dataSource={shipment.history} columns={[{ title: 'Package', render: (_, h) => shipment.packages.find(p => p.id === h.packageId)?.trackingNumber }, { title: 'Status', dataIndex: 'status' }, { title: 'Location', dataIndex: 'location' }, { title: 'Received by', dataIndex: 'receivedBy' }, { title: 'Time', dataIndex: 'recordedAtUtc', render: (v: string) => new Date(v).toLocaleString() }, { title: 'Notes', dataIndex: 'notes' }]} scroll={{ x: 800 }} />
      <Typography.Title level={4}>Claims & issues</Typography.Title><div className="report-cards">{shipment.claims.map(c => <Card key={c.id} title={c.category + ' · ' + c.status}><p>{c.description}</p><p>Owner: {c.owner}</p>{c.resolution ? <p>Resolution: {c.resolution}</p> : <Button onClick={() => open('resolve', undefined, c)}>Record resolution</Button>}</Card>)}</div>
    </>}
    <Modal centered title={mode === 'share' ? 'Customer packing confirmation' : mode === 'handover' ? 'Record package handover' : mode === 'claim' ? 'Report a shipment issue' : 'Resolve issue'} open={!!mode} onCancel={() => !busy && setMode(null)} onOk={() => form.submit()} confirmLoading={busy}>
      <Form form={form} layout="vertical" onFinish={submit}>
        {mode === 'share' && <><section className="packing-share-summary"><h3>Packing list · Customer confirmation</h3><dl className="packing-share-facts"><div><dt>Pickup reference</dt><dd>{shipment?.pickupNumber}</dd></div><div><dt>Customer</dt><dd>{shipment?.customerName}</dd></div><div><dt>Packages included</dt><dd>{shipment?.packages.length ?? 0}</dd></div><div><dt>Link validity</dt><dd>7 days</dd></div></dl></section><Alert type="info" message="Review package contents before sharing. Editing is locked while shared, and stays locked once confirmed." /><Form.Item name="leftBehindNotes" label="Items left behind, excluded, or still unresolved (write None if none)" rules={[{ required: true }]}><Input.TextArea rows={4} maxLength={2000} /></Form.Item></>}
        {mode === 'handover' && <><Form.Item name="status" label="Where is it going?" rules={[{ required: true }]}><Select options={allowed.map(value => ({ value, label: value.replaceAll('_', ' ') }))} /></Form.Item><Form.Item name="location" label="Warehouse/bin, vehicle, or delivery address" rules={[{ required: true }]}><Input maxLength={500} /></Form.Item><Form.Item name="receivedBy" label="Receiving person's name" rules={[{ required: true }]}><Input maxLength={160} /></Form.Item><Form.Item name="notes" label="Condition, seal, and handover notes"><Input.TextArea maxLength={2000} /></Form.Item></>}
        {mode === 'claim' && <><Form.Item name="packageId" label="Package (optional)"><Select allowClear options={shipment?.packages.map(p => ({ value: p.id, label: p.trackingNumber }))} /></Form.Item><Form.Item name="category" label="Problem type" rules={[{ required: true }]}><Select options={['MISSING', 'DAMAGED', 'LEFT_BEHIND', 'LATE', 'OTHER'].map(value => ({ value, label: value.replaceAll('_', ' ') }))} /></Form.Item><Form.Item name="description" label="What happened?" rules={[{ required: true }]}><Input.TextArea rows={4} maxLength={2000} /></Form.Item><Form.Item name="owner" label="Who will resolve this?" rules={[{ required: true }]}><Input maxLength={160} /></Form.Item></>}
        {mode === 'resolve' && <Form.Item name="resolution" label="Resolution and any related financial document reference" rules={[{ required: true }]}><Input.TextArea rows={4} maxLength={2000} /></Form.Item>}
      </Form>
    </Modal>
  </div>
}



