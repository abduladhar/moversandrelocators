import { useState, type ReactNode } from 'react'
import { Button, Popover } from 'antd'
import { MoreOutlined } from '@ant-design/icons'

/** Keep row commands and their existing confirmation prompts in a side popup. */
export function RowActions({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return <Popover trigger="click" placement="leftTop" open={open} onOpenChange={setOpen}
    classNames={{ root: 'row-actions-popup' }} title="Actions"
    content={<div className="row-actions-list" onClick={event => {
      const button = (event.target as HTMLElement).closest('button')
      if (button && /^(Edit|Open)$/.test(button.textContent?.trim() ?? '')) setOpen(false)
    }}>{children}</div>}>
    <Button type="text" className="row-actions-trigger" icon={<MoreOutlined />}
      aria-label="Open row actions" aria-haspopup="dialog" aria-expanded={open}
      onClick={event => event.stopPropagation()} />
  </Popover>
}
