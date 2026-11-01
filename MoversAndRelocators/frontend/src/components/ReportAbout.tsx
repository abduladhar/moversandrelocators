import { useState, type ReactNode } from 'react'
import { Button } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import { useT } from '../i18n'

/** What a report includes, behind an "About this report" link so the figures come first (design step 5). */
export function ReportAbout({ title, description }: { title: ReactNode; description: ReactNode }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  return <div className="report-about">
    <Button type="link" size="small" icon={<InfoCircleOutlined />} aria-expanded={open} onClick={() => setOpen(value => !value)}>{t('reports.about')}</Button>
    {open && <div className="report-about-body"><strong>{title}</strong><p>{description}</p></div>}
  </div>
}
