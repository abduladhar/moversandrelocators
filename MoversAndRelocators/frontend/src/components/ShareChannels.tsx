import { Button, Tooltip, message } from 'antd'
import { CopyOutlined, LinkedinOutlined, MailOutlined, MessageOutlined, ShareAltOutlined, WhatsAppOutlined } from '@ant-design/icons'
import { useT } from '../i18n'

type Props = {
  /** The customer link being shared. */
  url: string
  /** The whole message, link included, as it should arrive. */
  text: string
  subject?: string
  phone?: string | null
  email?: string | null
  size?: 'small' | 'middle' | 'large'
  /** Buttons unique to one screen (an "Open page" link, a second copy button) rendered after the channels. */
  children?: React.ReactNode
}

const digits = (phone?: string | null) => (phone ?? '').replace(/\D/g, '')

/**
 * The ways one customer link can be sent. Used by every share dialog so a channel added here appears everywhere,
 * rather than being added to one screen and quietly missing from the next.
 */
export function ShareChannels({ url, text, subject, phone, email, size = 'middle', children }: Props) {
  const { t } = useT()
  const number = digits(phone)
  // wa.me without a number still works: WhatsApp asks who to send it to.
  const whatsApp = () => window.open(`https://wa.me/${number.length >= 8 ? number : ''}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  // iOS wants sms:<number>&body=, Android sms:<number>?body=; "?&" is the form both accept.
  const sms = () => window.open(`sms:${number}?&body=${encodeURIComponent(text)}`, '_self')
  const mail = () => window.open(`mailto:${encodeURIComponent(email ?? '')}${subject ? `?subject=${encodeURIComponent(subject)}&body=` : '?body='}${encodeURIComponent(text)}`, '_self')
  /* LinkedIn has no URL that pre-fills a direct message — the only share URL posts publicly to the feed, which
     would expose a customer's private link. So the message goes to the clipboard and LinkedIn messaging opens
     for it to be pasted to the right person. */
  const linkedIn = async () => {
    try { await navigator.clipboard.writeText(text); message.success(t('sales.share.linkedInCopied')) }
    catch { message.info(t('sales.share.linkedInManual')) }
    window.open('https://www.linkedin.com/messaging/', '_blank', 'noopener,noreferrer')
  }
  const copy = () => navigator.clipboard.writeText(url).then(() => message.success(t('sales.share.linkCopied'))).catch(() => message.info(t('sales.share.copyManual')))

  return <div className="survey-share-actions">
    <Button className="share-whatsapp" size={size} icon={<WhatsAppOutlined />} onClick={whatsApp}>WhatsApp</Button>
    <Tooltip title={number ? undefined : t('sales.share.noPhone')}>
      <Button size={size} icon={<MessageOutlined />} disabled={!number} onClick={sms}>{t('sales.share.textMessage')}</Button>
    </Tooltip>
    <Tooltip title={email ? undefined : t('sales.share.noEmail')}>
      <Button size={size} icon={<MailOutlined />} onClick={mail}>{t('common.email')}</Button>
    </Tooltip>
    <Tooltip title={t('sales.share.linkedInTip')}>
      <Button size={size} icon={<LinkedinOutlined />} onClick={() => void linkedIn()}>LinkedIn</Button>
    </Tooltip>
    <Button size={size} icon={<CopyOutlined />} onClick={() => void copy()}>{t('sales.share.copyLink')}</Button>
    {typeof navigator !== 'undefined' && typeof navigator.share === 'function' &&
      <Button size={size} icon={<ShareAltOutlined />} onClick={() => void navigator.share({ title: subject, text, url }).catch(() => undefined)}>{t('sales.share.more')}</Button>}
    {children}
  </div>
}
