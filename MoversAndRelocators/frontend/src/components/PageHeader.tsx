import { RefreshButton } from './RefreshButton'
import { Button, Space, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'

export function PageHeader({ eyebrow, title, description, action, onAction, filters, onRefresh, refreshDisabled, refreshConfirm }: { eyebrow: string; title: string; description: string; action?: string; onAction?: () => void; filters?: ReactNode; onRefresh?: () => unknown | Promise<unknown>; refreshDisabled?: boolean; refreshConfirm?: string }) {
  return <div className="page-header"><div><Typography.Text className="eyebrow">{eyebrow}</Typography.Text><Typography.Title level={2}>{title}</Typography.Title><Typography.Paragraph type="secondary">{description}</Typography.Paragraph></div><Space wrap className="page-actions">{filters}{onRefresh && <RefreshButton onRefresh={onRefresh} disabled={refreshDisabled} confirmText={refreshConfirm} />}{action && <Button type="primary" icon={<PlusOutlined />} onClick={onAction}>{action}</Button>}</Space></div>
}

