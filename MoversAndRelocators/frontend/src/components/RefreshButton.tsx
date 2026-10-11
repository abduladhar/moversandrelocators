import { useRef, useState } from 'react'
import { Button, Modal, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'

export function RefreshButton({ onRefresh, disabled = false, confirmText }: { onRefresh: () => unknown | Promise<unknown>; disabled?: boolean; confirmText?: string }) {
  const [loading, setLoading] = useState(false)
  const pending = useRef(false)
  const refresh = async () => {
    if (pending.current) return
    pending.current = true; setLoading(true)
    try { await onRefresh() }
    catch (error) { message.error(error instanceof Error ? error.message : 'Unable to refresh') }
    finally { pending.current = false; setLoading(false) }
  }
  return <Button icon={<ReloadOutlined />} loading={loading} disabled={disabled} onClick={() => {
    if (confirmText) Modal.confirm({ title: 'Refresh page data?', content: confirmText, okText: 'Refresh', onOk: refresh })
    else void refresh()
  }}>Refresh</Button>
}
