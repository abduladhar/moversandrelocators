import { useState, type ReactNode } from 'react'
import { Button, Popover } from 'antd'
import { MoreOutlined } from '@ant-design/icons'
import { useT } from '../i18n'

/** Keep row commands and their existing confirmation prompts in a side popup. */
export function RowActions({ children }: { children: ReactNode }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  // Edit/Open buttons close the popup (their dialogs take over); matched on the label in the current language.
  const closing = new Set(['Edit', 'Open', t('common.edit'), t('common.open')])
  return <Popover trigger="click" placement="leftTop" open={open} onOpenChange={setOpen}
    classNames={{ root: 'row-actions-popup' }} title={t('common.actions')}
    content={<div className="row-actions-list" onClick={event => {
      const button = (event.target as HTMLElement).closest('button')
      if (button && closing.has(button.textContent?.trim() ?? '')) setOpen(false)
    }}>{children}</div>}>
    <Button type="text" className="row-actions-trigger" icon={<MoreOutlined />}
      aria-label={t('shell.rowActions.open')} aria-haspopup="dialog" aria-expanded={open}
      onClick={event => event.stopPropagation()} />
  </Popover>
}
