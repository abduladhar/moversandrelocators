import { RefreshButton } from '../components/RefreshButton'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Card, Col, Empty, Form, Input, InputNumber, Modal, Popconfirm, Progress, Row, Select, Space, Statistic, Tabs, Tag, Typography, message } from 'antd'
import { AppstoreAddOutlined, ArrowLeftOutlined, BoxPlotOutlined, CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, DeleteOutlined, DollarOutlined, EditOutlined, EnvironmentOutlined, HomeOutlined, InboxOutlined, MessageOutlined, MinusCircleOutlined, PaperClipOutlined, PlusCircleOutlined, PlusOutlined, SaveOutlined, TeamOutlined } from '@ant-design/icons'
import { employeesApi, surveysApi } from '../api'
import { AttachmentList } from '../components/AttachmentList'
import { MediaCapture } from '../components/MediaCapture'
import { SurveyMapLink } from '../components/SurveyMapLink'
import { SurveyTripPanel } from '../components/SurveyTripPanel'
import type { Employee, HouseholdItem, PackingMaterial, SurveyAttachment, SurveyDetail, SurveyDetailsInput } from '../types'

type ItemDraft = SurveyDetailsInput['rooms'][number]['items'][number]
type RoomDraft = SurveyDetailsInput['rooms'][number]
type ItemForm = ItemDraft & { roomIndex: number; itemIndex?: number }

const roomColors = ['#176b52', '#315ca8', '#8b5b16', '#7a3f86', '#a33d4c', '#087d83']
const statusColor: Record<string, string> = { SCHEDULED: 'blue', CONFIRMED: 'cyan', IN_PROGRESS: 'orange', COMPLETED: 'green' }
const toDraft = (detail: SurveyDetail): SurveyDetailsInput => ({ rooms: detail.rooms.map(room => ({ name: room.name, displayOrder: room.displayOrder, items: room.items.map(item => ({ householdItemId: item.householdItemId, quantity: item.quantity, volumePerUnitCbm: item.volumePerUnitCbm, notes: item.notes ?? '' })) })), extraMaterials: detail.extraMaterials.map(x => ({ materialId: x.materialId, quantity: x.quantity })) })

