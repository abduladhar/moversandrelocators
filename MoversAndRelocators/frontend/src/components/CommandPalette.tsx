import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Input, Modal, type InputRef } from 'antd'
import { EnterOutlined, SearchOutlined } from '@ant-design/icons'
import { useT } from '../i18n'

export type PaletteItem = { key: string; label: string; path: string; icon?: ReactNode }

const RECORDS = 'records:'

/** Ctrl K / ⌘ K: type part of a page, module or section name, pick with the arrows and Enter. With two or more
 * characters it also offers to find that text in the record lists (leads, quotations, pickups, customers…). */
export function CommandPalette({ items, recordLists = [], open, onClose, onSelect, onSearchRecords }: {
  items: PaletteItem[]; recordLists?: PaletteItem[]; open: boolean; onClose: () => void; onSelect: (key: string) => void; onSearchRecords?: (key: string, query: string) => void
}) {
  const { t } = useT()
  const [query, setQuery] = useState(''), [active, setActive] = useState(0)
  const input = useRef<InputRef>(null), list = useRef<HTMLUListElement>(null)
  useEffect(() => { if (open) { setQuery(''); setActive(0) } }, [open])
  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    if (!q) return items
    // Pages whose own name starts with the text come first, then name matches, then module/section matches.
    const rank = (x: PaletteItem) => { const label = x.label.toLocaleLowerCase(); return label.startsWith(q) ? 0 : label.includes(q) ? 1 : x.path.toLocaleLowerCase().includes(q) ? 2 : 3 }
    const pages = items.map(x => [x, rank(x)] as const).filter(([, r]) => r < 3).sort((a, b) => a[1] - b[1]).map(([x]) => x)
    const records = q.length >= 2 && onSearchRecords ? recordLists.map(x => ({ ...x, key: RECORDS + x.key, label: t('shell.palette.findIn', { query: query.trim(), page: x.label }) })) : []
    return [...pages, ...records]
  }, [items, recordLists, query, onSearchRecords, t])
  useEffect(() => { list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) }, [active])
  const choose = (key: string) => { if (key.startsWith(RECORDS)) onSearchRecords?.(key.slice(RECORDS.length), query.trim()); else onSelect(key); onClose() }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, matches.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && matches[active]) { e.preventDefault(); choose(matches[active].key) }
  }
  return <Modal className="command-palette" open={open} onCancel={onClose} footer={null} closable={false} width={600} style={{ top: 90 }} destroyOnHidden afterOpenChange={visible => { if (visible) input.current?.focus() }}>
    <Input ref={input} size="large" variant="borderless" prefix={<SearchOutlined />} placeholder={t('shell.palette.placeholder')} aria-label={t('shell.palette.placeholder')}
      value={query} onChange={e => { setQuery(e.target.value); setActive(0) }} onKeyDown={onKeyDown}
      role="combobox" aria-expanded aria-controls="command-palette-list" aria-activedescendant={matches[active] ? 'palette-' + matches[active].key.replace(':', '-') : undefined} />
    <ul id="command-palette-list" ref={list} role="listbox" className="command-palette-list">
      {matches.map((item, i) => <li key={item.key} id={'palette-' + item.key.replace(':', '-')} role="option" aria-selected={i === active} className={item.key.startsWith(RECORDS) ? 'is-record-search' : undefined}
        onMouseEnter={() => setActive(i)} onClick={() => choose(item.key)}>
        <span className="command-palette-icon" aria-hidden="true">{item.icon}</span>
        <span className="command-palette-text"><strong>{item.label}</strong><small>{item.path}</small></span>
        {i === active && <EnterOutlined className="command-palette-enter" aria-hidden="true" />}
      </li>)}
      {!matches.length && <li className="command-palette-empty" role="presentation">{t('shell.palette.empty', { query })}</li>}
    </ul>
    <div className="command-palette-hint">{t('shell.palette.hint')}</div>
  </Modal>
}
