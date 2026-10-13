import { Select } from 'antd'
import { GlobalOutlined } from '@ant-design/icons'
import { languages, useT, type Language } from '.'

/** Language picker; the choice is remembered on this device. */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useT()
  return <Select<Language> size={compact ? 'small' : 'middle'} value={language} onChange={setLanguage} aria-label={t('common.language')}
    className="language-switcher" popupMatchSelectWidth={false} suffixIcon={<GlobalOutlined />}
    options={languages.map(l => ({ value: l.code, label: <span lang={l.code} dir={l.dir}>{l.name}</span> }))} />
}
