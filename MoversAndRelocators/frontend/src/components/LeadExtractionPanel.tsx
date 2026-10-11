import { useState } from 'react'
import { Alert, Button, Collapse, Modal, Steps, Tag, message } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { request, salesApi } from '../api'
import { readSession } from '../session'
import type { LeadAttachment } from '../types'
import { DataGrid } from './DataGrid'

type InventoryItem = { name: string; quantity: number; notes: string; room?: string | null; fragile?: boolean; handling?: string | null }
type InventoryBox = { boxType: string; quantity: number; contents: string; room?: string | null }
type Usage = { inputTokens: number; cachedInputTokens: number; outputTokens: number; audioSeconds: number; cost: number | null; currency: string; pricesConfigured: boolean }
type Inventory = { items: InventoryItem[]; boxes?: InventoryBox[]; transcript?: string | null; framesAnalysed?: number; warning?: string | null; usage?: Usage | null; inventory?: { expectedCbm: number; fragileItems: number; itemCount: number; boxCount: number } }

const FRAMES = 16, FRAME_SIZE = 1024, AUDIO_RATE = 16000, AUDIO_SECONDS = 6 * 60

/** The saved result is stored server-side with PascalCase names; API responses use camelCase. */
function readSaved(json?: string): Inventory | null {
  try {
    const x = JSON.parse(json || 'null'); if (!x) return null
    const items = (x.items ?? x.Items ?? []).map((i: any) => ({ name: i.name ?? i.Name, quantity: i.quantity ?? i.Quantity, notes: i.notes ?? i.Notes ?? '', room: i.room ?? i.Room, fragile: i.fragile ?? i.Fragile, handling: i.handling ?? i.Handling }))
    const boxes = (x.boxes ?? x.Boxes ?? []).map((b: any) => ({ boxType: b.boxType ?? b.BoxType, quantity: b.quantity ?? b.Quantity, contents: b.contents ?? b.Contents ?? '', room: b.room ?? b.Room }))
    const u = x.usage ?? x.Usage
    const usage = u ? { inputTokens: u.inputTokens ?? u.InputTokens, cachedInputTokens: u.cachedInputTokens ?? u.CachedInputTokens ?? 0, outputTokens: u.outputTokens ?? u.OutputTokens, audioSeconds: u.audioSeconds ?? u.AudioSeconds ?? 0, cost: u.cost ?? u.Cost ?? null, currency: u.currency ?? u.Currency ?? 'USD', pricesConfigured: u.pricesConfigured ?? u.PricesConfigured ?? false } : null
    return { items, boxes, transcript: x.transcript ?? x.Transcript, framesAnalysed: x.framesAnalysed ?? x.FramesAnalysed, warning: x.warning ?? x.Warning, usage }
  } catch { return null }
}

/** Still pictures for OpenAI: the image itself, or FRAMES evenly spaced frames of a video (JPEG, at most 1024 px). */
async function previews(url: string, isVideo: boolean): Promise<string[]> {
  const canvas = document.createElement('canvas')
  const encode = (source: CanvasImageSource, width: number, height: number) => {
    const scale = Math.min(1, FRAME_SIZE / Math.max(width, height))
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale)
    canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.75)
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
    for (let i = 0; i < FRAMES; i++) {
      await wait('seeked', () => { video.currentTime = video.duration * (i + 0.5) / FRAMES })
      result.push(encode(video, video.videoWidth, video.videoHeight))
    }
    return result
  } finally { video.removeAttribute('src'); video.load() }
}

/**
 * The video's sound as a small WAV (16 kHz mono, first 6 minutes) so OpenAI can transcribe the narration.
 * Returns null when the video has no sound or the browser cannot decode it; extraction then uses pictures only.
 */
async function soundTrack(url: string): Promise<string | null> {
  try {
    const response = await fetch(url); if (!response.ok) return null
    const data = await response.arrayBuffer()
    const Context = window.AudioContext ?? (window as any).webkitAudioContext; if (!Context) return null
    const context = new Context()
    let decoded: AudioBuffer
    try { decoded = await context.decodeAudioData(data) } finally { void context.close() }
    const seconds = Math.min(decoded.duration, AUDIO_SECONDS); if (seconds < 1) return null
    const offline = new OfflineAudioContext(1, Math.ceil(seconds * AUDIO_RATE), AUDIO_RATE)
    const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start(0)
    const samples = (await offline.startRendering()).getChannelData(0)
    // 16-bit PCM WAV
    const wav = new DataView(new ArrayBuffer(44 + samples.length * 2))
    const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) wav.setUint8(offset + i, value.charCodeAt(i)) }
    text(0, 'RIFF'); wav.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE'); text(12, 'fmt ')
    wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 1, true); wav.setUint32(24, AUDIO_RATE, true)
    wav.setUint32(28, AUDIO_RATE * 2, true); wav.setUint16(32, 2, true); wav.setUint16(34, 16, true); text(36, 'data'); wav.setUint32(40, samples.length * 2, true)
    for (let i = 0; i < samples.length; i++) wav.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true)
    const blob = new Blob([wav.buffer], { type: 'audio/wav' })
    return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob) })
  } catch { return null }
}

const stepTitles = ['Pictures', 'Sound', 'OpenAI']

