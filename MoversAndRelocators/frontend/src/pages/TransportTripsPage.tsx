import {CurrencyFields,useCurrencies} from '../currency'
import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Tag, Typography, message } from 'antd'
import { PageHeader } from '../components/PageHeader'
import { operationsApi, readable, type Trip } from '../operationsApi'
import type { PickupChoice, VehicleChoice } from '../operationsApi'
import { formatDateTime, formatNumber, has, useT } from '../i18n'
const money = (v: number) => formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export function TransportTripsPage() {
  const { t } = useT()
  const statusLabel = (v: string) => has('operations.trips.status.' + v) ? t('operations.trips.status.' + v) : readable(v)
  const {data:currencyData}=useCurrencies()
  const [trips, setTrips] = useState<Trip[]>([]), [pickups, setPickups] = useState<PickupChoice[]>([]), [vehicles, setVehicles] = useState<VehicleChoice[]>([])
  const [error, setError] = useState(''), [creating, setCreating] = useState(false), [completing, setCompleting] = useState<Trip | null>(null), [busy, setBusy] = useState(false)
  const [form] = Form.useForm(), [completeForm] = Form.useForm()
  const fail = (e: unknown) => { const text = e instanceof Error ? e.message : t('operations.trips.saveFailed'); setError(text); message.error(text) }
  const load = async () => { try { const [tr, choices] = await Promise.all([operationsApi.trips(), operationsApi.tripChoices()]); setTrips(tr); setPickups(choices.pickups); setVehicles(choices.vehicles); setError('') } catch (e) { fail(e) } }
  useEffect(() => { void load() }, [])
  const submit = async (value: Record<string, unknown>) => {
    setBusy(true)
    try { await operationsApi.trip({ ...value, startedAtUtc: new Date(String(value.startedAtUtc)).toISOString() }); setCreating(false); message.success(t('operations.trips.planned')); await load() } catch (e) { fail(e) } finally { setBusy(false) }
  }
  const complete = async (value: Record<string, unknown>) => {
    if (!completing) return
    setBusy(true)
    try { await operationsApi.completeTrip(completing.trip.id, { ...value, version: completing.trip.version, completedAtUtc: new Date(String(value.completedAtUtc)).toISOString() }); setCompleting(null); message.success(t('operations.trips.completed')); await load() } catch (e) { fail(e) } finally { setBusy(false) }
  }
  const now = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
  const required = [{ required: true, message: t('common.required') }]
  const numeric = (name: string, label: string, min = 0) => <Form.Item className={/amount|cost|rate|price/i.test(name) ? "amount-field" : undefined} name={name} label={label} rules={required}><InputNumber controls={false} min={min} precision={2} style={{ width: '100%' }} /></Form.Item>
  return <div className="operations-workspace">
    <PageHeader onRefresh={load} eyebrow={t('operations.trips.eyebrow')} title={t('operations.trips.title')} description={t('operations.trips.description')} filters={<><Button type="primary" onClick={() => { form.resetFields(); form.setFieldsValue({ currency: currencyData?.settings.defaultCurrency||'AED', startedAtUtc: now(), allocations: [{ weight: 1 }] }); setCreating(true) }}>{t('operations.trips.plan')}</Button></>} />
    {error && <Alert type="error" message={error} closable onClose={() => setError('')} />}
    <Alert type="info" message={t('operations.trips.fuelHint')} />
    <div className="trip-cards">{trips.map(tr => <Card key={tr.trip.id} title={<Space>{tr.trip.number}<Tag color={tr.trip.status === 'COMPLETED' ? 'green' : 'blue'}>{statusLabel(tr.trip.status)}</Tag></Space>} extra={<span>{tr.trip.vehicleNumber}</span>}>
      <Typography.Title level={5}>{tr.trip.origin} → {tr.trip.destination}</Typography.Title><p>{t('operations.trips.started', { date: formatDateTime(tr.trip.startedAtUtc) })}</p>
      <p>{t('operations.trips.summary', { count: tr.allocations.length, km: tr.trip.kilometres, currency: tr.trip.currency, fuel: money(tr.trip.fuelCost), other: money(tr.trip.otherCost) })}</p>
      <ul>{tr.allocations.map(a => <li key={a.pickupId}>{t('operations.trips.allocation', { move: pickups.find(p => p.id === a.pickupId)?.pickupNumber ?? a.pickupId, weight: a.weight, fuel: money(a.fuelCost), other: money(a.otherCost) })}</li>)}</ul>
      <Space wrap><Button href={'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(tr.trip.origin) + '&destination=' + encodeURIComponent(tr.trip.destination) + '&travelmode=driving'} target="_blank" rel="noopener noreferrer">{t('operations.trips.openMaps')}</Button>{tr.trip.status === 'PLANNED' && <Button type="primary" onClick={() => { completeForm.resetFields(); completeForm.setFieldsValue({ otherCost: 0, endOdometer: tr.trip.startOdometer, completedAtUtc: now() }); setCompleting(tr) }}>{t('operations.trips.complete')}</Button>}</Space>
    </Card>)}</div>{trips.length === 0 && <Card>{t('operations.trips.empty')}</Card>}
    <Modal centered title={t('operations.trips.planTitle')} open={creating} onCancel={() => !busy && setCreating(false)} onOk={() => form.submit()} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={busy} width={780}>
      <Form form={form} layout="vertical" onFinish={submit} className="operations-form">
        <div className="auto-number-note">{t('operations.trips.autoNumber')}</div>
        <Form.Item name="vehicleId" label={t('operations.trips.vehicle')} rules={required}><Select options={vehicles.filter(v => v.isActive).map(v => ({ value: v.id, label: v.registrationNumber + ' · ' + v.name }))} /></Form.Item>
        <Form.Item name="origin" label={t('operations.trips.origin')} rules={required}><Input maxLength={500} /></Form.Item><Form.Item name="destination" label={t('operations.trips.destination')} rules={required}><Input maxLength={500} /></Form.Item>
        <Form.Item name="startedAtUtc" label={t('operations.trips.start')} rules={required}><Input type="datetime-local" /></Form.Item><CurrencyFields form={form} dateName="startedAtUtc"/>
        {numeric('startOdometer', t('operations.trips.startOdometer'))}{numeric('kmPerLitre', t('operations.trips.kmPerLitre'), 0.01)}{numeric('fuelPricePerLitre', t('operations.trips.fuelPrice'))}
        <div className="full-width"><Typography.Title level={5}>{t('operations.trips.sharing')}</Typography.Title><p>{t('operations.trips.sharingHint')}</p><Form.List name="allocations">{(fields, { add, remove }) => <>{fields.map(field => <Space key={field.key} align="baseline" className="allocation-row"><Form.Item name={[field.name, 'pickupId']} label={t('operations.trips.move')} rules={required}><Select showSearch optionFilterProp="label" options={pickups.map(p => ({ value: p.id, label: p.pickupNumber + ' · ' + p.customerName }))} style={{ minWidth: 200 }} /></Form.Item><Form.Item name={[field.name, 'weight']} label={t('operations.trips.weight')} rules={required}><InputNumber min={0.0001} max={1000000} precision={4} /></Form.Item><Button danger onClick={() => remove(field.name)}>{t('common.remove')}</Button></Space>)}<Button onClick={() => add({ weight: 1 })}>{t('operations.trips.addMove')}</Button></>}</Form.List></div>
      </Form>
    </Modal>
    <Modal centered title={completing ? t('operations.trips.completeTitle', { number: completing.trip.number }) : t('operations.trips.complete')} open={!!completing} onCancel={() => !busy && setCompleting(null)} onOk={() => completeForm.submit()} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={busy}>
      <Form form={completeForm} layout="vertical" onFinish={complete}><Alert type="info" message={t('operations.trips.startOdometerValue', { km: completing?.trip.startOdometer ?? 0 })} />{numeric('endOdometer', t('operations.trips.endOdometer'), completing?.trip.startOdometer ?? 0)}{numeric('otherCost', t('operations.trips.otherCost'))}<Form.Item name="completedAtUtc" label={t('operations.trips.completedAt')} rules={required}><Input type="datetime-local" /></Form.Item></Form>
    </Modal>
  </div>
}
