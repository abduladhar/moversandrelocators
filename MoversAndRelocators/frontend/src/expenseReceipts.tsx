import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Empty, Image, Modal, Popconfirm, Space, Spin, Tag, Tooltip, message } from 'antd'
import { CameraOutlined, DeleteOutlined, FileOutlined, FilePdfOutlined, PaperClipOutlined } from '@ant-design/icons'
import { request, uploadFile } from './api'
import type { PresignedUpload } from './types'
import { formatDateTime, formatNumber, t as translate, useT } from './i18n'

/** The kind of expense a receipt belongs to (matches the API). */
export type ReceiptKind = 'SURVEY' | 'PICKUP' | 'PACKING' | 'DELIVERY' | 'OPERATIONS' | 'CASH'
export type ExpenseReceipt = { id: string; kind: ReceiptKind; expenseId: string; originalFileName: string; contentType: string; sizeBytes: number; uploadedBy: string; uploadedAtUtc: string | null }

const MAX_BYTES = 25 * 1024 * 1024
export const receiptAccept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx'

export const receiptsApi = {
  // POST so long lists (hundreds of queue rows) are not limited by the URL length.
  list: (expenseIds: string[]) => expenseIds.length ? request<ExpenseReceipt[]>('/api/expense-receipts/query', { method: 'POST', body: JSON.stringify({ expenseIds }) }) : Promise.resolve([]),
  upload: (kind: ReceiptKind, expenseId: string, file: File) => uploadFile<ExpenseReceipt>(file,
    () => request<PresignedUpload>(`/api/expense-receipts/${kind}/${expenseId}/upload-requests`, { method: 'POST', body: JSON.stringify({ fileName: file.name, contentType: file.type || 'application/octet-stream', sizeBytes: file.size }) }),
    id => request<ExpenseReceipt>(`/api/expense-receipts/${id}/complete`, { method: 'POST' })),
  download: (id: string) => request<{ url: string }>(`/api/expense-receipts/${id}/download`),
  remove: (id: string) => request<boolean>(`/api/expense-receipts/${id}`, { method: 'DELETE' }),
}

/**
 * Phone photos are often 3–10 MB: shrink large images to at most 2000 px (JPEG) before uploading.
 * Anything that cannot be decoded (e.g. HEIC on some browsers) or would not get smaller is sent unchanged.
 */
export async function prepareReceipt(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.size < 600 * 1024 || typeof createImageBitmap !== 'function') return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file
  } catch { return file }
}

/** Uploads receipts one by one; returns how many succeeded and reports failures. */
export async function uploadReceipts(kind: ReceiptKind, expenseId: string, files: File[]) {
  let done = 0
  for (const original of files) {
    try {
      const file = await prepareReceipt(original)
      if (file.size > MAX_BYTES) throw new Error(translate('expenses.receipts.tooLarge', { name: file.name }))
      await receiptsApi.upload(kind, expenseId, file); done++
    } catch (e) { message.error(e instanceof Error ? e.message : translate('expenses.receipts.uploadFailed', { name: original.name })) }
  }
  return done
}

/** Receipts of several expenses at once, grouped by expense id. */
export function useReceipts(expenseIds: string[]) {
  const key = [...expenseIds].sort().join(',')
  const [items, setItems] = useState<ExpenseReceipt[]>([])
  const reload = useCallback(() => receiptsApi.list(key ? key.split(',') : []).then(setItems).catch(() => setItems([])), [key])
  useEffect(() => { void reload() }, [reload])
  const byExpense = useMemo(() => { const m = new Map<string, ExpenseReceipt[]>(); for (const x of items) m.set(x.expenseId, [...(m.get(x.expenseId) ?? []), x]); return m }, [items])
  return { byExpense, reload }
}

/** Hidden file inputs behind "Take photo" (opens the camera on phones) and "Attach file". */
function PickButtons({ onFiles, busy, size }: { onFiles: (files: File[]) => void; busy?: boolean; size?: 'small' | 'middle' }) {
  const camera = useRef<HTMLInputElement>(null), files = useRef<HTMLInputElement>(null)
  const { t } = useT()
  const take = (e: React.ChangeEvent<HTMLInputElement>) => { const list = Array.from(e.target.files ?? []); e.target.value = ''; if (list.length) onFiles(list) }
  return <Space wrap>
    <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={take} />
    <input ref={files} type="file" accept={receiptAccept} multiple hidden onChange={take} />
    <Button size={size} icon={<CameraOutlined />} loading={busy} onClick={() => camera.current?.click()}>{t('expenses.receipts.takePhoto')}</Button>
    <Button size={size} icon={<PaperClipOutlined />} disabled={busy} onClick={() => files.current?.click()}>{t('expenses.receipts.attachFile')}</Button>
  </Space>
}