export function LeadExtractionPanel({ leadId, attachment }: { leadId: string; attachment: LeadAttachment }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [step, setStep] = useState(-1)
  const [result, setResult] = useState<Inventory | null>(() => readSaved(attachment.extractionJson))
  const allowed = readSession()?.user.permissions.includes('sales.items.extract')
  if (!allowed || !/^(image|video)\//.test(attachment.contentType)) return null
  const isVideo = attachment.contentType.startsWith('video/')
  const extract = async () => {
    setBusy(true)
    try {
      const { url } = await salesApi.attachmentDownload(leadId, attachment.id)
      setStep(0)
      const frames = isVideo || !url.startsWith('https://') ? await previews(url, isVideo) : undefined
      setStep(1)
      const audio = isVideo ? await soundTrack(url) : null
      setStep(2)
      const output = await request<Inventory>(`/api/sales/leads/${leadId}/attachments/${attachment.id}/extract`, { method: 'POST', body: JSON.stringify({ frames, audio }) })
      setResult(output); setStep(3); message.success('Saved to the lead inventory')
    } catch (error) { setStep(-1); message.error(error instanceof Error ? error.message : 'Extraction failed') }
    finally { setBusy(false) }
  }
  const items = [...(result?.items ?? [])].sort((a, b) => (a.room ?? '~').localeCompare(b.room ?? '~'))
  return <><Button size="small" icon={<RobotOutlined />} onClick={() => setOpen(true)}>Extract items</Button>
    <Modal centered width={960} title={'Item extraction · ' + attachment.originalFileName} open={open} onCancel={() => !busy && setOpen(false)} footer={null}>
      <Alert type="info" showIcon title="Review before using" description={isVideo
        ? `OpenAI receives ${FRAMES} pictures taken from this video (stored in S3 and shared by a short-lived link) and a transcript of what is said in it. Say rooms and contents while recording for better results. Counts may be incomplete; this is a draft, not a confirmed packing list.`
        : 'OpenAI receives this picture by a short-lived link. Counts may be incomplete; this is a draft, not a confirmed packing list.'} />
      <div className="lead-extract-run">
        <Button type="primary" icon={<RobotOutlined />} loading={busy} onClick={() => void extract()}>{result ? 'Extract again with OpenAI' : 'Extract with OpenAI'}</Button>
        {busy && isVideo && <Steps size="small" current={step} items={stepTitles.map(title => ({ title }))} />}
      </div>
      {result && <>
        {result.inventory && <Alert style={{ marginBottom: 12 }} type="success" showIcon title={"Saved to the lead's inventory: " + result.inventory.expectedCbm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' CBM expected, ' + result.inventory.fragileItems + ' fragile piece' + (result.inventory.fragileItems === 1 ? '' : 's')} description="Review and correct it with Inventory on the lead. Extracting this file again replaces only its own lines." />}
        {result.warning && <Alert style={{ marginBottom: 12 }} type="warning" showIcon title={result.warning} />}
        <h4 className="lead-extract-heading">Items {result.framesAnalysed ? <small>from {result.framesAnalysed} picture{result.framesAnalysed === 1 ? '' : 's'}{result.transcript ? ' and the narration' : ''}</small> : null}</h4>
        <DataGrid rowKey="key" dataSource={items.map((x, i) => ({ ...x, key: i }))} pagination={false} scroll={{ x: 760 }} columns={[
          { title: 'Room', dataIndex: 'room', width: 140, render: (v: string | null) => v || <span style={{ color: '#8a9892' }}>—</span> },
          { title: 'Item', dataIndex: 'name' },
          { title: 'Qty', dataIndex: 'quantity', width: 70, align: 'right' as const },
          { title: 'Handling', width: 220, render: (_: unknown, x: InventoryItem) => <>{x.fragile && <Tag color="red">Fragile</Tag>}{x.handling && <span>{x.handling}</span>}{!x.fragile && !x.handling && '—'}</> },
          { title: 'Review notes', dataIndex: 'notes' }]} />
        {(result.boxes?.length ?? 0) > 0 && <>
          <h4 className="lead-extract-heading">Boxes needed <small>{result.boxes!.reduce((n, b) => n + b.quantity, 0)} in total</small></h4>
          <DataGrid rowKey="key" dataSource={result.boxes!.map((x, i) => ({ ...x, key: i }))} pagination={false} columns={[
            { title: 'Box type', dataIndex: 'boxType' }, { title: 'Qty', dataIndex: 'quantity', width: 70, align: 'right' as const },
            { title: 'Contents', dataIndex: 'contents' }, { title: 'Room', dataIndex: 'room', render: (v: string | null) => v || '—' }]} />
        </>}
        {result.usage && <p className="lead-extract-usage">OpenAI usage: {result.usage.inputTokens.toLocaleString()} input / {result.usage.outputTokens.toLocaleString()} output tokens{result.usage.audioSeconds ? ' · ' + Math.round(result.usage.audioSeconds) + ' s of sound' : ''} · {result.usage.cost != null ? <strong>approx. ${result.usage.cost.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</strong> : 'cost not calculated (set prices in Settings › OpenAI)'}</p>}
        {result.transcript && <Collapse style={{ marginTop: 12 }} size="small" items={[{ key: 't', label: 'What was said in the video', children: <p className="lead-extract-transcript">{result.transcript}</p> }]} />}
      </>}
    </Modal></>
}
