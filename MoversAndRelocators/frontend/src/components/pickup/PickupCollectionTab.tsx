import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Card, Checkbox, Drawer, Empty, Form, Input, InputNumber, Modal, Popconfirm, Radio, Select, Space, Table, Tag, Timeline, Tooltip, Typography, Upload, message } from 'antd'
import { AppstoreAddOutlined, CameraOutlined, CheckCircleOutlined, DeleteOutlined, DownloadOutlined, HistoryOutlined, PlusOutlined, QuestionCircleOutlined, ScanOutlined, StopOutlined, UnlockOutlined, WarningOutlined } from '@ant-design/icons'
import type { BoxType, Warehouse } from '../../types'
import { formatDateTime, has, useT } from '../../i18n'
import { pickupCollectionApi, type BoxCondition, type BoxStatus, type CollectionBox, type CollectionEvent, type PickupCollection, type SelectablePackingJob } from '../../pickupCollectionApi'

// Labels are keys under pickups.collection.status / .condition, translated at render.
const STATUS: Record<BoxStatus, { color: string }> = {
  PENDING: { color: 'default' },
  PICKED: { color: 'green' },
  EXCLUDED: { color: 'blue' },
  MISSING: { color: 'red' },
}
const CONDITION: Record<BoxCondition, { color: string }> = {
  NOT_CHECKED: { color: 'default' },
  OK: { color: 'green' },
  DAMAGED: { color: 'orange' },
}
const when = (x: string | null) => (x ? formatDateTime(x) : '—')

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
  const { t } = useT()
  const statusLabel = (s: BoxStatus) => t('pickups.collection.status.' + s)
  const conditionLabel = (c: BoxCondition) => t('pickups.collection.condition.' + c)
  const methodLabel = (m: string) => has('pickups.collection.method.' + m) ? t('pickups.collection.method.' + m) : m.toLowerCase()

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await pickupCollectionApi.get(pickupId)) }
    catch (e) { message.error(e instanceof Error ? e.message : t('pickups.collection.loadFailed')) }
    finally { setLoading(false) }
  }, [pickupId])
  useEffect(() => { void load() }, [load, packingKey])

  const run = async (action: () => Promise<PickupCollection>, done?: string) => {
    setBusy(true)
    try { setData(await action()); if (done) message.success(done) }
    catch (e) { message.error(e instanceof Error ? e.message : t('pickups.actionFailed')) }
    finally { setBusy(false) }
  }

  const openAdd = async () => {
    setChosen([]); setAddOpen(true)
    try { setOptions(await pickupCollectionApi.selectableJobs(pickupId)) }
    catch (e) { message.error(e instanceof Error ? e.message : t('pickups.collection.jobsFailed')) }
  }

  const scan = async (code: string) => {
    const value = code.trim()
    if (!value) return
    await run(() => pickupCollectionApi.scan(pickupId, value), t('pickups.collection.scanPicked', { label: value }))
    if (scanBox.current) scanBox.current.focus()
  }

  const showHistory = async (box?: CollectionBox) => {
    try {
      const items = await pickupCollectionApi.history(pickupId, box?.source, box?.boxId)
      setHistory({ title: box ? t('pickups.collection.boxTitle', { number: box.trackingNumber }) : t('pickups.collection.allChanges'), items })
    } catch (e) { message.error(e instanceof Error ? e.message : t('pickups.collection.historyFailed')) }
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
    try { await pickupCollectionApi.uploadMedia(pickupId, file, checking.source, checking.boxId); await load(); message.success(t('pickups.collection.attached', { name: file.name })) }
    catch (e) { message.error(e instanceof Error ? e.message : t('pickups.collection.attachFailed', { name: file.name })) }
    finally { setBusy(false) }
    return false
  }

  const locked = data?.isApproved ?? false
  const counts = useMemo(() => data ? [
    { key: 'expected', label: t('pickups.collection.expected'), value: data.expected },
    { key: 'picked', label: statusLabel('PICKED'), value: data.picked },
    { key: 'pending', label: statusLabel('PENDING'), value: data.pending },
    { key: 'missing', label: statusLabel('MISSING'), value: data.missing },
    { key: 'excluded', label: statusLabel('EXCLUDED'), value: data.excluded },
    { key: 'damaged', label: conditionLabel('DAMAGED'), value: data.damaged },
  ] : [], [data, t])

  if (!data && loading) return <Card loading />
  if (!data) return <Empty description={t('pickups.collection.unavailable')} />

  const fromJobs = data.boxes.filter(b => b.source === 'PACKING')
  const manualBoxes = data.boxes.filter(b => b.source === 'PICKUP')

  // One column set for both tables; the job column only earns its place in the packing-job list.
  const boxColumns = (showJob: boolean) => [
    { title: t('pickups.collection.colLabel'), render: (_: unknown, b: CollectionBox) => <Space direction="vertical" size={0}><b>{b.trackingNumber}</b>
      <Typography.Text type="secondary">{b.boxTypeName}{b.roomName ? ` · ${b.roomName}` : ''}{b.isFragile ? ` · ${t('pickups.fragileLower')}` : ''}</Typography.Text></Space> },
    ...(showJob ? [{ title: t('pickups.collection.colJob'), width: 170, render: (_: unknown, b: CollectionBox) => b.packingJobNumber ? <Tag>{b.packingJobNumber}</Tag> : null }] : []),
    { title: t('common.status'), width: 150, render: (_: unknown, b: CollectionBox) => <Space direction="vertical" size={0}>
      <Tag color={STATUS[b.status].color}>{statusLabel(b.status)}</Tag>
      {b.statusReason && <Typography.Text type="secondary">{b.statusReason}</Typography.Text>}</Space> },
    { title: t('pickups.collection.colCondition'), width: 180, render: (_: unknown, b: CollectionBox) => <Space direction="vertical" size={0}>
      <Space size={4}>
        <Tag color={CONDITION[b.condition].color} icon={b.condition === 'DAMAGED' ? <WarningOutlined /> : undefined}>{conditionLabel(b.condition)}</Tag>
        {b.media.length > 0 && <Tag icon={<CameraOutlined />}>{b.media.length}</Tag>}
      </Space>
      {b.conditionNotes && <Typography.Text type="secondary" ellipsis={{ tooltip: b.conditionNotes }} style={{ maxWidth: 160 }}>{b.conditionNotes}</Typography.Text>}
    </Space> },
    { title: t('pickups.collection.colAddedBy'), width: 190, render: (_: unknown, b: CollectionBox) => <Space direction="vertical" size={0}>
      <span>{b.addedBy || '—'}</span><Typography.Text type="secondary">{when(b.addedAtUtc)}</Typography.Text></Space> },
    { title: t('pickups.collection.colPickedBy'), width: 200, render: (_: unknown, b: CollectionBox) => b.statusBy
      ? <Space direction="vertical" size={0}><span>{b.statusBy}</span><Typography.Text type="secondary">{when(b.statusAtUtc)}{b.method ? ` · ${methodLabel(b.method)}` : ''}</Typography.Text></Space>
      : <Typography.Text type="secondary">—</Typography.Text> },
    { title: '', width: 230, render: (_: unknown, b: CollectionBox) => <Space size={4} wrap>
      {b.status !== 'PICKED' && <Button size="small" type="primary" disabled={locked || busy}
        onClick={() => run(() => pickupCollectionApi.setStatus(pickupId, { source: b.source, boxId: b.boxId, status: 'PICKED', method: 'LIST' }))}>{t('pickups.collection.pick')}</Button>}
      {b.status === 'PICKED' && <Button size="small" disabled={locked || busy}
        onClick={() => run(() => pickupCollectionApi.setStatus(pickupId, { source: b.source, boxId: b.boxId, status: 'PENDING', method: 'LIST' }))}>{t('pickups.collection.undo')}</Button>}
      <Tooltip title={t('pickups.collection.notCollectedTip')}><Button size="small" icon={<StopOutlined />} disabled={locked || busy || b.status === 'EXCLUDED'}
        onClick={() => run(() => pickupCollectionApi.setStatus(pickupId, { source: b.source, boxId: b.boxId, status: 'EXCLUDED', method: 'LIST' }))} /></Tooltip>
      <Tooltip title={t('pickups.collection.markMissing')}><Button size="small" danger icon={<QuestionCircleOutlined />} disabled={locked || busy || b.status === 'MISSING'}
        onClick={() => run(() => pickupCollectionApi.setStatus(pickupId, { source: b.source, boxId: b.boxId, status: 'MISSING', method: 'LIST' }))} /></Tooltip>
      <Tooltip title={t('pickups.collection.checkConditionTip')}><Button size="small" icon={<CameraOutlined />} onClick={() => openCheck(b)} /></Tooltip>
      <Tooltip title={t('pickups.collection.history')}><Button size="small" icon={<HistoryOutlined />} aria-label={t('pickups.collection.history')} onClick={() => void showHistory(b)} /></Tooltip>
    </Space> },
  ]

  return <Space direction="vertical" size={16} style={{ width: '100%' }}>
    {data.isApproved && data.approval && <Alert type="success" showIcon
      title={t('pickups.collection.approvedTitle', { count: data.approval.pickedCount, date: when(data.approval.approvedAtUtc) })}
      description={<>{t('pickups.collection.approvedBy', { name: data.approval.approvedBy })}{data.approval.warehouseName ? ` · ${data.approval.warehouseName}` : ''}
        {data.approval.missingCount > 0 ? ` · ${t('pickups.collection.missingCount', { count: data.approval.missingCount })}` : ''}{data.approval.notes ? ` · ${data.approval.notes}` : ''}</>}
      action={data.canReopen && <Button size="small" icon={<UnlockOutlined />} onClick={() => {
        let reason = ''
        Modal.confirm({
          title: t('pickups.collection.reopenTitle'), okText: t('pickups.collection.reopen'), cancelText: t('common.cancel'),
          content: <Input.TextArea rows={3} placeholder={t('pickups.collection.reopenReason')} onChange={e => { reason = e.target.value }} />,
          onOk: () => run(() => pickupCollectionApi.reopen(pickupId, reason), t('pickups.collection.reopened')),
        })
      }}>{t('pickups.collection.reopen')}</Button>} />}

    {!locked && data.hasUnresolved && <Alert type="warning" showIcon
      title={`${t('pickups.collection.notMarkedCount', { count: data.pending })}${data.missing ? ` · ${t('pickups.collection.missingCount', { count: data.missing })}` : ''}`}
      description={t('pickups.collection.unresolvedHelp')} />}

    <Card size="small">
      <Space wrap split={<Typography.Text type="secondary">·</Typography.Text>}>
        {counts.map(c => <span key={c.key}><Typography.Text type="secondary">{c.label}</Typography.Text> <b>{c.value}</b></span>)}
      </Space>
    </Card>

    <Card title={t('pickups.collection.jobsTitle')} size="small"
      extra={<Button type="primary" icon={<PlusOutlined />} disabled={locked || busy} onClick={openAdd}>{t('pickups.collection.addJob')}</Button>}>
      {data.jobs.length === 0
        ? <Empty description={t('pickups.collection.noJobs')} />
        : <Table<typeof data.jobs[number]> rowKey="id" size="small" pagination={false} dataSource={data.jobs} columns={[
          { title: t('pickups.collection.colJob'), render: (_, j) => <Space direction="vertical" size={0}><b>{j.jobNumber}</b><Typography.Text type="secondary">{j.customerName}</Typography.Text></Space> },
          { title: t('pickups.collection.colProgress'), width: 260, render: (_, j) => <Space wrap size={4}>
            <Tag color="green">{t('pickups.collection.pickedCount', { count: j.picked })}</Tag>{j.pending > 0 && <Tag>{t('pickups.collection.notMarkedCount', { count: j.pending })}</Tag>}
            {j.missing > 0 && <Tag color="red">{t('pickups.collection.missingCount', { count: j.missing })}</Tag>}{j.excluded > 0 && <Tag color="blue">{t('pickups.collection.excludedCount', { count: j.excluded })}</Tag>}
          </Space> },
          { title: t('pickups.collection.colAdded'), width: 200, render: (_, j) => <Space direction="vertical" size={0}><span>{when(j.linkedAtUtc)}</span><Typography.Text type="secondary">{j.linkedBy}</Typography.Text></Space> },
          { title: '', width: 150, render: (_, j) => <Space size={4}>
            <Tooltip title={t('pickups.collection.pickAllJobTip')}><Button size="small" disabled={locked || busy}
              onClick={() => run(() => pickupCollectionApi.bulk(pickupId, 'PICKED', j.id), t('pickups.collection.jobAllPicked', { job: j.jobNumber }))}>{t('pickups.collection.pickAll')}</Button></Tooltip>
            <Popconfirm title={t('pickups.collection.removeJobTitle', { job: j.jobNumber })} description={t('pickups.collection.removeJobHelp')} okText={t('common.remove')} cancelText={t('common.cancel')}
              onConfirm={() => run(() => pickupCollectionApi.removeJob(pickupId, j.id), t('pickups.collection.jobRemoved'))}>
              <Button size="small" danger icon={<DeleteOutlined />} disabled={locked || busy} />
            </Popconfirm>
          </Space> },
        ]} />}
    </Card>

    <Card title={t('pickups.collection.boxesTitle', { count: data.expected })} size="small" extra={<Space wrap>
      <Input.Search ref={scanBox} allowClear enterButton={<ScanOutlined />} placeholder={t('pickups.collection.scanPlaceholder')} style={{ width: 260 }}
        disabled={locked || busy} onSearch={scan} />
      <Button disabled={locked || busy || data.pending === 0} onClick={() => run(() => pickupCollectionApi.bulk(pickupId, 'PICKED'), t('pickups.collection.allPicked'))}>{t('pickups.collection.pickAll')}</Button>
      <Button icon={<HistoryOutlined />} onClick={() => void showHistory()}>{t('pickups.collection.history')}</Button>
      <Button type="primary" icon={<CheckCircleOutlined />} disabled={locked || busy || data.expected === 0}
        onClick={() => { setWarehouseId(undefined); setApproveNotes(''); setApproveOpen(true) }}>{t('pickups.collection.approval')}</Button>
    </Space>}>
      <Space direction="vertical" size={18} style={{ width: '100%' }}>
        <div>
          <Typography.Text strong>{t('pickups.collection.fromJobs', { count: fromJobs.length })}</Typography.Text>
          {fromJobs.length
            ? <Table<CollectionBox> rowKey={b => `${b.source}:${b.boxId}`} size="small" loading={loading} dataSource={fromJobs} pagination={false} columns={boxColumns(true)} style={{ marginTop: 8 }} />
            : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('pickups.collection.noJobs')} />}
        </div>
        <div>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Typography.Text strong>{t('pickups.collection.packedAtPickup', { count: manualBoxes.length })}</Typography.Text>
            <Button size="small" icon={<AppstoreAddOutlined />} disabled={locked || busy} onClick={() => { boxForm.resetFields(); setAddBoxOpen(true) }}>{t('pickups.addBox')}</Button>
          </Space>
          {manualBoxes.length
            ? <Table<CollectionBox> rowKey={b => `${b.source}:${b.boxId}`} size="small" loading={loading} dataSource={manualBoxes} pagination={false} columns={boxColumns(false)} style={{ marginTop: 8 }} />
            : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('pickups.collection.nothingPackedHere')} />}
        </div>
      </Space>
    </Card>


    <Modal title={t('pickups.collection.addBoxTitle')} open={addBoxOpen} onCancel={() => setAddBoxOpen(false)} okText={t('common.add')} cancelText={t('common.cancel')}
      onOk={() => boxForm.validateFields().then(v =>
        run(() => pickupCollectionApi.addBox(pickupId, { boxTypeId: v.boxTypeId, roomName: v.roomName ?? null, isFragile: !!v.isFragile, notes: v.notes ?? null, copies: v.copies || 1 }),
          t('pickups.boxAdded')).then(() => setAddBoxOpen(false)))}>
      <Typography.Paragraph type="secondary">{t('pickups.collection.addBoxHelp')}</Typography.Paragraph>
      <Form form={boxForm} layout="vertical" initialValues={{ isFragile: false, copies: 1 }}>
        <Form.Item name="boxTypeId" label={t('pickups.boxType')} rules={[{ required: true, message: t('pickups.chooseBoxType') }]}>
          <Select showSearch optionFilterProp="label" placeholder={t('pickups.boxType')} options={boxTypes.map(b => ({ value: b.id, label: b.name }))} />
        </Form.Item>
        <Space size={12} style={{ width: '100%' }}>
          <Form.Item name="roomName" label={t('common.room')}><Input placeholder={t('pickups.collection.roomPlaceholder')} maxLength={120} /></Form.Item>
          <Form.Item name="copies" label={t('pickups.collection.howMany')}><InputNumber min={1} max={50} /></Form.Item>
          <Form.Item name="isFragile" label={t('pickups.fragile')} valuePropName="checked"><Checkbox /></Form.Item>
        </Space>
        <Form.Item name="notes" label={t('common.notes')}><Input.TextArea rows={2} maxLength={500} placeholder={t('pickups.collection.packedByCustomer')} /></Form.Item>
      </Form>
    </Modal>

    <Modal title={t('pickups.collection.addJobsTitle')} open={addOpen} onCancel={() => setAddOpen(false)} okText={t('common.add')} cancelText={t('common.cancel')}
      okButtonProps={{ disabled: chosen.length === 0 }}
      onOk={() => run(() => pickupCollectionApi.addJobs(pickupId, chosen), t('pickups.collection.jobAdded')).then(() => setAddOpen(false))}>
      <Typography.Paragraph type="secondary">{t('pickups.collection.addJobsHelp')}</Typography.Paragraph>
      <Select mode="multiple" style={{ width: '100%' }} value={chosen} onChange={setChosen} placeholder={t('pickups.collection.searchJobs')}
        showSearch filterOption={false} onSearch={async s => { try { setOptions(await pickupCollectionApi.selectableJobs(pickupId, s)) } catch { /* keep the list */ } }}
        options={options.map(o => ({
          value: o.id,
          label: `${o.jobNumber} · ${o.customerName} · ${t('pickups.collection.boxesLeft', { count: o.boxCount, remaining: o.remaining })}`,
          disabled: o.remaining === 0,
        }))} />
    </Modal>

    <Modal title={t('pickups.collection.approval')} open={approveOpen} onCancel={() => setApproveOpen(false)} okText={t('pickups.collection.approve')} cancelText={t('common.cancel')}
      onOk={() => run(() => pickupCollectionApi.approve(pickupId, { warehouseId, notes: approveNotes, acceptMissing: data.missing > 0 }), t('pickups.collection.approved')).then(() => setApproveOpen(false))}>
      {data.pending > 0 && <Alert type="error" showIcon style={{ marginBottom: 12 }}
        title={t('pickups.collection.stillNotMarked', { count: data.pending })} description={t('pickups.collection.stillNotMarkedHelp')} />}
      {data.missing > 0 && <Alert type="warning" showIcon style={{ marginBottom: 12 }}
        title={t('pickups.collection.areMissing', { count: data.missing })} description={t('pickups.collection.areMissingHelp')} />}
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Select allowClear style={{ width: '100%' }} placeholder={t('pickups.collection.receivingWarehouse')} value={warehouseId} onChange={setWarehouseId}
          options={warehouses.map(w => ({ value: w.id, label: w.name }))} />
        <Input.TextArea rows={3} placeholder={t('common.notes')} value={approveNotes} onChange={e => setApproveNotes(e.target.value)} maxLength={500} />
      </Space>
    </Modal>

    <Drawer title={checking ? t('pickups.collection.conditionTitle', { number: checking.trackingNumber }) : ''} open={!!checking} onClose={() => setCheck(null)} width={520}>
      {checking && <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert type="info" showIcon title={t('pickups.collection.checkTitle')}
          description={t('pickups.collection.checkHelp')} />

        <Radio.Group value={condition} onChange={e => setCondition(e.target.value)} disabled={locked || busy} optionType="button" buttonStyle="solid">
          <Radio.Button value="OK">{conditionLabel('OK')}</Radio.Button>
          <Radio.Button value="DAMAGED">{conditionLabel('DAMAGED')}</Radio.Button>
          <Radio.Button value="NOT_CHECKED">{conditionLabel('NOT_CHECKED')}</Radio.Button>
        </Radio.Group>

        <Input.TextArea rows={3} value={damageNotes} maxLength={1000} disabled={locked || busy}
          placeholder={condition === 'DAMAGED' ? t('pickups.collection.describeDamage') : t('pickups.collection.notesOptional')}
          onChange={e => setDamageNotes(e.target.value)} />

        <Button type="primary" loading={busy} disabled={locked}
          onClick={() => run(() => pickupCollectionApi.setCondition(pickupId, { source: checking.source, boxId: checking.boxId, condition, notes: damageNotes }), t('pickups.collection.conditionRecorded'))}>
          {t('pickups.collection.saveCondition')}
        </Button>

        <Card size="small" title={t('pickups.collection.mediaTitle', { count: checking.media.length })}
          extra={<Upload beforeUpload={addMedia} showUploadList={false} multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" disabled={locked || busy}>
            <Button icon={<CameraOutlined />} disabled={locked || busy}>{t('pickups.collection.attach')}</Button>
          </Upload>}>
          {checking.media.length === 0
            ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('pickups.collection.nothingAttached')} />
            : <Space direction="vertical" size={6} style={{ width: '100%' }}>
              {checking.media.map(m => <Space key={m.id} style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space direction="vertical" size={0}>
                  <span>{m.fileName}{!m.isUploaded && <Tag color="gold" style={{ marginInlineStart: 6 }}>{t('pickups.collection.incomplete')}</Tag>}</span>
                  <Typography.Text type="secondary">{Math.max(1, Math.round(m.sizeBytes / 1024))} KB · {m.uploadedBy} · {when(m.createdAtUtc)}</Typography.Text>
                </Space>
                <Space size={4}>
                  <Tooltip title={t('common.download')}><Button size="small" aria-label={t('common.download')} icon={<DownloadOutlined />} disabled={!m.isUploaded}
                    onClick={async () => { try { const { url } = await pickupCollectionApi.mediaDownload(pickupId, m.id); window.open(url, '_blank') } catch (e) { message.error(e instanceof Error ? e.message : t('pickups.openFailed')) } }} /></Tooltip>
                  <Popconfirm title={t('pickups.removeFileTitle')} okText={t('common.remove')} cancelText={t('common.cancel')} onConfirm={async () => {
                    try { await pickupCollectionApi.deleteMedia(pickupId, m.id); await load(); message.success(t('pickups.fileRemoved')) }
                    catch (e) { message.error(e instanceof Error ? e.message : t('pickups.removeFailed')) }
                  }}><Button size="small" danger icon={<DeleteOutlined />} disabled={locked || busy} /></Popconfirm>
                </Space>
              </Space>)}
            </Space>}
        </Card>

        {checking.conditionBy && <Typography.Text type="secondary">{t('pickups.collection.lastChecked', { name: checking.conditionBy, date: when(checking.conditionAtUtc) })}</Typography.Text>}
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
              <span><b>{cond ? t('pickups.collection.conditionIs', { condition: CONDITION[cond] ? conditionLabel(cond) : cond }) : statusLabel(e.toStatus)}</b>
                {!cond && e.fromStatus && e.fromStatus !== e.toStatus ? ` ${t('pickups.collection.wasStatus', { status: statusLabel(e.fromStatus) })}` : ''} · {e.trackingNumber}</span>
              <Typography.Text type="secondary">{e.actor} · {when(e.occurredAtUtc)}{cond ? '' : ` · ${methodLabel(e.method)}`}</Typography.Text>
              {e.notes && <Typography.Text type="secondary">{e.notes}</Typography.Text>}
            </Space>,
          }
        })} />
        : <Empty description={t('pickups.collection.nothingRecorded')} />}
    </Drawer>
  </Space>
}
