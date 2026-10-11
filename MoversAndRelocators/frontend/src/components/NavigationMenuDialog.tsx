import type { ReactNode } from 'react'
import { Modal } from 'antd'

export type NavigationTile = { key: string; label: string; icon: ReactNode; disabled?: boolean }

export function NavigationMenuDialog({ title, open, items, onClose, onSelect, columns = 2 }: {
  columns?: 2 | 3; title: string; open: boolean; items: NavigationTile[]; onClose: () => void; onSelect: (key: string) => void
}) {
  return <Modal className={columns===3?'navigation-menu-dialog navigation-menu-wide':'navigation-menu-dialog'} title={title} open={open} onCancel={onClose}
    footer={null} width={columns===3?720:456} centered destroyOnHidden>
    <div className="navigation-menu-tiles">
      {items.map(item => <button key={item.key} type="button" className="navigation-menu-tile"
        disabled={item.disabled} onClick={() => onSelect(item.key)}>
        <span className="navigation-menu-icon" aria-hidden="true">{item.icon}</span>
        <span>{item.label}</span>
      </button>)}
    </div>
  </Modal>
}

