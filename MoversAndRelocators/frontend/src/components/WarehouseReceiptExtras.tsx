import { useEffect, useState } from 'react'
import { Button, Card, Empty, Form, Modal, Popconfirm, Space, message } from 'antd'
import { DeleteOutlined, DownloadOutlined, EditOutlined } from '@ant-design/icons'
import { warehouseApi, type WarehouseFile, type WarehouseReceipt, type WarehouseShipping } from '../warehouseApi'
import { WarehouseShippingFields } from './WarehouseShippingFields'
import { MediaCapture } from './MediaCapture'
import { formatBytes } from './AttachmentList'

export function WarehouseReceiptExtras({ receipt, onChanged }: { receipt: WarehouseReceipt; onChanged: (receipt: WarehouseReceipt) => void }) {
  const [files, setFiles] = useState<WarehouseFile[]>([]), [open, setOpen] = useState(false), [saving, setSaving] = useState(false)
  const [form] = Form.useForm<{ shipping: WarehouseShipping }>()
  const load = async () => { try { setFiles(await warehouseApi.files(receipt.id)) } catch (e) { message.error(e instanceof Error ? e.message : 'Unable to load attachments') } }
  useEffect(() => { void load() }, [receipt.id])
  const edit = () => { form.resetFields(); form.setFieldsValue({ shipping: receipt.details.shipping ?? { shipper: { name: receipt.details.customerName, phone: receipt.details.phone, address: receipt.details.address } } }); setOpen(true) }
  const save = async () => {
    const v = await form.validateFields(); setSaving(true)
    try { onChanged(await warehouseApi.shipping(receipt.id, receipt.version, v.shipping)); setOpen(false); message.success('Shipping details saved') }
    catch (e) { message.error(e instanceof Error ? e.message : 'Unable to save shipping details') }
    finally { setSaving(false) }
  }
  const download = async (file: WarehouseFile) => { try { const result = await warehouseApi.download(receipt.id, file.id); window.open(result.url, '_blank', 'noopener,noreferrer') } catch (e) { message.error(e instanceof Error ? e.message : 'Unable to download') } }
  const remove = async (file: WarehouseFile) => { try { await warehouseApi.removeFile(receipt.id, file.id); await load() } catch (e) { message.error(e instanceof Error ? e.message : 'Unable to remove attachment') } }
  return <div className="warehouse-receipt-extras">
    <Button icon={<EditOutlined />} onClick={edit} style={{ margin: '16px 0' }}>Edit shipper, consignee & drop details</Button>
    <Card title={`Warehouse attachments (${files.length})`}>
      {files.length ? <ul className="pickup-list">{files.map(file => <li key={file.id}><div><strong>{file.originalFileName}</strong><small>{formatBytes(file.sizeBytes)} · {file.uploadedBy}{file.uploadedAtUtc ? ` · ${new Date(file.uploadedAtUtc).toLocaleString()}` : ''}</small></div><Space>
        <Button aria-label={`Download ${file.originalFileName}`} icon={<DownloadOutlined />} onClick={() => void download(file)}>Download</Button>
        <Popconfirm title="Remove this attachment from the receipt?" onConfirm={() => void remove(file)}><Button aria-label={`Remove ${file.originalFileName}`} danger icon={<DeleteOutlined />} /></Popconfirm>
      </Space></li>)}</ul> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No attachments yet" />}
      <MediaCapture uploadFile={async file => { await warehouseApi.upload(receipt.id, file); await load() }} note="Attach warehouse photos, videos, audio, PDFs, Word or Excel files to this receipt. Files are private. Maximum 500 MB per file." />
    </Card>
    <Modal centered title="Shipper, consignee & drop details" open={open} width={760} onCancel={() => !saving && setOpen(false)} confirmLoading={saving} onOk={() => void save()} okText="Save details" destroyOnHidden>
      <Form form={form} layout="vertical" disabled={saving}><WarehouseShippingFields /></Form>
    </Modal>
  </div>
}
