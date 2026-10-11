import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Result, Typography, message } from 'antd'
import { publicUploadApi } from '../api'
import { MediaCapture } from '../components/MediaCapture'
import type { PublicUploadInfo } from '../types'

export function CustomerUploadPage({ token }: { token: string }) {
  const [items, setItems] = useState(''), [description, setDescription] = useState(''), [savingDetails, setSavingDetails] = useState(false)
  const [info, setInfo] = useState<PublicUploadInfo>()
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    publicUploadApi.info(token).then(data => { setInfo(data); setItems(data.customerItems ?? ''); setDescription(data.customerDescription ?? '') }).catch(() => setInvalid(true))
  }, [token])

  const saveDetails = async () => {
    setSavingDetails(true)
    try { await publicUploadApi.saveDetails(token, items, description); message.success('Move details saved') }
    catch (error) { message.error(error instanceof Error ? error.message : 'Unable to save details') }
    finally { setSavingDetails(false) }
  }

  if (invalid) {
    return <div className="public-upload-page"><Result status="warning" title="Upload link unavailable" subTitle="This link is invalid, expired or has been revoked. Please contact your move coordinator." /></div>
  }

  return (
    <div className="public-upload-page">
      <Card className="public-upload-card" loading={!info}>
        <div className="upload-brand"><span>M</span><strong>{info?.tenantName ?? 'Movers'}</strong></div>
        <Typography.Title level={2}>Share your move details</Typography.Title>
        <Typography.Paragraph type="secondary">
          Record or upload videos, photos, voice notes and documents for {info?.customerName}. No account is required.
        </Typography.Paragraph>
        <Alert showIcon type="info" message={`Reference ${info?.leadNumber ?? ''}`} description={info ? `This secure link expires ${new Date(info.expiresAtUtc).toLocaleString()}.` : ''} />

        {(info?.requestedItems || info?.description) && <Alert type="info" style={{ marginTop: 16, whiteSpace: 'pre-wrap' }} message="From your move coordinator" description={[info.requestedItems, info.description].filter(Boolean).join('\n\n')} />}
        <Form layout="vertical" style={{ marginTop: 20 }}>
          <Form.Item label="Items you want to move (optional)"><Input.TextArea rows={3} maxLength={4000} value={items} onChange={e => setItems(e.target.value)} placeholder="For example: 2 beds, 1 sofa, 6 chairs" /></Form.Item>
          <Form.Item label="Description (optional)"><Input.TextArea rows={2} maxLength={4000} value={description} onChange={e => setDescription(e.target.value)} placeholder="Add room details, special handling, or anything we should know" /></Form.Item>
          <Button loading={savingDetails} onClick={() => void saveDetails()}>Save details</Button>
        </Form>
        <MediaCapture uploadFile={file => publicUploadApi.upload(token, file)} beforeUpload={() => publicUploadApi.saveDetails(token, items, description)} />
      </Card>
    </div>
  )
}
