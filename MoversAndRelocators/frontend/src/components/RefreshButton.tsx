import { useRef, useState } from 'react'
import { Button, Modal, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useT } from '../i18n'

export function RefreshButton({ onRefresh, disabled = false, confirmText }: { onRefresh: () => unknown | Promise<unknown>; disabled?: boolean; confirmText?: string }) {
  const { t } = useT()
  const [loading, setLoading] = useState(false)
  const pending = useRef(false)
  const refresh = async () => {
    if (pending.current) return
    pending.current = true; setLoading(true)
    try { await onRefresh() }
    catch (error) { message.error(error instanceof Error ? error.message : t('shell.refresh.failed')) }
    finally { pending.current = false; setLoading(false) }
  }
  return <Button icon={<ReloadOutlined />} loading={loading} disabled={disabled} onClick={() => {
    if (confirmText) Modal.confirm({ title: t('shell.refresh.confirmTitle'), content: confirmText, okText: t('common.refresh'), cancelText: t('common.cancel'), onOk: refresh })
    else void refresh()
  }}>{t('common.refresh')}</Button>
}
