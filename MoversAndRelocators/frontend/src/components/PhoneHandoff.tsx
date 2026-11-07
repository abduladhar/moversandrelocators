import { Button, QRCode, Typography, message } from 'antd'
import { CopyOutlined, MailOutlined, MobileOutlined, ShareAltOutlined, WhatsAppOutlined } from '@ant-design/icons'
import { useT } from '../i18n'

const digits = (phone?: string | null) => (phone ?? '').replace(/\D/g, '')

/**
 * "Continue on your phone": a QR code for the customer's upload link, plus ways to send the link to themselves
 * (WhatsApp to their own number, email to their own address, copy, the device's share sheet). Shown on computers,
 * where the camera and microphone are less handy than on a phone.
 */
export function PhoneHandoff({ url, phone, email, companyName }: { url: string; phone?: string | null; email?: string | null; companyName?: string }) {
  const { t } = useT()
  const text = t('customer.leadForm.phoneMessage', { company: companyName || t('customer.leadForm.theMovers'), url })
  const number = digits(phone)
  const whatsApp = () => window.open(`https://wa.me/${number.length >= 8 ? number : ''}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  const mail = () => window.open(`mailto:${encodeURIComponent(email ?? '')}?subject=${encodeURIComponent(t('customer.leadForm.phoneSubject'))}&body=${encodeURIComponent(text)}`, '_self')
  const copy = () => navigator.clipboard.writeText(url).then(() => message.success(t('customer.leadForm.linkCopied'))).catch(() => message.info(t('customer.leadForm.copyManual', { url })))
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return <aside className="phone-handoff" aria-labelledby="phone-handoff-title">
    <div className="phone-handoff-head"><MobileOutlined /><div>
      <Typography.Title level={5} id="phone-handoff-title">{t('customer.leadForm.phoneTitle')}</Typography.Title>
      <Typography.Text type="secondary">{t('customer.leadForm.phoneText')}</Typography.Text></div></div>
    <div className="phone-handoff-qr"><QRCode value={url} size={168} bordered={false} errorLevel="M" /></div>
    <Typography.Text type="secondary" className="phone-handoff-or">{t('customer.leadForm.phoneOr')}</Typography.Text>
    <div className="phone-handoff-actions">
      <Button icon={<WhatsAppOutlined />} onClick={whatsApp}>WhatsApp</Button>
      <Button icon={<MailOutlined />} onClick={mail}>{t('customer.leadForm.sendEmail')}</Button>
      <Button icon={<CopyOutlined />} onClick={() => void copy()}>{t('customer.leadForm.copyLink')}</Button>
      {canShare && <Button icon={<ShareAltOutlined />} onClick={() => void navigator.share({ title: t('customer.leadForm.phoneSubject'), text, url }).catch(() => undefined)}>{t('customer.leadForm.share')}</Button>}
    </div>
  </aside>
}
