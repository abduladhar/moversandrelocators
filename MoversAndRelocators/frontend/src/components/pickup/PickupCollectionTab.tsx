import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Card, Checkbox, Drawer, Empty, Form, Input, InputNumber, Modal, Popconfirm, Radio, Select, Space, Table, Tag, Timeline, Tooltip, Typography, Upload, message } from 'antd'
import { AppstoreAddOutlined, CameraOutlined, CheckCircleOutlined, DeleteOutlined, DownloadOutlined, HistoryOutlined, PlusOutlined, QuestionCircleOutlined, ScanOutlined, StopOutlined, UnlockOutlined, WarningOutlined } from '@ant-design/icons'
import type { BoxType, Warehouse } from '../../types'
import { pickupCollectionApi, type BoxCondition, type BoxStatus, type CollectionBox, type CollectionEvent, type PickupCollection, type SelectablePackingJob } from '../../pickupCollectionApi'

const STATUS: Record<BoxStatus, { label: string; color: string }> = {
  PENDING: { label: 'Not marked', color: 'default' },
  PICKED: { label: 'Picked', color: 'green' },
  EXCLUDED: { label: 'Not this pickup', color: 'blue' },
  MISSING: { label: 'Missing', color: 'red' },
}
const CONDITION: Record<BoxCondition, { label: string; color: string }> = {
  NOT_CHECKED: { label: 'Not checked', color: 'default' },
  OK: { label: 'Good', color: 'green' },
  DAMAGED: { label: 'Damaged', color: 'orange' },
}
const when = (x: string | null) => (x ? new Date(x).toLocaleString() : '—')

type Props = {
  pickupId: string
  warehouses: Warehouse[]
  /** Box types for adding a box inline, for goods the customer packed themselves. */
  boxTypes: BoxType[]
  /** Changes whenever the packing list is saved elsewhere, so the checklist picks those boxes up. */
  packingKey?: string
}

