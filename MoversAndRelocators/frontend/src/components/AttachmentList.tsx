import { Button, Empty, Popconfirm, Space, Tag, Tooltip } from 'antd'
import { AudioOutlined, DeleteOutlined, DownloadOutlined, FileExcelOutlined, FileImageOutlined, FileOutlined, FilePdfOutlined, FileWordOutlined, VideoCameraOutlined } from '@ant-design/icons'
import type { SurveyAttachment } from '../types'
import { formatDateTime, formatNumber, useT } from '../i18n'

const oneDecimal = (value: number) => formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const formatBytes = (bytes: number) => bytes < 1024 ? `${formatNumber(bytes)} B` : bytes < 1048576 ? `${oneDecimal(bytes / 1024)} KB` : `${oneDecimal(bytes / 1048576)} MB`

function FileIcon({ type }: { type: string }) {
  if (type.startsWith('image/')) return <FileImageOutlined />
  if (type.startsWith('video/')) return <VideoCameraOutlined />
  if (type.startsWith('audio/')) return <AudioOutlined />
  if (type.includes('pdf')) return <FilePdfOutlined />
  if (type.includes('word')) return <FileWordOutlined />
  if (type.includes('excel') || type.includes('spreadsheet')) return <FileExcelOutlined />
  return <FileOutlined />
}

type Props = { files: SurveyAttachment[]; showSource?: boolean; emptyText: string; onDownload?: (file: SurveyAttachment) => void; onDelete?: (file: SurveyAttachment) => void }

/** Uploaded survey files as compact rows: type icon, name, size, date and optional actions. */
export function AttachmentList({ files, showSource, emptyText, onDownload, onDelete }: Props) {
  const { t } = useT()
  if (!files.length) return <Empty className="attachment-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
  return <ul className="attachment-list">{files.map(file => <li key={file.id}>
    <span className="attachment-icon"><FileIcon type={file.contentType} /></span>
    <div className="attachment-meta"><strong title={file.originalFileName}>{file.originalFileName}</strong>
      <small>{formatBytes(file.sizeBytes)}{file.uploadedAtUtc && <> · {formatDateTime(file.uploadedAtUtc)}</>}{showSource && <> · {file.uploadedBy}</>}</small></div>
    {showSource && <Tag className={`attachment-source is-${file.source.toLowerCase()}`}>{file.source === 'CUSTOMER' ? t('common.customer') : t('sales.attachments.staff')}</Tag>}
    {(onDownload || onDelete) && <Space size={0}>
      {onDownload && <Tooltip title={t('common.download')}><Button type="text" size="small" aria-label={t('sales.attachments.downloadFile', { file: file.originalFileName })} icon={<DownloadOutlined />} onClick={() => onDownload(file)} /></Tooltip>}
      {onDelete && <Popconfirm title={t('sales.attachments.removeConfirm')} okText={t('common.remove')} cancelText={t('common.cancel')} okButtonProps={{ danger: true }} onConfirm={() => onDelete(file)}><Button type="text" size="small" danger aria-label={t('sales.attachments.removeFile', { file: file.originalFileName })} icon={<DeleteOutlined />} /></Popconfirm>}
    </Space>}
  </li>)}</ul>
}

export const uploadAccept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx'
