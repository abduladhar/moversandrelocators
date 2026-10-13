import { useEffect, useMemo, useState } from 'react'
import { Alert, AutoComplete, Button, Checkbox, Form, Input, InputNumber, Result, Select, Spin, Tag, Typography, message } from 'antd'
import { CalendarOutlined, CheckCircleFilled, CheckCircleOutlined, DeleteOutlined, EnvironmentOutlined, HomeOutlined, InboxOutlined, LockOutlined, PaperClipOutlined, PlusOutlined, SendOutlined, UndoOutlined } from '@ant-design/icons'
import { publicSurveyApi } from '../api'
import { SurveyMapLink } from '../components/SurveyMapLink'
import { AttachmentList } from '../components/AttachmentList'
import { MediaCapture } from '../components/MediaCapture'
import type { CatalogItem, PublicSurvey, SurveyAttachment } from '../types'
import { formatDate, formatDateTime, formatNumber, useT } from '../i18n'

const localDateTime = (utc: string) => { const d = new Date(utc); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
const volume = (cbm: number) => formatNumber(cbm, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
type AddedItem = { key: string; roomName: string; householdItemId: string; quantity: number; notes: string }
type AddForm = { roomName: string; householdItemId: string; quantity: number; notes: string }

export function CustomerSurveyPage({ token }: { token: string }) {
  const { t } = useT()
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
  const cbm = (value: number) => t('customer.shared.cbm', { volume: volume(value) })
  const steps = [
    { key: 'appointment', label: t('customer.survey.stepAppointment'), done: Boolean(survey?.scheduleConfirmed) },
    { key: 'inventory', label: t('customer.survey.stepInventory'), done: Boolean(survey?.itemsConfirmed || survey?.customerChanges) },
    { key: 'files', label: t('customer.survey.stepFiles'), done: files.length > 0 },
  ]

  const fail = (e: unknown, fallback: string) => message.error(e instanceof Error ? e.message : fallback)
  const getLocation = () => { if (!navigator.geolocation) return message.error(t('customer.survey.locationUnsupported')); navigator.geolocation.getCurrentPosition(position => { setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }); message.success(t('customer.survey.locationAdded')) }, () => message.error(t('customer.survey.locationDenied')), { enableHighAccuracy: true, timeout: 15000 }) }
  const confirmSchedule = async () => { const value = await form.validateFields(); setSaving(true); try { setSurvey(await publicSurveyApi.confirmSchedule(token, { scheduledAtUtc: new Date(value.scheduledAtLocal).toISOString(), address: value.address, latitude: location?.latitude ?? null, longitude: location?.longitude ?? null, notes: value.notes })); message.success(t('customer.survey.appointmentConfirmed')) } catch (e) { fail(e, t('customer.survey.confirmFailed')) } finally { setSaving(false) } }
  const confirmItems = async () => { if (!accepted) return; setSaving(true); try { setSurvey(await publicSurveyApi.confirmItems(token, changeNotes)); message.success(t('customer.survey.inventoryConfirmed')) } catch (e) { fail(e, t('customer.survey.confirmFailed')) } finally { setSaving(false) } }
  const toggleRemove = (id: string) => setRemoved(current => { const next = { ...current }; if (id in next) delete next[id]; else next[id] = ''; return next })
  const addItem = async () => { const value = await addForm.validateFields(); setAdded(current => [...current, { key: crypto.randomUUID(), roomName: value.roomName.trim(), householdItemId: value.householdItemId, quantity: value.quantity, notes: value.notes?.trim() ?? '' }]); addForm.resetFields(); addForm.setFieldsValue({ quantity: 1, roomName: value.roomName }); setAddOpen(false) }
  const sendChanges = async () => {
    setSaving(true)
    try {
      setSurvey(await publicSurveyApi.submitChanges(token, { removedItems: Object.entries(removed).map(([surveyItemId, reason]) => ({ surveyItemId, reason })), addedItems: added.map(({ roomName, householdItemId, quantity, notes }) => ({ roomName, householdItemId, quantity, notes })), notes: changeNotes }))
      setRemoved({}); setAdded([]); setChangeNotes(''); message.success(t('customer.survey.changesSent'))
    } catch (e) { fail(e, t('customer.survey.sendChangesFailed')) } finally { setSaving(false) }
  }

  if (invalid) return <div className="cs-page cs-centered"><Result status="warning" title={t('customer.survey.unavailableTitle')} subTitle={t('customer.survey.unavailableText')} /></div>
  if (!survey) return <div className="cs-page cs-centered"><Spin size="large" /></div>

  return <div className="cs-page">
    <header className="cs-header"><div className="cs-header-inner"><div className="cs-brand"><span>{survey.tenantName.charAt(0).toUpperCase()}</span><strong>{survey.tenantName}</strong></div><span className="cs-secure"><LockOutlined /> {t('customer.survey.secureLink')}</span></div></header>
    <main className="cs-main">
      <section className="cs-hero">
        <Typography.Text className="cs-eyebrow">{t('customer.survey.eyebrow', { number: survey.surveyNumber })}</Typography.Text>
        <h1>{t('customer.survey.hello', { name: survey.customerName })}</h1>
        <p>{t('customer.survey.intro')}</p>
        <div className="cs-hero-meta"><span><CalendarOutlined /> {formatDateTime(survey.scheduledAtUtc)}</span><span><InboxOutlined /> {t('customer.survey.volumeSurveyed', { volume: cbm(survey.totalVolumeCbm) })}</span><span>{t('customer.survey.linkValidUntil', { date: formatDate(survey.expiresAtUtc) })}</span></div>
        <ol className="cs-steps">{steps.map((step, index) => <li key={step.key} className={step.done ? 'is-done' : ''}><span>{step.done ? <CheckCircleFilled /> : index + 1}</span>{step.label}</li>)}</ol>
      </section>

      <section className="cs-card">
        <div className="cs-card-head"><span className="cs-step-badge">1</span><div><h2>{t('customer.survey.step1Title')}</h2><p>{t('customer.survey.step1Text')}</p></div>{survey.scheduleConfirmed && <Tag className="cs-done-tag" icon={<CheckCircleOutlined />}>{t('customer.survey.confirmedTag')}</Tag>}</div>
        <Form form={form} layout="vertical" requiredMark={false} className="cs-form">
          <div className="cs-grid-2"><Form.Item label={t('customer.survey.dateTime')} name="scheduledAtLocal" rules={[{ required: true, message: t('customer.survey.chooseDateTime') }]}><Input type="datetime-local" /></Form.Item>
            <Form.Item label={t('customer.survey.yourLocation')}><Button block icon={<EnvironmentOutlined />} onClick={getLocation} className={location ? 'is-shared' : ''}>{location ? t('customer.survey.locationShared') : t('customer.survey.shareLocation')}</Button></Form.Item></div>
          <Form.Item label={t('customer.survey.surveyAddress')} name="address" rules={[{ required: true, message: t('customer.survey.enterAddress') }]}><Input.TextArea rows={2} placeholder={t('customer.survey.addressPlaceholder')} /></Form.Item>
          <div style={{ marginBottom: 16 }}><SurveyMapLink address={surveyAddress ?? survey.address} latitude={location?.latitude} longitude={location?.longitude} /></div><Form.Item label={t('customer.survey.notesForSurveyor')} name="notes"><Input.TextArea rows={2} placeholder={t('customer.survey.notesPlaceholder')} /></Form.Item>
          <Button type="primary" size="large" loading={saving} icon={<CheckCircleOutlined />} onClick={() => void confirmSchedule()}>{survey.scheduleConfirmed ? t('customer.survey.updateAppointment') : t('customer.survey.confirmAppointment')}</Button>
        </Form>
      </section>

      <section className="cs-card">
        <div className="cs-card-head"><span className="cs-step-badge">2</span><div><h2>{t('customer.survey.step2Title')}</h2><p>{t('customer.survey.step2Text')}</p></div>{survey.itemsConfirmed && <Tag className="cs-done-tag" icon={<CheckCircleOutlined />}>{t('customer.survey.confirmedTag')}</Tag>}</div>
        {survey.customerChanges && <Alert className="cs-alert" type="info" showIcon message={t('customer.survey.changesSentTitle')} description={t('customer.survey.changesSentText', { date: formatDateTime(survey.customerChanges.requestedAtUtc), removed: survey.customerChanges.removedItems.length, added: survey.customerChanges.addedItems.length })} />}
        {survey.rooms.length ? <div className="cs-rooms">{survey.rooms.map(room => <div key={room.id} className="cs-room">
          <div className="cs-room-head"><span><HomeOutlined /> {room.name}</span><small>{cbm(room.totalVolumeCbm)}</small></div>
          {room.items.map(item => { const marked = item.id in removed; return <div key={item.id} className={`cs-item ${marked ? 'is-removed' : ''}`}>
            <div className="cs-item-main"><strong>{item.itemName}</strong><small>{t('customer.shared.qty', { quantity: item.quantity })} · {cbm(item.totalVolumeCbm)}{item.notes ? ` · ${item.notes}` : ''}</small>
              {marked && <Input size="small" className="cs-reason" placeholder={t('customer.survey.reasonPlaceholder')} maxLength={300} value={removed[item.id]} onChange={e => setRemoved(current => ({ ...current, [item.id]: e.target.value }))} />}</div>
            <Button size="small" type={marked ? 'default' : 'text'} danger={!marked} icon={marked ? <UndoOutlined /> : <DeleteOutlined />} onClick={() => toggleRemove(item.id)}>{marked ? t('customer.survey.keep') : t('common.remove')}</Button>
          </div> })}
        </div>)}</div> : <div className="cs-empty">{t('customer.survey.noItems')}</div>}

        <div className="cs-additions">
          <div className="cs-additions-head"><h3>{t('customer.survey.additionalItems')}</h3>{!addOpen && <Button icon={<PlusOutlined />} onClick={() => { addForm.setFieldsValue({ quantity: 1 }); setAddOpen(true) }}>{t('customer.survey.addItem')}</Button>}</div>
          {added.map(item => <div key={item.key} className="cs-item is-added"><div className="cs-item-main"><strong>{catalogById.get(item.householdItemId)?.name}</strong><small>{item.roomName} · {t('customer.shared.qty', { quantity: item.quantity })}{item.notes ? ` · ${item.notes}` : ''}</small></div><Button size="small" type="text" aria-label={t('customer.survey.removeAdded')} title={t('customer.survey.removeAdded')} icon={<DeleteOutlined />} onClick={() => setAdded(current => current.filter(x => x.key !== item.key))} /></div>)}
          {addOpen && <Form form={addForm} layout="vertical" requiredMark={false} className="cs-add-form">
            <div className="cs-grid-2"><Form.Item label={t('common.room')} name="roomName" rules={[{ required: true, whitespace: true, message: t('customer.survey.enterRoom') }, { max: 120 }]}><AutoComplete options={roomNames.map(value => ({ value }))} placeholder={t('customer.survey.roomPlaceholder')} filterOption={(input, option) => String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())} /></Form.Item>
              <Form.Item label={t('common.item')} name="householdItemId" rules={[{ required: true, message: t('customer.survey.chooseItem') }]}><Select showSearch placeholder={t('customer.survey.searchItems')} optionFilterProp="label" options={catalog.map(x => ({ value: x.id, label: x.name }))} notFoundContent={t('customer.survey.noMatchingItems')} /></Form.Item></div>
            <div className="cs-grid-qty"><Form.Item label={t('common.quantity')} name="quantity" rules={[{ required: true, message: t('common.required') }]}><InputNumber min={1} max={100} precision={0} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('common.notes')} name="notes"><Input maxLength={300} placeholder={t('customer.survey.itemNotesPlaceholder')} /></Form.Item></div>
            <div className="cs-actions"><Button onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => void addItem()}>{t('customer.survey.addToList')}</Button></div>
          </Form>}
          {!added.length && !addOpen && <Typography.Text type="secondary" className="cs-muted">{t('customer.survey.nothingAdded')}</Typography.Text>}
        </div>

        <Form.Item label={t('customer.survey.anythingElse')} className="cs-notes" layout="vertical"><Input.TextArea rows={2} maxLength={2000} value={changeNotes} onChange={e => setChangeNotes(e.target.value)} placeholder={t('customer.survey.anythingElsePlaceholder')} /></Form.Item>
        <div className="cs-submit-bar">{changeCount > 0
          ? <><span>{t('customer.survey.changeSummary', { removed: Object.keys(removed).length, added: added.length })}</span><Button type="primary" size="large" icon={<SendOutlined />} loading={saving} onClick={() => void sendChanges()}>{t('customer.survey.sendChanges')}</Button></>
          : survey.rooms.length > 0 && <><Checkbox checked={accepted || survey.itemsConfirmed} disabled={survey.itemsConfirmed} onChange={event => setAccepted(event.target.checked)}>{t('customer.survey.itemsCorrect')}</Checkbox><Button type="primary" size="large" disabled={!accepted || survey.itemsConfirmed} loading={saving} icon={<CheckCircleOutlined />} onClick={() => void confirmItems()}>{survey.itemsConfirmed ? t('customer.survey.inventoryConfirmedButton') : t('customer.survey.confirmInventory')}</Button></>}</div>
      </section>

      <section className="cs-card">
        <div className="cs-card-head"><span className="cs-step-badge">3</span><div><h2>{t('customer.survey.step3Title')}</h2><p>{t('customer.survey.step3Text')}</p></div></div>
        <MediaCapture uploadFile={async file => { const saved = await publicSurveyApi.upload(token, file); setFiles(current => [saved, ...current]) }} />
        <div className="cs-files-head"><PaperClipOutlined /> {t('customer.survey.yourUploads')} <Tag>{files.length}</Tag></div>
        <AttachmentList files={files} emptyText={t('customer.survey.noFiles')} />
      </section>
      <footer className="cs-footer"><LockOutlined /> {t('customer.survey.footer', { name: survey.customerName })}</footer>
    </main>
  </div>
}