/** What this pickup collects: the packing jobs on it, and every expected box ticked off by list or scan. */
export function PickupCollectionTab({ pickupId, warehouses, boxTypes, packingKey }: Props) {
  const [data, setData] = useState<PickupCollection | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [addOpen, setAddOpen] = useState(false), [options, setOptions] = useState<SelectablePackingJob[]>([]), [chosen, setChosen] = useState<string[]>([])
  const [history, setHistory] = useState<{ title: string; items: CollectionEvent[] } | null>(null)
  const [addBoxOpen, setAddBoxOpen] = useState(false), [boxForm] = Form.useForm<{ boxTypeId: string; roomName?: string; isFragile: boolean; notes?: string; copies: number }>()
  const [check, setCheck] = useState<CollectionBox | null>(null), [condition, setCondition] = useState<BoxCondition>('OK'), [damageNotes, setDamageNotes] = useState('')
  const [approveOpen, setApproveOpen] = useState(false), [warehouseId, setWarehouseId] = useState<string | undefined>(undefined), [approveNotes, setApproveNotes] = useState('')
  const scanBox = useRef<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await pickupCollectionApi.get(pickupId)) }
    catch (e) { message.error(e instanceof Error ? e.message : 'Could not load the collection') }
    finally { setLoading(false) }
  }, [pickupId])
  useEffect(() => { void load() }, [load, packingKey])

  const run = async (action: () => Promise<PickupCollection>, done?: string) => {
    setBusy(true)
    try { setData(await action()); if (done) message.success(done) }
    catch (e) { message.error(e instanceof Error ? e.message : 'That did not work') }
    finally { setBusy(false) }
  }

  const openAdd = async () => {
    setChosen([]); setAddOpen(true)
    try { setOptions(await pickupCollectionApi.selectableJobs(pickupId)) }
    catch (e) { message.error(e instanceof Error ? e.message : 'Could not list packing jobs') }
  }

  const scan = async (code: string) => {
    const value = code.trim()
    if (!value) return
    await run(() => pickupCollectionApi.scan(pickupId, value), `${value} picked`)
    if (scanBox.current) scanBox.current.focus()
  }

  const showHistory = async (box?: CollectionBox) => {
    try {
      const items = await pickupCollectionApi.history(pickupId, box?.source, box?.boxId)
      setHistory({ title: box ? `Box ${box.trackingNumber}` : 'All changes', items })
    } catch (e) { message.error(e instanceof Error ? e.message : 'Could not load the history') }
  }

  const openCheck = (box: CollectionBox) => {
    setCheck(box)
    setCondition(box.condition === 'NOT_CHECKED' ? 'OK' : box.condition)
    setDamageNotes(box.conditionNotes ?? '')
  }
  // The drawer reads from the freshly loaded list, so uploads and condition changes show without reopening it.
  const checking = check ? data?.boxes.find(b => b.source === check.source && b.boxId === check.boxId) ?? check : null

  const addMedia = async (file: File) => {
    if (!checking) return false
    setBusy(true)
    try { await pickupCollectionApi.uploadMedia(pickupId, file, checking.source, checking.boxId); await load(); message.success(`${file.name} attached`) }
    catch (e) { message.error(e instanceof Error ? e.message : `Could not attach ${file.name}`) }
    finally { setBusy(false) }
    return false
  }

  const locked = data?.isApproved ?? false
  const counts = useMemo(() => data ? [
    { key: 'expected', label: 'Expected', value: data.expected },
    { key: 'picked', label: 'Picked', value: data.picked },
    { key: 'pending', label: 'Not marked', value: data.pending },
    { key: 'missing', label: 'Missing', value: data.missing },
    { key: 'excluded', label: 'Not this pickup', value: data.excluded },
    { key: 'damaged', label: 'Damaged', value: data.damaged },
  ] : [], [data])

  if (!data && loading) return <Card loading />
  if (!data) return <Empty description="Collection unavailable" />

  const fromJobs = data.boxes.filter(b => b.source === 'PACKING')
  const manualBoxes = data.boxes.filter(b => b.source === 'PICKUP')

  // One column set for both tables; the job column only earns its place in the packing-job list.
  const boxColumns = (showJob: boolean) => [
    { title: 'Label', render: (_: unknown, b: CollectionBox) => <Space direction="vertical" size={0}><b>{b.trackingNumber}</b>
      <Typography.Text type="secondary">{b.boxTypeName}{b.roomName ? ` · ${b.roomName}` : ''}{b.isFragile ? ' · fragile' : ''}</Typography.Text></Space> },
    ...(showJob ? [{ title: 'Job', width: 170, render: (_: unknown, b: CollectionBox) => b.packingJobNumber ? <Tag>{b.packingJobNumber}</Tag> : null }] : []),
    { title: 'Status', width: 150, render: (_: unknown, b: CollectionBox) => <Space direction="vertical" size={0}>
      <Tag color={STATUS[b.status].color}>{STATUS[b.status].label}</Tag>
      {b.statusReason && <Typography.Text type="secondary">{b.statusReason}</Typography.Text>}</Space> },
    { title: 'Condition', width: 180, render: (_: unknown, b: CollectionBox) => <Space direction="vertical" size={0}>
      <Space size={4}>
        <Tag color={CONDITION[b.condition].color} icon={b.condition === 'DAMAGED' ? <WarningOutlined /> : undefined}>{CONDITION[b.condition].label}</Tag>
        {b.media.length > 0 && <Tag icon={<CameraOutlined />}>{b.media.length}</Tag>}
      </Space>
      {b.conditionNotes && <Typography.Text type="secondary" ellipsis={{ tooltip: b.conditionNotes }} style={{ maxWidth: 160 }}>{b.conditionNotes}</Typography.Text>}
    </Space> },
    { title: 'Added by', width: 190, render: (_: unknown, b: CollectionBox) => <Space direction="vertical" size={0}>
      <span>{b.addedBy || '—'}</span><Typography.Text type="secondary">{when(b.addedAtUtc)}</Typography.Text></Space> },
    { title: 'Picked by', width: 200, render: (_: unknown, b: CollectionBox) => b.statusBy
      ? <Space direction="vertical" size={0}><span>{b.statusBy}</span><Typography.Text type="secondary">{when(b.statusAtUtc)}{b.method ? ` · ${b.method.toLowerCase()}` : ''}</Typography.Text></Space>
      : <Typography.Text type="secondary">—</Typography.Text> },
    { title: '', width: 230, render: (_: unknown, b: CollectionBox) => <Space size={4} wrap>
      {b.status !== 'PICKED' && <Button size="small" type="primary" disabled={locked || busy}
        onClick={() => run(() => pickupCollectionApi.setStatus(pickupId, { source: b.source, boxId: b.boxId, status: 'PICKED', method: 'LIST' }))}>Pick</Button>}
      {b.status === 'PICKED' && <Button size="small" disabled={locked || busy}
        onClick={() => run(() => pickupCollectionApi.setStatus(pickupId, { source: b.source, boxId: b.boxId, status: 'PENDING', method: 'LIST' }))}>Undo</Button>}
      <Tooltip title="Not collected on this pickup"><Button size="small" icon={<StopOutlined />} disabled={locked || busy || b.status === 'EXCLUDED'}
        onClick={() => run(() => pickupCollectionApi.setStatus(pickupId, { source: b.source, boxId: b.boxId, status: 'EXCLUDED', method: 'LIST' }))} /></Tooltip>
      <Tooltip title="Mark missing"><Button size="small" danger icon={<QuestionCircleOutlined />} disabled={locked || busy || b.status === 'MISSING'}
        onClick={() => run(() => pickupCollectionApi.setStatus(pickupId, { source: b.source, boxId: b.boxId, status: 'MISSING', method: 'LIST' }))} /></Tooltip>
      <Tooltip title="Check condition / attach photos"><Button size="small" icon={<CameraOutlined />} onClick={() => openCheck(b)} /></Tooltip>
      <Tooltip title="History"><Button size="small" icon={<HistoryOutlined />} onClick={() => void showHistory(b)} /></Tooltip>
    </Space> },
  ]

  return <Space direction="vertical" size={16} style={{ width: '100%' }}>
    {data.isApproved && data.approval && <Alert type="success" showIcon
      title={`Warehouse approved ${data.approval.pickedCount} box(es) on ${when(data.approval.approvedAtUtc)}`}
      description={<>By {data.approval.approvedBy}{data.approval.warehouseName ? ` · ${data.approval.warehouseName}` : ''}
        {data.approval.missingCount > 0 ? ` · ${data.approval.missingCount} missing` : ''}{data.approval.notes ? ` · ${data.approval.notes}` : ''}</>}
      action={data.canReopen && <Button size="small" icon={<UnlockOutlined />} onClick={() => {
        let reason = ''
        Modal.confirm({
          title: 'Reopen this collection?', okText: 'Reopen',
          content: <Input.TextArea rows={3} placeholder="Why is it being reopened?" onChange={e => { reason = e.target.value }} />,
          onOk: () => run(() => pickupCollectionApi.reopen(pickupId, reason), 'Collection reopened'),
        })
      }}>Reopen</Button>} />}

    {!locked && data.hasUnresolved && <Alert type="warning" showIcon
      title={`${data.pending} box(es) not marked${data.missing ? ` · ${data.missing} missing` : ''}`}
      description="Every box must be picked, marked missing, or removed from this pickup before the warehouse can approve it." />}

    <Card size="small">
      <Space wrap split={<Typography.Text type="secondary">·</Typography.Text>}>
        {counts.map(c => <span key={c.key}><Typography.Text type="secondary">{c.label}</Typography.Text> <b>{c.value}</b></span>)}
      </Space>
    </Card>

    <Card title="Packing jobs on this pickup" size="small"
      extra={<Button type="primary" icon={<PlusOutlined />} disabled={locked || busy} onClick={openAdd}>Add packing job</Button>}>
      {data.jobs.length === 0
        ? <Empty description="No packing job added yet" />
        : <Table<typeof data.jobs[number]> rowKey="id" size="small" pagination={false} dataSource={data.jobs} columns={[
          { title: 'Job', render: (_, j) => <Space direction="vertical" size={0}><b>{j.jobNumber}</b><Typography.Text type="secondary">{j.customerName}</Typography.Text></Space> },
          { title: 'Progress', width: 260, render: (_, j) => <Space wrap size={4}>
            <Tag color="green">{j.picked} picked</Tag>{j.pending > 0 && <Tag>{j.pending} not marked</Tag>}
            {j.missing > 0 && <Tag color="red">{j.missing} missing</Tag>}{j.excluded > 0 && <Tag color="blue">{j.excluded} not this pickup</Tag>}
          </Space> },
          { title: 'Added', width: 200, render: (_, j) => <Space direction="vertical" size={0}><span>{when(j.linkedAtUtc)}</span><Typography.Text type="secondary">{j.linkedBy}</Typography.Text></Space> },
          { title: '', width: 150, render: (_, j) => <Space size={4}>
            <Tooltip title="Mark every box on this job as picked"><Button size="small" disabled={locked || busy}
              onClick={() => run(() => pickupCollectionApi.bulk(pickupId, 'PICKED', j.id), `All boxes on ${j.jobNumber} picked`)}>Pick all</Button></Tooltip>
            <Popconfirm title={`Remove ${j.jobNumber}?`} description="Only works while none of its boxes are marked." okText="Remove"
              onConfirm={() => run(() => pickupCollectionApi.removeJob(pickupId, j.id), 'Packing job removed')}>
              <Button size="small" danger icon={<DeleteOutlined />} disabled={locked || busy} />
            </Popconfirm>
          </Space> },
        ]} />}
    </Card>

    <Card title={`Boxes (${data.expected})`} size="small" extra={<Space wrap>
      <Input.Search ref={scanBox} allowClear enterButton={<ScanOutlined />} placeholder="Scan or type a label" style={{ width: 260 }}
        disabled={locked || busy} onSearch={scan} />
      <Button disabled={locked || busy || data.pending === 0} onClick={() => run(() => pickupCollectionApi.bulk(pickupId, 'PICKED'), 'All boxes picked')}>Pick all</Button>
      <Button icon={<HistoryOutlined />} onClick={() => void showHistory()}>History</Button>
      <Button type="primary" icon={<CheckCircleOutlined />} disabled={locked || busy || data.expected === 0}
        onClick={() => { setWarehouseId(undefined); setApproveNotes(''); setApproveOpen(true) }}>Warehouse approval</Button>
    </Space>}>
      <Space direction="vertical" size={18} style={{ width: '100%' }}>
        <div>
          <Typography.Text strong>From packing jobs ({fromJobs.length})</Typography.Text>
          {fromJobs.length
            ? <Table<CollectionBox> rowKey={b => `${b.source}:${b.boxId}`} size="small" loading={loading} dataSource={fromJobs} pagination={false} columns={boxColumns(true)} style={{ marginTop: 8 }} />
            : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No packing job added yet" />}
        </div>
        <div>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Typography.Text strong>Packed at pickup ({manualBoxes.length})</Typography.Text>
            <Button size="small" icon={<AppstoreAddOutlined />} disabled={locked || busy} onClick={() => { boxForm.resetFields(); setAddBoxOpen(true) }}>Add box</Button>
          </Space>
          {manualBoxes.length
            ? <Table<CollectionBox> rowKey={b => `${b.source}:${b.boxId}`} size="small" loading={loading} dataSource={manualBoxes} pagination={false} columns={boxColumns(false)} style={{ marginTop: 8 }} />
            : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing packed at the pickup yet" />}
        </div>
      </Space>
    </Card>


    <Modal title="Add a box to this pickup" open={addBoxOpen} onCancel={() => setAddBoxOpen(false)} okText="Add"
      onOk={() => boxForm.validateFields().then(v =>
        run(() => pickupCollectionApi.addBox(pickupId, { boxTypeId: v.boxTypeId, roomName: v.roomName ?? null, isFragile: !!v.isFragile, notes: v.notes ?? null, copies: v.copies || 1 }),
          'Box added').then(() => setAddBoxOpen(false)))}>
      <Typography.Paragraph type="secondary">For goods the customer packed themselves. Each box gets its own label and joins the list as not marked, so whoever loads it is recorded separately from you.</Typography.Paragraph>
      <Form form={boxForm} layout="vertical" initialValues={{ isFragile: false, copies: 1 }}>
        <Form.Item name="boxTypeId" label="Box type" rules={[{ required: true, message: 'Choose a box type' }]}>
          <Select showSearch optionFilterProp="label" placeholder="Box type" options={boxTypes.map(b => ({ value: b.id, label: b.name }))} />
        </Form.Item>
        <Space size={12} style={{ width: '100%' }}>
          <Form.Item name="roomName" label="Room"><Input placeholder="Kitchen" maxLength={120} /></Form.Item>
          <Form.Item name="copies" label="How many"><InputNumber min={1} max={50} /></Form.Item>
          <Form.Item name="isFragile" label="Fragile" valuePropName="checked"><Checkbox /></Form.Item>
        </Space>
        <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} maxLength={500} placeholder="Packed by the customer" /></Form.Item>
      </Form>
    </Modal>

    <Modal title="Add packing jobs to this pickup" open={addOpen} onCancel={() => setAddOpen(false)} okText="Add"
      okButtonProps={{ disabled: chosen.length === 0 }}
      onOk={() => run(() => pickupCollectionApi.addJobs(pickupId, chosen), 'Packing job added').then(() => setAddOpen(false))}>
      <Typography.Paragraph type="secondary">Every box on the job is listed as expected straight away, so the crew sees the full count.</Typography.Paragraph>
      <Select mode="multiple" style={{ width: '100%' }} value={chosen} onChange={setChosen} placeholder="Search by job number, customer or address"
        showSearch filterOption={false} onSearch={async s => { try { setOptions(await pickupCollectionApi.selectableJobs(pickupId, s)) } catch { /* keep the list */ } }}
        options={options.map(o => ({
          value: o.id,
          label: `${o.jobNumber} · ${o.customerName} · ${o.remaining} of ${o.boxCount} box(es) left`,
          disabled: o.remaining === 0,
        }))} />
    </Modal>

    <Modal title="Warehouse approval" open={approveOpen} onCancel={() => setApproveOpen(false)} okText="Approve"
      onOk={() => run(() => pickupCollectionApi.approve(pickupId, { warehouseId, notes: approveNotes, acceptMissing: data.missing > 0 }), 'Collection approved').then(() => setApproveOpen(false))}>
      {data.pending > 0 && <Alert type="error" showIcon style={{ marginBottom: 12 }}
        title={`${data.pending} box(es) are still not marked`} description="Mark them picked, missing or not-this-pickup first." />}
      {data.missing > 0 && <Alert type="warning" showIcon style={{ marginBottom: 12 }}
        title={`${data.missing} box(es) are missing`} description="Approving confirms the shortage; the counts are frozen on the approval." />}
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Select allowClear style={{ width: '100%' }} placeholder="Receiving warehouse (optional)" value={warehouseId} onChange={setWarehouseId}
          options={warehouses.map(w => ({ value: w.id, label: w.name }))} />
        <Input.TextArea rows={3} placeholder="Notes" value={approveNotes} onChange={e => setApproveNotes(e.target.value)} maxLength={500} />
      </Space>
    </Modal>

    <Drawer title={checking ? `Condition · ${checking.trackingNumber}` : ''} open={!!checking} onClose={() => setCheck(null)} width={520}>
      {checking && <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert type="info" showIcon title="Check the box before it is loaded"
          description="Record damage as found, with photos or video as evidence. Both stay on the pickup's history." />

        <Radio.Group value={condition} onChange={e => setCondition(e.target.value)} disabled={locked || busy} optionType="button" buttonStyle="solid">
          <Radio.Button value="OK">Good</Radio.Button>
          <Radio.Button value="DAMAGED">Damaged</Radio.Button>
          <Radio.Button value="NOT_CHECKED">Not checked</Radio.Button>
        </Radio.Group>

        <Input.TextArea rows={3} value={damageNotes} maxLength={1000} disabled={locked || busy}
          placeholder={condition === 'DAMAGED' ? 'Describe the damage (required)' : 'Notes (optional)'}
          onChange={e => setDamageNotes(e.target.value)} />

        <Button type="primary" loading={busy} disabled={locked}
          onClick={() => run(() => pickupCollectionApi.setCondition(pickupId, { source: checking.source, boxId: checking.boxId, condition, notes: damageNotes }), 'Condition recorded')}>
          Save condition
        </Button>

        <Card size="small" title={`Photos, video and documents (${checking.media.length})`}
          extra={<Upload beforeUpload={addMedia} showUploadList={false} multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" disabled={locked || busy}>
            <Button icon={<CameraOutlined />} disabled={locked || busy}>Attach</Button>
          </Upload>}>
          {checking.media.length === 0
            ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing attached yet" />
            : <Space direction="vertical" size={6} style={{ width: '100%' }}>
              {checking.media.map(m => <Space key={m.id} style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space direction="vertical" size={0}>
                  <span>{m.fileName}{!m.isUploaded && <Tag color="gold" style={{ marginLeft: 6 }}>Incomplete</Tag>}</span>
                  <Typography.Text type="secondary">{Math.max(1, Math.round(m.sizeBytes / 1024))} KB · {m.uploadedBy} · {when(m.createdAtUtc)}</Typography.Text>
                </Space>
                <Space size={4}>
                  <Tooltip title="Download"><Button size="small" icon={<DownloadOutlined />} disabled={!m.isUploaded}
                    onClick={async () => { try { const { url } = await pickupCollectionApi.mediaDownload(pickupId, m.id); window.open(url, '_blank') } catch (e) { message.error(e instanceof Error ? e.message : 'Could not open it') } }} /></Tooltip>
                  <Popconfirm title="Remove this file?" onConfirm={async () => {
                    try { await pickupCollectionApi.deleteMedia(pickupId, m.id); await load(); message.success('File removed') }
                    catch (e) { message.error(e instanceof Error ? e.message : 'Could not remove it') }
                  }}><Button size="small" danger icon={<DeleteOutlined />} disabled={locked || busy} /></Popconfirm>
                </Space>
              </Space>)}
            </Space>}
        </Card>

        {checking.conditionBy && <Typography.Text type="secondary">Last checked by {checking.conditionBy} · {when(checking.conditionAtUtc)}</Typography.Text>}
      </Space>}
    </Drawer>

    <Drawer title={history?.title} open={!!history} onClose={() => setHistory(null)} width={520}>
      {history?.items.length
        ? <Timeline items={history.items.map(e => {
          // A condition check carries the condition in the method and leaves the status unchanged.
          const cond = e.method.startsWith('COND:') ? (e.method.slice(5) as BoxCondition) : null
          const colour = cond ? CONDITION[cond]?.color ?? 'gray' : STATUS[e.toStatus].color
          return {
            color: colour === 'default' ? 'gray' : colour,
            children: <Space direction="vertical" size={0}>
              <span><b>{cond ? `Condition: ${CONDITION[cond]?.label ?? cond}` : STATUS[e.toStatus].label}</b>
                {!cond && e.fromStatus && e.fromStatus !== e.toStatus ? ` (was ${STATUS[e.fromStatus].label.toLowerCase()})` : ''} · {e.trackingNumber}</span>
              <Typography.Text type="secondary">{e.actor} · {when(e.occurredAtUtc)}{cond ? '' : ` · ${e.method.toLowerCase()}`}</Typography.Text>
              {e.notes && <Typography.Text type="secondary">{e.notes}</Typography.Text>}
            </Space>,
          }
        })} />
        : <Empty description="Nothing recorded yet" />}
    </Drawer>
  </Space>
}
