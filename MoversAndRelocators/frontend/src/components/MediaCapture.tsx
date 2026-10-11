import { useEffect, useRef, useState } from 'react'
import { Button, Card, Empty, List, Progress, Space, Tag, Typography, message } from 'antd'
import { AudioOutlined, CameraOutlined, CloudUploadOutlined, DeleteOutlined, FileOutlined, FolderOpenOutlined, PauseCircleOutlined, VideoCameraOutlined } from '@ant-design/icons'
import { uploadAccept } from './AttachmentList'

type CaptureKind = 'audio' | 'video' | 'photo' | null
const maxBytes = 500 * 1024 * 1024

type Props = {
  /** Uploads one file; called sequentially for each queued file. */
  uploadFile: (file: File) => Promise<unknown>
  /** Runs once before the queue is uploaded, e.g. to save accompanying details. */
  beforeUpload?: () => Promise<unknown>
  disabled?: boolean
  /** Footer note under the upload button; defaults to the customer-facing privacy notice. */
  note?: string
}

/** Customer media capture: record audio/video, take photos or browse files, review the queue, then upload. */
export function MediaCapture({ uploadFile, beforeUpload, disabled, note = 'Files are stored privately for your move coordinator. Maximum 500 MB per file. Camera and microphone access require HTTPS or localhost.' }: Props) {
  const [files, setFiles] = useState<File[]>([]), [uploading, setUploading] = useState(false), [progress, setProgress] = useState(0)
  const [captureKind, setCaptureKind] = useState<CaptureKind>(null), [recording, setRecording] = useState(false), [seconds, setSeconds] = useState(0)
  const browseInput = useRef<HTMLInputElement>(null), video = useRef<HTMLVideoElement>(null), recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null), chunks = useRef<Blob[]>([]), timer = useRef<number | null>(null)

  const stopMedia = () => {
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = null
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
  }
  useEffect(() => stopMedia, [])
  useEffect(() => { if (video.current && stream.current && captureKind !== 'audio') video.current.srcObject = stream.current }, [captureKind, recording])

  const chooseCapture = async (kind: Exclude<CaptureKind, null>) => {
    if (!navigator.mediaDevices?.getUserMedia || (kind !== 'photo' && typeof MediaRecorder === 'undefined')) { message.error('Recording is not supported by this browser. Use Browse files instead.'); return }
    if (recording) return
    stopMedia(); setCaptureKind(kind); setSeconds(0)
    try {
      stream.current = await navigator.mediaDevices.getUserMedia(kind === 'audio' ? { audio: true } : { audio: kind === 'video', video: { facingMode: { ideal: 'environment' } } })
      if (kind !== 'audio' && video.current) video.current.srcObject = stream.current
    } catch {
      setCaptureKind(null)
      message.error(`Allow ${kind === 'audio' ? 'microphone' : 'camera and microphone'} access to record.`)
    }
  }

  const takePhoto = () => {
    const camera = video.current
    if (!camera?.videoWidth) { message.info('Wait for the camera preview.'); return }
    const canvas = document.createElement('canvas')
    canvas.width = camera.videoWidth; canvas.height = camera.videoHeight
    canvas.getContext('2d')?.drawImage(camera, 0, 0)
    canvas.toBlob(blob => {
      if (blob) setFiles(current => [...current, new File([blob], 'photo-' + Date.now() + '.jpg', { type: 'image/jpeg' })])
      stopMedia(); setCaptureKind(null)
    }, 'image/jpeg', 0.9)
  }

  const startRecording = () => {
    if (!stream.current || !captureKind) return
    const recordedKind = captureKind
    const preferred = recordedKind === 'audio' ? ['audio/webm;codecs=opus', 'audio/mp4'] : ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4']
    const mimeType = preferred.find(type => MediaRecorder.isTypeSupported(type))
    const activeRecorder = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined)
    chunks.current = []
    activeRecorder.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data) }
    activeRecorder.onstop = () => {
      const type = activeRecorder.mimeType || (recordedKind === 'audio' ? 'audio/webm' : 'video/webm')
      const extension = type.includes('mp4') ? 'mp4' : 'webm'
      setFiles(current => [...current, new File([new Blob(chunks.current, { type })], `${recordedKind}-recording-${Date.now()}.${extension}`, { type })])
      setRecording(false); setCaptureKind(null); stopMedia()
    }
    recorder.current = activeRecorder
    activeRecorder.start(1000)
    setRecording(true); setSeconds(0)
    timer.current = window.setInterval(() => setSeconds(value => value + 1), 1000)
  }
  const stopRecording = () => { if (recorder.current?.state === 'recording') recorder.current.stop() }
  const closeRecorder = () => { if (recording) { recorder.current?.stop(); return } stopMedia(); setCaptureKind(null) }

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const selected = Array.from(list), valid = selected.filter(file => file.size > 0 && file.size <= maxBytes)
    if (valid.length !== selected.length) message.error('Each file must be between 1 byte and 500 MB.')
    setFiles(current => [...current, ...valid])
  }

  const upload = async () => {
    if (!files.length) return
    setUploading(true); setProgress(0)
    try {
      await beforeUpload?.()
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        await uploadFile(file)
        setFiles(current => current.filter(queued => queued !== file))
        setProgress(Math.round(((i + 1) / files.length) * 100))
      }
      setFiles([])
      message.success('Files uploaded successfully')
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : 'Upload failed.')
    } finally { setUploading(false) }
  }

  return <div className="media-capture">
    <fieldset disabled={disabled || uploading || recording} className="capture-actions" style={{ border: 0, padding: 0 }}>
      <button type="button" onClick={() => void chooseCapture('audio')}><AudioOutlined /><strong>Audio</strong><small>Record voice</small></button>
      <button type="button" onClick={() => void chooseCapture('video')}><VideoCameraOutlined /><strong>Video</strong><small>Record rooms</small></button>
      <button type="button" onClick={() => void chooseCapture('photo')}><CameraOutlined /><strong>Image</strong><small>Take photos</small></button>
      <button type="button" onClick={() => browseInput.current?.click()}><FolderOpenOutlined /><strong>Browse files</strong><small>Documents and media</small></button>
    </fieldset>
    <input ref={browseInput} hidden type="file" accept={uploadAccept} multiple onChange={event => { addFiles(event.target.files); event.target.value = '' }} />

    {captureKind && <Card size="small" className="recorder-panel">
      {captureKind !== 'audio' ? <video ref={video} autoPlay muted playsInline aria-label="Camera preview" /> : <div className={`audio-pulse ${recording ? 'is-recording' : ''}`}><AudioOutlined /></div>}
      <Space wrap>
        <Tag color={recording ? 'red' : 'blue'}>{recording ? `Recording ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Ready'}</Tag>
        {captureKind === 'photo' && <Button type="primary" icon={<CameraOutlined />} onClick={takePhoto}>Take photo</Button>}
        {!recording && captureKind !== 'photo' && <Button type="primary" danger icon={captureKind === 'audio' ? <AudioOutlined /> : <VideoCameraOutlined />} onClick={startRecording}>Start recording</Button>}
        {recording && <Button danger icon={<PauseCircleOutlined />} onClick={stopRecording}>Stop and add</Button>}
        <Button onClick={closeRecorder}>{recording ? 'Stop and close' : 'Close'}</Button>
      </Space>
    </Card>}

    {files.length ? <List size="small" header={`${files.length} file${files.length > 1 ? 's' : ''} ready`} dataSource={files} renderItem={(file, index) =>
      <List.Item actions={[<Button aria-label={`Remove ${file.name}`} key="remove" disabled={uploading} type="text" danger icon={<DeleteOutlined />} onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))} />]}>
        <List.Item.Meta avatar={<FileOutlined />} title={file.name} description={`${(file.size / 1048576).toFixed(1)} MB · ${file.type || 'File'}`} />
      </List.Item>} />
      : !captureKind && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Choose one of the options above" />}

    {uploading && <Progress percent={progress} />}
    <Button block size="large" type="primary" icon={<CloudUploadOutlined />} loading={uploading} disabled={disabled || !files.length || Boolean(captureKind)} onClick={() => void upload()}>
      Upload {files.length || ''} file{files.length === 1 ? '' : 's'}
    </Button>
    <Typography.Text className="upload-privacy" type="secondary">{note}</Typography.Text>
  </div>
}
