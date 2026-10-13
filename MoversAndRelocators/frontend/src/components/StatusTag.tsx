import { Tag } from 'antd'
import { useT } from '../i18n'

export function StatusTag({ active }: { active: boolean }) {
  const { t } = useT()
  return <Tag color={active ? 'success' : 'default'}>{active ? t('common.active') : t('common.inactive')}</Tag>
}
