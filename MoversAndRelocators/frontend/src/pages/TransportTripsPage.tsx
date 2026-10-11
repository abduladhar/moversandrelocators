import {CurrencyFields,useCurrencies} from '../currency'
import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Tag, Typography, message } from 'antd'
import { PageHeader } from '../components/PageHeader'
import { operationsApi, type Trip } from '../operationsApi'
import type { PickupChoice, VehicleChoice } from '../operationsApi'
export function TransportTripsPage() {
  const {data:currencyData}=useCurrencies()
  const [trips, setTrips] = useState<Trip[]>([]), [pickups, setPickups] = useState<PickupChoice[]>([]), [vehicles, setVehicles] = useState<VehicleChoice[]>([])
  const [error, setError] = useState(''), [creating, setCreating] = useState(false), [completing, setCompleting] = useState<Trip | null>(null), [busy, setBusy] = useState(false)
  const [form] = Form.useForm(), [completeForm] = Form.useForm()
  const fail = (e: unknown) => { const text = e instanceof Error ? e.message : 'Unable to save trip.'; setError(text); message.error(text) }
  const load = async () => { try { const [t, choices] = await Promise.all([operationsApi.trips(), operationsApi.tripChoices()]); setTrips(t); setPickups(choices.pickups); setVehicles(choices.vehicles); setError('') } catch (e) { fail(e) } }
  useEffect(() => { void load() }, [])
  const submit = async (value: Record<string, unknown>) => {
    setBusy(true)
    try { await operationsApi.trip({ ...value, startedAtUtc: new Date(String(value.startedAtUtc)).toISOString() }); setCreating(false); message.success('Trip planned'); await load() } catch (e) { fail(e) } finally { setBusy(false) }
  }
  const complete = async (value: Record<string, unknown>) => {
    if (!completing) return
    setBusy(true)
    try { await operationsApi.completeTrip(completing.trip.id, { ...value, version: completing.trip.version, completedAtUtc: new Date(String(value.completedAtUtc)).toISOString() }); setCompleting(null); message.success('Trip completed and costs allocated'); await load() } catch (e) { fail(e) } finally { setBusy(false) }
  }
  const now = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
  const numeric = (name: string, label: string, min = 0) => <Form.Item className={/amount|cost|rate|price/i.test(name) ? "amount-field" : undefined} name={name} label={label} rules={[{ required: true }]}><InputNumber controls={false} min={min} precision={2} style={{ width: '100%' }} /></Form.Item>
  return <div className="operations-workspace">
    <PageHeader onRefresh={load} eyebrow="OPERATIONS" title="Transport & consolidation" description="Plan shared vehicle trips and record distance-based fuel cost." filters={<><Button type="primary" onClick={() => { form.resetFields(); form.setFieldsValue({ currency: currencyData?.settings.defaultCurrency||'AED', startedAtUtc: now(), allocations: [{ weight: 1 }] }); setCreating(true) }}>Plan a trip</Button></>} />
    {error && <Alert type="error" message={error} closable onClose={() => setError('')} />}
    <Alert type="info" message="Fuel = actual kilometres ÷ vehicle km/litre × fuel price. Allocation weights determine each move's share. Enter only additional non-fuel trip costs when completing." />
    <div className="trip-cards">{trips.map(t => <Card key={t.trip.id} title={<Space>{t.trip.number}<Tag color={t.trip.status === 'COMPLETED' ? 'green' : 'blue'}>{t.trip.status}</Tag></Space>} extra={<span>{t.trip.vehicleNumber}</span>}>
      <Typography.Title level={5}>{t.trip.origin} → {t.trip.destination}</Typography.Title><p>Started: {new Date(t.trip.startedAtUtc).toLocaleString()}</p>
      <p>{t.allocations.length} move(s) · {t.trip.kilometres} km · Fuel {t.trip.currency} {t.trip.fuelCost.toFixed(2)} · Other {t.trip.otherCost.toFixed(2)}</p>
      <ul>{t.allocations.map(a => <li key={a.pickupId}>{pickups.find(p => p.id === a.pickupId)?.pickupNumber ?? a.pickupId} — weight {a.weight}; fuel share {a.fuelCost.toFixed(2)}, other {a.otherCost.toFixed(2)}</li>)}</ul>
      <Space wrap><Button href={'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(t.trip.origin) + '&destination=' + encodeURIComponent(t.trip.destination) + '&travelmode=driving'} target="_blank" rel="noopener noreferrer">Open Google Maps</Button>{t.trip.status === 'PLANNED' && <Button type="primary" onClick={() => { completeForm.resetFields(); completeForm.setFieldsValue({ otherCost: 0, endOdometer: t.trip.startOdometer, completedAtUtc: now() }); setCompleting(t) }}>Complete trip</Button>}</Space>
    </Card>)}</div>{trips.length === 0 && <Card>No trips yet. Plan a trip after creating a pickup and vehicle.</Card>}
    <Modal centered title="Plan transport" open={creating} onCancel={() => !busy && setCreating(false)} onOk={() => form.submit()} confirmLoading={busy} width={780}>
      <Form form={form} layout="vertical" onFinish={submit} className="operations-form">
        <div className="auto-number-note">Number assigned automatically on save</div>
        <Form.Item name="vehicleId" label="Vehicle" rules={[{ required: true }]}><Select options={vehicles.filter(v => v.isActive).map(v => ({ value: v.id, label: v.registrationNumber + ' · ' + v.name }))} /></Form.Item>
        <Form.Item name="origin" label="Starting address" rules={[{ required: true }]}><Input maxLength={500} /></Form.Item><Form.Item name="destination" label="Destination address" rules={[{ required: true }]}><Input maxLength={500} /></Form.Item>
        <Form.Item name="startedAtUtc" label="Start (local time)" rules={[{ required: true }]}><Input type="datetime-local" /></Form.Item><CurrencyFields form={form} dateName="startedAtUtc"/>
        {numeric('startOdometer', 'Start odometer (km)')}{numeric('kmPerLitre', 'Vehicle fuel efficiency (km/litre)', 0.01)}{numeric('fuelPricePerLitre', 'Fuel price per litre')}
        <div className="full-width"><Typography.Title level={5}>Moves sharing this trip</Typography.Title><p>Use volume × distance, or your approved allocation basis, consistently for all moves.</p><Form.List name="allocations">{(fields, { add, remove }) => <>{fields.map(field => <Space key={field.key} align="baseline" className="allocation-row"><Form.Item name={[field.name, 'pickupId']} label="Move" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={pickups.map(p => ({ value: p.id, label: p.pickupNumber + ' · ' + p.customerName }))} style={{ minWidth: 200 }} /></Form.Item><Form.Item name={[field.name, 'weight']} label="Allocation weight" rules={[{ required: true }]}><InputNumber min={0.0001} max={1000000} precision={4} /></Form.Item><Button danger onClick={() => remove(field.name)}>Remove</Button></Space>)}<Button onClick={() => add({ weight: 1 })}>Add a move</Button></>}</Form.List></div>
      </Form>
    </Modal>
    <Modal centered title={'Complete ' + (completing?.trip.number ?? 'trip')} open={!!completing} onCancel={() => !busy && setCompleting(null)} onOk={() => completeForm.submit()} confirmLoading={busy}>
      <Form form={completeForm} layout="vertical" onFinish={complete}><Alert type="info" message={'Start odometer: ' + (completing?.trip.startOdometer ?? 0) + ' km'} />{numeric('endOdometer', 'End odometer (km)', completing?.trip.startOdometer ?? 0)}{numeric('otherCost', 'Other trip costs (exclude fuel)')}<Form.Item name="completedAtUtc" label="Completed (local time)" rules={[{ required: true }]}><Input type="datetime-local" /></Form.Item></Form>
    </Modal>
  </div>
}