export function SurveyDetailPage({ surveyId, onBack, onChanged }: { surveyId: string; onBack: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<SurveyDetail>(), [items, setItems] = useState<HouseholdItem[]>([]), [materials, setMaterials] = useState<PackingMaterial[]>([])
  const [draft, setDraft] = useState<SurveyDetailsInput>({ rooms: [], extraMaterials: [] }), [selectedRoom, setSelectedRoom] = useState(0), [saving, setSaving] = useState(false)
  const [roomOpen, setRoomOpen] = useState(false), [itemOpen, setItemOpen] = useState(false), [itemEditing, setItemEditing] = useState<{ roomIndex: number; itemIndex: number } | null>(null)
  const [extraMaterialId, setExtraMaterialId] = useState<string>(), [extraQuantity, setExtraQuantity] = useState(1)
  const [roomForm] = Form.useForm<{ name: string }>(), [itemForm] = Form.useForm<ItemForm>()
  const [files, setFiles] = useState<SurveyAttachment[]>([]), [reviewing, setReviewing] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  // Every room/item change is saved as soon as its popup is confirmed, so a refresh (common on phones and tablets) loses nothing.
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const draftRef = useRef(draft), savedRef = useRef<SurveyDetailsInput>({ rooms: [], extraMaterials: [] }), queue = useRef<Promise<unknown>>(Promise.resolve())
  const showDraft = (next: SurveyDetailsInput) => { draftRef.current = next; setDraft(next) }
  const markSaved = (survey: SurveyDetail) => { const saved = toDraft(survey); savedRef.current = saved; return saved }
  /**
   * Saves the inventory (rooms, items, extra materials); saves run one after another. When a save fails the screen
   * goes back to the last saved inventory and the popup stays open with what was typed, so Save can simply be pressed again.
   */
  const persist = (next: SurveyDetailsInput, done?: string): Promise<boolean> => {
    showDraft(next)
    const run = async () => {
      setSaving(true); setSaveState('saving')
      try { const updated = await surveysApi.saveDetails(surveyId, next); setDetail(updated); savedRef.current = next; setSaveState(draftRef.current === next ? 'saved' : 'saving'); onChanged(); if (done) message.success(done); return true }
      catch (error) { showDraft(savedRef.current); setSaveState('error'); fail(error, 'The change was not saved. Check the connection and try again.'); return false }
      finally { setSaving(false) }
    }
    const result = queue.current.then(run, run); queue.current = result; return result
  }
  const unsaved = JSON.stringify(draft) !== JSON.stringify(savedRef.current)

  const load = async () => {
    try {
      const [survey, itemMasters, materialMasters, attachments, staff] = await Promise.all([surveysApi.get(surveyId), surveysApi.items(), surveysApi.materials(), surveysApi.attachments(surveyId), employeesApi.employees()])
      setDetail(survey); setItems(itemMasters); setMaterials(materialMasters); setFiles(attachments); setEmployees(staff)
      showDraft(markSaved(survey)); setSaveState('saved')
    } catch (error) { message.error(error instanceof Error ? error.message : 'Unable to load survey') }
  }
  const fail = (error: unknown, fallback: string) => message.error(error instanceof Error ? error.message : fallback)
  const reviewCustomerChanges = async (action: 'apply' | 'dismiss') => {
    setReviewing(true)
    try { const updated = action === 'apply' ? await surveysApi.applyCustomerChanges(surveyId) : await surveysApi.dismissCustomerChanges(surveyId); setDetail(updated); showDraft(markSaved(updated)); setSaveState('saved'); setSelectedRoom(0); onChanged(); message.success(action === 'apply' ? 'Customer changes applied to the inventory' : 'Customer request dismissed') }
    catch (error) { fail(error, 'Unable to update the customer request') } finally { setReviewing(false) }
  }
  const uploadFile = async (file: File) => { const saved = await surveysApi.upload(surveyId, file); setFiles(current => [saved, ...current]) }
  const downloadFile = async (file: SurveyAttachment) => { try { const { url } = await surveysApi.attachmentDownload(surveyId, file.id); window.open(url, '_blank', 'noopener,noreferrer') } catch (error) { fail(error, 'Unable to download the file') } }
  const deleteFile = async (file: SurveyAttachment) => { try { await surveysApi.deleteAttachment(surveyId, file.id); setFiles(current => current.filter(x => x.id !== file.id)) } catch (error) { fail(error, 'Unable to remove the file') } }
  useEffect(() => { void load() }, [surveyId])

  const totalDraftVolume = useMemo(() => draft.rooms.reduce((total, room) => total + room.items.reduce((sum, item) => sum + item.quantity * (item.volumePerUnitCbm ?? 0), 0), 0), [draft])
  const addRoom = async () => {
    const value = await roomForm.validateFields(); const current = draftRef.current
    if (await persist({ ...current, rooms: [...current.rooms, { name: value.name.trim(), displayOrder: current.rooms.length + 1, items: [] }] }, 'Room saved')) { setSelectedRoom(current.rooms.length); setRoomOpen(false); roomForm.resetFields() }
  }
  const removeRoom = (index: number) => { const current = draftRef.current; void persist({ ...current, rooms: current.rooms.filter((_, i) => i !== index).map((room, i) => ({ ...room, displayOrder: i + 1 })) }, 'Room removed'); setSelectedRoom(value => Math.max(0, Math.min(value, current.rooms.length - 2))) }
  /** Typing changes the name on screen; it is saved when the field loses focus or Enter is pressed. */
  const renameRoom = (index: number, name: string) => showDraft({ ...draftRef.current, rooms: draftRef.current.rooms.map((room, i) => i === index ? { ...room, name } : room) })
  const commitRoomName = () => { const current = draftRef.current; if (JSON.stringify(current) === JSON.stringify(savedRef.current)) return; if (current.rooms.some(room => !room.name.trim())) { message.warning('Enter a room name.'); return } void persist(current, 'Room name saved') }
  const showItem = (roomIndex: number, itemIndex?: number) => {
    const existing = itemIndex === undefined ? undefined : draft.rooms[roomIndex].items[itemIndex]
    setItemEditing(itemIndex === undefined ? null : { roomIndex, itemIndex }); itemForm.setFieldsValue(existing ? { ...existing, roomIndex, itemIndex } : { roomIndex, householdItemId: '', quantity: 1, volumePerUnitCbm: 1, notes: '' }); setItemOpen(true)
  }
  const itemMasterChanged = (id: string) => { const master = items.find(x => x.id === id); if (master) itemForm.setFieldValue('volumePerUnitCbm', master.volumeCbm) }
  const saveItem = async () => {
    const value = await itemForm.validateFields(); const item: ItemDraft = { householdItemId: value.householdItemId, quantity: value.quantity, volumePerUnitCbm: value.volumePerUnitCbm, notes: value.notes ?? '' }
    const current = draftRef.current
    const next = { ...current, rooms: current.rooms.map((room, roomIndex) => roomIndex !== value.roomIndex ? room : { ...room, items: itemEditing ? room.items.map((old, itemIndex) => itemIndex === itemEditing.itemIndex ? item : old) : [...room.items, item] }) }
    // The popup stays open if saving fails, so nothing typed is lost.
    if (await persist(next, itemEditing ? 'Item saved' : 'Item added')) setItemOpen(false)
  }
  const removeItem = (roomIndex: number, itemIndex: number) => { const current = draftRef.current; void persist({ ...current, rooms: current.rooms.map((room, i) => i === roomIndex ? { ...room, items: room.items.filter((_, j) => j !== itemIndex) } : room) }, 'Item removed') }
  const addExtra = async () => { if (!extraMaterialId || extraQuantity <= 0) return; const current = draftRef.current; if (await persist({ ...current, extraMaterials: [...current.extraMaterials.filter(x => x.materialId !== extraMaterialId), { materialId: extraMaterialId, quantity: extraQuantity }] }, 'Material saved')) { setExtraMaterialId(undefined); setExtraQuantity(1) } }
  const removeExtra = (index: number) => { const current = draftRef.current; void persist({ ...current, extraMaterials: current.extraMaterials.filter((_, i) => i !== index) }, 'Material removed') }
  /** Recalculates the packing plan from the saved inventory. */
  const saveAll = () => persist(draftRef.current, 'Packing plan recalculated')
  const selected = draft.rooms[selectedRoom]

  if (!detail) return <Card loading />
  return <div className="survey-workspace">
    <div className="survey-workspace-header"><div className="survey-heading"><Button icon={<ArrowLeftOutlined />} aria-label="Back to surveys" onClick={onBack} /><div><Typography.Text className="eyebrow">SURVEY WORKSPACE</Typography.Text><Typography.Title level={2}>{detail.survey.surveyNumber}<span className="survey-heading-customer">{detail.survey.customerName}</span></Typography.Title></div></div><Space wrap className="survey-heading-actions"><RefreshButton onRefresh={load} disabled={saving || reviewing || roomOpen || itemOpen} confirmText={unsaved ? 'Refreshing will discard the change that has not been saved yet.' : undefined} /><Tag className="survey-status-tag" color={statusColor[detail.survey.status]}>{detail.survey.status.replaceAll('_', ' ')}</Tag>{saveState === 'error' ? <Tag className="survey-save-state" color="error">Last change not saved</Tag> : <Tag className="survey-save-state" color={saveState === 'saving' ? 'processing' : 'success'} icon={saveState === 'saving' ? <ClockCircleOutlined /> : <CheckCircleOutlined />}>{saveState === 'saving' ? 'Saving…' : 'All changes saved'}</Tag>}</Space></div>

    <div className="survey-kpi-row">{[
      { key: 'rooms', icon: <HomeOutlined />, label: 'Rooms', value: draft.rooms.length },
      { key: 'units', icon: <InboxOutlined />, label: 'Item units', value: draft.rooms.reduce((sum, room) => sum + room.items.reduce((x, item) => x + item.quantity, 0), 0) },
      { key: 'volume', icon: <BoxPlotOutlined />, label: 'Survey volume', value: totalDraftVolume.toFixed(3), unit: 'CBM' },
      { key: 'cost', icon: <DollarOutlined />, label: 'Material estimate', value: detail.packingPlan.estimatedMaterialCost.toFixed(2) },
    ].map(kpi => <div key={kpi.key} className={`survey-kpi survey-kpi-${kpi.key}`}><span className="survey-kpi-icon">{kpi.icon}</span><div><small>{kpi.label}</small><strong>{kpi.value}{kpi.unit && <em>{kpi.unit}</em>}</strong></div></div>)}</div>

    <Tabs className="survey-workspace-tabs" defaultActiveKey="overview" destroyOnHidden={false} items={[
      { key: 'overview', label: 'Overview', children: <>
<Card className="survey-customer-strip"><div className="survey-facts">{[
      { key: 'employee', icon: <TeamOutlined />, label: 'Surveyor', value: detail.survey.assignedEmployeeName },
      { key: 'time', icon: <CalendarOutlined />, label: 'Appointment', value: new Date(detail.survey.scheduledAtUtc).toLocaleString() },
      { key: 'address', icon: <EnvironmentOutlined />, label: 'Location', value: <Space direction="vertical" size={4}><span>{detail.survey.address}</span><SurveyMapLink address={detail.survey.address} latitude={detail.survey.latitude} longitude={detail.survey.longitude} /></Space> },
      { key: 'customer-time', icon: <ClockCircleOutlined />, label: 'Schedule confirmation', value: detail.survey.scheduleConfirmedAtUtc ? <Tag color="green">Confirmed</Tag> : <Tag color="gold">Pending</Tag> },
      { key: 'customer-items', icon: <CheckCircleOutlined />, label: 'Inventory confirmation', value: detail.customerChanges ? <Tag color="orange">Changes requested</Tag> : detail.survey.itemsConfirmedAtUtc ? <Tag color="green">Confirmed</Tag> : <Tag>Not requested</Tag> },
    ].map(fact => <div key={fact.key} className="survey-fact"><span className="survey-fact-icon">{fact.icon}</span><div><small>{fact.label}</small><div className="survey-fact-value">{fact.value}</div></div></div>)}</div></Card>
      </> },
      { key: 'inventory', label: `Rooms & items (${draft.rooms.length})`, children: <>
<div className="survey-entry-layout">
      <Card className="room-rail" title={<Space><HomeOutlined />Rooms</Space>} extra={<Tag>{draft.rooms.length}</Tag>}>
        <div className="room-list">{draft.rooms.map((room, index) => <button type="button" key={`${room.displayOrder}-${index}`} className={`room-nav-card ${selectedRoom === index ? 'is-selected' : ''}`} style={{ '--room-color': roomColors[index % roomColors.length] } as React.CSSProperties} onClick={() => setSelectedRoom(index)}><span className="room-icon"><HomeOutlined /></span><span><strong>{room.name}</strong><small>{room.items.length} item type{room.items.length === 1 ? '' : 's'} · {room.items.reduce((sum, x) => sum + x.quantity * (x.volumePerUnitCbm ?? 0), 0).toFixed(3)} CBM</small></span></button>)}</div>
        {!draft.rooms.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Add the first room" />}
        <Button block type="dashed" icon={<PlusOutlined />} onClick={() => setRoomOpen(true)}>Add room</Button>
      </Card>

      <Card className="room-editor" title={selected ? <Space><span className="room-title-icon" style={{ background: roomColors[selectedRoom % roomColors.length] }}><HomeOutlined /></span><Input className="room-name-input" variant="borderless" aria-label="Room name" value={selected.name} onChange={event => renameRoom(selectedRoom, event.target.value)} onBlur={commitRoomName} onPressEnter={event => (event.target as HTMLInputElement).blur()} /></Space> : 'Select a room'} extra={selected && <Space><Tag className="survey-volume-badge">{selected.items.reduce((sum, x) => sum + x.quantity * (x.volumePerUnitCbm ?? 0), 0).toFixed(3)} CBM</Tag><Popconfirm title="Remove this room and all its items?" onConfirm={() => removeRoom(selectedRoom)}><Button danger type="text" icon={<DeleteOutlined />} /></Popconfirm></Space>}>
        {selected ? <><div className="room-section-heading"><div><Typography.Title level={4}>Items in this room</Typography.Title><Typography.Text type="secondary">Add each household item and confirm its count and volume.</Typography.Text></div><Button type="primary" icon={<AppstoreAddOutlined />} onClick={() => showItem(selectedRoom)}>Add item</Button></div>
          <div className="survey-item-grid">{selected.items.map((item, index) => { const master = items.find(x => x.id === item.householdItemId); return <div key={`${item.householdItemId}-${index}`} className="survey-tile">
            <div className="survey-tile-head"><span className="survey-tile-icon"><InboxOutlined /></span><strong title={master?.name}>{master?.name ?? 'Household item'}</strong><Space size={0} className="survey-tile-actions"><Button size="small" type="text" aria-label="Edit item" icon={<EditOutlined />} onClick={() => showItem(selectedRoom, index)} /><Popconfirm title="Remove this item?" onConfirm={() => removeItem(selectedRoom, index)}><Button size="small" type="text" danger aria-label="Remove item" icon={<DeleteOutlined />} /></Popconfirm></Space></div>
            <dl className="survey-tile-metrics"><div><dt>Count</dt><dd>{item.quantity}</dd></div><div><dt>Each <em>CBM</em></dt><dd>{item.volumePerUnitCbm?.toFixed(3)}</dd></div><div><dt>Total <em>CBM</em></dt><dd>{(item.quantity * (item.volumePerUnitCbm ?? 0)).toFixed(3)}</dd></div></dl>
            {item.notes && <p className="survey-tile-note">{item.notes}</p>}</div> })}</div>
          {!selected.items.length && <Empty description="No items in this room yet"><Button type="primary" icon={<PlusOutlined />} onClick={() => showItem(selectedRoom)}>Add first item</Button></Empty>}</> : <Empty className="room-editor-empty" description="Add a room to begin the survey"><Button type="primary" icon={<PlusOutlined />} onClick={() => setRoomOpen(true)}>Add room</Button></Empty>}
      </Card>
    </div>
      </> },
      { key: 'packing', label: 'Packing plan', children: <>
        <Typography.Paragraph type="secondary">Rooms, items and extra materials are saved as you add them, and the packing estimate is recalculated each time.</Typography.Paragraph>
<Card className="survey-materials-card" title={<Space><AppstoreAddOutlined />Extra packing materials</Space>} extra={<Tag>{draft.extraMaterials.length} selected</Tag>}><div className="extra-material-entry"><Select showSearch optionFilterProp="label" placeholder="Choose bubble wrap or another material" value={extraMaterialId} onChange={setExtraMaterialId} options={materials.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.name} · ${x.currentUnitCost}/${x.unit}` }))} /><InputNumber aria-label="Quantity" style={{ width: '100%' }} min={0.001} precision={3} value={extraQuantity} onChange={value => setExtraQuantity(value ?? 1)} /><Button type="primary" icon={<PlusOutlined />} loading={saving} onClick={() => void addExtra()}>Add material</Button></div><div className="material-chip-list">{draft.extraMaterials.map((extra, index) => { const material = materials.find(x => x.id === extra.materialId); return <Tag key={extra.materialId} className="survey-chip" closable onClose={event => { event.preventDefault(); removeExtra(index) }}><strong>{material?.name}</strong>{extra.quantity} {material?.unit}</Tag> })}</div></Card>

    <Card className="packing-result-card" title={<Space><BoxPlotOutlined />Packing plan and quotation input</Space>} extra={<Button icon={<SaveOutlined />} loading={saving} onClick={() => void saveAll()}>Recalculate plan</Button>}>
      <Row gutter={[12, 12]} className="packing-stats"><Col xs={12} md={6}><Statistic title="Saved volume" value={detail.packingPlan.itemsVolumeCbm} suffix="CBM" precision={3} /></Col><Col xs={12} md={6}><Statistic title="Boxes required" value={detail.packingPlan.boxes.length} /></Col><Col xs={12} md={6}><Statistic title="Total capacity" value={detail.packingPlan.boxCapacityCbm} suffix="CBM" precision={3} /></Col><Col xs={12} md={6}><Statistic title="Material cost" value={detail.packingPlan.estimatedMaterialCost} precision={2} /></Col></Row>
      {detail.packingPlan.boxCapacityCbm > 0 && <div className="packing-capacity"><div><span>Box capacity used</span><b>{Math.min(100, Math.round(detail.packingPlan.itemsVolumeCbm / detail.packingPlan.boxCapacityCbm * 100))}%</b></div><Progress percent={Math.min(100, Math.round(detail.packingPlan.itemsVolumeCbm / detail.packingPlan.boxCapacityCbm * 100))} showInfo={false} /></div>}
      {detail.packingPlan.unboxedItems.length > 0 && <Alert type="warning" showIcon message={`${detail.packingPlan.unboxedItems.length} item(s) need a larger box type`} />}
      <div className="planned-box-grid">{detail.packingPlan.boxes.map(box => <div key={box.number} className="survey-tile">
        <div className="survey-tile-head"><span className="survey-tile-icon"><BoxPlotOutlined /></span><strong>Box {box.number}</strong><Tag className="survey-tile-tag">{box.boxTypeName}</Tag></div>
        <div className="survey-tile-usage"><span>{box.usedCbm.toFixed(3)} of {box.capacityCbm.toFixed(3)} CBM</span><b>{Math.round(box.usedCbm / box.capacityCbm * 100)}%</b></div>
        <Progress percent={Math.round(box.usedCbm / box.capacityCbm * 100)} showInfo={false} size="small" />
        <div className="survey-tile-contents">{box.contents.map((x, i) => <span key={i}>{x.roomName} · {x.itemName}</span>)}</div></div>)}</div>
    </Card>
      </> },
      { key: 'files', label: `Photos & files (${files.length})`, children: <>
<Card className="survey-files-card" title={<Space><PaperClipOutlined />Attachments</Space>} extra={<Tag>{files.length}</Tag>}>
      <Typography.Paragraph type="secondary" className="survey-files-hint">Photos, videos, voice notes and documents from the survey visit and from the customer's link. Customers only see the files they uploaded.</Typography.Paragraph>
      <div className="survey-files-layout">
        <MediaCapture uploadFile={uploadFile} note="Record on site or attach existing files. Maximum 500 MB per file. Camera and microphone need HTTPS or localhost." />
        <div><h4 className="survey-files-heading">Uploaded files</h4><AttachmentList files={files} showSource emptyText="No attachments yet" onDownload={file => void downloadFile(file)} onDelete={file => void deleteFile(file)} /></div>
      </div>
    </Card>
      </> },
      { key: 'trip', label: 'Trip & expenses', children: <>
<SurveyTripPanel detail={detail} employees={employees} onUpdated={updated => { setDetail(updated); onChanged() }} />
      </> },
      { key: 'review', label: <Space size={6}>Customer review{detail.customerChanges && <Tag color="orange">Pending</Tag>}</Space>, children: <>
{detail.customerChanges && <Card className="customer-change-card" title={<Space><MessageOutlined />Customer requested changes</Space>} extra={<Typography.Text type="secondary">Sent {new Date(detail.customerChanges.requestedAtUtc).toLocaleString()}</Typography.Text>}>
      <div className="customer-change-grid">
        <div><h4><MinusCircleOutlined /> Remove ({detail.customerChanges.removedItems.length})</h4>{detail.customerChanges.removedItems.length ? detail.customerChanges.removedItems.map(x => <div key={x.surveyItemId} className="customer-change-row is-removed"><strong>{x.itemName}</strong><small>{x.roomName} · Qty {x.quantity}{x.reason ? ` · “${x.reason}”` : ''}</small></div>) : <Typography.Text type="secondary">No removals</Typography.Text>}</div>
        <div><h4><PlusCircleOutlined /> Add ({detail.customerChanges.addedItems.length})</h4>{detail.customerChanges.addedItems.length ? detail.customerChanges.addedItems.map((x, i) => <div key={i} className="customer-change-row is-added"><strong>{x.itemName}</strong><small>{x.roomName} · Qty {x.quantity} · {(x.quantity * x.volumePerUnitCbm).toFixed(3)} CBM{x.notes ? ` · “${x.notes}”` : ''}</small></div>) : <Typography.Text type="secondary">No additions</Typography.Text>}</div>
      </div>
      {detail.customerChanges.notes && <Alert className="customer-change-notes" type="info" showIcon message="Customer note" description={detail.customerChanges.notes} />}
      <div className="customer-change-actions"><Popconfirm title="Dismiss this request without changing the inventory?" okText="Dismiss" onConfirm={() => void reviewCustomerChanges('dismiss')}><Button loading={reviewing}>Dismiss</Button></Popconfirm>
        <Popconfirm title="Apply these changes to the saved inventory?" description="Unsaved edits on this page will be replaced by the saved inventory." okText="Apply" onConfirm={() => void reviewCustomerChanges('apply')}><Button type="primary" icon={<CheckCircleOutlined />} loading={reviewing}>Apply to inventory</Button></Popconfirm></div>
    </Card>}
        {!detail.customerChanges && <Card><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={detail.survey.itemsConfirmedAtUtc ? 'The customer has confirmed the inventory. No changes are waiting for review.' : 'No customer changes to review yet.'} /></Card>}
      </> },
    ]} />
    <Modal centered title="Add a room" open={roomOpen} onCancel={() => setRoomOpen(false)} onOk={() => void addRoom()} okText="Save room" confirmLoading={saving} destroyOnHidden><Form form={roomForm} layout="vertical"><Form.Item label="Room name" name="name" rules={[{ required: true, message: 'Enter a room name' }]}><Input size="large" prefix={<HomeOutlined />} placeholder="Living room, master bedroom…" /></Form.Item></Form></Modal>
    <Modal centered title={itemEditing ? 'Edit household item' : `Add item to ${selected?.name ?? 'room'}`} open={itemOpen} onCancel={() => setItemOpen(false)} onOk={() => void saveItem()} okText="Save item" confirmLoading={saving} destroyOnHidden><Form form={itemForm} layout="vertical"><Form.Item name="roomIndex" hidden><InputNumber /></Form.Item><Form.Item label="Household item" name="householdItemId" rules={[{ required: true }]}><Select size="large" showSearch optionFilterProp="label" onChange={itemMasterChanged} options={items.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.name} · ${x.volumeCbm.toFixed(3)} CBM each` }))} /></Form.Item><div className="master-form-grid"><Form.Item label="Count" name="quantity" rules={[{ required: true }]}><InputNumber min={1} precision={0} size="large" style={{ width: '100%' }} /></Form.Item><Form.Item label="Volume per item (CBM)" name="volumePerUnitCbm" rules={[{ required: true }]}><InputNumber min={0.001} precision={3} size="large" style={{ width: '100%' }} /></Form.Item></div><Form.Item label="Handling notes" name="notes"><Input.TextArea rows={3} placeholder="Fragile, dismantling required, special handling…" /></Form.Item></Form></Modal>
  </div>
}

