import { useState } from 'react'
import { Alert, Button, Modal, message } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { request, salesApi } from '../api'
import { readSession } from '../session'
import type { LeadAttachment } from '../types'
import { DataGrid } from './DataGrid'

type InventoryItem = { name: string; quantity: number; notes: string }
type Inventory = { items: InventoryItem[] }
async function previews(url: string, isVideo: boolean): Promise<string[]> {
  const canvas = document.createElement('canvas')
  const encode = (source: CanvasImageSource, width: number, height: number) => {
    const scale = Math.min(1, 1280 / Math.max(width, height))
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale)
    canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.8)
  }
  if (!isVideo) {
    const image = new Image(); image.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Image load timed out.')), 30000)
      image.onload = () => { clearTimeout(timer); resolve() }
      image.onerror = () => { clearTimeout(timer); reject(new Error('Cannot load image. Check storage CORS settings.')) }
      image.src = url
    })
    return [encode(image, image.naturalWidth, image.naturalHeight)]
  }
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'; video.muted = true; video.preload = 'auto'
  const wait = (event: string, action: () => void) => new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer); video.removeEventListener(event, success); video.removeEventListener('error', failure)
      error ? reject(error) : resolve()
    }
    const success = () => finish()
    const failure = () => finish(new Error('Cannot read this video. Check its format and storage CORS settings.'))
    const timer = window.setTimeout(() => finish(new Error('Video preview timed out. Try a shorter clip.')), 30000)
    video.addEventListener(event, success, { once: true }); video.addEventListener('error', failure, { once: true }); action()
  })
  try {
    await wait('loadeddata', () => { video.src = url })
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error('Cannot determine video duration. Upload an MP4 recording.')
    const result: string[] = []
    for (let i = 0; i < 6; i++) {
      await wait('seeked', () => { video.currentTime = video.duration * (i + 0.5) / 6 })
      result.push(encode(video, video.videoWidth, video.videoHeight))
    }
    return result
  } finally { video.removeAttribute('src'); video.load() }
}

export function LeadExtractionPanel({ leadId, attachment }: { leadId: string; attachment: LeadAttachment }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Inventory | null>(() => {
    try { const parsed = JSON.parse(attachment.extractionJson || 'null'); return parsed ? { items: parsed.items ?? parsed.Items?.map((x: any) => ({ name: x.Name, quantity: x.Quantity, notes: x.Notes })) ?? [] } : null } catch { return null }
  })
  const allowed = readSession()?.user.permissions.includes('sales.items.extract')
  if (!allowed || !/^(image|video)\//.test(attachment.contentType)) return null
  const extract = async () => {
    setBusy(true)
    try {
      const { url } = await salesApi.attachmentDownload(leadId, attachment.id)
      const isVideo = attachment.contentType.startsWith('video/')
      const frames = isVideo || !url.startsWith('https://') ? await previews(url, isVideo) : undefined
      const output = await request<Inventory>(`/api/sales/leads/${leadId}/attachments/${attachment.id}/extract`, { method: 'POST', body: JSON.stringify({ frames }) })
      setResult(output); message.success('Draft inventory saved')
    } catch (error) { message.error(error instanceof Error ? error.message : 'Extraction failed') }
    finally { setBusy(false) }
  }
  return <><Button size="small" icon={<RobotOutlined />} onClick={() => setOpen(true)}>Extract items</Button>
    <Modal centered width={760} title={'Item extraction · ' + attachment.originalFileName} open={open} onCancel={() => !busy && setOpen(false)} footer={null}>
      <Alert type="info" showIcon message="Review before using" description="OpenAI receives this image or up to six sampled video frames. Counts may be incomplete or duplicated. Saved results are a draft, not a confirmed packing list." />
      <Button type="primary" loading={busy} onClick={() => void extract()} style={{ marginBlock: 16 }}>{result ? 'Extract again with OpenAI' : 'Extract with OpenAI'}</Button>
      {result && <DataGrid rowKey={(_, index) => String(index)} dataSource={result.items} pagination={false} columns={[{ title: 'Item', dataIndex: 'name' }, { title: 'Quantity', dataIndex: 'quantity' }, { title: 'Review notes', dataIndex: 'notes' }]} />}
    </Modal></>
}
