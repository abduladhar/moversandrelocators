import { useState } from 'react'
import { Alert, Button, Checkbox, Collapse, Modal, Segmented, Steps, Tag, Tooltip, message } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { request, salesApi } from '../api'
import { readSession } from '../session'
import type { ExtractionProviders, LeadAttachment } from '../types'
import { DataGrid } from './DataGrid'
import { ItemPicture, type PictureMark } from './ItemPicture'
import { formatNumber, localizeServerText, t as translate, useT } from '../i18n'

type InventoryItem = { name: string; quantity: number; notes: string; room?: string | null; fragile?: boolean; handling?: string | null; /** Number of the picture showing the item (when pictures were requested), 0 when none; mark = where it is in it. */ picture?: number; mark?: PictureMark | null }
type InventoryBox = { boxType: string; quantity: number; contents: string; room?: string | null }
type Usage = { inputTokens: number; cachedInputTokens: number; outputTokens: number; audioSeconds: number; cost: number | null; currency: string; pricesConfigured: boolean }
type Inventory = { items: InventoryItem[]; boxes?: InventoryBox[]; transcript?: string | null; framesAnalysed?: number; warning?: string | null; usage?: Usage | null; provider?: string | null; model?: string | null; inventory?: { expectedCbm: number; fragileItems: number; itemCount: number; boxCount: number } }
const providerName = (key?: string | null) => key === 'claude' ? 'Claude' : 'OpenAI'

const FRAMES = 16, FRAME_SIZE = 1024, AUDIO_RATE = 16000, AUDIO_SECONDS = 6 * 60

