import { useEffect, useMemo, useState } from 'react'
import { Alert, AutoComplete, Button, Checkbox, Form, Input, InputNumber, Result, Select, Spin, Tag, Typography, message } from 'antd'
import { CalendarOutlined, CheckCircleFilled, CheckCircleOutlined, DeleteOutlined, EnvironmentOutlined, HomeOutlined, InboxOutlined, LockOutlined, PaperClipOutlined, PlusOutlined, SendOutlined, UndoOutlined } from '@ant-design/icons'
import { publicSurveyApi } from '../api'
import { SurveyMapLink } from '../components/SurveyMapLink'
import { AttachmentList } from '../components/AttachmentList'
import { MediaCapture } from '../components/MediaCapture'
import type { CatalogItem, PublicSurvey, SurveyAttachment } from '../types'

const localDateTime = (utc: string) => { const d = new Date(utc); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
type AddedItem = { key: string; roomName: string; householdItemId: string; quantity: number; notes: string }
type AddForm = { roomName: string; householdItemId: string; quantity: number; notes: string }

export function CustomerSurveyPage({ token }: { token: string }) {
  const [survey, setSurvey] = useState<PublicSurvey>(), [invalid, setInvalid] = useState(false), [saving, setSaving] = useState(false), [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null), [accepted, setAccepted] = useState(false)
  const [catalog, setCatalog] = useState<CatalogItem[]>([]), [files, setFiles] = useState<SurveyAttachment[]>([])
  const [removed, setRemoved] = useState<Record<string, string>>({}), [added, setAdded] = useState<AddedItem[]>([]), [addOpen, setAddOpen] = useState(false), [changeNotes, setChangeNotes] = useState('')
  const [form] = Form.useForm<{ scheduledAtLocal: string; address: string; notes: string }>(), [addForm] = Form.useForm<AddForm>()

  useEffect(() => {
    publicSurveyApi.get(token).then(x => { setSurvey(x); form.setFieldsValue({ scheduledAtLocal: localDateTime(x.scheduledAtUtc), address: x.address, notes: '' }) }).catch(() => setInvalid(true))
    publicSurveyApi.catalog(token).then(setCatalog).catch(() => setCatalog([]))
    publicSurveyApi.attachments(token).then(setFiles).catch(() => setFiles([]))
  }, [token, form])

  const surveyAddress = Form.useWatch('address', form)
  const roomNames = useMemo(() => [...new Set([...(survey?.rooms.map(r => r.name) ?? []), ...added.map(a => a.roomName)])], [survey, added])
  const catalogById = useMemo(() => new Map(catalog.map(x => [x.id, x])), [catalog])
  const changeCount = Object.keys(removed).length + added.length
  const steps = [
    { key: 'appointment', label: 'Appointment', done: Boolean(survey?.scheduleConfirmed) },
    { key: 'inventory', label: 'Inventory', done: Boolean(survey?.itemsConfirmed || survey?.customerChanges) },
    { key: 'files', label: 'Photos & documents', done: files.length > 0 },
  ]

  const fail = (e: unknown, fallback: string) => message.error(e instanceof Error ? e.message : fallback)
  const getLocation = () => { if (!navigator.geolocation) return message.error('Location sharing is not supported on this device.'); navigator.geolocation.getCurrentPosition(position => { setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }); message.success('Current location added') }, () => message.error('Allow location access or enter the address manually.'), { enableHighAccuracy: true, timeout: 15000 }) }
  const confirmSchedule = async () => { const value = await form.validateFields(); setSaving(true); try { setSurvey(await publicSurveyApi.confirmSchedule(token, { scheduledAtUtc: new Date(value.scheduledAtLocal).toISOString(), address: value.address, latitude: location?.latitude ?? null, longitude: location?.longitude ?? null, notes: value.notes })); message.success('Appointment confirmed') } catch (e) { fail(e, 'Unable to confirm') } finally { setSaving(false) } }
  const confirmItems = async () => { if (!accepted) return; setSaving(true); try { setSurvey(await publicSurveyApi.confirmItems(token, changeNotes)); message.success('Inventory confirmed') } catch (e) { fail(e, 'Unable to confirm') } finally { setSaving(false) } }
  const toggleRemove = (id: string) => setRemoved(current => { const next = { ...current }; if (id in next) delete next[id]; else next[id] = ''; return next })
  const addItem = async () => { const value = await addForm.validateFields(); setAdded(current => [...current, { key: crypto.randomUUID(), roomName: value.roomName.trim(), householdItemId: value.householdItemId, quantity: value.quantity, notes: value.notes?.trim() ?? '' }]); addForm.resetFields(); addForm.setFieldsValue({ quantity: 1, roomName: value.roomName }); setAddOpen(false) }
  const sendChanges = async () => {
    setSaving(true)
    try {
      setSurvey(await publicSurveyApi.submitChanges(token, { removedItems: Object.entries(removed).map(([surveyItemId, reason]) => ({ surveyItemId, reason })), addedItems: added.map(({ roomName, householdItemId, quantity, notes }) => ({ roomName, householdItemId, quantity, notes })), notes: changeNotes }))
      setRemoved({}); setAdded([]); setChangeNotes(''); message.success('Your changes were sent to your move coordinator')
    } catch (e) { fail(e, 'Unable to send changes') } finally { setSaving(false) }
  }

  if (invalid) return <div className="cs-page cs-centered"><Result status="warning" title="Survey link unavailable" subTitle="This link is invalid or has expired. Please contact your move coordinator for a new link." /></div>
  if (!survey) return <div className="cs-page cs-centered"><Spin size="large" /></div>

  return <div className="cs-page">
    <header className="cs-header"><div className="cs-header-inner"><div className="cs-brand"><span>{survey.tenantName.charAt(0).toUpperCase()}</span><strong>{survey.tenantName}</strong></div><span className="cs-secure"><LockOutlined /> Secure link</span></div></header>
    <main className="cs-main">
      <section className="cs-hero">
        <Typography.Text className="cs-eyebrow">MOVING SURVEY · {survey.surveyNumber}</Typography.Text>
        <h1>Hello {survey.customerName}</h1>
        <p>Please confirm your survey appointment, review the items we will move, and share any photos or documents that help us plan.</p>
        <div className="cs-hero-meta"><span><CalendarOutlined /> {new Date(survey.scheduledAtUtc).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span><span><InboxOutlined /> {survey.totalVolumeCbm.toFixed(3)} CBM surveyed</span><span>Link valid until {new Date(survey.expiresAtUtc).toLocaleDateString([], { dateStyle: 'medium' })}</span></div>
        <ol className="cs-steps">{steps.map((step, index) => <li key={step.key} className={step.done ? 'is-done' : ''}><span>{step.done ? <CheckCircleFilled /> : index + 1}</span>{step.label}</li>)}</ol>
      </section>

      <section className="cs-card">
        <div className="cs-card-head"><span className="cs-step-badge">1</span><div><h2>Confirm your appointment</h2><p>Check the date, time and address where our surveyor should meet you.</p></div>{survey.scheduleConfirmed && <Tag className="cs-done-tag" icon={<CheckCircleOutlined />}>Confirmed</Tag>}</div>
        <Form form={form} layout="vertical" requiredMark={false} className="cs-form">
          <div className="cs-grid-2"><Form.Item label="Date and time" name="scheduledAtLocal" rules={[{ required: true, message: 'Choose a date and time' }]}><Input type="datetime-local" /></Form.Item>
            <Form.Item label="Your location"><Button block icon={<EnvironmentOutlined />} onClick={getLocation} className={location ? 'is-shared' : ''}>{location ? 'Current location shared' : 'Share my current location'}</Button></Form.Item></div>
          <Form.Item label="Survey address" name="address" rules={[{ required: true, message: 'Enter the survey address' }]}><Input.TextArea rows={2} placeholder="Building, street, area, city" /></Form.Item>
          <div style={{ marginBottom: 16 }}><SurveyMapLink address={surveyAddress ?? survey.address} latitude={location?.latitude} longitude={location?.longitude} /></div><Form.Item label="Notes for the surveyor" name="notes"><Input.TextArea rows={2} placeholder="Gate code, parking, best contact time…" /></Form.Item>
          <Button type="primary" size="large" loading={saving} icon={<CheckCircleOutlined />} onClick={() => void confirmSchedule()}>{survey.scheduleConfirmed ? 'Update appointment' : 'Confirm appointment'}</Button>
        </Form>
      </section>

      <section className="cs-card">
        <div className="cs-card-head"><span className="cs-step-badge">2</span><div><h2>Review your inventory</h2><p>Remove anything you no longer want moved, or add items the surveyor missed. Your coordinator reviews every change.</p></div>{survey.itemsConfirmed && <Tag className="cs-done-tag" icon={<CheckCircleOutlined />}>Confirmed</Tag>}</div>
        {survey.customerChanges && <Alert className="cs-alert" type="info" showIcon message="Changes sent for review" description={<>Sent {new Date(survey.customerChanges.requestedAtUtc).toLocaleString()}: {survey.customerChanges.removedItems.length} removal(s) and {survey.customerChanges.addedItems.length} addition(s). Your coordinator will update the inventory. Sending new changes replaces this request.</>} />}
        {survey.rooms.length ? <div className="cs-rooms">{survey.rooms.map(room => <div key={room.id} className="cs-room">
          <div className="cs-room-head"><span><HomeOutlined /> {room.name}</span><small>{room.totalVolumeCbm.toFixed(3)} CBM</small></div>
          {room.items.map(item => { const marked = item.id in removed; return <div key={item.id} className={`cs-item ${marked ? 'is-removed' : ''}`}>
            <div className="cs-item-main"><strong>{item.itemName}</strong><small>Qty {item.quantity} · {item.totalVolumeCbm.toFixed(3)} CBM{item.notes ? ` · ${item.notes}` : ''}</small>
              {marked && <Input size="small" className="cs-reason" placeholder="Reason (optional)" maxLength={300} value={removed[item.id]} onChange={e => setRemoved(current => ({ ...current, [item.id]: e.target.value }))} />}</div>
            <Button size="small" type={marked ? 'default' : 'text'} danger={!marked} icon={marked ? <UndoOutlined /> : <DeleteOutlined />} onClick={() => toggleRemove(item.id)}>{marked ? 'Keep' : 'Remove'}</Button>
          </div> })}
        </div>)}</div> : <div className="cs-empty">Your surveyor has not entered items yet. You can still add items you want moved below.</div>}

        <div className="cs-additions">
          <div className="cs-additions-head"><h3>Additional items</h3>{!addOpen && <Button icon={<PlusOutlined />} onClick={() => { addForm.setFieldsValue({ quantity: 1 }); setAddOpen(true) }}>Add an item</Button>}</div>
          {added.map(item => <div key={item.key} className="cs-item is-added"><div className="cs-item-main"><strong>{catalogById.get(item.householdItemId)?.name}</strong><small>{item.roomName} · Qty {item.quantity}{item.notes ? ` · ${item.notes}` : ''}</small></div><Button size="small" type="text" aria-label="Remove added item" icon={<DeleteOutlined />} onClick={() => setAdded(current => current.filter(x => x.key !== item.key))} /></div>)}
          {addOpen && <Form form={addForm} layout="vertical" requiredMark={false} className="cs-add-form">
            <div className="cs-grid-2"><Form.Item label="Room" name="roomName" rules={[{ required: true, whitespace: true, message: 'Enter a room' }, { max: 120 }]}><AutoComplete options={roomNames.map(value => ({ value }))} placeholder="e.g. Living room" filterOption={(input, option) => String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())} /></Form.Item>
              <Form.Item label="Item" name="householdItemId" rules={[{ required: true, message: 'Choose an item' }]}><Select showSearch placeholder="Search items" optionFilterProp="label" options={catalog.map(x => ({ value: x.id, label: x.name }))} notFoundContent="No matching items" /></Form.Item></div>
            <div className="cs-grid-qty"><Form.Item label="Quantity" name="quantity" rules={[{ required: true }]}><InputNumber min={1} max={100} precision={0} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="Notes" name="notes"><Input maxLength={300} placeholder="Size, fragile, needs dismantling…" /></Form.Item></div>
            <div className="cs-actions"><Button onClick={() => setAddOpen(false)}>Cancel</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => void addItem()}>Add to list</Button></div>
          </Form>}
          {!added.length && !addOpen && <Typography.Text type="secondary" className="cs-muted">Nothing added yet.</Typography.Text>}
        </div>

        <Form.Item label="Anything else we should know?" className="cs-notes" layout="vertical"><Input.TextArea rows={2} maxLength={2000} value={changeNotes} onChange={e => setChangeNotes(e.target.value)} placeholder="Items going to storage, things you will pack yourself…" /></Form.Item>
        <div className="cs-submit-bar">{changeCount > 0
          ? <><span><b>{Object.keys(removed).length}</b> to remove · <b>{added.length}</b> to add</span><Button type="primary" size="large" icon={<SendOutlined />} loading={saving} onClick={() => void sendChanges()}>Send changes for review</Button></>
          : survey.rooms.length > 0 && <><Checkbox checked={accepted || survey.itemsConfirmed} disabled={survey.itemsConfirmed} onChange={event => setAccepted(event.target.checked)}>The rooms and items above are correct.</Checkbox><Button type="primary" size="large" disabled={!accepted || survey.itemsConfirmed} loading={saving} icon={<CheckCircleOutlined />} onClick={() => void confirmItems()}>{survey.itemsConfirmed ? 'Inventory confirmed' : 'Confirm inventory'}</Button></>}</div>
      </section>

      <section className="cs-card">
        <div className="cs-card-head"><span className="cs-step-badge">3</span><div><h2>Photos & documents</h2><p>Share photos or videos of large or fragile items, building access, or any documents such as floor plans or inventories.</p></div></div>
        <MediaCapture uploadFile={async file => { const saved = await publicSurveyApi.upload(token, file); setFiles(current => [saved, ...current]) }} />
        <div className="cs-files-head"><PaperClipOutlined /> Your uploads <Tag>{files.length}</Tag></div>
        <AttachmentList files={files} emptyText="No files uploaded yet" />
      </section>
      <footer className="cs-footer"><LockOutlined /> This private link is for {survey.customerName}. Please don't forward it.</footer>
    </main>
  </div>
}
