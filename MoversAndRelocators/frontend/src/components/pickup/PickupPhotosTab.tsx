import { useEffect, useMemo, useState } from 'react'
import { AutoComplete, Button, Card, Empty, Form, Image, Popconfirm, Segmented, Space, Tag, Tooltip, message } from 'antd'
import { CameraOutlined, DeleteOutlined, DownloadOutlined, FileOutlined } from '@ant-design/icons'
import { pickupsApi } from '../../api'
import type { PickupAttachment, PickupDetail, PickupWork } from '../../types'
import { formatBytes } from '../AttachmentList'
import { MediaCapture } from '../MediaCapture'

const stages: { value: PickupAttachment['stage']; label: string }[] = [{ value: 'BEFORE_PACKING', label: 'Before packing' }, { value: 'AFTER_PACKING', label: 'After packing' }, { value: 'OTHER', label: 'Other' }]
const stageLabel = (stage: string) => stages.find(s => s.value === stage)?.label ?? stage

type Props = { detail: PickupDetail; work: PickupWork; onWork: (work: PickupWork) => void }

/** Before/after packing photos and videos for each room, captured on site. */
export function PickupPhotosTab({ detail, work, onWork }: Props) {
  const [stage, setStage] = useState<PickupAttachment['stage']>('BEFORE_PACKING'), [room, setRoom] = useState(''), [urls, setUrls] = useState<Record<string, string>>({})
  const pickupId = detail.pickup.id
  const roomOptions = [...new Set([...work.expectedInventory.map(x => x.roomName), ...detail.packages.map(p => p.roomName).filter((x): x is string => Boolean(x)), ...work.attachments.map(a => a.roomName).filter((x): x is string => Boolean(x))])].map(value => ({ value }))
  const images = useMemo(() => work.attachments.filter(a => a.contentType.startsWith('image/')), [work.attachments])

  // Short-lived signed URLs for thumbnails; fetched once per image.
  useEffect(() => {
    const missing = images.filter(a => !urls[a.id]).slice(0, 60)
    if (!missing.length) return
    void Promise.all(missing.map(a => pickupsApi.attachmentDownload(pickupId, a.id).then(r => [a.id, r.url] as const).catch(() => null)))
      .then(rows => setUrls(current => ({ ...current, ...Object.fromEntries(rows.filter((r): r is readonly [string, string] => r !== null)) })))
  }, [images, pickupId, urls])

  const groups = useMemo(() => { const g = new Map<string, PickupAttachment[]>(); for (const a of work.attachments) { const k = a.roomName ?? 'General'; g.set(k, [...(g.get(k) ?? []), a]) } return [...g.entries()] }, [work.attachments])
  const upload = async (file: File) => { await pickupsApi.upload(pickupId, file, stage, room.trim()); onWork(await pickupsApi.work(pickupId)) }
  const download = async (a: PickupAttachment) => { try { window.open((await pickupsApi.attachmentDownload(pickupId, a.id)).url, '_blank', 'noopener,noreferrer') } catch (e) { message.error(e instanceof Error ? e.message : 'Unable to download') } }
  const remove = async (a: PickupAttachment) => { try { await pickupsApi.deleteAttachment(pickupId, a.id); onWork(await pickupsApi.work(pickupId)) } catch (e) { message.error(e instanceof Error ? e.message : 'Unable to remove') } }

  const tile = (a: PickupAttachment) => <figure key={a.id} className="pickup-photo">
    {a.contentType.startsWith('image/') && urls[a.id] ? <Image src={urls[a.id]} alt={a.originalFileName} /> : <div className="pickup-photo-file"><FileOutlined /><span>{a.originalFileName}</span></div>}
    <figcaption><small>{a.uploadedAtUtc ? new Date(a.uploadedAtUtc).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''} · {formatBytes(a.sizeBytes)}</small>
      <Space size={0}><Tooltip title="Download"><Button type="text" size="small" aria-label="Download" icon={<DownloadOutlined />} onClick={() => void download(a)} /></Tooltip>
        <Popconfirm title="Remove this file?" okText="Remove" okButtonProps={{ danger: true }} onConfirm={() => void remove(a)}><Button type="text" size="small" danger aria-label="Remove" icon={<DeleteOutlined />} /></Popconfirm></Space></figcaption>
  </figure>

  return <div className="pickup-photos">
    <Card title={<Space><CameraOutlined />Capture</Space>}>
      <Form layout="vertical" requiredMark={false}>
        <Form.Item label="Stage"><Segmented block value={stage} onChange={value => setStage(value as PickupAttachment['stage'])} options={stages} /></Form.Item>
        <Form.Item label="Room or area" extra="Tag each photo with the room so before and after shots line up."><AutoComplete value={room} onChange={setRoom} options={roomOptions} placeholder="e.g. Living room, Hall, Kitchen" filterOption={(input, option) => String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())} /></Form.Item>
      </Form>
      <MediaCapture uploadFile={upload} note={`Saving as "${stageLabel(stage)}"${room.trim() ? ` · ${room.trim()}` : ''}. Maximum 500 MB per file.`} />
    </Card>
    <Card title="Photos by room" extra={<Tag>{work.attachments.length} files</Tag>}>
      {groups.length ? groups.map(([name, files]) => <section key={name} className="pickup-photo-room">
        <h4>{name}</h4>
        <div className="pickup-photo-stages">{stages.map(s => { const list = files.filter(f => f.stage === s.value); return list.length ? <div key={s.value}><h5>{s.label} <small>{list.length}</small></h5><Image.PreviewGroup><div className="pickup-photo-grid">{list.map(tile)}</div></Image.PreviewGroup></div> : null })}</div>
      </section>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No photos yet. Capture each room before packing and again after it is cleared." />}
    </Card>
  </div>
}