/** The saved result is stored server-side with PascalCase names; API responses use camelCase. */
function readSaved(json?: string): Inventory | null {
  try {
    const x = JSON.parse(json || 'null'); if (!x) return null
    const items = (x.items ?? x.Items ?? []).map((i: any) => ({ name: i.name ?? i.Name, quantity: i.quantity ?? i.Quantity, notes: i.notes ?? i.Notes ?? '', room: i.room ?? i.Room, fragile: i.fragile ?? i.Fragile, handling: i.handling ?? i.Handling, picture: i.picture ?? i.Picture ?? 0, mark: (m => m ? { x: m.x ?? m.X, y: m.y ?? m.Y, width: m.width ?? m.Width, height: m.height ?? m.Height } : null)(i.mark ?? i.Mark) }))
    const boxes = (x.boxes ?? x.Boxes ?? []).map((b: any) => ({ boxType: b.boxType ?? b.BoxType, quantity: b.quantity ?? b.Quantity, contents: b.contents ?? b.Contents ?? '', room: b.room ?? b.Room }))
    const u = x.usage ?? x.Usage
    const usage = u ? { inputTokens: u.inputTokens ?? u.InputTokens, cachedInputTokens: u.cachedInputTokens ?? u.CachedInputTokens ?? 0, outputTokens: u.outputTokens ?? u.OutputTokens, audioSeconds: u.audioSeconds ?? u.AudioSeconds ?? 0, cost: u.cost ?? u.Cost ?? null, currency: u.currency ?? u.Currency ?? 'USD', pricesConfigured: u.pricesConfigured ?? u.PricesConfigured ?? false } : null
    return { items, boxes, transcript: x.transcript ?? x.Transcript, framesAnalysed: x.framesAnalysed ?? x.FramesAnalysed, warning: x.warning ?? x.Warning, usage, provider: x.provider ?? x.Provider, model: x.model ?? x.Model }
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
      const timer = window.setTimeout(() => reject(new Error(translate('sales.extraction.imageTimeout'))), 30000)
      image.onload = () => { clearTimeout(timer); resolve() }
      image.onerror = () => { clearTimeout(timer); reject(new Error(translate('sales.extraction.imageLoadFailed'))) }
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
    const failure = () => finish(new Error(translate('sales.extraction.videoReadFailed')))
    const timer = window.setTimeout(() => finish(new Error(translate('sales.extraction.videoTimeout'))), 30000)
    video.addEventListener(event, success, { once: true }); video.addEventListener('error', failure, { once: true }); action()
  })
  try {
    await wait('loadeddata', () => { video.src = url })
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error(translate('sales.extraction.videoDuration'))
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

export function LeadExtractionPanel({ leadId, attachment }: { leadId: string; attachment: LeadAttachment }) {
  const { t } = useT()
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [step, setStep] = useState(-1)
  // Optional: attach the picture that shows each item best; shots are the pictures of the last run, for the thumbnails here.
  const [pictures, setPictures] = useState(false), [shots, setShots] = useState<string[]>([])
  const [result, setResult] = useState<Inventory | null>(() => readSaved(attachment.extractionJson))
  // The AIs the tenant configured (Settings › OpenAI / Claude); the user picks one per run.
  const [available, setAvailable] = useState<ExtractionProviders>(), [provider, setProvider] = useState<string>()
  const allowed = readSession()?.user.permissions.includes('sales.items.extract')
  if (!allowed || !/^(image|video)\//.test(attachment.contentType)) return null
  const isVideo = attachment.contentType.startsWith('video/')
  const name = providerName(provider)
  const show = () => {
    setOpen(true)
    salesApi.extractionProviders().then(value => {
      setAvailable(value)
      setProvider(current => value.providers.some(p => p.key === current) ? current : value.providers[0]?.key)
    }).catch(error => message.error(error instanceof Error ? error.message : t('sales.extraction.loadSettingsFailed')))
  }
  // Only OpenAI can transcribe sound; without it the narration is not sent at all.
  const withSound = isVideo && (available?.transcription ?? true)
  const extract = async () => {
    setBusy(true)
    try {
      const { url } = await salesApi.attachmentDownload(leadId, attachment.id)
      setStep(0)
      const frames = isVideo || !url.startsWith('https://') ? await previews(url, isVideo) : undefined
      setShots(frames ?? [url])
      setStep(1)
      const audio = withSound ? await soundTrack(url) : null
      setStep(2)
      const output = await request<Inventory>(`/api/sales/leads/${leadId}/attachments/${attachment.id}/extract`, { method: 'POST', body: JSON.stringify({ frames, audio, provider, pictures }) })
      setResult(output); setStep(3); message.success(t('sales.extraction.savedToInventory'))
    } catch (error) { setStep(-1); message.error(error instanceof Error ? error.message : t('sales.extraction.failed')) }
    finally { setBusy(false) }
  }
  const items = [...(result?.items ?? [])].sort((a, b) => (a.room ?? '~').localeCompare(b.room ?? '~'))
  const noProvider = available !== undefined && available.providers.length === 0
  return <><Button size="small" icon={<RobotOutlined />} onClick={show}>{t('sales.extraction.button')}</Button>
    <Modal centered width={960} title={t('sales.extraction.title', { file: attachment.originalFileName })} open={open} onCancel={() => !busy && setOpen(false)} footer={null}>
      {noProvider
        ? <Alert type="warning" showIcon title={t('sales.extraction.noAiTitle')} description={t('sales.extraction.noAiDescription')} />
        : <Alert type="info" showIcon title={t('sales.extraction.reviewTitle')} description={isVideo
          ? t(!withSound ? 'sales.extraction.videoInfo' : provider === 'claude' ? 'sales.extraction.videoInfoSoundOpenAi' : 'sales.extraction.videoInfoSound', { provider: name, frames: FRAMES })
          : t('sales.extraction.imageInfo', { provider: name })} />}
      {!noProvider && <div className="lead-extract-options">
        {(available?.providers.length ?? 0) > 1 && <div className="lead-extract-provider" style={{ marginTop: 0 }}>
          <span>{t('sales.extraction.extractWith')}</span>
          <Segmented disabled={busy} value={provider} onChange={value => setProvider(String(value))} options={available!.providers.map(p => ({ value: p.key, label: <span title={p.model}>{p.name} <small>{p.model}</small></span> }))} />
        </div>}
        <Tooltip title={isVideo ? t('sales.extraction.pictureTipVideo') : t('sales.extraction.pictureTipPhoto')}>
          <Checkbox disabled={busy} checked={pictures} onChange={e => setPictures(e.target.checked)}>{t('sales.extraction.attachPicture')}</Checkbox>
        </Tooltip>
      </div>}
      <div className="lead-extract-run">
        <Button type="primary" icon={<RobotOutlined />} loading={busy} disabled={!provider} onClick={() => void extract()}>{result ? t('sales.extraction.extractAgainWithProvider', { provider: name }) : t('sales.extraction.extractWithProvider', { provider: name })}</Button>
        {busy && isVideo && <Steps size="small" current={step} items={[t('sales.extraction.stepPictures'), withSound ? t('sales.extraction.stepSound') : t('sales.extraction.stepNoSound'), name].map(title => ({ title }))} />}
      </div>
      {result && <>
        {result.inventory && <Alert style={{ marginBottom: 12 }} type="success" showIcon title={t('sales.extraction.savedTitle', { cbm: formatNumber(result.inventory.expectedCbm, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), count: result.inventory.fragileItems })} description={t('sales.extraction.savedDescription')} />}
        {result.warning && <Alert style={{ marginBottom: 12 }} type="warning" showIcon title={localizeServerText(result.warning)} />}
        <h4 className="lead-extract-heading">{t('common.items')} {result.framesAnalysed ? <small>{t(result.transcript ? 'sales.extraction.fromPicturesNarration' : 'sales.extraction.fromPictures', { count: result.framesAnalysed })}</small> : null}</h4>
        <DataGrid rowKey="key" dataSource={items.map((x, i) => ({ ...x, key: i }))} pagination={false} scroll={{ x: 760 }} columns={[
          // Only when this run attached pictures; thumbnails come from the pictures taken in this browser, otherwise the number.
          ...(items.some(x => x.picture) ? [{ title: t('sales.picture'), width: 76, render: (_: unknown, x: InventoryItem) => !x.picture ? '—'
            : shots[x.picture - 1] ? <ItemPicture src={shots[x.picture - 1]} mark={x.mark} alt={x.name} size={48} />
            : <Tag>#{x.picture}</Tag> }] : []),
          { title: t('common.room'), dataIndex: 'room', width: 140, render: (v: string | null) => v || <span style={{ color: '#8a9892' }}>—</span> },
          { title: t('common.item'), dataIndex: 'name' },
          { title: t('sales.qty'), dataIndex: 'quantity', width: 70, align: 'right' as const },
          { title: t('sales.extraction.handling'), width: 220, render: (_: unknown, x: InventoryItem) => <>{x.fragile && <Tag color="red">{t('sales.fragile')}</Tag>}{x.handling && <span>{x.handling}</span>}{!x.fragile && !x.handling && '—'}</> },
          { title: t('sales.extraction.reviewNotes'), dataIndex: 'notes' }]} />
        {(result.boxes?.length ?? 0) > 0 && <>
          <h4 className="lead-extract-heading">{t('sales.extraction.boxesNeeded')} <small>{t('sales.extraction.boxesTotal', { total: result.boxes!.reduce((n, b) => n + b.quantity, 0) })}</small></h4>
          <DataGrid rowKey="key" dataSource={result.boxes!.map((x, i) => ({ ...x, key: i }))} pagination={false} columns={[
            { title: t('sales.extraction.boxType'), dataIndex: 'boxType' }, { title: t('sales.qty'), dataIndex: 'quantity', width: 70, align: 'right' as const },
            { title: t('sales.extraction.contents'), dataIndex: 'contents' }, { title: t('common.room'), dataIndex: 'room', render: (v: string | null) => v || '—' }]} />
        </>}
        {result.usage && <p className="lead-extract-usage">{t('sales.extraction.usage', { provider: providerName(result.provider) + (result.model ? ' (' + result.model + ')' : ''), input: result.usage.inputTokens, output: result.usage.outputTokens })}{result.usage.audioSeconds ? ' · ' + t('sales.extraction.soundSeconds', { seconds: Math.round(result.usage.audioSeconds) }) : ''} · {result.usage.cost != null ? <strong>{t('sales.approx')} ${formatNumber(result.usage.cost, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</strong> : t('sales.extraction.costNotCalculated', { provider: providerName(result.provider) })}</p>}
        {result.transcript && <Collapse style={{ marginTop: 12 }} size="small" items={[{ key: 't', label: t('sales.extraction.transcript'), children: <p className="lead-extract-transcript">{result.transcript}</p> }]} />}
      </>}
    </Modal></>
}
