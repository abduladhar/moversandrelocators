import { Tag } from 'antd'

export function StatusTag({ active }: { active: boolean }) {
  return <Tag color={active ? 'success' : 'default'}>{active ? 'Active' : 'Inactive'}</Tag>
}
