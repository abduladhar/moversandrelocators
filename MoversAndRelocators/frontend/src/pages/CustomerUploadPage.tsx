import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Result, Typography, message } from 'antd'
import { publicUploadApi } from '../api'
import { MediaCapture } from '../components/MediaCapture'
import type { PublicUploadInfo } from '../types'
import { formatDateTime, useT } from '../i18n'

export function CustomerUploadPage({ token }: { token: string }) {
  const { t } = useT()
  const [items, setItems] = useState(''), [description, setDescription] = useState(''), [savingDetails, setSavingDetails] = useState(false)
  const [info, setInfo] = useState<PublicUploadInfo>()
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    publicUploadApi.info(token).then(data => { setInfo(data); setItems(data.customerItems ?? ''); setDescription(data.customerDescription ?? '') }).catch(() => setInvalid(true))
  }, [token])

  const saveDetails = async () => {
    setSavingDetails(true)
    try { await publicUploadApi.saveDetails(token, items, description); message.success(t('customer.upload.detailsSaved')) }
    catch (error) { message.error(error instanceof Error ? error.message : t('customer.upload.saveFailed')) }
    finally { setSavingDetails(false) }
  }

  if (invalid) {
    return <div className="public-upload-page"><Result status="warning" title={t('customer.upload.unavailableTitle')} subTitle={t('customer.shared.linkInvalid')} /></div>
  }

  return (
    <div className="public-upload-page">
      <Card className="public-upload-card" loading={!info}>
        <div className="upload-brand"><span>{(info?.tenantName || 'M').charAt(0).toUpperCase()}</span><strong>{info?.tenantName ?? ''}</strong></div>
        <Typography.Title level={2}>{t('customer.upload.title')}</Typography.Title>
        <Typography.Paragraph type="secondary">{t('customer.upload.intro', { name: info?.customerName ?? '' })}</Typography.Paragraph>
        <Alert showIcon type="info" message={t('customer.shared.reference', { number: info?.leadNumber ?? '' })} description={info ? t('customer.shared.linkExpires', { date: formatDateTime(info.expiresAtUtc) }) : ''} />

        {(info?.requestedItems || info?.description) && <Alert type="info" style={{ marginTop: 16, whiteSpace: 'pre-wrap' }} message={t('customer.upload.fromCoordinator')} description={[info.requestedItems, info.description].filter(Boolean).join('\n\n')} />}
        <Form layout="vertical" style={{ marginTop: 20 }}>
          <Form.Item label={t('customer.upload.itemsLabel')}><Input.TextArea rows={3} maxLength={4000} value={items} onChange={e => setItems(e.target.value)} placeholder={t('customer.upload.itemsPlaceholder')} /></Form.Item>
          <Form.Item label={t('customer.upload.descriptionLabel')}><Input.TextArea rows={2} maxLength={4000} value={description} onChange={e => setDescription(e.target.value)} placeholder={t('customer.upload.descriptionPlaceholder')} /></Form.Item>
          <Button loading={savingDetails} onClick={() => void saveDetails()}>{t('customer.upload.saveDetails')}</Button>
        </Form>
        <MediaCapture uploadFile={file => publicUploadApi.upload(token, file)} beforeUpload={() => publicUploadApi.saveDetails(token, items, description)} />
      </Card>
    </div>
  )
}