/** For "add expense" forms: collect photos/files before the expense exists; upload them with uploadReceipts after saving. */
export function ReceiptPicker({ value, onChange }: { value: File[]; onChange: (files: File[]) => void }) {
  return <div className="receipt-picker">
    <PickButtons size="small" onFiles={f => onChange([...value, ...f])} />
    {value.length > 0 && <div className="receipt-picker-files">{value.map((f, i) => <Tag key={i} closable onClose={() => onChange(value.filter((_, n) => n !== i))} icon={f.type.startsWith('image/') ? <CameraOutlined /> : <FileOutlined />}>{f.name}</Tag>)}</div>}
  </div>
}

/** Paper-clip button showing how many receipts an expense has; opens the receipts window. */
export function ReceiptsButton({ kind, expenseId, receipts, editable = true, onChanged, title }: { kind: ReceiptKind; expenseId: string; receipts: ExpenseReceipt[]; editable?: boolean; onChanged: () => void; title?: string }) {
  const [open, setOpen] = useState(false), { t } = useT()
  return <>
    <Tooltip title={receipts.length ? t('expenses.receipts.count', { count: receipts.length }) : editable ? t('expenses.receipts.addTip') : t('expenses.receipts.none')}>
      <Button size="small" type={receipts.length ? 'default' : 'text'} icon={<PaperClipOutlined />} aria-label={t('expenses.receipts.receipts')} onClick={() => setOpen(true)} disabled={!editable && !receipts.length}>{receipts.length || null}</Button>
    </Tooltip>
    {open && <ReceiptsModal kind={kind} expenseId={expenseId} receipts={receipts} editable={editable} title={title} onChanged={onChanged} onClose={() => setOpen(false)} />}
  </>
}

function ReceiptsModal({ kind, expenseId, receipts, editable, title, onChanged, onClose }: { kind: ReceiptKind; expenseId: string; receipts: ExpenseReceipt[]; editable: boolean; title?: string; onChanged: () => void; onClose: () => void }) {
  const [urls, setUrls] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false), { t } = useT()
  useEffect(() => {
    // Signed preview links for images (valid for a few minutes).
    for (const r of receipts) if (r.contentType.startsWith('image/') && !urls[r.id])
      void receiptsApi.download(r.id).then(x => setUrls(u => ({ ...u, [r.id]: x.url }))).catch(() => undefined)
  }, [receipts])
  const add = async (files: File[]) => { setBusy(true); const n = await uploadReceipts(kind, expenseId, files); setBusy(false); if (n) { message.success(t('expenses.receipts.attached', { count: n })); onChanged() } }
  const open = async (r: ExpenseReceipt) => { try { window.open((await receiptsApi.download(r.id)).url, '_blank', 'noopener') } catch (e) { message.error(e instanceof Error ? e.message : t('expenses.receipts.openFailed')) } }
  const remove = async (r: ExpenseReceipt) => { try { await receiptsApi.remove(r.id); message.success(t('expenses.receipts.removed')); onChanged() } catch (e) { message.error(e instanceof Error ? e.message : t('expenses.receipts.removeFailed')) } }
  return <Modal centered open title={title ?? t('expenses.receipts.title')} footer={<Button onClick={onClose}>{t('common.close')}</Button>} onCancel={onClose} width={640}>
    {editable && <div className="receipt-actions"><PickButtons onFiles={f => void add(f)} busy={busy} /><small>{t('expenses.receipts.help')}</small></div>}
    {busy && <div className="receipt-uploading"><Spin size="small" /> {t('expenses.receipts.uploading')}</div>}
    {!receipts.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('expenses.receipts.empty')} /> :
      <Image.PreviewGroup><ul className="receipt-list">{receipts.map(r => <li key={r.id}>
        <div className="receipt-thumb">{r.contentType.startsWith('image/') ? (urls[r.id] ? <Image src={urls[r.id]} alt={r.originalFileName} width={64} height={64} style={{ objectFit: 'cover' }} /> : <Spin size="small" />) : r.contentType === 'application/pdf' ? <FilePdfOutlined /> : <FileOutlined />}</div>
        <div className="receipt-meta"><a onClick={() => void open(r)}>{r.originalFileName}</a><small>{(r.sizeBytes / 1024 / 1024 >= 1 ? formatNumber(r.sizeBytes / 1024 / 1024, { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' MB' : formatNumber(Math.max(1, Math.round(r.sizeBytes / 1024))) + ' KB')} · {r.uploadedBy}{r.uploadedAtUtc ? ' · ' + formatDateTime(r.uploadedAtUtc) : ''}</small></div>
        {editable && <Popconfirm title={t('expenses.receipts.removeTitle')} okText={t('common.remove')} cancelText={t('common.cancel')} okButtonProps={{ danger: true }} onConfirm={() => void remove(r)}><Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={t('expenses.receipts.remove')} /></Popconfirm>}
      </li>)}</ul></Image.PreviewGroup>}
  </Modal>
}
