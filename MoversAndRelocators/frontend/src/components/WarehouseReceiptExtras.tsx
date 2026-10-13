import { useEffect, useState } from 'react'
import { Button, Card, Empty, Form, Modal, Popconfirm, Space, message } from 'antd'
import { DeleteOutlined, DownloadOutlined, EditOutlined } from '@ant-design/icons'
import { warehouseApi, type WarehouseFile, type WarehouseReceipt, type WarehouseShipping } from '../warehouseApi'
import { WarehouseShippingFields } from './WarehouseShippingFields'
import { MediaCapture } from './MediaCapture'
import { formatBytes } from './AttachmentList'
import { formatDateTime, useT } from '../i18n'

export function WarehouseReceiptExtras({ receipt, onChanged }: { receipt: WarehouseReceipt; onChanged: (receipt: WarehouseReceipt) => void }) {
  const { t } = useT()
  const [files, setFiles] = useState<WarehouseFile[]>([]), [open, setOpen] = useState(false), [saving, setSaving] = useState(false)
  const [form] = Form.useForm<{ shipping: WarehouseShipping }>()
  const load = async () => { try { setFiles(await warehouseApi.files(receipt.id)) } catch (e) { message.error(e instanceof Error ? e.message : t('warehouse.extras.attachmentsFailed')) } }
  useEffect(() => { void load() }, [receipt.id])
  const edit = () => { form.resetFields(); form.setFieldsValue({ shipping: receipt.details.shipping ?? { shipper: { name: receipt.details.customerName, phone: receipt.details.phone, address: receipt.details.address } } }); setOpen(true) }
  const save = async () => {
    const v = await form.validateFields(); setSaving(true)
    try { onChanged(await warehouseApi.shipping(receipt.id, receipt.version, v.shipping)); setOpen(false); message.success(t('warehouse.extras.shippingSaved')) }
    catch (e) { message.error(e instanceof Error ? e.message : t('warehouse.extras.shippingFailed')) }
    finally { setSaving(false) }
  }
  const download = async (file: WarehouseFile) => { try { const result = await warehouseApi.download(receipt.id, file.id); window.open(result.url, '_blank', 'noopener,noreferrer') } catch (e) { message.error(e instanceof Error ? e.message : t('warehouse.extras.downloadFailed')) } }
  const remove = async (file: WarehouseFile) => { try { await warehouseApi.removeFile(receipt.id, file.id); await load() } catch (e) { message.error(e instanceof Error ? e.message : t('warehouse.extras.removeFailed')) } }
  return <div className="warehouse-receipt-extras">
    <Button icon={<EditOutlined />} onClick={edit} style={{ margin: '16px 0' }}>{t('warehouse.extras.editShipping')}</Button>
    <Card title={t('warehouse.extras.attachments', { count: files.length })}>
      {files.length ? <ul className="pickup-list">{files.map(file => <li key={file.id}><div><strong>{file.originalFileName}</strong><small>{formatBytes(file.sizeBytes)} · {file.uploadedBy}{file.uploadedAtUtc ? ` · ${formatDateTime(file.uploadedAtUtc)}` : ''}</small></div><Space>
        <Button aria-label={t('warehouse.extras.downloadFile', { name: file.originalFileName })} icon={<DownloadOutlined />} onClick={() => void download(file)}>{t('common.download')}</Button>
        <Popconfirm title={t('warehouse.extras.removeConfirm')} okText={t('common.remove')} cancelText={t('common.cancel')} onConfirm={() => void remove(file)}><Button aria-label={t('warehouse.extras.removeFile', { name: file.originalFileName })} danger icon={<DeleteOutlined />} /></Popconfirm>
      </Space></li>)}</ul> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('warehouse.extras.noAttachments')} />}
      <MediaCapture uploadFile={async file => { await warehouseApi.upload(receipt.id, file); await load() }} note={t('warehouse.extras.uploadNote')} />
    </Card>
    <Modal centered title={t('warehouse.extras.shippingTitle')} open={open} width={760} onCancel={() => !saving && setOpen(false)} confirmLoading={saving} onOk={() => void save()} okText={t('warehouse.extras.saveDetails')} cancelText={t('common.cancel')} destroyOnHidden>
      <Form form={form} layout="vertical" disabled={saving}><WarehouseShippingFields /></Form>
    </Modal>
  </div>
}
